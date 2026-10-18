'use strict';

const AppError = require('../utils/AppError');
const clientesRepo = require('../repositories/clientes.repository');

async function listar(filtros) {
  return clientesRepo.listar(filtros);
}

async function obtenerExistente(id) {
  const cliente = await clientesRepo.obtenerPorId(id);
  if (!cliente) throw AppError.notFound('El cliente no existe.');
  return cliente;
}

async function validarDocumentoUnico(documento, excluirId) {
  if (await clientesRepo.existeDocumento(documento, excluirId)) {
    const mensaje = `Ya existe un cliente con el CUIT/DNI ${documento}.`;
    throw AppError.conflict(mensaje, { documento: mensaje });
  }
}

async function crear(datos) {
  await validarDocumentoUnico(datos.documento, 0);
  const id = await clientesRepo.crear(datos);
  return clientesRepo.obtenerPorId(id);
}

async function actualizar(id, datos) {
  await obtenerExistente(id);
  await validarDocumentoUnico(datos.documento, id);
  await clientesRepo.actualizar(id, datos);
  return clientesRepo.obtenerPorId(id);
}

async function eliminar(id) {
  await obtenerExistente(id);
  const ventas = await clientesRepo.contarVentas(id);
  if (ventas > 0) {
    throw AppError.conflict(`No se puede eliminar: el cliente tiene ${ventas} venta(s) registrada(s). Podés desactivarlo.`);
  }
  await clientesRepo.eliminar(id);
}

module.exports = { listar, crear, actualizar, eliminar };
