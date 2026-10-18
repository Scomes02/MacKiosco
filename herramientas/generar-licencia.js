'use strict';

/**
 * HERRAMIENTA DEL FABRICANTE - Generador de claves de licencia.
 * Solo funciona en la PC que tiene la clave privada (carpeta "licencias").
 * NUNCA se incluye en el instalador ni se entrega a los locales.
 *
 * Uso interactivo (pregunta los datos):
 *   node herramientas/generar-licencia.js
 *
 * Uso directo:
 *   node herramientas/generar-licencia.js --equipo ABCD-EFGH-JKMN-PQRS --titular "Kiosco Don Pepe" --meses 12
 *   node herramientas/generar-licencia.js --equipo ABCD-EFGH-JKMN-PQRS --titular "Kiosco Don Pepe" --vence 2027-12-31
 *
 * Crear el par de claves (una sola vez, antes de armar el primer instalador):
 *   node herramientas/generar-licencia.js --crear-claves
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { normalizarCodigo, esFechaValida, firmarLicencia, leerLicencia } = require('../backend/src/utils/licencia-formato');

const RAIZ = path.join(__dirname, '..');
const CARPETA_LICENCIAS = path.join(RAIZ, 'licencias');
const ARCHIVO_PRIVADA = path.join(CARPETA_LICENCIAS, 'clave-privada.pem');
const ARCHIVO_PUBLICA = path.join(RAIZ, 'backend', 'src', 'config', 'licencia-publica.pem');
const ARCHIVO_EMITIDAS = path.join(CARPETA_LICENCIAS, 'emitidas.csv');

const dos = (n) => String(n).padStart(2, '0');
const aFecha = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const aFechaLegible = (texto) => texto.split('-').reverse().join('/');

/** Crea el par de claves si no existe. Jamás pisa una clave privada existente. */
function asegurarClaves() {
  if (fs.existsSync(ARCHIVO_PRIVADA)) {
    // La clave pública siempre se regenera a partir de la privada, para que nunca queden desparejas.
    const publica = crypto.createPublicKey(fs.readFileSync(ARCHIVO_PRIVADA, 'utf8')).export({ type: 'spki', format: 'pem' });
    if (!fs.existsSync(ARCHIVO_PUBLICA) || fs.readFileSync(ARCHIVO_PUBLICA, 'utf8') !== publica) {
      fs.writeFileSync(ARCHIVO_PUBLICA, publica);
    }
    return false;
  }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.mkdirSync(CARPETA_LICENCIAS, { recursive: true });
  fs.writeFileSync(ARCHIVO_PRIVADA, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
  fs.writeFileSync(ARCHIVO_PUBLICA, publicKey.export({ type: 'spki', format: 'pem' }));
  return true;
}

function leerArgumentos() {
  const argumentos = {};
  const lista = process.argv.slice(2);
  for (let i = 0; i < lista.length; i += 1) {
    if (lista[i].startsWith('--')) {
      const siguiente = lista[i + 1];
      const tieneValor = siguiente !== undefined && !siguiente.startsWith('--');
      argumentos[lista[i].slice(2)] = tieneValor ? siguiente : true;
      if (tieneValor) i += 1;
    }
  }
  return argumentos;
}

function vencimientoDesde({ meses, vence }) {
  if (vence) {
    if (!esFechaValida(vence)) throw new Error('La fecha de vencimiento debe tener el formato AAAA-MM-DD.');
    return vence;
  }
  const cantidad = Number.parseInt(meses, 10);
  if (!Number.isInteger(cantidad) || cantidad < 1 || cantidad > 240) {
    throw new Error('Indicá la duración en meses (entre 1 y 240) o una fecha de vencimiento.');
  }
  const fecha = new Date();
  fecha.setMonth(fecha.getMonth() + cantidad);
  return aFecha(fecha);
}

function generar({ equipo, titular, meses, vence }) {
  const codigo = normalizarCodigo(equipo);
  if (!codigo) throw new Error('El código de equipo no es válido. Tiene 16 caracteres, por ejemplo ABCD-EFGH-JKMN-PQRS.');
  const nombre = String(titular || '').trim().slice(0, 60);
  if (!nombre) throw new Error('Indicá el titular de la licencia (nombre del kiosco o del cliente).');
  const fechaVencimiento = vencimientoDesde({ meses, vence });
  if (new Date(`${fechaVencimiento}T23:59:59`) < new Date()) throw new Error('La fecha de vencimiento ya pasó.');

  const privada = fs.readFileSync(ARCHIVO_PRIVADA, 'utf8');
  const clave = firmarLicencia({ equipo: codigo, vence: fechaVencimiento, titular: nombre }, privada);

  // Control: la clave recién generada tiene que verificarse con la clave pública que usa la aplicación.
  if (!leerLicencia(clave, fs.readFileSync(ARCHIVO_PUBLICA, 'utf8'))) {
    throw new Error('La clave generada no se pudo verificar. Revisá que las claves pública y privada correspondan.');
  }

  const nueva = !fs.existsSync(ARCHIVO_EMITIDAS);
  const fila = [aFecha(new Date()), codigo, nombre.replace(/;/g, ','), fechaVencimiento, clave].join(';');
  fs.appendFileSync(ARCHIVO_EMITIDAS, `${nueva ? 'emitida;equipo;titular;vence;clave\r\n' : ''}${fila}\r\n`);

  return { codigo, nombre, fechaVencimiento, clave };
}

function mostrar({ codigo, nombre, fechaVencimiento, clave }) {
  console.log('\n----------------------------------------------------------------');
  console.log(` Titular:  ${nombre}`);
  console.log(` Equipo:   ${codigo}`);
  console.log(` Vence:    ${aFechaLegible(fechaVencimiento)}`);
  console.log('----------------------------------------------------------------');
  console.log(' CLAVE DE LICENCIA (copiala completa y enviásela al cliente):\n');
  console.log(clave);
  console.log('\n----------------------------------------------------------------');
  console.log(` Quedó registrada en ${path.relative(RAIZ, ARCHIVO_EMITIDAS)}`);
}

async function modoInteractivo() {
  const consola = readline.createInterface({ input: process.stdin, output: process.stdout });
  const preguntar = (texto) => new Promise((resolve) => consola.question(texto, (respuesta) => resolve(respuesta.trim())));
  try {
    console.log('\n=== MacKiosco · Generador de licencias ===\n');
    console.log('El cliente ve su código de equipo en Configuración > Licencia.\n');
    const equipo = await preguntar('Código de equipo: ');
    const titular = await preguntar('Titular (nombre del kiosco o cliente): ');
    const duracion = await preguntar('Duración en meses, o fecha de vencimiento AAAA-MM-DD [12]: ');
    const datos = /^\d{4}-\d{2}-\d{2}$/.test(duracion) ? { vence: duracion } : { meses: duracion || '12' };
    mostrar(generar({ equipo, titular, ...datos }));
  } finally {
    consola.close();
  }
}

async function main() {
  const argumentos = leerArgumentos();

  if (argumentos['crear-claves']) {
    const creadas = asegurarClaves();
    console.log(
      creadas
        ? 'Se creó el par de claves.\n  Privada: licencias/clave-privada.pem  (GUARDALA: hacé una copia en un lugar seguro y no la compartas)\n  Pública: backend/src/config/licencia-publica.pem  (va dentro del instalador)'
        : 'Las claves ya existían: no se modificó nada.'
    );
    return;
  }

  if (!fs.existsSync(ARCHIVO_PRIVADA)) {
    throw new Error('No se encontró la clave privada (licencias/clave-privada.pem). Ejecutá primero:  node herramientas/generar-licencia.js --crear-claves');
  }
  asegurarClaves();

  if (argumentos.equipo) mostrar(generar(argumentos));
  else await modoInteractivo();
}

main().catch((error) => {
  console.error(`\nError: ${error.message}\n`);
  process.exit(1);
});
