'use strict';

const { query } = require('../config/db');

/**
 * Consultas de estadísticas. Todas trabajan sobre ventas COMPLETADAS dentro de
 * un rango [desde, hasta) expresado como fechas 'YYYY-MM-DD HH:MM:SS'.
 */

const RANGO = "v.estado = 'COMPLETADA' AND v.fecha >= ? AND v.fecha < ?";

/** Totales generales del período: ventas, importe, descuentos, costo, ganancia y unidades. */
async function totales(desde, hasta) {
  const [ventas, detalle, anuladas] = await Promise.all([
    query(
      `SELECT COUNT(*) AS ventas,
              COALESCE(SUM(v.total), 0) AS total,
              COALESCE(SUM(v.descuento_monto), 0) AS descuentos
         FROM ventas v WHERE ${RANGO}`,
      [desde, hasta]
    ),
    query(
      `SELECT COALESCE(SUM(d.cantidad), 0) AS unidades,
              COALESCE(SUM(d.cantidad * d.precio_costo), 0) AS costo
         FROM venta_detalles d JOIN ventas v ON v.id = d.venta_id
        WHERE ${RANGO}`,
      [desde, hasta]
    ),
    query("SELECT COUNT(*) AS anuladas FROM ventas v WHERE v.estado = 'ANULADA' AND v.fecha >= ? AND v.fecha < ?", [
      desde,
      hasta,
    ]),
  ]);

  const total = Number(ventas[0].total);
  const costo = Number(detalle[0].costo);
  const cantidad = ventas[0].ventas;
  return {
    ventas: cantidad,
    total,
    descuentos: Number(ventas[0].descuentos),
    unidades: Number(detalle[0].unidades),
    costo,
    ganancia: Math.round((total - costo) * 100) / 100,
    ticket_promedio: cantidad ? Math.round((total / cantidad) * 100) / 100 : 0,
    anuladas: anuladas[0].anuladas,
  };
}

async function porDia(desde, hasta) {
  const filas = await query(
    `SELECT DATE_FORMAT(v.fecha, '%Y-%m-%d') AS dia, COUNT(*) AS ventas, SUM(v.total) AS total
       FROM ventas v WHERE ${RANGO}
      GROUP BY dia ORDER BY dia`,
    [desde, hasta]
  );
  return filas.map((f) => ({ ...f, total: Number(f.total) }));
}

async function porHora(desde, hasta) {
  const filas = await query(
    `SELECT HOUR(v.fecha) AS hora, COUNT(*) AS ventas, SUM(v.total) AS total
       FROM ventas v WHERE ${RANGO}
      GROUP BY hora ORDER BY hora`,
    [desde, hasta]
  );
  return filas.map((f) => ({ ...f, total: Number(f.total) }));
}

async function porMetodoPago(desde, hasta) {
  const filas = await query(
    `SELECT mp.id, mp.nombre, COUNT(*) AS operaciones, SUM(vp.monto) AS total
       FROM venta_pagos vp
       JOIN ventas v ON v.id = vp.venta_id
       JOIN metodos_pago mp ON mp.id = vp.metodo_pago_id
      WHERE ${RANGO}
      GROUP BY mp.id
      ORDER BY total DESC`,
    [desde, hasta]
  );
  return filas.map((f) => ({ ...f, total: Number(f.total) }));
}

async function porCategoria(desde, hasta) {
  const filas = await query(
    `SELECT c.id, c.nombre, c.color, c.icono, SUM(d.cantidad) AS unidades, SUM(d.subtotal) AS total
       FROM venta_detalles d
       JOIN ventas v ON v.id = d.venta_id
       JOIN productos p ON p.id = d.producto_id
       JOIN categorias c ON c.id = p.categoria_id
      WHERE ${RANGO}
      GROUP BY c.id
      ORDER BY total DESC`,
    [desde, hasta]
  );
  return filas.map((f) => ({ ...f, unidades: Number(f.unidades), total: Number(f.total) }));
}

async function porUsuario(desde, hasta) {
  const filas = await query(
    `SELECT u.id, u.nombre, COUNT(*) AS ventas, SUM(v.total) AS total
       FROM ventas v JOIN usuarios u ON u.id = v.usuario_id
      WHERE ${RANGO}
      GROUP BY u.id
      ORDER BY total DESC`,
    [desde, hasta]
  );
  return filas.map((f) => ({ ...f, total: Number(f.total) }));
}

async function topProductos(desde, hasta, limite = 10) {
  const filas = await query(
    `SELECT d.producto_id AS id,
            MAX(d.producto_codigo) AS codigo,
            MAX(d.producto_nombre) AS nombre,
            SUM(d.cantidad) AS unidades,
            SUM(d.subtotal) AS total,
            SUM(d.subtotal - d.cantidad * d.precio_costo) AS ganancia
       FROM venta_detalles d JOIN ventas v ON v.id = d.venta_id
      WHERE ${RANGO}
      GROUP BY d.producto_id
      ORDER BY unidades DESC, total DESC
      LIMIT ?`,
    [desde, hasta, limite]
  );
  return filas.map((f) => ({
    ...f,
    unidades: Number(f.unidades),
    total: Number(f.total),
    ganancia: Number(f.ganancia),
  }));
}

async function ultimasVentas(limite = 8) {
  return query(
    `SELECT v.id, v.fecha, v.total, v.estado, u.nombre AS usuario, c.nombre AS cliente,
            (SELECT GROUP_CONCAT(mp.nombre ORDER BY vp.id SEPARATOR ' + ')
               FROM venta_pagos vp JOIN metodos_pago mp ON mp.id = vp.metodo_pago_id
              WHERE vp.venta_id = v.id) AS metodos_pago
       FROM ventas v
       JOIN usuarios u ON u.id = v.usuario_id
       LEFT JOIN clientes c ON c.id = v.cliente_id
      ORDER BY v.fecha DESC, v.id DESC
      LIMIT ?`,
    [limite]
  );
}

async function alertasStock(limite = 10) {
  const [conteo, productos] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(stock = 0), 0) AS sin_stock,
              COALESCE(SUM(stock > 0 AND stock <= stock_minimo), 0) AS stock_bajo,
              COUNT(*) AS activos
         FROM productos WHERE eliminado_en IS NULL AND activo = 1`
    ),
    query(
      `SELECT p.id, p.codigo, p.nombre, p.stock, p.stock_minimo, c.nombre AS categoria, c.icono AS categoria_icono,
              c.color AS categoria_color
         FROM productos p JOIN categorias c ON c.id = p.categoria_id
        WHERE p.eliminado_en IS NULL AND p.activo = 1 AND p.stock <= p.stock_minimo
        ORDER BY p.stock ASC, p.nombre ASC
        LIMIT ?`,
      [limite]
    ),
  ]);
  return {
    sin_stock: Number(conteo[0].sin_stock),
    stock_bajo: Number(conteo[0].stock_bajo),
    productos_activos: conteo[0].activos,
    productos: productos,
  };
}

module.exports = {
  totales,
  porDia,
  porHora,
  porMetodoPago,
  porCategoria,
  porUsuario,
  topProductos,
  ultimasVentas,
  alertasStock,
};
