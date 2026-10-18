'use strict';

/**
 * Utilidades para operar con importes sin errores de punto flotante.
 * Todos los cálculos se hacen en centavos (enteros) y se vuelven a pesos al final.
 */

function aCentavos(importe) {
  return Math.round(Number(importe) * 100);
}

function aPesos(centavos) {
  return Math.round(centavos) / 100;
}

/** Redondea un importe a 2 decimales. */
function redondear(importe) {
  return aPesos(aCentavos(importe));
}

module.exports = { aCentavos, aPesos, redondear };
