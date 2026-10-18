'use strict';

/**
 * Aplicador de migraciones: ejecuta, una sola vez y en orden, los archivos .sql de
 * backend/database/migraciones. Lleva el registro en la tabla "migraciones".
 * Sirve para actualizar una base ya instalada SIN borrar sus datos.
 */

const fs = require('fs');
const path = require('path');

const DIRECTORIO = path.join(__dirname, '..', 'database', 'migraciones');

function listarArchivos() {
  if (!fs.existsSync(DIRECTORIO)) return [];
  return fs
    .readdirSync(DIRECTORIO)
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort();
}

/**
 * @param {import('mysql2/promise').Connection} conn conexión con multipleStatements activado
 * @returns {Promise<string[]>} nombres de las migraciones que se aplicaron en esta ejecución
 */
async function aplicarPendientes(conn) {
  await conn.query(
    `CREATE TABLE IF NOT EXISTS migraciones (
       nombre      VARCHAR(120) NOT NULL,
       aplicada_en DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
       PRIMARY KEY (nombre)
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  );
  const [filas] = await conn.query('SELECT nombre FROM migraciones');
  const aplicadas = new Set(filas.map((fila) => fila.nombre));

  const nuevas = [];
  for (const archivo of listarArchivos()) {
    if (aplicadas.has(archivo)) continue;
    await conn.query(fs.readFileSync(path.join(DIRECTORIO, archivo), 'utf8'));
    await conn.query('INSERT INTO migraciones (nombre) VALUES (?)', [archivo]);
    nuevas.push(archivo);
  }
  return nuevas;
}

/** Indica cuántas migraciones faltan aplicar (usa cualquier ejecutor con .query). */
async function contarPendientes(conn) {
  try {
    const [filas] = await conn.query('SELECT nombre FROM migraciones');
    const aplicadas = new Set(filas.map((fila) => fila.nombre));
    return listarArchivos().filter((archivo) => !aplicadas.has(archivo)).length;
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') return listarArchivos().length;
    throw error;
  }
}

module.exports = { aplicarPendientes, contarPendientes };
