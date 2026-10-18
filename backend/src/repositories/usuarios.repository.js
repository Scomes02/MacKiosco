'use strict';

const { query } = require('../config/db');

const CAMPOS_PUBLICOS = 'id, nombre, usuario, email, rol, activo, ultimo_acceso, creado_en';

async function listar() {
  return query(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios ORDER BY activo DESC, nombre`);
}

async function obtenerPorId(id) {
  const filas = await query(`SELECT ${CAMPOS_PUBLICOS} FROM usuarios WHERE id = ?`, [id]);
  return filas[0] || null;
}

/** Incluye el hash de la contraseña: usar solo para autenticar. */
async function obtenerConHashPorUsuario(usuario) {
  const filas = await query('SELECT * FROM usuarios WHERE usuario = ?', [usuario]);
  return filas[0] || null;
}

async function obtenerConHashPorId(id) {
  const filas = await query('SELECT * FROM usuarios WHERE id = ?', [id]);
  return filas[0] || null;
}

async function existeUsuario(usuario, excluirId = 0) {
  const filas = await query('SELECT id FROM usuarios WHERE usuario = ? AND id <> ? LIMIT 1', [usuario, excluirId]);
  return filas.length > 0;
}

async function contarAdminsActivos(excluirId = 0) {
  const filas = await query(
    "SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'ADMIN' AND activo = 1 AND id <> ?",
    [excluirId]
  );
  return filas[0].total;
}

async function crear({ nombre, usuario, email, rol, passwordHash }) {
  const resultado = await query(
    'INSERT INTO usuarios (nombre, usuario, email, rol, password_hash) VALUES (?, ?, ?, ?, ?)',
    [nombre, usuario, email, rol, passwordHash]
  );
  return resultado.insertId;
}

async function actualizar(id, { nombre, usuario, email, rol, activo }) {
  await query('UPDATE usuarios SET nombre = ?, usuario = ?, email = ?, rol = ?, activo = ? WHERE id = ?', [
    nombre,
    usuario,
    email,
    rol,
    activo ? 1 : 0,
    id,
  ]);
}

async function actualizarPassword(id, passwordHash) {
  await query('UPDATE usuarios SET password_hash = ? WHERE id = ?', [passwordHash, id]);
}

async function registrarAcceso(id) {
  await query('UPDATE usuarios SET ultimo_acceso = NOW() WHERE id = ?', [id]);
}

module.exports = {
  listar,
  obtenerPorId,
  obtenerConHashPorUsuario,
  obtenerConHashPorId,
  existeUsuario,
  contarAdminsActivos,
  crear,
  actualizar,
  actualizarPassword,
  registrarAcceso,
};
