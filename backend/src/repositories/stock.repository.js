'use strict';

const { query, likeContiene } = require('../config/db');

/**
 * Registra un movimiento de stock. Siempre se llama dentro de la misma transacción
 * que modifica el stock del producto, para que historial y stock nunca difieran.
 */
async function registrarMovimiento(
  { producto_id, tipo, cantidad, stock_anterior, stock_resultante, motivo = null, venta_id = null, compra_id = null, usuario_id },
  conn
) {
  await query(
    `INSERT INTO movimientos_stock
       (producto_id, tipo, cantidad, stock_anterior, stock_resultante, motivo, venta_id, compra_id, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [producto_id, tipo, cantidad, stock_anterior, stock_resultante, motivo, venta_id, compra_id, usuario_id],
    conn
  );
}

async function listarMovimientos({ q, producto_id, tipo, desde, hasta, page, limit }) {
  const condiciones = [];
  const params = [];

  if (q) {
    condiciones.push('(p.nombre LIKE ? OR p.codigo LIKE ?)');
    const like = likeContiene(q);
    params.push(like, like);
  }
  if (producto_id) {
    condiciones.push('m.producto_id = ?');
    params.push(producto_id);
  }
  if (tipo && tipo !== 'todos') {
    condiciones.push('m.tipo = ?');
    params.push(tipo);
  }
  if (desde) {
    condiciones.push('m.fecha >= ?');
    params.push(`${desde} 00:00:00`);
  }
  if (hasta) {
    condiciones.push('m.fecha < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(hasta);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [items, conteo] = await Promise.all([
    query(
      `SELECT m.id, m.fecha, m.tipo, m.cantidad, m.stock_anterior, m.stock_resultante, m.motivo,
              m.venta_id, m.compra_id, m.producto_id,
              p.codigo AS producto_codigo, p.nombre AS producto_nombre,
              u.nombre AS usuario
         FROM movimientos_stock m
         JOIN productos p ON p.id = m.producto_id
         JOIN usuarios u ON u.id = m.usuario_id
         ${where}
        ORDER BY m.fecha DESC, m.id DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    ),
    query(
      `SELECT COUNT(*) AS total
         FROM movimientos_stock m
         JOIN productos p ON p.id = m.producto_id
         ${where}`,
      params
    ),
  ]);

  return { items, total: conteo[0].total };
}

module.exports = { registrarMovimiento, listarMovimientos };
