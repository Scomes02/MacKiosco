'use strict';

const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { paginar } = require('../utils/paginacion');
const productosRepo = require('../repositories/productos.repository');
const stockRepo = require('../repositories/stock.repository');

async function listarMovimientos(filtros) {
  const { items, total } = await stockRepo.listarMovimientos(filtros);
  return paginar({ items, total, page: filtros.page, limit: filtros.limit });
}

/**
 * Ajuste manual de stock (entrada o salida) con motivo obligatorio.
 * El stock del producto y el movimiento se guardan en la misma transacción.
 */
async function ajustar({ producto_id, tipo, cantidad, motivo }, usuario) {
  await withTransaction(async (conn) => {
    const [producto] = await productosRepo.obtenerParaActualizar([producto_id], conn);
    if (!producto || producto.eliminado_en) throw AppError.notFound('El producto no existe o fue eliminado.');

    const esEntrada = tipo === 'ENTRADA';
    if (!esEntrada && producto.stock < cantidad) {
      throw new AppError(
        409,
        `No se pueden descontar ${cantidad} unidades de "${producto.nombre}": el stock actual es ${producto.stock}.`,
        'STOCK_INSUFICIENTE'
      );
    }

    const nuevoStock = esEntrada ? producto.stock + cantidad : producto.stock - cantidad;
    await productosRepo.actualizarStock(producto_id, nuevoStock, conn);
    await stockRepo.registrarMovimiento(
      {
        producto_id,
        tipo: esEntrada ? 'AJUSTE_ENTRADA' : 'AJUSTE_SALIDA',
        cantidad: esEntrada ? cantidad : -cantidad,
        stock_anterior: producto.stock,
        stock_resultante: nuevoStock,
        motivo,
        usuario_id: usuario.id,
      },
      conn
    );
  });

  return productosRepo.obtenerPorId(producto_id);
}

module.exports = { listarMovimientos, ajustar };
