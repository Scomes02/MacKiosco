'use strict';

/**
 * Actualiza una base ya instalada a la última versión del sistema SIN borrar datos.
 *
 *   npm run db:migrar
 *
 * Usa las credenciales del archivo backend/.env
 */

const mysql = require('mysql2/promise');
const env = require('../src/config/env');
const { aplicarPendientes } = require('./migraciones');

async function main() {
  console.log(`Conectando a MySQL en ${env.db.host}:${env.db.port} / ${env.db.database}...`);
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    charset: 'utf8mb4',
    multipleStatements: true,
  });

  try {
    const [[{ tablas }]] = await conn.query(
      "SELECT COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema = ? AND table_name = 'usuarios'",
      [env.db.database]
    );
    if (!tablas) {
      console.log('\nLa base todavía no está instalada. Ejecutá primero:  npm run db:setup\n');
      process.exitCode = 1;
      return;
    }

    const aplicadas = await aplicarPendientes(conn);
    if (aplicadas.length) {
      console.log(`\nSe aplicaron ${aplicadas.length} actualización(es):`);
      for (const nombre of aplicadas) console.log(`  - ${nombre}`);
      console.log('\nReiniciá el sistema (npm start) para usar la nueva versión.\n');
    } else {
      console.log('\nLa base ya estaba actualizada. No había nada para aplicar.\n');
    }
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(`\nNo se pudo actualizar la base de datos: ${error.sqlMessage || error.message}\n`);
  process.exit(1);
});
