'use strict';

/**
 * Utilidades de fechas en hora local del servidor (la misma que usa MySQL en una instalación local).
 */

const dos = (n) => String(n).padStart(2, '0');

/** Date -> 'YYYY-MM-DD' */
function aFecha(date) {
  return `${date.getFullYear()}-${dos(date.getMonth() + 1)}-${dos(date.getDate())}`;
}

/** Date -> 'YYYY-MM-DD HH:MM:SS' */
function aFechaHora(date) {
  return `${aFecha(date)} ${dos(date.getHours())}:${dos(date.getMinutes())}:${dos(date.getSeconds())}`;
}

function inicioDelDia(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function sumarDias(date, dias) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + dias);
}

function inicioDelMes(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Convierte un rango de fechas inclusivo ('YYYY-MM-DD' a 'YYYY-MM-DD')
 * en un rango semiabierto de fecha-hora [desde 00:00, hasta + 1 día 00:00).
 */
function rangoInclusivo(desde, hasta) {
  const [a, m, d] = hasta.split('-').map(Number);
  return {
    desde: `${desde} 00:00:00`,
    hasta: aFechaHora(new Date(a, m - 1, d + 1)),
  };
}

module.exports = { aFecha, aFechaHora, inicioDelDia, sumarDias, inicioDelMes, rangoInclusivo };
