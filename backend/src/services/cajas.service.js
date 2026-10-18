'use strict';

const AppError = require('../utils/AppError');
const { withTransaction } = require('../config/db');
const { paginar } = require('../utils/paginacion');
const { aCentavos, aPesos } = require('../utils/dinero');
const cajasRepo = require('../repositories/cajas.repository');

const formatoPesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' });

/** Efectivo que debería haber en el cajón: inicial + ventas en efectivo + ingresos - egresos. */
function calcularEfectivoEsperado(montoInicial, totales) {
  const ventasEfectivo = totales.por_metodo
    .filter((m) => m.es_efectivo)
    .reduce((suma, m) => suma + aCentavos(m.total), 0);
  return aPesos(aCentavos(montoInicial) + ventasEfectivo + aCentavos(totales.ingresos) - aCentavos(totales.egresos));
}

async function armarDetalle(caja, conn) {
  const [totales, movimientos] = await Promise.all([
    cajasRepo.totales(caja.id, conn),
    cajasRepo.listarMovimientos(caja.id, conn),
  ]);
  return {
    ...caja,
    totales,
    movimientos,
    efectivo_esperado: calcularEfectivoEsperado(caja.monto_inicial, totales),
  };
}

/** Devuelve la caja abierta con sus totales, o null si no hay ninguna. */
async function obtenerActual() {
  const caja = await cajasRepo.obtenerAbierta();
  return caja ? armarDetalle(caja) : null;
}

async function obtenerDetalle(id) {
  const caja = await cajasRepo.obtenerPorId(id);
  if (!caja) throw AppError.notFound('La caja no existe.');
  return armarDetalle(caja);
}

async function listar(filtros) {
  const { items, total } = await cajasRepo.listar(filtros);
  return paginar({ items, total, page: filtros.page, limit: filtros.limit });
}

async function abrir({ monto_inicial }, usuario) {
  const abierta = await cajasRepo.obtenerAbierta();
  if (abierta) throw AppError.conflict('Ya hay una caja abierta. Cerrala antes de abrir una nueva.');

  try {
    await cajasRepo.abrir({ usuario_id: usuario.id, monto_inicial });
  } catch (error) {
    // Dos aperturas simultáneas: la base solo permite una caja abierta.
    if (error.code === 'ER_DUP_ENTRY') throw AppError.conflict('Ya hay una caja abierta.');
    throw error;
  }
  return obtenerActual();
}

async function cerrar({ monto_contado, observaciones }, usuario) {
  const cajaId = await withTransaction(async (conn) => {
    const caja = await cajasRepo.obtenerAbiertaParaActualizar(conn);
    if (!caja) throw AppError.conflict('No hay ninguna caja abierta para cerrar.');

    const totales = await cajasRepo.totales(caja.id, conn);
    const esperado = calcularEfectivoEsperado(caja.monto_inicial, totales);
    await cajasRepo.cerrar(
      caja.id,
      {
        usuario_id: usuario.id,
        monto_esperado: esperado,
        monto_contado,
        diferencia: aPesos(aCentavos(monto_contado) - aCentavos(esperado)),
        observaciones,
      },
      conn
    );
    return caja.id;
  });
  return obtenerDetalle(cajaId);
}

/** Ingreso o egreso manual de efectivo (retiros, pago a proveedores, cambio, etc.). */
async function registrarMovimiento({ tipo, monto, concepto }, usuario) {
  await withTransaction(async (conn) => {
    const caja = await cajasRepo.obtenerAbiertaParaActualizar(conn);
    if (!caja) throw AppError.conflict('No hay una caja abierta. Abrí la caja para registrar movimientos.');

    if (tipo === 'EGRESO') {
      const totales = await cajasRepo.totales(caja.id, conn);
      const disponible = calcularEfectivoEsperado(caja.monto_inicial, totales);
      if (aCentavos(monto) > aCentavos(disponible)) {
        throw AppError.conflict(
          `No hay suficiente efectivo en caja. Disponible: ${formatoPesos.format(disponible)}.`
        );
      }
    }
    await cajasRepo.insertarMovimiento({ caja_id: caja.id, tipo, monto, concepto, usuario_id: usuario.id }, conn);
  });
  return obtenerActual();
}

module.exports = { obtenerActual, obtenerDetalle, listar, abrir, cerrar, registrarMovimiento };
