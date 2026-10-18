'use strict';

const AppError = require('../utils/AppError');
const metodosRepo = require('../repositories/metodosPago.repository');

async function listar({ soloActivos }) {
  return metodosRepo.listar({ soloActivos });
}

async function obtenerExistente(id) {
  const metodo = await metodosRepo.obtenerPorId(id);
  if (!metodo) throw AppError.notFound('El método de pago no existe.');
  return metodo;
}

async function validarNombreUnico(nombre, excluirId) {
  if (await metodosRepo.existeNombre(nombre, excluirId)) {
    const mensaje = `Ya existe un método de pago llamado "${nombre}".`;
    throw AppError.conflict(mensaje, { nombre: mensaje });
  }
}

async function validarQueQuedeUnoActivo(id) {
  if ((await metodosRepo.contarActivos(id)) === 0) {
    throw AppError.badRequest('Tiene que quedar al menos un método de pago activo.');
  }
}

async function crear(datos) {
  await validarNombreUnico(datos.nombre, 0);
  const id = await metodosRepo.crear(datos);
  return metodosRepo.obtenerPorId(id);
}

async function actualizar(id, datos) {
  await obtenerExistente(id);
  await validarNombreUnico(datos.nombre, id);
  if (!datos.activo) await validarQueQuedeUnoActivo(id);
  await metodosRepo.actualizar(id, datos);
  return metodosRepo.obtenerPorId(id);
}

async function eliminar(id) {
  await obtenerExistente(id);
  const usos = await metodosRepo.contarUsos(id);
  if (usos > 0) {
    throw AppError.conflict('No se puede eliminar: el método de pago ya fue usado en ventas. Podés desactivarlo.');
  }
  await validarQueQuedeUnoActivo(id);
  await metodosRepo.eliminar(id);
}

module.exports = { listar, crear, actualizar, eliminar };
