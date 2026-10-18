'use strict';

const { query, likeContiene } = require('../config/db');

async function listar({ q = '', estado = 'todos' } = {}) {
  const condiciones = [];
  const params = [];
  if (q) {
    condiciones.push('(c.nombre LIKE ? OR c.documento LIKE ? OR c.direccion LIKE ?)');
    const like = likeContiene(q);
    params.push(like, like, like);
  }
  if (estado === 'activos') condiciones.push('c.activo = 1');
  if (estado === 'inactivos') condiciones.push('c.activo = 0');
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  return query(
    `SELECT c.id, c.nombre, c.documento, c.condicion_iva, c.telefono, c.email, c.direccion, c.notas, c.activo,
            COALESCE(v.compras, 0) AS compras,
            COALESCE(v.total, 0) AS total_comprado,
            v.ultima_compra
       FROM clientes c
       LEFT JOIN (
              SELECT cliente_id, COUNT(*) AS compras, SUM(total) AS total, MAX(fecha) AS ultima_compra
                FROM ventas
               WHERE estado = 'COMPLETADA' AND cliente_id IS NOT NULL
               GROUP BY cliente_id
            ) v ON v.cliente_id = c.id
       ${where}
      ORDER BY c.nombre`,
    params
  );
}

async function obtenerPorId(id, conn) {
  const filas = await query('SELECT * FROM clientes WHERE id = ?', [id], conn);
  return filas[0] || null;
}

async function existeDocumento(documento, excluirId = 0) {
  if (!documento) return false;
  const filas = await query('SELECT id FROM clientes WHERE documento = ? AND id <> ? LIMIT 1', [documento, excluirId]);
  return filas.length > 0;
}

async function contarVentas(id) {
  const filas = await query('SELECT COUNT(*) AS total FROM ventas WHERE cliente_id = ?', [id]);
  return filas[0].total;
}

async function crear(datos) {
  const resultado = await query(
    `INSERT INTO clientes (nombre, documento, condicion_iva, telefono, email, direccion, notas, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.nombre,
      datos.documento,
      datos.condicion_iva,
      datos.telefono,
      datos.email,
      datos.direccion,
      datos.notas,
      datos.activo ? 1 : 0,
    ]
  );
  return resultado.insertId;
}

async function actualizar(id, datos) {
  await query(
    `UPDATE clientes
        SET nombre = ?, documento = ?, condicion_iva = ?, telefono = ?, email = ?, direccion = ?, notas = ?, activo = ?
      WHERE id = ?`,
    [
      datos.nombre,
      datos.documento,
      datos.condicion_iva,
      datos.telefono,
      datos.email,
      datos.direccion,
      datos.notas,
      datos.activo ? 1 : 0,
      id,
    ]
  );
}

async function eliminar(id) {
  await query('DELETE FROM clientes WHERE id = ?', [id]);
}

module.exports = { listar, obtenerPorId, existeDocumento, contarVentas, crear, actualizar, eliminar };
