'use strict';

const fs = require('fs');
const path = require('path');
const forge = require('node-forge');
const env = require('../../config/env');
const AppError = require('../../utils/AppError');

/**
 * Manejo de la clave privada y los certificados digitales que exige ARCA.
 *
 *   certs/clave.key           clave privada (se genera acá y NUNCA sale del servidor)
 *   certs/homologacion.crt    certificado del entorno de pruebas
 *   certs/produccion.crt      certificado para facturar de verdad
 */

const ARCHIVO_CLAVE = 'clave.key';
const ARCHIVO_CERTIFICADO = { HOMOLOGACION: 'homologacion.crt', PRODUCCION: 'produccion.crt' };

const rutaClave = () => path.join(env.arca.carpetaCertificados, ARCHIVO_CLAVE);
const rutaCertificado = (ambiente) => path.join(env.arca.carpetaCertificados, ARCHIVO_CERTIFICADO[ambiente]);

function leerSiExiste(ruta) {
  return fs.existsSync(ruta) ? fs.readFileSync(ruta, 'utf8') : null;
}

function guardar(ruta, contenido) {
  fs.mkdirSync(env.arca.carpetaCertificados, { recursive: true });
  fs.writeFileSync(ruta, contenido, { encoding: 'utf8', mode: 0o600 });
}

function existeClave() {
  return fs.existsSync(rutaClave());
}

/** Genera la clave privada RSA de 2048 bits (solo si todavía no existe). */
function obtenerOCrearClave() {
  const existente = leerSiExiste(rutaClave());
  if (existente) return forge.pki.privateKeyFromPem(existente);

  const { privateKey } = forge.pki.rsa.generateKeyPair({ bits: 2048, e: 0x10001 });
  guardar(rutaClave(), forge.pki.privateKeyToPem(privateKey));
  return privateKey;
}

/**
 * Genera el "pedido de certificado" (CSR) que se sube a la web de ARCA.
 * El CSR no es secreto: solo contiene la clave pública y los datos del comercio.
 */
function generarPedido({ cuit, razonSocial, alias }) {
  const clave = obtenerOCrearClave();
  const publica = forge.pki.setRsaPublicKey(clave.n, clave.e);

  const pedido = forge.pki.createCertificationRequest();
  pedido.publicKey = publica;
  pedido.setSubject([
    { name: 'countryName', value: 'AR' },
    { name: 'organizationName', value: razonSocial },
    { name: 'commonName', value: alias },
    { name: 'serialNumber', value: `CUIT ${cuit}` },
  ]);
  pedido.sign(clave, forge.md.sha256.create());
  return forge.pki.certificationRequestToPem(pedido);
}

function describir(certificado) {
  const campo = (nombre) => certificado.subject.getField(nombre)?.value || null;
  return {
    titular: campo('CN'),
    cuit: (campo({ name: 'serialNumber' }) || '').replace(/\D/g, '') || null,
    emisor: certificado.issuer.getField('CN')?.value || null,
    valido_desde: certificado.validity.notBefore.toISOString(),
    valido_hasta: certificado.validity.notAfter.toISOString(),
    vencido: certificado.validity.notAfter < new Date(),
  };
}

/** Valida y guarda el certificado (.crt) que entrega ARCA para el ambiente indicado. */
function guardarCertificado(ambiente, pem, cuitDelComercio) {
  let certificado;
  try {
    certificado = forge.pki.certificateFromPem(pem);
  } catch {
    throw AppError.badRequest(
      'El texto pegado no es un certificado válido. Tiene que empezar con "-----BEGIN CERTIFICATE-----".'
    );
  }
  if (!existeClave()) {
    throw AppError.conflict('Primero generá el pedido de certificado (paso 1): todavía no hay una clave privada en este servidor.');
  }
  const clave = forge.pki.privateKeyFromPem(leerSiExiste(rutaClave()));
  if (certificado.publicKey.n.toString(16) !== clave.n.toString(16)) {
    throw AppError.badRequest(
      'Este certificado no corresponde a la clave generada en este sistema. ' +
        'Tiene que ser el que ARCA emitió a partir del pedido (CSR) descargado desde esta pantalla.'
    );
  }
  if (certificado.validity.notAfter < new Date()) {
    throw AppError.badRequest('El certificado está vencido. Generá uno nuevo en la web de ARCA.');
  }
  const datos = describir(certificado);
  if (datos.cuit && cuitDelComercio && datos.cuit !== cuitDelComercio) {
    throw AppError.badRequest(
      `El certificado pertenece al CUIT ${datos.cuit}, pero el comercio está configurado con el CUIT ${cuitDelComercio}.`
    );
  }
  guardar(rutaCertificado(ambiente), forge.pki.certificateToPem(certificado));
  return datos;
}

/** Datos del certificado cargado para un ambiente, o null si todavía no se cargó. */
function estadoCertificado(ambiente) {
  const pem = leerSiExiste(rutaCertificado(ambiente));
  if (!pem) return null;
  try {
    return describir(forge.pki.certificateFromPem(pem));
  } catch {
    return null;
  }
}

/** Clave y certificado listos para firmar (lanza un error claro si falta algo). */
function credenciales(ambiente) {
  const clavePem = leerSiExiste(rutaClave());
  const certificadoPem = leerSiExiste(rutaCertificado(ambiente));
  if (!clavePem || !certificadoPem) {
    throw new AppError(
      409,
      'Falta cargar el certificado digital de ARCA. Completá los pasos en Configuración → Facturación electrónica.',
      'ARCA_SIN_CERTIFICADO'
    );
  }
  return {
    clave: forge.pki.privateKeyFromPem(clavePem),
    certificado: forge.pki.certificateFromPem(certificadoPem),
  };
}

/** Firma un texto en formato CMS (PKCS#7), como exige el servicio de autenticación de ARCA. */
function firmarCms(contenido, ambiente) {
  const { clave, certificado } = credenciales(ambiente);
  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(contenido, 'utf8');
  p7.addCertificate(certificado);
  p7.addSigner({
    key: clave,
    certificate: certificado,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() },
    ],
  });
  p7.sign();
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes());
}

module.exports = { existeClave, generarPedido, guardarCertificado, estadoCertificado, firmarCms };
