'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { aFechaHora } = require('../utils/fechas');
const configuracionRepo = require('../repositories/configuracion.repository');

/**
 * Copias de seguridad de la base de datos.
 *
 * - Una copia automática por día (mientras el sistema esté encendido) y copias manuales a pedido.
 * - Cada copia es un archivo .sql.gz completo: sirve para restaurar todo en otra PC.
 * - Se guardan en el disco y, si se configuró, se duplican en una "carpeta extra"
 *   (pendrive, OneDrive, Google Drive, otro disco) para sobrevivir a la rotura del disco.
 * - Se conservan las últimas N copias (BACKUP_CONSERVAR, por defecto 30).
 */

const PATRON_ARCHIVO = /^kiosco-\d{4}-\d{2}-\d{2}_\d{6}\.sql\.gz$/;
const HORAS_ENTRE_COPIAS = 20;
const REVISAR_CADA_MS = 30 * 60 * 1000;

let copiaEnCurso = null;

const dos = (n) => String(n).padStart(2, '0');
function nombreDeArchivo(fecha) {
  return (
    `kiosco-${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `_${dos(fecha.getHours())}${dos(fecha.getMinutes())}${dos(fecha.getSeconds())}.sql.gz`
  );
}

/** Ejecuta mysqldump y guarda su salida comprimida. La contraseña viaja por variable de entorno, no por la línea de comandos. */
async function volcarBase(destino) {
  const proceso = spawn(
    env.copias.mysqldump,
    [
      `--host=${env.db.host}`,
      `--port=${env.db.port}`,
      `--user=${env.db.user}`,
      '--single-transaction',
      '--no-tablespaces',
      '--default-character-set=utf8mb4',
      '--add-drop-table',
      env.db.database,
    ],
    { env: { ...process.env, MYSQL_PWD: env.db.password }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let errores = '';
  proceso.stderr.on('data', (parte) => {
    errores += parte.toString();
  });
  const terminado = new Promise((resolve, reject) => {
    proceso.on('error', (error) =>
      reject(
        error.code === 'ENOENT'
          ? new Error('No se encontró el programa mysqldump. Revisá MYSQLDUMP_PATH en la configuración.')
          : error
      )
    );
    proceso.on('close', (codigo) =>
      codigo === 0 ? resolve() : reject(new Error(`mysqldump terminó con error: ${errores.trim().split('\n').pop() || codigo}`))
    );
  });

  await Promise.all([pipeline(proceso.stdout, zlib.createGzip({ level: 6 }), fs.createWriteStream(destino)), terminado]);
}

function listarEn(carpeta) {
  if (!carpeta || !fs.existsSync(carpeta)) return [];
  return fs
    .readdirSync(carpeta)
    .filter((nombre) => PATRON_ARCHIVO.test(nombre))
    .sort()
    .reverse();
}

/** Borra las copias más viejas, dejando solo las últimas `conservar`. */
function depurar(carpeta) {
  for (const nombre of listarEn(carpeta).slice(env.copias.conservar)) {
    try {
      fs.unlinkSync(path.join(carpeta, nombre));
    } catch {
      // Si no se puede borrar una copia vieja no es grave.
    }
  }
}

async function ejecutarCopia(origen) {
  const carpeta = env.copias.carpeta;
  const ahora = new Date();
  const nombre = nombreDeArchivo(ahora);
  const destino = path.join(carpeta, nombre);
  const parcial = `${destino}.parcial`;
  const config = await configuracionRepo.obtenerTodo();
  const carpetaExtra = (config.copia_carpeta_extra || '').trim();

  try {
    fs.mkdirSync(carpeta, { recursive: true });
    await volcarBase(parcial);
    if (fs.statSync(parcial).size < 200) throw new Error('la copia quedó vacía');
    fs.renameSync(parcial, destino);
    depurar(carpeta);
  } catch (error) {
    fs.rmSync(parcial, { force: true });
    await configuracionRepo.guardar({ copia_ultimo_error: `${aFechaHora(ahora)} · ${error.message}`.slice(0, 480) });
    console.error(`[copias] No se pudo hacer la copia de seguridad: ${error.message}`);
    throw new AppError(500, `No se pudo hacer la copia de seguridad: ${error.message}`, 'COPIA_FALLIDA');
  }

  // Duplicado en la carpeta extra: si falla (pendrive desconectado, etc.) la copia local igual es válida.
  let resultadoExtra = '';
  if (carpetaExtra) {
    try {
      fs.mkdirSync(carpetaExtra, { recursive: true });
      fs.copyFileSync(destino, path.join(carpetaExtra, nombre));
      depurar(carpetaExtra);
      resultadoExtra = 'OK';
    } catch (error) {
      resultadoExtra = `No se pudo copiar a la carpeta extra: ${error.code || error.message}`;
      console.error(`[copias] ${resultadoExtra}`);
    }
  }

  await configuracionRepo.guardar({
    copia_ultima_fecha: aFechaHora(ahora),
    copia_ultimo_error: '',
    copia_extra_resultado: resultadoExtra,
  });
  console.log(`[copias] Copia ${origen.toLowerCase()} creada: ${nombre}`);
  return nombre;
}

/** Hace una copia ahora. Si ya hay una en curso, espera a esa en lugar de lanzar otra. */
function crear(origen = 'MANUAL') {
  if (!copiaEnCurso) {
    copiaEnCurso = ejecutarCopia(origen).finally(() => {
      copiaEnCurso = null;
    });
  }
  return copiaEnCurso;
}

async function estado() {
  const config = await configuracionRepo.obtenerTodo();
  const carpeta = env.copias.carpeta;
  const archivos = listarEn(carpeta).map((nombre) => {
    const datos = fs.statSync(path.join(carpeta, nombre));
    return { nombre, tamano: datos.size, fecha: aFechaHora(datos.mtime) };
  });
  return {
    carpeta,
    carpeta_extra: config.copia_carpeta_extra || '',
    ultima_copia: config.copia_ultima_fecha || null,
    ultimo_error: config.copia_ultimo_error || null,
    resultado_extra: config.copia_extra_resultado || null,
    conservar: env.copias.conservar,
    archivos,
  };
}

/** Define (o quita, con texto vacío) la carpeta extra. Se comprueba que se pueda escribir en ella. */
async function configurar({ carpeta_extra }) {
  const carpetaExtra = String(carpeta_extra || '').trim();
  if (carpetaExtra) {
    if (!path.isAbsolute(carpetaExtra)) {
      throw AppError.badRequest('Escribí la ruta completa de la carpeta, por ejemplo E:\\CopiasKiosco o C:\\Users\\Juan\\OneDrive\\Kiosco.');
    }
    if (path.resolve(carpetaExtra) === path.resolve(env.copias.carpeta)) {
      throw AppError.badRequest('La carpeta extra tiene que ser distinta de la carpeta principal de copias.');
    }
    const prueba = path.join(carpetaExtra, '.prueba-de-escritura');
    try {
      fs.mkdirSync(carpetaExtra, { recursive: true });
      fs.writeFileSync(prueba, 'ok');
      fs.unlinkSync(prueba);
    } catch (error) {
      throw AppError.badRequest(
        `No se puede escribir en esa carpeta (${error.code || error.message}). Verificá que exista, que el disco esté conectado y que no sea una unidad de red.`
      );
    }
  }
  await configuracionRepo.guardar({ copia_carpeta_extra: carpetaExtra, copia_extra_resultado: '' });
  return estado();
}

/** Ruta de una copia existente, validando el nombre para que no se pueda leer ningún otro archivo. */
function rutaDeArchivo(nombre) {
  if (!PATRON_ARCHIVO.test(nombre)) throw AppError.badRequest('El nombre de la copia no es válido.');
  const ruta = path.join(env.copias.carpeta, nombre);
  if (!fs.existsSync(ruta)) throw AppError.notFound('Esa copia de seguridad ya no existe.');
  return ruta;
}

async function hacerCopiaSiCorresponde() {
  try {
    const config = await configuracionRepo.obtenerTodo();
    const ultima = config.copia_ultima_fecha ? new Date(config.copia_ultima_fecha.replace(' ', 'T')).getTime() : 0;
    if (Date.now() - ultima >= HORAS_ENTRE_COPIAS * 60 * 60 * 1000) await crear('AUTOMATICA');
  } catch (error) {
    if (!(error instanceof AppError)) console.error(`[copias] ${error.message}`);
  }
}

/** Activa la copia automática diaria. Se llama una vez al iniciar el servidor. */
function programar() {
  setTimeout(hacerCopiaSiCorresponde, 60 * 1000).unref();
  setInterval(hacerCopiaSiCorresponde, REVISAR_CADA_MS).unref();
}

module.exports = { crear, estado, configurar, rutaDeArchivo, programar };
