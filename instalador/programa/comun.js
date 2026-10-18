'use strict';

/**
 * Funciones compartidas por los scripts que corren en la PC del local:
 * configurar.js (al instalar o actualizar), desinstalar.js y servicio.js.
 *
 * Distribución en una PC instalada:
 *   C:\Program Files\MacKiosco\        el programa (se reemplaza al actualizar)
 *     app\backend, app\frontend\dist   la aplicación
 *     runtime\node, runtime\mysql      Node.js y MySQL incluidos
 *     instalador\                      estos scripts
 *   C:\ProgramData\MacKiosco\          los datos del local (NUNCA se tocan al actualizar)
 *     config\.env                      configuración y claves propias de esta PC
 *     mysql\data, mysql\my.ini         base de datos
 *     certs\                           certificados de ARCA
 *     backups\                         copias de seguridad
 *     logs\                            registros
 */

const fs = require('fs');
const net = require('net');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const NOMBRE = 'MacKiosco';
const SERVICIO_BASE = 'MacKioscoDB';
const TAREA = 'MacKiosco';
const REGLA_FIREWALL = 'MacKiosco';
const CLAVE_REGISTRO = 'HKLM\\SOFTWARE\\MacKiosco';

const carpetaPrograma = path.resolve(__dirname, '..');
const carpetaDatos = process.env.MACKIOSCO_DATOS || path.join(process.env.ProgramData || 'C:\\ProgramData', NOMBRE);

const rutas = {
  programa: carpetaPrograma,
  datos: carpetaDatos,
  backend: path.join(carpetaPrograma, 'app', 'backend'),
  node: path.join(carpetaPrograma, 'runtime', 'node', 'node.exe'),
  mysqlBase: path.join(carpetaPrograma, 'runtime', 'mysql'),
  mysqld: path.join(carpetaPrograma, 'runtime', 'mysql', 'bin', 'mysqld.exe'),
  mysqldump: path.join(carpetaPrograma, 'runtime', 'mysql', 'bin', 'mysqldump.exe'),
  mysqlCliente: path.join(carpetaPrograma, 'runtime', 'mysql', 'bin', 'mysql.exe'),
  servicio: path.join(carpetaPrograma, 'instalador', 'servicio.js'),
  config: path.join(carpetaDatos, 'config'),
  archivoEnv: path.join(carpetaDatos, 'config', '.env'),
  archivoInstalacion: path.join(carpetaDatos, 'config', 'instalacion.json'),
  archivoPuerto: path.join(carpetaDatos, 'puerto.txt'),
  mysqlDatos: path.join(carpetaDatos, 'mysql', 'data'),
  mysqlIni: path.join(carpetaDatos, 'mysql', 'my.ini'),
  certificados: path.join(carpetaDatos, 'certs'),
  copias: path.join(carpetaDatos, 'backups'),
  logs: path.join(carpetaDatos, 'logs'),
  archivoLog: path.join(carpetaDatos, 'logs', 'instalacion.log'),
  archivoError: path.join(carpetaDatos, 'logs', 'ultimo-error.txt'),
};

function registrar(mensaje) {
  const linea = `${new Date().toLocaleString('sv-SE')} ${mensaje}`;
  console.log(linea);
  try {
    fs.mkdirSync(rutas.logs, { recursive: true });
    fs.appendFileSync(rutas.archivoLog, `${linea}\r\n`);
  } catch {
    // Sin registro en archivo: se sigue igual.
  }
}

/** Ejecuta un programa y devuelve su salida. Lanza un error con el detalle si termina mal. */
function ejecutar(programa, argumentos, opciones = {}) {
  try {
    return execFileSync(programa, argumentos, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], ...opciones });
  } catch (error) {
    const detalle = `${error.stdout || ''}${error.stderr || ''}`.trim() || error.message;
    throw new Error(`Falló "${path.basename(programa)} ${argumentos.join(' ')}": ${detalle}`);
  }
}

/** Igual que ejecutar, pero no se detiene si falla (para pasos que pueden no aplicar). */
function intentar(programa, argumentos, opciones) {
  try {
    return ejecutar(programa, argumentos, opciones);
  } catch (error) {
    registrar(`  (se ignora) ${error.message}`);
    return null;
  }
}

function puertoLibre(puerto) {
  return new Promise((resolve) => {
    const servidor = net.createServer();
    servidor.once('error', () => resolve(false));
    servidor.once('listening', () => servidor.close(() => resolve(true)));
    servidor.listen(puerto, '0.0.0.0');
  });
}

/** Primer puerto libre a partir del preferido (por si la PC ya tiene otro programa usándolo). */
async function elegirPuerto(preferido, intentos = 30) {
  for (let puerto = preferido; puerto < preferido + intentos; puerto += 1) {
    if (await puertoLibre(puerto)) return puerto;
  }
  throw new Error(`No se encontró un puerto libre cerca del ${preferido}.`);
}

function puertoAbierto(puerto, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port: puerto, host });
    socket.setTimeout(1500);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    const fallo = () => {
      socket.destroy();
      resolve(false);
    };
    socket.once('error', fallo);
    socket.once('timeout', fallo);
  });
}

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function esperarPuerto(puerto, segundos, descripcion) {
  const limite = Date.now() + segundos * 1000;
  while (Date.now() < limite) {
    if (await puertoAbierto(puerto)) return;
    await esperar(1000);
  }
  throw new Error(`${descripcion} no respondió en el puerto ${puerto} después de ${segundos} segundos.`);
}

/** Lee un archivo .env simple (CLAVE=valor) y lo devuelve como objeto. */
function leerEnv(archivo) {
  const valores = {};
  if (!fs.existsSync(archivo)) return valores;
  for (const linea of fs.readFileSync(archivo, 'utf8').split(/\r?\n/)) {
    const coincidencia = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (coincidencia) valores[coincidencia[1]] = coincidencia[2];
  }
  return valores;
}

/** Ejecuta un script del backend con Node, usando la configuración de esta PC. */
function ejecutarScriptDelBackend(script, argumentos = []) {
  return ejecutar(rutas.node, [path.join(rutas.backend, 'scripts', script), ...argumentos], {
    cwd: rutas.backend,
    env: { ...process.env, KIOSCO_ENV_FILE: rutas.archivoEnv },
  });
}

module.exports = {
  NOMBRE,
  SERVICIO_BASE,
  TAREA,
  REGLA_FIREWALL,
  CLAVE_REGISTRO,
  rutas,
  registrar,
  ejecutar,
  intentar,
  elegirPuerto,
  puertoAbierto,
  esperar,
  esperarPuerto,
  leerEnv,
  ejecutarScriptDelBackend,
  spawn,
};
