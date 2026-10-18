'use strict';

const { query } = require('../config/db');

async function listar({ soloActivos = false } = {}) {
  return query(
    `SELECT id, nombre, es_efectivo, activo, orden
       FROM metodos_pago
      ${soloActivos ? 'WHERE activo = 1' : ''}
      ORDER BY orden, nombre`
  );
}

async function obtenerPorId(id) {
  const filas = await query('SELECT * FROM metodos_pago WHERE id = ?', [id]);
  return filas[0] || null;
}

async function obtenerPorIds(ids, conn) {
  if (!ids.length) return [];
  return query('SELECT id, nombre, es_efectivo, activo FROM metodos_pago WHERE id IN (?)', [ids], conn);
}

async function existeNombre(nombre, excluirId = 0) {
  const filas = await query('SELECT id FROM metodos_pago WHERE nombre = ? AND id <> ? LIMIT 1', [nombre, excluirId]);
  return filas.length > 0;
}

async function contarActivos(excluirId = 0) {
  const filas = await query('SELECT COUNT(*) AS total FROM metodos_pago WHERE activo = 1 AND id <> ?', [excluirId]);
  return filas[0].total;
}

async function contarUsos(id) {
  const filas = await query('SELECT COUNT(*) AS total FROM venta_pagos WHERE metodo_pago_id = ?', [id]);
  return filas[0].total;
}

async function crear({ nombre, es_efectivo, activo, orden }) {
  const resultado = await query('INSERT INTO metodos_pago (nombre, es_efectivo, activo, orden) VALUES (?, ?, ?, ?)', [
    nombre,
    es_efectivo ? 1 : 0,
    activo ? 1 : 0,
    orden,
  ]);
  return resultado.insertId;
}

async function actualizar(id, { nombre, es_efectivo, activo, orden }) {
  await query('UPDATE metodos_pago SET nombre = ?, es_efectivo = ?, activo = ?, orden = ? WHERE id = ?', [
    nombre,
    es_efectivo ? 1 : 0,
    activo ? 1 : 0,
    orden,
    id,
  ]);
}

async function eliminar(id) {
  await query('DELETE FROM metodos_pago WHERE id = ?', [id]);
}

module.exports = {
  listar,
  obtenerPorId,
  obtenerPorIds,
  existeNombre,
  contarActivos,
  contarUsos,
  crear,
  actualizar,
  eliminar,
};
