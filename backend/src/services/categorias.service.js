'use strict';

const AppError = require('../utils/AppError');
const categoriasRepo = require('../repositories/categorias.repository');

async function listar(filtros) {
  return categoriasRepo.listar(filtros);
}

async function obtenerExistente(id) {
  const categoria = await categoriasRepo.obtenerPorId(id);
  if (!categoria) throw AppError.notFound('La categoría no existe.');
  return categoria;
}

async function validarNombreUnico(nombre, excluirId) {
  if (await categoriasRepo.existeNombre(nombre, excluirId)) {
    const mensaje = `Ya existe una categoría llamada "${nombre}".`;
    throw AppError.conflict(mensaje, { nombre: mensaje });
  }
}

async function crear(datos) {
  await validarNombreUnico(datos.nombre, 0);
  const id = await categoriasRepo.crear(datos);
  return categoriasRepo.obtenerPorId(id);
}

async function actualizar(id, datos) {
  await obtenerExistente(id);
  await validarNombreUnico(datos.nombre, id);
  await categoriasRepo.actualizar(id, datos);
  return categoriasRepo.obtenerPorId(id);
}

async function eliminar(id) {
  await obtenerExistente(id);
  const { total, vigentes } = await categoriasRepo.contarProductos(id);
  if (vigentes > 0) {
    throw AppError.conflict(
      `No se puede eliminar: la categoría tiene ${vigentes} producto(s). Movelos a otra categoría o desactivala.`
    );
  }
  if (total > 0) {
    throw AppError.conflict(
      'No se puede eliminar: la categoría tiene productos en el historial de ventas. Podés desactivarla.'
    );
  }
  await categoriasRepo.eliminar(id);
}

module.exports = { listar, crear, actualizar, eliminar };
