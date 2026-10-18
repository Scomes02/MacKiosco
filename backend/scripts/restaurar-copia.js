'use strict';

/**
 * Restaura una copia de seguridad (.sql.gz) sobre la base de datos del sistema.
 *
 *   node scripts/restaurar-copia.js "C:\ruta\kiosco-2026-10-02_130000.sql.gz" --confirmar
 *
 * ATENCIÓN: reemplaza TODOS los datos actuales por los de la copia. Antes de restaurar se
 * hace automáticamente una copia de los datos actuales, por si hay que volver atrás.
 */

const fs = require('fs');
const zlib = require('zlib');
const { spawn } = require('child_process');
const { pipeline } = require('stream/promises');
const env = require('../src/config/env');

async function main() {
  const archivo = process.argv[2];
  const confirmado = process.argv.includes('--confirmar');

  if (!archivo || !fs.existsSync(archivo)) {
    throw new Error('Indicá el archivo de la copia a restaurar (termina en .sql.gz).');
  }
  if (!confirmado) {
    throw new Error(
      'Restaurar reemplaza todos los datos actuales por los de la copia. ' +
        'Si estás seguro, repetí el comando agregando --confirmar al final.'
    );
  }

  console.log('Guardando una copia de los datos actuales antes de restaurar...');
  const copias = require('../src/services/copias.service');
  const { pool } = require('../src/config/db');
  try {
    const previa = await copias.crear('MANUAL');
    console.log(`  Copia previa: ${previa}`);
  } catch (error) {
    console.log(`  No se pudo hacer la copia previa (${error.message}). Se continúa con la restauración.`);
  } finally {
    await pool.end();
  }

  console.log(`Restaurando ${archivo} ...`);
  const proceso = spawn(
    env.copias.mysql,
    [`--host=${env.db.host}`, `--port=${env.db.port}`, `--user=${env.db.user}`, '--default-character-set=utf8mb4', env.db.database],
    { env: { ...process.env, MYSQL_PWD: env.db.password }, windowsHide: true, stdio: ['pipe', 'ignore', 'pipe'] }
  );
  let errores = '';
  proceso.stderr.on('data', (parte) => {
    errores += parte.toString();
  });
  const terminado = new Promise((resolve, reject) => {
    proceso.on('error', (error) =>
      reject(error.code === 'ENOENT' ? new Error('No se encontró el programa mysql. Revisá MYSQL_CLIENT_PATH.') : error)
    );
    proceso.on('close', (codigo) => (codigo === 0 ? resolve() : reject(new Error(errores.trim() || `mysql terminó con código ${codigo}`))));
  });

  const entrada = archivo.endsWith('.gz') ? [fs.createReadStream(archivo), zlib.createGunzip()] : [fs.createReadStream(archivo)];
  await Promise.all([pipeline(...entrada, proceso.stdin), terminado]);

  console.log('Listo: la copia fue restaurada. Reiniciá el sistema para continuar.');
}

main().catch((error) => {
  console.error(`\nNo se pudo restaurar: ${error.message}\n`);
  process.exit(1);
});
