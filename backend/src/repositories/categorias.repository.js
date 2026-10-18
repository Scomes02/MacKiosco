'use strict';

const { query, likeContiene } = require('../config/db');

async function listar({ q = '', estado = 'todos' } = {}) {
  const condiciones = [];
  const params = [];
  if (q) {
    condiciones.push('c.nombre LIKE ?');
    params.push(likeContiene(q));
  }
  if (estado === 'activos') condiciones.push('c.activo = 1');
  if (estado === 'inactivos') condiciones.push('c.activo = 0');
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  return query(
    `SELECT c.id, c.nombre, c.descripcion, c.color, c.icono, c.activo,
            COUNT(p.id) AS productos
       FROM categorias c
       LEFT JOIN productos p ON p.categoria_id = c.id AND p.eliminado_en IS NULL
       ${where}
      GROUP BY c.id
      ORDER BY c.nombre`,
    params
  );
}

async function obtenerPorId(id) {
  const filas = await query('SELECT * FROM categorias WHERE id = ?', [id]);
  return filas[0] || null;
}

async function existeNombre(nombre, excluirId = 0) {
  const filas = await query('SELECT id FROM categorias WHERE nombre = ? AND id <> ? LIMIT 1', [nombre, excluirId]);
  return filas.length > 0;
}

/** Cuenta todos los productos de la categoría, incluidos los eliminados (siguen referenciándola). */
async function contarProductos(id) {
  const filas = await query(
    `SELECT COUNT(*) AS total, SUM(eliminado_en IS NULL) AS vigentes
       FROM productos WHERE categoria_id = ?`,
    [id]
  );
  return { total: filas[0].total, vigentes: Number(filas[0].vigentes || 0) };
}

async function crear({ nombre, descripcion, color, icono, activo }) {
  const resultado = await query(
    'INSERT INTO categorias (nombre, descripcion, color, icono, activo) VALUES (?, ?, ?, ?, ?)',
    [nombre, descripcion, color, icono, activo ? 1 : 0]
  );
  return resultado.insertId;
}

async function actualizar(id, { nombre, descripcion, color, icono, activo }) {
  await query('UPDATE categorias SET nombre = ?, descripcion = ?, color = ?, icono = ?, activo = ? WHERE id = ?', [
    nombre,
    descripcion,
    color,
    icono,
    activo ? 1 : 0,
    id,
  ]);
}

async function eliminar(id) {
  await query('DELETE FROM categorias WHERE id = ?', [id]);
}

module.exports = { listar, obtenerPorId, existeNombre, contarProductos, crear, actualizar, eliminar };
