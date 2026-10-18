'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const usuariosRepo = require('../repositories/usuarios.repository');

const COSTO_HASH = 10;
// Hash de relleno: si el usuario no existe igual se compara contra algo,
// para que el tiempo de respuesta no revele qué usuarios existen.
const HASH_DE_RELLENO = bcrypt.hashSync('contraseña-de-relleno', COSTO_HASH);

function aPublico(usuario) {
  return { id: usuario.id, nombre: usuario.nombre, usuario: usuario.usuario, email: usuario.email, rol: usuario.rol };
}

function generarToken(usuario) {
  return jwt.sign({ sub: String(usuario.id), rol: usuario.rol }, env.jwtSecret, {
    expiresIn: `${env.sessionHours}h`,
  });
}

/** Devuelve el contenido del token o null si es inválido o venció. */
function verificarToken(token) {
  try {
    return jwt.verify(token, env.jwtSecret);
  } catch {
    return null;
  }
}

function hashearPassword(password) {
  return bcrypt.hash(password, COSTO_HASH);
}

async function login({ usuario, password }) {
  const encontrado = await usuariosRepo.obtenerConHashPorUsuario(usuario);
  const coincide = await bcrypt.compare(password, encontrado ? encontrado.password_hash : HASH_DE_RELLENO);

  if (!encontrado || !coincide || !encontrado.activo) {
    throw new AppError(401, 'Usuario o contraseña incorrectos.', 'CREDENCIALES_INVALIDAS');
  }

  await usuariosRepo.registrarAcceso(encontrado.id);
  return { usuario: aPublico(encontrado), token: generarToken(encontrado) };
}

async function cambiarPassword(usuarioId, { actual, nueva }) {
  const usuario = await usuariosRepo.obtenerConHashPorId(usuarioId);
  if (!usuario) throw AppError.unauthorized();

  const coincide = await bcrypt.compare(actual, usuario.password_hash);
  if (!coincide) {
    throw AppError.badRequest('La contraseña actual no es correcta.', { actual: 'La contraseña actual no es correcta.' });
  }
  if (actual === nueva) {
    throw AppError.badRequest('La nueva contraseña debe ser distinta a la actual.', {
      nueva: 'La nueva contraseña debe ser distinta a la actual.',
    });
  }
  await usuariosRepo.actualizarPassword(usuarioId, await hashearPassword(nueva));
}

module.exports = { login, cambiarPassword, verificarToken, hashearPassword, aPublico };
