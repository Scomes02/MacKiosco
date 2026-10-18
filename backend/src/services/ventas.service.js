'use strict';

const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { paginar } = require('../utils/paginacion');
const { aCentavos, aPesos } = require('../utils/dinero');
const ventasRepo = require('../repositories/ventas.repository');
const productosRepo = require('../repositories/productos.repository');
const clientesRepo = require('../repositories/clientes.repository');
const cajasRepo = require('../repositories/cajas.repository');
const metodosRepo = require('../repositories/metodosPago.repository');
const stockRepo = require('../repositories/stock.repository');
const facturacion = require('./facturacion.service');

const formatoPesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

async function listar(filtros) {
  const { items, total, resumen } = await ventasRepo.listar(filtros);
  return { ...paginar({ items, total, page: filtros.page, limit: filtros.limit }), resumen };
}

async function obtener(id) {
  const venta = await ventasRepo.obtenerPorId(id);
  if (!venta) throw AppError.notFound('La venta no existe.');
  return venta;
}

/** Suma las cantidades si el mismo producto vino repetido en la lista. */
function agruparItems(items) {
  const cantidades = new Map();
  for (const item of items) {
    cantidades.set(item.producto_id, (cantidades.get(item.producto_id) || 0) + item.cantidad);
  }
  return cantidades;
}

function agruparPagos(pagos) {
  const montos = new Map();
  for (const pago of pagos) {
    montos.set(pago.metodo_pago_id, (montos.get(pago.metodo_pago_id) || 0) + aCentavos(pago.monto));
  }
  return montos;
}

/**
 * Registra una venta completa de forma atómica:
 * valida caja, cliente, productos, stock y pagos; guarda cabecera, detalle y pagos;
 * descuenta el stock y deja asentado cada movimiento. Si algo falla, no se guarda nada.
 *
 * Los precios SIEMPRE se toman de la base de datos, nunca de lo que envía el navegador.
 *
 * Comprobante: RECIBO (interno, no fiscal) o FACTURA (electrónica, con CAE de ARCA).
 * La factura se pide a ARCA después de guardar la venta: si ARCA no responde, la venta
 * igual queda registrada y la factura queda pendiente para reintentar.
 */
async function crear(datos, usuario) {
  const cantidades = agruparItems(datos.items);
  const montosPorMetodo = agruparPagos(datos.pagos);
  if (datos.comprobante === 'FACTURA') await facturacion.exigirOperativa();

  const ventaId = await withTransaction(async (conn) => {
    // 1. Tiene que haber una caja abierta (queda bloqueada hasta terminar la venta).
    const caja = await cajasRepo.obtenerAbiertaParaActualizar(conn);
    if (!caja) {
      throw new AppError(409, 'No hay una caja abierta. Abrí la caja para poder registrar ventas.', 'CAJA_CERRADA');
    }

    // 2. Cliente (opcional).
    if (datos.cliente_id) {
      const cliente = await clientesRepo.obtenerPorId(datos.cliente_id, conn);
      if (!cliente || !cliente.activo) {
        throw AppError.badRequest('El cliente seleccionado no existe o está inactivo.');
      }
    }

    // 3. Productos: se bloquean sus filas y se valida existencia, estado y stock.
    const productos = await productosRepo.obtenerParaActualizar([...cantidades.keys()], conn);
    const porId = new Map(productos.map((p) => [p.id, p]));
    const detalles = [];
    let subtotalCentavos = 0;

    for (const [productoId, cantidad] of cantidades) {
      const producto = porId.get(productoId);
      if (!producto || producto.eliminado_en) {
        throw new AppError(
          400,
          'Uno de los productos del carrito ya no existe. Quitalo e intentá nuevamente.',
          'PRODUCTO_INEXISTENTE'
        );
      }
      if (!producto.activo) {
        throw new AppError(400, `"${producto.nombre}" está inactivo y no se puede vender.`, 'PRODUCTO_INACTIVO');
      }
      if (producto.stock < cantidad) {
        const mensaje =
          producto.stock === 0
            ? `No hay stock de "${producto.nombre}".`
            : `No hay stock suficiente de "${producto.nombre}". Disponible: ${producto.stock}.`;
        throw new AppError(409, mensaje, 'STOCK_INSUFICIENTE');
      }

      const subtotalLinea = aCentavos(producto.precio_venta) * cantidad;
      subtotalCentavos += subtotalLinea;
      detalles.push({
        producto_id: producto.id,
        producto_codigo: producto.codigo,
        producto_nombre: producto.nombre,
        cantidad,
        precio_unitario: producto.precio_venta,
        precio_costo: producto.precio_costo,
        iva: producto.iva,
        subtotal: aPesos(subtotalLinea),
        stock_anterior: producto.stock,
      });
    }

    // 4. Totales calculados en el servidor.
    const descuentoCentavos = Math.round((subtotalCentavos * datos.descuento_porcentaje) / 100);
    const totalCentavos = subtotalCentavos - descuentoCentavos;
    if (totalCentavos <= 0) {
      throw AppError.badRequest('El total de la venta debe ser mayor a cero.');
    }

    // 5. Pagos: métodos válidos y suma exactamente igual al total.
    const metodos = await metodosRepo.obtenerPorIds([...montosPorMetodo.keys()], conn);
    const metodosPorId = new Map(metodos.map((m) => [m.id, m]));
    let pagadoCentavos = 0;
    const pagos = [];
    for (const [metodoId, montoCentavos] of montosPorMetodo) {
      const metodo = metodosPorId.get(metodoId);
      if (!metodo || !metodo.activo) {
        throw AppError.badRequest('El método de pago seleccionado no existe o está inactivo.');
      }
      pagadoCentavos += montoCentavos;
      pagos.push({ metodo_pago_id: metodoId, monto: aPesos(montoCentavos) });
    }
    if (pagadoCentavos !== totalCentavos) {
      throw new AppError(
        400,
        `Los pagos (${formatoPesos.format(aPesos(pagadoCentavos))}) no coinciden con el total de la venta ` +
          `(${formatoPesos.format(aPesos(totalCentavos))}). Actualizá el carrito e intentá nuevamente.`,
        'PAGO_NO_COINCIDE'
      );
    }

    // 6. Guardar venta, detalle y pagos.
    const nuevaVentaId = await ventasRepo.crear(
      {
        usuario_id: usuario.id,
        cliente_id: datos.cliente_id,
        caja_id: caja.id,
        subtotal: aPesos(subtotalCentavos),
        descuento_porcentaje: datos.descuento_porcentaje,
        descuento_monto: aPesos(descuentoCentavos),
        total: aPesos(totalCentavos),
        comprobante: datos.comprobante,
        observaciones: datos.observaciones,
      },
      conn
    );
    await ventasRepo.insertarDetalles(nuevaVentaId, detalles, conn);
    await ventasRepo.insertarPagos(nuevaVentaId, pagos, conn);

    // 7. Descontar stock y registrar los movimientos.
    for (const detalle of detalles) {
      const nuevoStock = detalle.stock_anterior - detalle.cantidad;
      await productosRepo.actualizarStock(detalle.producto_id, nuevoStock, conn);
      await stockRepo.registrarMovimiento(
        {
          producto_id: detalle.producto_id,
          tipo: 'VENTA',
          cantidad: -detalle.cantidad,
          stock_anterior: detalle.stock_anterior,
          stock_resultante: nuevoStock,
          motivo: `Venta N° ${nuevaVentaId}`,
          venta_id: nuevaVentaId,
          usuario_id: usuario.id,
        },
        conn
      );
    }

    return nuevaVentaId;
  });

  if (datos.comprobante === 'FACTURA') {
    try {
      await facturacion.emitirFactura(ventaId, usuario);
    } catch (error) {
      // La venta ya está guardada: un problema al facturar no debe hacerla fallar.
      console.error(`[arca] No se pudo iniciar la factura de la venta ${ventaId}: ${error.message}`);
    }
  }

  return ventasRepo.obtenerPorId(ventaId);
}

/** Emite o reintenta la factura electrónica de una venta ya registrada. */
async function facturar(id, usuario) {
  await facturacion.emitirFactura(id, usuario);
  return ventasRepo.obtenerPorId(id);
}

const MENSAJE_CAJA_CERRADA =
  'No se puede anular: la caja de esta venta ya fue cerrada. ' +
  'Si devolvés dinero, registralo como un egreso en la caja actual.';

/**
 * Anula una venta: la marca como ANULADA y devuelve el stock de cada producto.
 * Solo se permite mientras la caja de esa venta siga abierta, para no alterar arqueos ya cerrados.
 * Si la venta tiene una factura autorizada, primero se emite su nota de crédito en ARCA.
 */
async function anular(id, { motivo }, usuario) {
  const actual = await ventasRepo.obtenerPorId(id);
  if (!actual) throw AppError.notFound('La venta no existe.');
  if (actual.estado === 'ANULADA') throw AppError.conflict('La venta ya estaba anulada.');
  if (actual.caja_estado !== 'ABIERTA') throw AppError.conflict(MENSAJE_CAJA_CERRADA);
  await facturacion.emitirNotaDeCreditoSiCorresponde(id, usuario);

  await withTransaction(async (conn) => {
    const venta = await ventasRepo.obtenerParaAnular(id, conn);
    if (!venta) throw AppError.notFound('La venta no existe.');
    if (venta.estado === 'ANULADA') throw AppError.conflict('La venta ya estaba anulada.');
    if (venta.caja_estado !== 'ABIERTA') throw AppError.conflict(MENSAJE_CAJA_CERRADA);

    const detalles = await ventasRepo.listarDetalles(id, conn);
    const productos = await productosRepo.obtenerParaActualizar(
      detalles.map((d) => d.producto_id),
      conn
    );
    const porId = new Map(productos.map((p) => [p.id, p]));

    for (const detalle of detalles) {
      const producto = porId.get(detalle.producto_id);
      const nuevoStock = producto.stock + detalle.cantidad;
      producto.stock = nuevoStock;
      await productosRepo.actualizarStock(producto.id, nuevoStock, conn);
      await stockRepo.registrarMovimiento(
        {
          producto_id: producto.id,
          tipo: 'ANULACION_VENTA',
          cantidad: detalle.cantidad,
          stock_anterior: nuevoStock - detalle.cantidad,
          stock_resultante: nuevoStock,
          motivo: `Anulación de venta N° ${id}: ${motivo}`,
          venta_id: id,
          usuario_id: usuario.id,
        },
        conn
      );
    }

    await ventasRepo.marcarAnulada(id, { usuario_id: usuario.id, motivo }, conn);
  });

  return ventasRepo.obtenerPorId(id);
}

module.exports = { listar, obtener, crear, facturar, anular };
