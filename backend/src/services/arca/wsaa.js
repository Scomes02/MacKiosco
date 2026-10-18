'use strict';

const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const { aFechaHora } = require('../../utils/fechas');
const fiscalRepo = require('../../repositories/fiscal.repository');
const certificados = require('./certificados');
const soap = require('./soap');

/**
 * WSAA: servicio de autenticación de ARCA.
 * Entrega un "ticket de acceso" (token + firma) válido por 12 horas para usar la facturación.
 * ARCA no permite pedir otro mientras el anterior siga vigente, por eso se guarda en la base.
 */

const SERVICIO = 'wsfe';
const dos = (n) => String(n).padStart(2, '0');

/** Fecha en formato ISO con zona horaria local (ej.: 2026-10-01T12:00:00-03:00). */
function fechaIso(fecha) {
  const desfase = -fecha.getTimezoneOffset();
  const signo = desfase >= 0 ? '+' : '-';
  const zona = `${signo}${dos(Math.floor(Math.abs(desfase) / 60))}:${dos(Math.abs(desfase) % 60)}`;
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:${dos(fecha.getSeconds())}${zona}`
  );
}

function armarPedido() {
  const ahora = Date.now();
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<loginTicketRequest version="1.0"><header>' +
    `<uniqueId>${Math.floor(ahora / 1000)}</uniqueId>` +
    `<generationTime>${fechaIso(new Date(ahora - 10 * 60 * 1000))}</generationTime>` +
    `<expirationTime>${fechaIso(new Date(ahora + 10 * 60 * 1000))}</expirationTime>` +
    `</header><service>${SERVICIO}</service></loginTicketRequest>`
  );
}

/** Traduce los rechazos más comunes de ARCA a una explicación entendible. */
function explicarRechazo(error) {
  const texto = `${error.faultCode || ''} ${error.message}`;
  if (/cms\.cert\.untrusted|cms\.cert\.notFound|cms\.bad/i.test(texto)) {
    return 'ARCA no reconoce el certificado cargado. Verificá que sea el certificado de este ambiente (pruebas o producción) y que no esté vencido.';
  }
  if (/notAuthorized|computador no autorizado/i.test(texto)) {
    return 'El certificado no está autorizado a usar la facturación electrónica. En la web de ARCA, asociá el certificado al servicio "Facturación Electrónica" (wsfe).';
  }
  if (/alreadyAuthenticated/i.test(texto)) {
    return 'ARCA ya entregó un acceso vigente para este certificado y todavía no venció. Esperá unos minutos e intentá de nuevo.';
  }
  if (/expirationTime|generationTime/i.test(texto)) {
    return 'ARCA rechazó el pedido por la fecha y hora. Verificá que el reloj de esta computadora esté en hora.';
  }
  return null;
}

/**
 * Devuelve { token, firma } para el ambiente indicado, reutilizando el ticket guardado si sigue vigente.
 */
async function obtenerAcceso(ambiente, cuit) {
  const guardado = await fiscalRepo.obtenerTicket(ambiente, SERVICIO);
  if (guardado && guardado.cuit === cuit) return { token: guardado.token, firma: guardado.firma };

  const cms = certificados.firmarCms(armarPedido(), ambiente);
  let cuerpo;
  try {
    cuerpo = await soap.enviar(
      env.arca.urls[ambiente].wsaa,
      '',
      `<loginCms xmlns="http://wsaa.view.sua.dvadac.desein.afip.gov"><in0>${cms}</in0></loginCms>`
    );
  } catch (error) {
    const explicacion = error.code === 'ARCA_ERROR' ? explicarRechazo(error) : null;
    if (explicacion) throw new AppError(502, explicacion, 'ARCA_ACCESO_RECHAZADO');
    throw error;
  }

  // La respuesta trae otro XML (el ticket) como texto dentro de <loginCmsReturn>.
  const ticket = soap.parsearXml(String(cuerpo?.loginCmsResponse?.loginCmsReturn || ''))?.loginTicketResponse;
  const token = ticket?.credentials?.token;
  const firma = ticket?.credentials?.sign;
  const vence = ticket?.header?.expirationTime ? new Date(ticket.header.expirationTime) : null;
  if (!token || !firma || !vence || Number.isNaN(vence.getTime())) {
    throw new AppError(502, 'ARCA devolvió un acceso con un formato inesperado.', 'ARCA_RESPUESTA_INVALIDA');
  }

  await fiscalRepo.guardarTicket({ ambiente, servicio: SERVICIO, cuit, token, firma, vence_en: aFechaHora(vence) });
  return { token, firma };
}

/** Descarta el ticket guardado (por ejemplo, si ARCA dice que ya no es válido). */
async function olvidarAcceso(ambiente) {
  await fiscalRepo.borrarTicket(ambiente, SERVICIO);
}

module.exports = { obtenerAcceso, olvidarAcceso };
