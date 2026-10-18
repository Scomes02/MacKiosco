'use strict';

const { query } = require('../config/db');

async function crear({ proveedor_id, usuario_id, numero_comprobante, total, observaciones }, conn) {
  const resultado = await query(
    'INSERT INTO compras (proveedor_id, usuario_id, numero_comprobante, total, observaciones) VALUES (?, ?, ?, ?, ?)',
    [proveedor_id, usuario_id, numero_comprobante, total, observaciones],
    conn
  );
  return resultado.insertId;
}

async function insertarDetalles(compraId, detalles, conn) {
  const filas = detalles.map((d) => [compraId, d.producto_id, d.cantidad, d.costo_unitario, d.subtotal]);
  await query(
    'INSERT INTO compra_detalles (compra_id, producto_id, cantidad, costo_unitario, subtotal) VALUES ?',
    [filas],
    conn
  );
}

async function listar({ proveedor_id, desde, hasta, page, limit }) {
  const condiciones = [];
  const params = [];
  if (proveedor_id) {
    condiciones.push('c.proveedor_id = ?');
    params.push(proveedor_id);
  }
  if (desde) {
    condiciones.push('c.fecha >= ?');
    params.push(`${desde} 00:00:00`);
  }
  if (hasta) {
    condiciones.push('c.fecha < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(hasta);
  }
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  const [items, totales] = await Promise.all([
    query(
      `SELECT c.id, c.fecha, c.numero_comprobante, c.total, c.observaciones,
              pr.razon_social AS proveedor, u.nombre AS usuario,
              (SELECT COUNT(*) FROM compra_detalles d WHERE d.compra_id = c.id) AS renglones,
              (SELECT COALESCE(SUM(d.cantidad), 0) FROM compra_detalles d WHERE d.compra_id = c.id) AS unidades
         FROM compras c
         JOIN proveedores pr ON pr.id = c.proveedor_id
         JOIN usuarios u ON u.id = c.usuario_id
         ${where}
        ORDER BY c.fecha DESC, c.id DESC
        LIMIT ? OFFSET ?`,
      [...params, limit, (page - 1) * limit]
    ),
    query(`SELECT COUNT(*) AS total, COALESCE(SUM(c.total), 0) AS importe FROM compras c ${where}`, params),
  ]);

  return {
    items: items.map((c) => ({ ...c, unidades: Number(c.unidades) })),
    total: totales[0].total,
    resumen: { importe: Number(totales[0].importe) },
  };
}

async function obtenerPorId(id, conn) {
  const filas = await query(
    `SELECT c.id, c.fecha, c.numero_comprobante, c.total, c.observaciones, c.proveedor_id,
            pr.razon_social AS proveedor, u.nombre AS usuario
       FROM compras c
       JOIN proveedores pr ON pr.id = c.proveedor_id
       JOIN usuarios u ON u.id = c.usuario_id
      WHERE c.id = ?`,
    [id],
    conn
  );
  if (!filas[0]) return null;

  const detalles = await query(
    `SELECT d.id, d.producto_id, p.codigo AS producto_codigo, p.nombre AS producto_nombre,
            d.cantidad, d.costo_unitario, d.subtotal
       FROM compra_detalles d JOIN productos p ON p.id = d.producto_id
      WHERE d.compra_id = ? ORDER BY d.id`,
    [id],
    conn
  );
  return { ...filas[0], detalles };
}

module.exports = { crear, insertarDetalles, listar, obtenerPorId };
