'use strict';

const mysql = require('mysql2/promise');
const env = require('./env');

/**
 * Pool de conexiones a MySQL.
 * - decimalNumbers: los DECIMAL llegan como number (no como string).
 * - dateStrings: las fechas llegan como 'YYYY-MM-DD HH:MM:SS' en hora local,
 *   evitando conversiones de zona horaria inesperadas.
 */
const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.database,
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
  dateStrings: true,
});

/**
 * Ejecuta una consulta parametrizada y devuelve las filas (o el resultado del INSERT/UPDATE).
 * @param {string} sql
 * @param {Array} [params]
 * @param {import('mysql2/promise').PoolConnection} [conn] conexión de una transacción en curso
 */
async function query(sql, params = [], conn = pool) {
  const [resultado] = await conn.query(sql, params);
  return resultado;
}

/**
 * Ejecuta `trabajo` dentro de una transacción. Si lanza un error se hace ROLLBACK.
 * @template T
 * @param {(conn: import('mysql2/promise').PoolConnection) => Promise<T>} trabajo
 * @returns {Promise<T>}
 */
async function withTransaction(trabajo) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const resultado = await trabajo(conn);
    await conn.commit();
    return resultado;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function verificarConexion() {
  const conn = await pool.getConnection();
  try {
    await conn.ping();
  } finally {
    conn.release();
  }
}

/** Escapa los comodines de LIKE para que el texto del usuario se busque literalmente. */
function likeContiene(texto) {
  return `%${String(texto).replace(/[\\%_]/g, '\\$&')}%`;
}

module.exports = { pool, query, withTransaction, verificarConexion, likeContiene };
