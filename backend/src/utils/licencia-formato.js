'use strict';

const crypto = require('crypto');

/**
 * Formato de las licencias. Lo comparten la aplicación (que solo VERIFICA con la clave pública)
 * y la herramienta del fabricante (que FIRMA con la clave privada, que nunca se distribuye).
 *
 *   Clave de licencia:  MK1.<datos en base64url>.<firma Ed25519 en base64url>
 *   Datos:              { "e": "CÓDIGO-DE-EQUIPO", "v": "AAAA-MM-DD", "t": "Titular" }
 */

const PREFIJO = 'MK1';
const ALFABETO = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // base32 sin letras que se confunden (I, L, O, U)

/** Convierte el identificador interno de la PC en un código corto y legible: XXXX-XXXX-XXXX-XXXX. */
function codigoDeEquipo(identificador) {
  const hash = crypto.createHash('sha256').update(`mackiosco:${String(identificador).trim().toLowerCase()}`).digest();
  let bits = '';
  for (const byte of hash.subarray(0, 10)) bits += byte.toString(2).padStart(8, '0');
  let codigo = '';
  for (let i = 0; i < 80; i += 5) codigo += ALFABETO[Number.parseInt(bits.slice(i, i + 5), 2)];
  return codigo.match(/.{4}/g).join('-');
}

/** Acepta el código con o sin guiones, en mayúsculas o minúsculas, y lo devuelve normalizado. */
function normalizarCodigo(texto) {
  const limpio = String(texto || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  return limpio.length === 16 ? limpio.match(/.{4}/g).join('-') : null;
}

function esFechaValida(texto) {
  return /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(new Date(`${texto}T00:00:00`).getTime());
}

/** Genera una clave firmada. Solo la usa la herramienta del fabricante. */
function firmarLicencia({ equipo, vence, titular }, clavePrivadaPem) {
  const datos = Buffer.from(JSON.stringify({ e: equipo, v: vence, t: titular || '' }), 'utf8');
  const firma = crypto.sign(null, datos, crypto.createPrivateKey(clavePrivadaPem));
  return `${PREFIJO}.${datos.toString('base64url')}.${firma.toString('base64url')}`;
}

/**
 * Verifica la firma de una clave y devuelve sus datos, o null si no es auténtica.
 * No controla el equipo ni el vencimiento: eso lo decide quien la usa.
 */
function leerLicencia(clave, clavePublicaPem) {
  const partes = String(clave || '').trim().replace(/\s+/g, '').split('.');
  if (partes.length !== 3 || partes[0] !== PREFIJO) return null;
  try {
    const datos = Buffer.from(partes[1], 'base64url');
    const firma = Buffer.from(partes[2], 'base64url');
    if (!crypto.verify(null, datos, crypto.createPublicKey(clavePublicaPem), firma)) return null;
    const { e, v, t } = JSON.parse(datos.toString('utf8'));
    if (!normalizarCodigo(e) || !esFechaValida(v)) return null;
    return { equipo: normalizarCodigo(e), vence: v, titular: String(t || '') };
  } catch {
    return null;
  }
}

module.exports = { codigoDeEquipo, normalizarCodigo, esFechaValida, firmarLicencia, leerLicencia };
