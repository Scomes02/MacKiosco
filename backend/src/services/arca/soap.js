'use strict';

const https = require('https');
const http = require('http');
const { XMLParser } = require('fast-xml-parser');
const AppError = require('../../utils/AppError');

/**
 * Cliente SOAP mínimo para los servicios web de ARCA (ex AFIP).
 * Los servidores de ARCA usan parámetros de cifrado antiguos, por eso se baja el
 * nivel de seguridad de OpenSSL SOLO para estas conexiones.
 */
const agenteArca = new https.Agent({ ciphers: 'DEFAULT@SECLEVEL=0', minVersion: 'TLSv1.2', keepAlive: false });

const parser = new XMLParser({
  ignoreAttributes: true,
  removeNSPrefix: true,
  parseTagValue: false, // los CAE y números largos deben quedar como texto
  trimValues: true,
});

const TIEMPO_MAXIMO_MS = 25000;

function escaparXml(valor) {
  return String(valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function parsearXml(xml) {
  return parser.parse(xml);
}

/** Devuelve siempre un array (el parser entrega un objeto cuando hay un solo elemento). */
function comoLista(valor) {
  if (valor === undefined || valor === null || valor === '') return [];
  return Array.isArray(valor) ? valor : [valor];
}

/**
 * Envía un pedido SOAP y devuelve el contenido de <Body> ya convertido a objeto.
 * Lanza un AppError 503 con un mensaje claro si no hay conexión o ARCA no responde.
 */
function enviar(url, soapAction, cuerpoXml) {
  const sobre =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/">' +
    `<soapenv:Header/><soapenv:Body>${cuerpoXml}</soapenv:Body></soapenv:Envelope>`;

  const destino = new URL(url);
  const esHttps = destino.protocol === 'https:';
  const opciones = {
    method: 'POST',
    hostname: destino.hostname,
    port: destino.port || (esHttps ? 443 : 80),
    path: destino.pathname + destino.search,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': Buffer.byteLength(sobre),
      SOAPAction: `"${soapAction}"`,
    },
    timeout: TIEMPO_MAXIMO_MS,
    ...(esHttps ? { agent: agenteArca } : {}),
  };

  return new Promise((resolve, reject) => {
    const sinConexion = (detalle) =>
      reject(
        new AppError(
          503,
          `No se pudo conectar con ARCA (${detalle}). Verificá la conexión a internet e intentá nuevamente.`,
          'ARCA_SIN_CONEXION'
        )
      );

    const pedido = (esHttps ? https : http).request(opciones, (respuesta) => {
      const partes = [];
      respuesta.on('data', (parte) => partes.push(parte));
      respuesta.on('end', () => {
        const texto = Buffer.concat(partes).toString('utf8');
        let cuerpo;
        try {
          cuerpo = parsearXml(texto)?.Envelope?.Body;
        } catch {
          cuerpo = null;
        }
        if (!cuerpo) {
          return reject(
            new AppError(502, `ARCA devolvió una respuesta inesperada (HTTP ${respuesta.statusCode}).`, 'ARCA_RESPUESTA_INVALIDA')
          );
        }
        if (cuerpo.Fault) {
          const motivo = cuerpo.Fault.faultstring || cuerpo.Fault.Reason?.Text || 'error desconocido';
          const error = new AppError(502, `ARCA rechazó el pedido: ${motivo}`, 'ARCA_ERROR');
          error.faultCode = String(cuerpo.Fault.faultcode || '');
          return reject(error);
        }
        return resolve(cuerpo);
      });
    });

    pedido.on('timeout', () => pedido.destroy(new Error('tiempo de espera agotado')));
    pedido.on('error', (error) => sinConexion(error.code || error.message));
    pedido.end(sobre);
  });
}

module.exports = { enviar, escaparXml, parsearXml, comoLista };
