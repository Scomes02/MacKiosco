'use strict';

/**
 * Genera un historial de demostración REALISTA y coherente:
 * simula día por día la actividad del kiosco (apertura de caja, ventas, anulaciones,
 * reposición de mercadería, retiros y cierre de caja) partiendo del stock inicial.
 *
 * Todo queda guardado en MySQL con las mismas reglas que usa el sistema:
 * cada venta descuenta stock y deja su movimiento, cada compra lo suma, etc.
 * La simulación usa un generador pseudoaleatorio con semilla fija, por lo que
 * siempre produce el mismo tipo de datos.
 */

const { aFechaHora } = require('../src/utils/fechas');

const DIAS = 45;
const MONTO_INICIAL_CAJA = 20000;
const ADMIN = 1;
const CAJEROS = [2, 3];

// Popularidad relativa de cada categoría (id de categoría -> peso).
const PESO_CATEGORIA = { 1: 10, 2: 6, 3: 3, 4: 4, 5: 5, 6: 9, 7: 5, 8: 8, 9: 5, 10: 6, 11: 9, 12: 2, 13: 3, 14: 3, 15: 2 };
// Cantidad relativa de ventas por hora, de 8 a 21 hs.
const PESO_HORA = [3, 4, 5, 6, 8, 9, 6, 4, 5, 7, 9, 10, 8, 5];
// Método de pago (id) -> peso.
const PESO_METODO = [
  [1, 50],
  [2, 25],
  [3, 13],
  [4, 7],
  [5, 5],
];
const MOTIVOS_ANULACION = [
  'Error al cargar los productos',
  'El cliente se arrepintió de la compra',
  'Se cobró con el método de pago equivocado',
  'Producto en mal estado, se devolvió el dinero',
];

/** Generador pseudoaleatorio determinístico (mulberry32). */
function crearAzar(semilla) {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function insertarEnLotes(conn, sql, filas, tamano = 1000) {
  for (let i = 0; i < filas.length; i += tamano) {
    await conn.query(sql, [filas.slice(i, i + tamano)]);
  }
}

async function generarHistorial(conn) {
  const azar = crearAzar(20260101);
  const entero = (min, max) => min + Math.floor(azar() * (max - min + 1));
  const probabilidad = (p) => azar() < p;
  const elegirPonderado = (pares) => {
    const total = pares.reduce((suma, [, peso]) => suma + peso, 0);
    let punto = azar() * total;
    for (const [valor, peso] of pares) {
      punto -= peso;
      if (punto <= 0) return valor;
    }
    return pares[pares.length - 1][0];
  };

  const [productos] = await conn.query(
    `SELECT id, codigo, nombre, categoria_id, proveedor_id, precio_costo, precio_venta, stock, stock_minimo, activo
       FROM productos ORDER BY id`
  );
  const [clientes] = await conn.query('SELECT id FROM clientes');
  const [proveedores] = await conn.query('SELECT id, razon_social FROM proveedores ORDER BY id');

  for (const p of productos) {
    p.precio_costo = Number(p.precio_costo);
    p.precio_venta = Number(p.precio_venta);
    p.peso = (PESO_CATEGORIA[p.categoria_id] || 2) * (0.4 + azar() * 1.2);
  }

  const ahora = new Date();
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
  const diaNumero = (n) => new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - n);
  const conHora = (dia, hora, minuto = 0, segundo = 0) =>
    new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora, minuto, segundo);

  // Filas a insertar
  const cajas = [];
  const cajaMovimientos = [];
  const ventas = [];
  const ventaDetalles = [];
  const ventaPagos = [];
  const compras = [];
  const compraDetalles = [];
  const movimientos = [];

  let cajaId = 0;
  let ventaId = 0;
  let compraId = 0;

  const moverStock = (producto, tipo, cantidad, fecha, extra) => {
    const anterior = producto.stock;
    producto.stock += cantidad;
    movimientos.push([
      producto.id,
      tipo,
      cantidad,
      anterior,
      producto.stock,
      extra.motivo,
      extra.venta_id || null,
      extra.compra_id || null,
      extra.usuario_id,
      aFechaHora(fecha),
    ]);
  };

  const reponerMercaderia = (fecha) => {
    for (const proveedor of proveedores) {
      const aReponer = productos.filter(
        (p) => p.proveedor_id === proveedor.id && p.activo && p.stock <= p.stock_minimo * 1.5
      );
      if (!aReponer.length) continue;

      compraId += 1;
      let total = 0;
      for (const p of aReponer) {
        const cantidad = Math.max(6, Math.ceil((p.stock_minimo * 4 - p.stock) / 6) * 6);
        const subtotal = cantidad * p.precio_costo;
        total += subtotal;
        compraDetalles.push([compraId, p.id, cantidad, p.precio_costo, subtotal]);
        moverStock(p, 'COMPRA', cantidad, fecha, {
          motivo: `Compra N° ${compraId} a ${proveedor.razon_social}`,
          compra_id: compraId,
          usuario_id: ADMIN,
        });
      }
      compras.push([
        compraId,
        aFechaHora(fecha),
        proveedor.id,
        ADMIN,
        `A-0001-${String(1000 + compraId).padStart(8, '0')}`,
        total,
        null,
      ]);
    }
  };

  const elegirProductos = (cantidadDeseada) => {
    const disponibles = productos.filter((p) => p.activo && p.stock > 0);
    const elegidos = [];
    for (let i = 0; i < cantidadDeseada && disponibles.length; i += 1) {
      const producto = elegirPonderado(disponibles.map((p) => [p, p.peso]));
      disponibles.splice(disponibles.indexOf(producto), 1);
      elegidos.push(producto);
    }
    return elegidos;
  };

  for (let n = DIAS; n >= 0; n -= 1) {
    const dia = diaNumero(n);
    const esHoy = n === 0;
    const diaSemana = dia.getDay(); // 0 = domingo

    let apertura = conHora(dia, 8, entero(0, 10));
    let cierre = conHora(dia, 22, entero(0, 20));
    if (esHoy) {
      if (apertura >= ahora) apertura = new Date(Math.max(dia.getTime(), ahora.getTime() - 10 * 60 * 1000));
      cierre = ahora;
    }

    const cajero = diaSemana === 0 ? ADMIN : CAJEROS[n % 2];
    cajaId += 1;
    let efectivoEnCaja = MONTO_INICIAL_CAJA;
    let ingresos = 0;
    let egresos = 0;
    let ventasEfectivo = 0;

    // --- Armar los eventos del día (ventas, reposición y movimientos de caja) ---
    const eventos = [];
    let cantidadVentas = entero(30, 48);
    if (diaSemana === 5 || diaSemana === 6) cantidadVentas += 10;
    if (diaSemana === 0) cantidadVentas -= 8;
    // Se sortean los horarios de todo el día; para hoy solo quedan las ventas anteriores a este momento.
    for (let i = 0; i < cantidadVentas; i += 1) {
      const hora = 8 + elegirPonderado(PESO_HORA.map((peso, indice) => [indice, peso]));
      const fecha = conHora(dia, hora, entero(0, 59), entero(0, 59));
      if (fecha > apertura && fecha < cierre) eventos.push({ tipo: 'venta', fecha });
    }
    // Reposición de mercadería: lunes y jueves (no en los últimos días, para que haya alertas de stock).
    if ((diaSemana === 1 || diaSemana === 4) && n > 4) {
      eventos.push({ tipo: 'reposicion', fecha: conHora(dia, 9, 30) });
    }
    if (!esHoy && probabilidad(0.12)) {
      eventos.push({ tipo: 'egreso', fecha: conHora(dia, 11, entero(0, 50)), monto: entero(3, 8) * 1000, concepto: 'Compra de artículos de limpieza' });
    }
    if (!esHoy && probabilidad(0.08)) {
      eventos.push({ tipo: 'ingreso', fecha: conHora(dia, 14, entero(0, 50)), monto: entero(5, 10) * 1000, concepto: 'Ingreso de cambio (billetes chicos)' });
    }
    if (!esHoy) eventos.push({ tipo: 'retiro', fecha: conHora(dia, 21, 40) });
    eventos.sort((a, b) => a.fecha - b.fecha);

    // --- Procesar los eventos en orden cronológico ---
    for (let i = 0; i < eventos.length; i += 1) {
      const evento = eventos[i];

      if (evento.tipo === 'reposicion') {
        reponerMercaderia(evento.fecha);
      } else if (evento.tipo === 'egreso' || evento.tipo === 'ingreso') {
        if (evento.tipo === 'egreso' && evento.monto > efectivoEnCaja) continue;
        const signo = evento.tipo === 'ingreso' ? 1 : -1;
        efectivoEnCaja += signo * evento.monto;
        if (signo > 0) ingresos += evento.monto;
        else egresos += evento.monto;
        cajaMovimientos.push([cajaId, evento.tipo.toUpperCase(), evento.monto, evento.concepto, cajero, aFechaHora(evento.fecha)]);
      } else if (evento.tipo === 'retiro') {
        // Retiro de efectivo antes del cierre: se deja aproximadamente el fondo de caja.
        const retiro = Math.floor(((efectivoEnCaja - MONTO_INICIAL_CAJA) * 0.8) / 10000) * 10000;
        if (retiro > 0) {
          efectivoEnCaja -= retiro;
          egresos += retiro;
          cajaMovimientos.push([cajaId, 'EGRESO', retiro, 'Retiro de efectivo para depósito', cajero, aFechaHora(evento.fecha)]);
        }
      } else if (evento.tipo === 'anulacion') {
        const { venta } = evento;
        for (const item of venta.items) {
          moverStock(item.producto, 'ANULACION_VENTA', item.cantidad, evento.fecha, {
            motivo: `Anulación de venta N° ${venta.id}: ${venta.motivo}`,
            venta_id: venta.id,
            usuario_id: ADMIN,
          });
        }
        efectivoEnCaja -= venta.efectivo;
        ventasEfectivo -= venta.efectivo;
      } else {
        // ---- Venta ----
        const cantidadItems = elegirPonderado([[1, 45], [2, 30], [3, 17], [4, 8]]);
        const items = elegirProductos(cantidadItems).map((producto) => ({
          producto,
          cantidad: Math.min(producto.stock, elegirPonderado([[1, 75], [2, 18], [3, 7]])),
        }));
        if (!items.length) continue;

        ventaId += 1;
        const usuarioVenta = probabilidad(0.85) ? cajero : ADMIN;
        let subtotal = 0;
        for (const item of items) {
          const { producto, cantidad } = item;
          const subtotalLinea = producto.precio_venta * cantidad;
          subtotal += subtotalLinea;
          ventaDetalles.push([ventaId, producto.id, producto.codigo, producto.nombre, cantidad, producto.precio_venta, producto.precio_costo, subtotalLinea]);
          moverStock(producto, 'VENTA', -cantidad, evento.fecha, {
            motivo: `Venta N° ${ventaId}`,
            venta_id: ventaId,
            usuario_id: usuarioVenta,
          });
        }

        const porcentaje = probabilidad(0.04) ? 10 : probabilidad(0.02) ? 5 : 0;
        const descuento = Math.round(subtotal * porcentaje) / 100;
        const total = Math.round((subtotal - descuento) * 100) / 100;

        // Pagos: casi siempre un solo método; a veces efectivo + Mercado Pago.
        let efectivo = 0;
        const parteEfectivo = Math.floor(total / 2000) * 1000;
        if (probabilidad(0.03) && parteEfectivo > 0 && parteEfectivo < total) {
          ventaPagos.push([ventaId, 1, parteEfectivo]);
          ventaPagos.push([ventaId, 2, Math.round((total - parteEfectivo) * 100) / 100]);
          efectivo = parteEfectivo;
        } else {
          const metodo = elegirPonderado(PESO_METODO);
          ventaPagos.push([ventaId, metodo, total]);
          if (metodo === 1) efectivo = total;
        }
        efectivoEnCaja += efectivo;
        ventasEfectivo += efectivo;

        const cliente = probabilidad(0.08) && clientes.length ? clientes[entero(0, clientes.length - 1)].id : null;

        // Algunas ventas de días anteriores se anulan a los pocos minutos.
        let anulacion = [null, null, null];
        let estado = 'COMPLETADA';
        const fechaAnulacion = new Date(evento.fecha.getTime() + entero(2, 15) * 60 * 1000);
        if (!esHoy && probabilidad(0.012) && fechaAnulacion < cierre) {
          estado = 'ANULADA';
          const motivo = MOTIVOS_ANULACION[entero(0, MOTIVOS_ANULACION.length - 1)];
          anulacion = [aFechaHora(fechaAnulacion), ADMIN, motivo];
          const pendiente = { tipo: 'anulacion', fecha: fechaAnulacion, venta: { id: ventaId, items, efectivo, motivo } };
          let posicion = i + 1;
          while (posicion < eventos.length && eventos[posicion].fecha <= fechaAnulacion) posicion += 1;
          eventos.splice(posicion, 0, pendiente);
        }

        ventas.push([ventaId, aFechaHora(evento.fecha), usuarioVenta, cliente, cajaId, subtotal, porcentaje, descuento, total, estado, ...anulacion]);
      }
    }

    // --- Cierre de caja (las cajas de días anteriores quedan cerradas; la de hoy, abierta) ---
    if (esHoy) {
      cajas.push([cajaId, 'ABIERTA', cajero, aFechaHora(apertura), MONTO_INICIAL_CAJA, null, null, null, null, null, null]);
    } else {
      const esperado = MONTO_INICIAL_CAJA + ventasEfectivo + ingresos - egresos;
      const diferencia = elegirPonderado([[0, 70], [-200, 8], [-500, 6], [100, 6], [300, 5], [-1000, 5]]);
      cajas.push([
        cajaId,
        'CERRADA',
        cajero,
        aFechaHora(apertura),
        MONTO_INICIAL_CAJA,
        cajero,
        aFechaHora(cierre),
        esperado,
        esperado + diferencia,
        diferencia,
        diferencia === 0 ? null : diferencia < 0 ? 'Faltante: posible error al dar el vuelto' : 'Sobrante de caja',
      ]);
    }
  }

  // ------------------------------------------------------------ Guardar todo en una transacción
  const inicio = aFechaHora(conHora(diaNumero(DIAS), 7, 0));
  await conn.beginTransaction();
  try {
    await conn.query("UPDATE movimientos_stock SET fecha = ? WHERE tipo = 'INICIAL'", [inicio]);
    await conn.query('UPDATE productos SET creado_en = ?', [inicio]);

    await insertarEnLotes(
      conn,
      `INSERT INTO cajas (id, estado, usuario_apertura_id, abierta_en, monto_inicial, usuario_cierre_id, cerrada_en,
                          monto_esperado, monto_contado, diferencia, observaciones) VALUES ?`,
      cajas
    );
    await insertarEnLotes(
      conn,
      'INSERT INTO caja_movimientos (caja_id, tipo, monto, concepto, usuario_id, fecha) VALUES ?',
      cajaMovimientos
    );
    await insertarEnLotes(
      conn,
      `INSERT INTO ventas (id, fecha, usuario_id, cliente_id, caja_id, subtotal, descuento_porcentaje, descuento_monto,
                           total, estado, anulada_en, anulada_por, motivo_anulacion) VALUES ?`,
      ventas
    );
    await insertarEnLotes(
      conn,
      `INSERT INTO venta_detalles (venta_id, producto_id, producto_codigo, producto_nombre, cantidad, precio_unitario,
                                   precio_costo, subtotal) VALUES ?`,
      ventaDetalles
    );
    await insertarEnLotes(conn, 'INSERT INTO venta_pagos (venta_id, metodo_pago_id, monto) VALUES ?', ventaPagos);
    await insertarEnLotes(
      conn,
      'INSERT INTO compras (id, fecha, proveedor_id, usuario_id, numero_comprobante, total, observaciones) VALUES ?',
      compras
    );
    await insertarEnLotes(
      conn,
      'INSERT INTO compra_detalles (compra_id, producto_id, cantidad, costo_unitario, subtotal) VALUES ?',
      compraDetalles
    );
    await insertarEnLotes(
      conn,
      `INSERT INTO movimientos_stock (producto_id, tipo, cantidad, stock_anterior, stock_resultante, motivo,
                                      venta_id, compra_id, usuario_id, fecha) VALUES ?`,
      movimientos
    );
    for (const p of productos) {
      await conn.query('UPDATE productos SET stock = ? WHERE id = ?', [p.stock, p.id]);
    }
    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  }

  return {
    dias: DIAS + 1,
    cajas: cajas.length,
    ventas: ventas.length,
    compras: compras.length,
    movimientos: movimientos.length,
  };
}

module.exports = { generarHistorial };
