'use strict';

const { query } = require('../config/db');

const CAMPOS_CAJA = `
  cj.id, cj.estado, cj.abierta_en, cj.monto_inicial, cj.cerrada_en,
  cj.monto_esperado, cj.monto_contado, cj.diferencia, cj.observaciones,
  cj.usuario_apertura_id, cj.usuario_cierre_id,
  ua.nombre AS usuario_apertura, uc.nombre AS usuario_cierre`;

const TABLAS_CAJA = `
  FROM cajas cj
  JOIN usuarios ua ON ua.id = cj.usuario_apertura_id
  LEFT JOIN usuarios uc ON uc.id = cj.usuario_cierre_id`;

const SELECT_CAJA = `SELECT ${CAMPOS_CAJA} ${TABLAS_CAJA}`;

async function obtenerAbierta(conn) {
  const filas = await query(`${SELECT_CAJA} WHERE cj.estado = 'ABIERTA' LIMIT 1`, [], conn);
  return filas[0] || null;
}

/** Bloquea la caja abierta: evita que se cierre mientras se está registrando una venta. */
async function obtenerAbiertaParaActualizar(conn) {
  const filas = await query("SELECT id, estado, monto_inicial FROM cajas WHERE estado = 'ABIERTA' LIMIT 1 FOR UPDATE", [], conn);
  return filas[0] || null;
}

async function obtenerPorId(id, conn) {
  const filas = await query(`${SELECT_CAJA} WHERE cj.id = ?`, [id], conn);
  return filas[0] || null;
}

async function abrir({ usuario_id, monto_inicial }, conn) {
  const resultado = await query(
    "INSERT INTO cajas (estado, usuario_apertura_id, monto_inicial) VALUES ('ABIERTA', ?, ?)",
    [usuario_id, monto_inicial],
    conn
  );
  return resultado.insertId;
}

async function cerrar(id, { usuario_id, monto_esperado, monto_contado, diferencia, observaciones }, conn) {
  await query(
    `UPDATE cajas
        SET estado = 'CERRADA', cerrada_en = NOW(), usuario_cierre_id = ?,
            monto_esperado = ?, monto_contado = ?, diferencia = ?, observaciones = ?
      WHERE id = ?`,
    [usuario_id, monto_esperado, monto_contado, diferencia, observaciones, id],
    conn
  );
}

async function insertarMovimiento({ caja_id, tipo, monto, concepto, usuario_id }, conn) {
  const resultado = await query(
    'INSERT INTO caja_movimientos (caja_id, tipo, monto, concepto, usuario_id) VALUES (?, ?, ?, ?, ?)',
    [caja_id, tipo, monto, concepto, usuario_id],
    conn
  );
  return resultado.insertId;
}

async function listarMovimientos(cajaId, conn) {
  return query(
    `SELECT m.id, m.tipo, m.monto, m.concepto, m.fecha, u.nombre AS usuario
       FROM caja_movimientos m JOIN usuarios u ON u.id = m.usuario_id
      WHERE m.caja_id = ?
      ORDER BY m.fecha DESC, m.id DESC`,
    [cajaId],
    conn
  );
}

/** Totales de una caja calculados desde las ventas y movimientos reales. */
async function totales(cajaId, conn) {
  const [ventas, porMetodo, movimientos] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(estado = 'COMPLETADA'), 0) AS cantidad,
              COALESCE(SUM(IF(estado = 'COMPLETADA', total, 0)), 0) AS total,
              COALESCE(SUM(estado = 'ANULADA'), 0) AS anuladas
         FROM ventas WHERE caja_id = ?`,
      [cajaId],
      conn
    ),
    query(
      `SELECT mp.id, mp.nombre, mp.es_efectivo, COUNT(*) AS operaciones, SUM(vp.monto) AS total
         FROM venta_pagos vp
         JOIN ventas v ON v.id = vp.venta_id
         JOIN metodos_pago mp ON mp.id = vp.metodo_pago_id
        WHERE v.caja_id = ? AND v.estado = 'COMPLETADA'
        GROUP BY mp.id
        ORDER BY mp.orden, mp.nombre`,
      [cajaId],
      conn
    ),
    query(
      `SELECT COALESCE(SUM(IF(tipo = 'INGRESO', monto, 0)), 0) AS ingresos,
              COALESCE(SUM(IF(tipo = 'EGRESO', monto, 0)), 0) AS egresos
         FROM caja_movimientos WHERE caja_id = ?`,
      [cajaId],
      conn
    ),
  ]);

  return {
    ventas_cantidad: Number(ventas[0].cantidad),
    ventas_total: Number(ventas[0].total),
    ventas_anuladas: Number(ventas[0].anuladas),
    por_metodo: porMetodo.map((m) => ({ ...m, total: Number(m.total) })),
    ingresos: Number(movimientos[0].ingresos),
    egresos: Number(movimientos[0].egresos),
  };
}

async function listar({ page, limit }) {
  const [items, conteo] = await Promise.all([
    query(
      `SELECT ${CAMPOS_CAJA},
              (SELECT COUNT(*) FROM ventas v WHERE v.caja_id = cj.id AND v.estado = 'COMPLETADA') AS ventas_cantidad,
              (SELECT COALESCE(SUM(v.total), 0) FROM ventas v WHERE v.caja_id = cj.id AND v.estado = 'COMPLETADA') AS ventas_total
         ${TABLAS_CAJA}
        ORDER BY cj.abierta_en DESC, cj.id DESC
        LIMIT ? OFFSET ?`,
      [limit, (page - 1) * limit]
    ),
    query('SELECT COUNT(*) AS total FROM cajas'),
  ]);
  return { items, total: conteo[0].total };
}

module.exports = {
  obtenerAbierta,
  obtenerAbiertaParaActualizar,
  obtenerPorId,
  abrir,
  cerrar,
  insertarMovimiento,
  listarMovimientos,
  totales,
  listar,
};
