'use strict';

const { query } = require('../config/db');

async function obtenerTodo() {
  const filas = await query('SELECT clave, valor FROM configuracion');
  return Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
}

async function guardar(valores) {
  const filas = Object.entries(valores).map(([clave, valor]) => [clave, valor]);
  if (!filas.length) return;
  await query('INSERT INTO configuracion (clave, valor) VALUES ? ON DUPLICATE KEY UPDATE valor = VALUES(valor)', [filas]);
}

module.exports = { obtenerTodo, guardar };
