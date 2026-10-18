'use strict';

const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { paginar } = require('../utils/paginacion');
const productosRepo = require('../repositories/productos.repository');
const categoriasRepo = require('../repositories/categorias.repository');
const proveedoresRepo = require('../repositories/proveedores.repository');
const stockRepo = require('../repositories/stock.repository');

async function listar(filtros) {
  const [{ items, total }, resumen] = await Promise.all([
    productosRepo.listar(filtros),
    productosRepo.resumenInventario(filtros),
  ]);
  return { ...paginar({ items, total, page: filtros.page, limit: filtros.limit }), resumen };
}

async function buscarParaVenta(filtros) {
  return productosRepo.buscarParaVenta(filtros);
}

async function obtener(id) {
  const producto = await productosRepo.obtenerPorId(id);
  if (!producto) throw AppError.notFound('El producto no existe o fue eliminado.');
  return producto;
}

/** Verifica que la categoría y el proveedor elegidos existan y que el código no esté repetido. */
async function validarRelaciones(datos, excluirId) {
  const categoria = await categoriasRepo.obtenerPorId(datos.categoria_id);
  if (!categoria) {
    throw AppError.badRequest('La categoría seleccionada no existe.', {
      categoria_id: 'La categoría seleccionada no existe.',
    });
  }
  if (datos.proveedor_id) {
    const proveedor = await proveedoresRepo.obtenerPorId(datos.proveedor_id);
    if (!proveedor) {
      throw AppError.badRequest('El proveedor seleccionado no existe.', {
        proveedor_id: 'El proveedor seleccionado no existe.',
      });
    }
  }
  if (await productosRepo.existeCodigo(datos.codigo, excluirId)) {
    const mensaje = `Ya existe un producto con el código ${datos.codigo}.`;
    throw AppError.conflict(mensaje, { codigo: mensaje });
  }
}

async function crear(datos, usuario) {
  await validarRelaciones(datos, 0);

  const id = await withTransaction(async (conn) => {
    const nuevoId = await productosRepo.crear(datos, conn);
    if (datos.stock > 0) {
      await stockRepo.registrarMovimiento(
        {
          producto_id: nuevoId,
          tipo: 'INICIAL',
          cantidad: datos.stock,
          stock_anterior: 0,
          stock_resultante: datos.stock,
          motivo: 'Stock inicial al crear el producto',
          usuario_id: usuario.id,
        },
        conn
      );
    }
    return nuevoId;
  });

  return productosRepo.obtenerPorId(id);
}

async function actualizar(id, datos) {
  await obtener(id);
  await validarRelaciones(datos, id);
  await productosRepo.actualizar(id, datos);
  return productosRepo.obtenerPorId(id);
}

/**
 * Elimina un producto.
 * - Si nunca se vendió ni se compró, se borra definitivamente.
 * - Si tiene historial, se archiva (borrado lógico) para no romper las ventas anteriores.
 */
async function eliminar(id) {
  await obtener(id);
  return withTransaction(async (conn) => {
    const [bloqueado] = await productosRepo.obtenerParaActualizar([id], conn);
    if (!bloqueado || bloqueado.eliminado_en) throw AppError.notFound('El producto no existe o ya fue eliminado.');

    if (await productosRepo.tieneHistorial(id, conn)) {
      await productosRepo.marcarEliminado(id, conn);
      return { modo: 'archivado' };
    }
    await productosRepo.eliminarFisico(id, conn);
    return { modo: 'eliminado' };
  });
}

module.exports = { listar, buscarParaVenta, obtener, crear, actualizar, eliminar };
