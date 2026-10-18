'use strict';

const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { paginar } = require('../utils/paginacion');
const { aCentavos, aPesos } = require('../utils/dinero');
const comprasRepo = require('../repositories/compras.repository');
const productosRepo = require('../repositories/productos.repository');
const proveedoresRepo = require('../repositories/proveedores.repository');
const stockRepo = require('../repositories/stock.repository');

async function listar(filtros) {
  const { items, total, resumen } = await comprasRepo.listar(filtros);
  return { ...paginar({ items, total, page: filtros.page, limit: filtros.limit }), resumen };
}

async function obtener(id) {
  const compra = await comprasRepo.obtenerPorId(id);
  if (!compra) throw AppError.notFound('La compra no existe.');
  return compra;
}

/**
 * Registra una compra a un proveedor (ingreso de mercadería):
 * suma el stock, opcionalmente actualiza el costo y deja el movimiento asentado.
 */
async function crear(datos, usuario) {
  const ids = datos.items.map((i) => i.producto_id);
  if (new Set(ids).size !== ids.length) {
    throw AppError.badRequest('Hay productos repetidos en la compra. Unificá las cantidades en un solo renglón.');
  }

  const compraId = await withTransaction(async (conn) => {
    const proveedor = await proveedoresRepo.obtenerPorId(datos.proveedor_id, conn);
    if (!proveedor || !proveedor.activo) {
      throw AppError.badRequest('El proveedor seleccionado no existe o está inactivo.');
    }

    const productos = await productosRepo.obtenerParaActualizar(ids, conn);
    const porId = new Map(productos.map((p) => [p.id, p]));

    let totalCentavos = 0;
    const detalles = datos.items.map((item) => {
      const producto = porId.get(item.producto_id);
      if (!producto || producto.eliminado_en) {
        throw AppError.badRequest('Uno de los productos de la compra ya no existe. Quitalo e intentá nuevamente.');
      }
      const subtotalCentavos = aCentavos(item.costo_unitario) * item.cantidad;
      totalCentavos += subtotalCentavos;
      return { ...item, subtotal: aPesos(subtotalCentavos), stock_anterior: producto.stock };
    });

    const nuevaCompraId = await comprasRepo.crear(
      {
        proveedor_id: datos.proveedor_id,
        usuario_id: usuario.id,
        numero_comprobante: datos.numero_comprobante,
        total: aPesos(totalCentavos),
        observaciones: datos.observaciones,
      },
      conn
    );
    await comprasRepo.insertarDetalles(nuevaCompraId, detalles, conn);

    for (const detalle of detalles) {
      const nuevoStock = detalle.stock_anterior + detalle.cantidad;
      if (datos.actualizar_costos) {
        await productosRepo.actualizarStockYCosto(detalle.producto_id, nuevoStock, detalle.costo_unitario, conn);
      } else {
        await productosRepo.actualizarStock(detalle.producto_id, nuevoStock, conn);
      }
      await stockRepo.registrarMovimiento(
        {
          producto_id: detalle.producto_id,
          tipo: 'COMPRA',
          cantidad: detalle.cantidad,
          stock_anterior: detalle.stock_anterior,
          stock_resultante: nuevoStock,
          motivo: `Compra N° ${nuevaCompraId} a ${proveedor.razon_social}`,
          compra_id: nuevaCompraId,
          usuario_id: usuario.id,
        },
        conn
      );
    }

    return nuevaCompraId;
  });

  return comprasRepo.obtenerPorId(compraId);
}

module.exports = { listar, obtener, crear };
