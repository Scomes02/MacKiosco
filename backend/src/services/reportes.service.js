'use strict';

const reportesRepo = require('../repositories/reportes.repository');
const cajasRepo = require('../repositories/cajas.repository');
const fiscalRepo = require('../repositories/fiscal.repository');
const { aFecha, aFechaHora, inicioDelDia, sumarDias, inicioDelMes, rangoInclusivo } = require('../utils/fechas');

const DIAS_GRAFICO = 14;
const DIAS_RANKING = 30;

/** Variación porcentual entre dos valores (null si no hay base de comparación). */
function variacion(actual, anterior) {
  if (!anterior) return null;
  return Math.round(((actual - anterior) / anterior) * 1000) / 10;
}

/** Completa con ceros los días sin ventas para que el gráfico no tenga huecos. */
function completarDias(filas, desde, cantidadDias) {
  const porDia = new Map(filas.map((f) => [f.dia, f]));
  return Array.from({ length: cantidadDias }, (_, i) => {
    const dia = aFecha(sumarDias(desde, i));
    return porDia.get(dia) || { dia, ventas: 0, total: 0 };
  });
}

/**
 * Indicadores del tablero principal. Todo se calcula en el momento desde la base de datos.
 */
async function dashboard() {
  const ahora = new Date();
  const hoy = inicioDelDia(ahora);
  const manana = sumarDias(hoy, 1);
  const ayer = sumarDias(hoy, -1);
  const mes = inicioDelMes(hoy);
  const mesAnterior = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const inicioGrafico = sumarDias(hoy, -(DIAS_GRAFICO - 1));
  const inicioUltimos30 = sumarDias(hoy, -(DIAS_RANKING - 1));

  // Para comparar parejo se usa el mismo tramo del período anterior:
  // "ayer hasta esta misma hora" y "el mes pasado hasta este mismo día y hora".
  const ayerMismaHora = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);
  const mesAnteriorMismoMomento = new Date(
    Math.min(
      new Date(hoy.getFullYear(), hoy.getMonth() - 1, hoy.getDate(), ahora.getHours(), ahora.getMinutes()).getTime(),
      mes.getTime()
    )
  );

  const f = aFechaHora;
  const [
    totalesHoy,
    totalesAyerMismaHora,
    totalesAyer,
    totalesMes,
    totalesMesAnterior,
    serie,
    metodosPago,
    topProductos,
    ultimasVentas,
    stock,
    cajaAbierta,
  ] = await Promise.all([
    reportesRepo.totales(f(hoy), f(manana)),
    reportesRepo.totales(f(ayer), f(ayerMismaHora)),
    reportesRepo.totales(f(ayer), f(hoy)),
    reportesRepo.totales(f(mes), f(manana)),
    reportesRepo.totales(f(mesAnterior), f(mesAnteriorMismoMomento)),
    reportesRepo.porDia(f(inicioGrafico), f(manana)),
    reportesRepo.porMetodoPago(f(inicioUltimos30), f(manana)),
    reportesRepo.topProductos(f(inicioUltimos30), f(manana), 8),
    reportesRepo.ultimasVentas(8),
    reportesRepo.alertasStock(10),
    cajasRepo.obtenerAbierta(),
  ]);

  return {
    generado_en: f(ahora),
    hoy: { ...totalesHoy, variacion_vs_ayer: variacion(totalesHoy.total, totalesAyerMismaHora.total) },
    ayer: totalesAyer,
    mes: { ...totalesMes, variacion_vs_mes_anterior: variacion(totalesMes.total, totalesMesAnterior.total) },
    ventas_por_dia: completarDias(serie, inicioGrafico, DIAS_GRAFICO),
    dias_ranking: DIAS_RANKING,
    metodos_pago: metodosPago,
    top_productos: topProductos,
    ultimas_ventas: ultimasVentas,
    stock,
    caja: cajaAbierta
      ? { abierta: true, id: cajaAbierta.id, abierta_en: cajaAbierta.abierta_en, usuario: cajaAbierta.usuario_apertura }
      : { abierta: false },
  };
}

/**
 * Reporte de ventas de un período (por defecto, el mes en curso).
 */
async function ventas({ desde, hasta }) {
  const hoy = inicioDelDia();
  const desdeFecha = desde || aFecha(inicioDelMes(hoy));
  const hastaFecha = hasta || aFecha(hoy);
  const rango = rangoInclusivo(desdeFecha, hastaFecha);

  const [resumen, porDia, porHora, porMetodoPago, porCategoria, porUsuario, topProductos, comprobantes] = await Promise.all([
    reportesRepo.totales(rango.desde, rango.hasta),
    reportesRepo.porDia(rango.desde, rango.hasta),
    reportesRepo.porHora(rango.desde, rango.hasta),
    reportesRepo.porMetodoPago(rango.desde, rango.hasta),
    reportesRepo.porCategoria(rango.desde, rango.hasta),
    reportesRepo.porUsuario(rango.desde, rango.hasta),
    reportesRepo.topProductos(rango.desde, rango.hasta, 20),
    fiscalRepo.resumenPorPeriodo(rango.desde, rango.hasta),
  ]);

  return {
    desde: desdeFecha,
    hasta: hastaFecha,
    resumen,
    por_dia: porDia,
    por_hora: porHora,
    por_metodo_pago: porMetodoPago,
    por_categoria: porCategoria,
    por_usuario: porUsuario,
    top_productos: topProductos,
    comprobantes,
  };
}

module.exports = { dashboard, ventas };
