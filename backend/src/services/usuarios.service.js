'use strict';

const AppError = require('../utils/AppError');
const usuariosRepo = require('../repositories/usuarios.repository');
const { hashearPassword } = require('./auth.service');

async function listar() {
  return usuariosRepo.listar();
}

async function obtenerExistente(id) {
  const usuario = await usuariosRepo.obtenerPorId(id);
  if (!usuario) throw AppError.notFound('El usuario no existe.');
  return usuario;
}

async function validarUsuarioUnico(usuario, excluirId) {
  if (await usuariosRepo.existeUsuario(usuario, excluirId)) {
    const mensaje = `Ya existe un usuario "${usuario}".`;
    throw AppError.conflict(mensaje, { usuario: mensaje });
  }
}

async function crear(datos) {
  await validarUsuarioUnico(datos.usuario, 0);
  const id = await usuariosRepo.crear({ ...datos, passwordHash: await hashearPassword(datos.password) });
  return usuariosRepo.obtenerPorId(id);
}

async function actualizar(id, datos, usuarioActual) {
  const existente = await obtenerExistente(id);
  await validarUsuarioUnico(datos.usuario, id);

  if (id === usuarioActual.id) {
    if (!datos.activo) throw AppError.badRequest('No podés desactivar tu propio usuario.');
    if (datos.rol !== 'ADMIN') throw AppError.badRequest('No podés quitarte el rol de administrador a vos mismo.');
  }

  // Siempre tiene que quedar al menos un administrador activo.
  const dejaDeSerAdmin = existente.rol === 'ADMIN' && existente.activo && (datos.rol !== 'ADMIN' || !datos.activo);
  if (dejaDeSerAdmin && (await usuariosRepo.contarAdminsActivos(id)) === 0) {
    throw AppError.badRequest('Tiene que quedar al menos un administrador activo en el sistema.');
  }

  await usuariosRepo.actualizar(id, datos);
  return usuariosRepo.obtenerPorId(id);
}

async function restablecerPassword(id, password) {
  await obtenerExistente(id);
  await usuariosRepo.actualizarPassword(id, await hashearPassword(password));
}

module.exports = { listar, crear, actualizar, restablecerPassword };
