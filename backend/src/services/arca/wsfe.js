'use strict';

const env = require('../../config/env');
const AppError = require('../../utils/AppError');
const soap = require('./soap');

/**
 * WSFEv1: servicio de factura electrónica de ARCA.
 * Acá solo se arman los pedidos y se interpretan las respuestas; las reglas de negocio
 * (qué facturar, a quién y cuándo) están en facturacion.service.js
 */

const ESPACIO = 'http://ar.gov.afip.dif.FEV1/';

function etiqueta(nombre, valor) {
  return `<${nombre}>${soap.escaparXml(valor)}</${nombre}>`;
}

function autenticacion({ token, firma, cuit }) {
  return `<Auth>${etiqueta('Token', token)}${etiqueta('Sign', firma)}${etiqueta('Cuit', cuit)}</Auth>`;
}

/** Une los mensajes de error/observación que devuelve ARCA en un solo texto. */
function unirMensajes(...grupos) {
  return grupos
    .flatMap((grupo) => soap.comoLista(grupo))
    .map((item) => `${item.Msg} (código ${item.Code})`)
    .join(' · ');
}

async function llamar(ambiente, metodo, contenido) {
  const cuerpo = await soap.enviar(
    env.arca.urls[ambiente].wsfe,
    `${ESPACIO}${metodo}`,
    `<${metodo} xmlns="${ESPACIO}">${contenido}</${metodo}>`
  );
  const resultado = cuerpo?.[`${metodo}Response`]?.[`${metodo}Result`];
  if (!resultado) {
    throw new AppError(502, 'ARCA devolvió una respuesta con un formato inesperado.', 'ARCA_RESPUESTA_INVALIDA');
  }
  return resultado;
}

/** Los códigos 600 a 602 indican que el ticket de acceso no es válido o venció. */
function esErrorDeAcceso(errores) {
  return soap.comoLista(errores).some((e) => ['600', '601', '602'].includes(String(e.Code)));
}

/** Estado de los servidores de ARCA (no requiere certificado). */
async function estadoServidores(ambiente) {
  const r = await llamar(ambiente, 'FEDummy', '');
  return { aplicacion: r.AppServer, base_de_datos: r.DbServer, autenticacion: r.AuthServer };
}

/** Número del último comprobante autorizado para un punto de venta y tipo de comprobante. */
async function ultimoAutorizado(ambiente, auth, { puntoVenta, tipo }) {
  const r = await llamar(
    ambiente,
    'FECompUltimoAutorizado',
    autenticacion(auth) + etiqueta('PtoVta', puntoVenta) + etiqueta('CbteTipo', tipo)
  );
  const errores = r.Errors?.Err;
  if (errores) {
    const error = new AppError(502, `ARCA informó un error: ${unirMensajes(errores)}`, 'ARCA_ERROR');
    error.accesoInvalido = esErrorDeAcceso(errores);
    throw error;
  }
  return Number(r.CbteNro);
}

/**
 * Consulta un comprobante ya emitido. Devuelve null si ese número no existe en ARCA.
 * Se usa para recuperar el CAE cuando se cortó la conexión justo después de autorizar.
 */
async function consultar(ambiente, auth, { puntoVenta, tipo, numero }) {
  const r = await llamar(
    ambiente,
    'FECompConsultar',
    autenticacion(auth) +
      `<FeCompConsReq>${etiqueta('CbteTipo', tipo)}${etiqueta('CbteNro', numero)}${etiqueta('PtoVta', puntoVenta)}</FeCompConsReq>`
  );
  const encontrado = r.ResultGet;
  if (!encontrado || !encontrado.CodAutorizacion) return null;
  return {
    numero: Number(encontrado.CbteDesde),
    fecha: encontrado.CbteFch,
    total: Number(encontrado.ImpTotal),
    doc_nro: String(encontrado.DocNro),
    cae: String(encontrado.CodAutorizacion),
    cae_vencimiento: encontrado.FchVto,
    resultado: encontrado.Resultado,
  };
}

/**
 * Solicita el CAE de un comprobante de productos (Concepto 1).
 * @returns {{ aprobado: boolean, cae?: string, cae_vencimiento?: string, mensaje: string }}
 */
async function solicitarCae(ambiente, auth, c) {
  const importe = (valor) => Number(valor).toFixed(2);

  const asociados = c.asociado
    ? '<CbtesAsoc><CbteAsoc>' +
      etiqueta('Tipo', c.asociado.tipo) +
      etiqueta('PtoVta', c.asociado.puntoVenta) +
      etiqueta('Nro', c.asociado.numero) +
      etiqueta('Cuit', auth.cuit) +
      etiqueta('CbteFch', c.asociado.fecha) +
      '</CbteAsoc></CbtesAsoc>'
    : '';

  const alicuotas = c.alicuotas.length
    ? `<Iva>${c.alicuotas
        .map((a) => `<AlicIva>${etiqueta('Id', a.id)}${etiqueta('BaseImp', importe(a.base))}${etiqueta('Importe', importe(a.importe))}</AlicIva>`)
        .join('')}</Iva>`
    : '';

  // El orden de los campos es obligatorio: así lo define el servicio de ARCA.
  const detalle =
    etiqueta('Concepto', 1) +
    etiqueta('DocTipo', c.docTipo) +
    etiqueta('DocNro', c.docNro) +
    etiqueta('CbteDesde', c.numero) +
    etiqueta('CbteHasta', c.numero) +
    etiqueta('CbteFch', c.fecha) +
    etiqueta('ImpTotal', importe(c.total)) +
    etiqueta('ImpTotConc', importe(c.noGravado)) +
    etiqueta('ImpNeto', importe(c.neto)) +
    etiqueta('ImpOpEx', importe(c.exento)) +
    etiqueta('ImpTrib', importe(0)) +
    etiqueta('ImpIVA', importe(c.iva)) +
    etiqueta('MonId', 'PES') +
    etiqueta('MonCotiz', 1) +
    etiqueta('CondicionIVAReceptorId', c.condicionIvaReceptor) +
    asociados +
    alicuotas;

  const r = await llamar(
    ambiente,
    'FECAESolicitar',
    autenticacion(auth) +
      '<FeCAEReq>' +
      `<FeCabReq>${etiqueta('CantReg', 1)}${etiqueta('PtoVta', c.puntoVenta)}${etiqueta('CbteTipo', c.tipo)}</FeCabReq>` +
      `<FeDetReq><FECAEDetRequest>${detalle}</FECAEDetRequest></FeDetReq>` +
      '</FeCAEReq>'
  );

  const errores = r.Errors?.Err;
  const respuesta = soap.comoLista(r.FeDetResp?.FECAEDetResponse)[0];
  const observaciones = respuesta?.Observaciones?.Obs;

  if (respuesta?.Resultado === 'A' && respuesta.CAE) {
    return {
      aprobado: true,
      cae: String(respuesta.CAE),
      cae_vencimiento: String(respuesta.CAEFchVto),
      mensaje: unirMensajes(observaciones),
    };
  }

  if (errores && esErrorDeAcceso(errores)) {
    const error = new AppError(502, `ARCA informó un error: ${unirMensajes(errores)}`, 'ARCA_ERROR');
    error.accesoInvalido = true;
    throw error;
  }

  return {
    aprobado: false,
    mensaje: unirMensajes(errores, observaciones) || 'ARCA rechazó el comprobante sin informar el motivo.',
  };
}

module.exports = { estadoServidores, ultimoAutorizado, consultar, solicitarCae };
