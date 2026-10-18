'use strict';

const AppError = require('../utils/AppError');
const proveedoresRepo = require('../repositories/proveedores.repository');

async function listar(filtros) {
  return proveedoresRepo.listar(filtros);
}

async function obtenerExistente(id) {
  const proveedor = await proveedoresRepo.obtenerPorId(id);
  if (!proveedor) throw AppError.notFound('El proveedor no existe.');
  return proveedor;
}

async function validarUnico(datos, excluirId) {
  const duplicado = await proveedoresRepo.existeDuplicado(datos, excluirId);
  if (!duplicado) return;
  if (datos.cuit && duplicado.cuit === datos.cuit) {
    const mensaje = `Ya existe un proveedor con el CUIT ${datos.cuit}.`;
    throw AppError.conflict(mensaje, { cuit: mensaje });
  }
  const mensaje = `Ya existe un proveedor llamado "${datos.razon_social}".`;
  throw AppError.conflict(mensaje, { razon_social: mensaje });
}

async function crear(datos) {
  await validarUnico(datos, 0);
  const id = await proveedoresRepo.crear(datos);
  return proveedoresRepo.obtenerPorId(id);
}

async function actualizar(id, datos) {
  await obtenerExistente(id);
  await validarUnico(datos, id);
  await proveedoresRepo.actualizar(id, datos);
  return proveedoresRepo.obtenerPorId(id);
}

async function eliminar(id) {
  await obtenerExistente(id);
  const compras = await proveedoresRepo.contarCompras(id);
  if (compras > 0) {
    throw AppError.conflict(
      `No se puede eliminar: el proveedor tiene ${compras} compra(s) registrada(s). Podés desactivarlo.`
    );
  }
  // Los productos que lo tenían asignado quedan "sin proveedor" (ON DELETE SET NULL).
  await proveedoresRepo.eliminar(id);
}

module.exports = { listar, crear, actualizar, eliminar };
