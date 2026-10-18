'use strict';

const { query, likeContiene } = require('../config/db');

async function listar({ q = '', estado = 'todos' } = {}) {
  const condiciones = [];
  const params = [];
  if (q) {
    condiciones.push('(pr.razon_social LIKE ? OR pr.cuit LIKE ? OR pr.contacto LIKE ?)');
    const like = likeContiene(q);
    params.push(like, like, like);
  }
  if (estado === 'activos') condiciones.push('pr.activo = 1');
  if (estado === 'inactivos') condiciones.push('pr.activo = 0');
  const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';

  return query(
    `SELECT pr.id, pr.razon_social, pr.cuit, pr.contacto, pr.telefono, pr.email, pr.direccion, pr.notas, pr.activo,
            (SELECT COUNT(*) FROM productos p WHERE p.proveedor_id = pr.id AND p.eliminado_en IS NULL) AS productos,
            (SELECT MAX(c.fecha) FROM compras c WHERE c.proveedor_id = pr.id) AS ultima_compra
       FROM proveedores pr
       ${where}
      ORDER BY pr.razon_social`,
    params
  );
}

async function obtenerPorId(id, conn) {
  const filas = await query('SELECT * FROM proveedores WHERE id = ?', [id], conn);
  return filas[0] || null;
}

async function existeDuplicado({ razon_social, cuit }, excluirId = 0) {
  const filas = await query(
    `SELECT razon_social, cuit FROM proveedores
      WHERE id <> ? AND (razon_social = ? OR (? IS NOT NULL AND cuit = ?)) LIMIT 1`,
    [excluirId, razon_social, cuit, cuit]
  );
  return filas[0] || null;
}

async function contarCompras(id) {
  const filas = await query('SELECT COUNT(*) AS total FROM compras WHERE proveedor_id = ?', [id]);
  return filas[0].total;
}

async function crear(datos) {
  const resultado = await query(
    `INSERT INTO proveedores (razon_social, cuit, contacto, telefono, email, direccion, notas, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.razon_social,
      datos.cuit,
      datos.contacto,
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
    `UPDATE proveedores
        SET razon_social = ?, cuit = ?, contacto = ?, telefono = ?, email = ?, direccion = ?, notas = ?, activo = ?
      WHERE id = ?`,
    [
      datos.razon_social,
      datos.cuit,
      datos.contacto,
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
  await query('DELETE FROM proveedores WHERE id = ?', [id]);
}

module.exports = { listar, obtenerPorId, existeDuplicado, contarCompras, crear, actualizar, eliminar };
