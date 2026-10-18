'use strict';

/**
 * Prepara la base de datos de un LOCAL NUEVO (lo ejecuta el instalador, no se usa en desarrollo).
 *
 *   node scripts/instalar-local.js <archivo-de-respuestas.json>
 *
 * El archivo de respuestas lo arma el instalador con lo que eligió quien instala:
 *   { "nombre_comercio": "...", "admin_password": "...", "con_catalogo": true }
 *
 * A diferencia de "npm run db:setup", NO carga ventas, clientes, proveedores ni usuarios de
 * demostración: deja un sistema limpio, con un único administrador y su contraseña propia.
 * Si la base ya está instalada no toca nada (para eso está db-migrar.js).
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');
const { aplicarPendientes } = require('./migraciones');

const DIRECTORIO_SQL = path.join(__dirname, '..', 'database');
const leerSql = (archivo) => fs.readFileSync(path.join(DIRECTORIO_SQL, archivo), 'utf8');

async function main() {
  const archivoRespuestas = process.argv[2];
  if (!archivoRespuestas || !fs.existsSync(archivoRespuestas)) {
    throw new Error('Falta el archivo de respuestas del instalador.');
  }
  const respuestas = JSON.parse(fs.readFileSync(archivoRespuestas, 'utf8').replace(/^﻿/, ''));
  const nombreComercio = String(respuestas.nombre_comercio || '').trim() || 'MacKiosco';
  const password = String(respuestas.admin_password || '');
  if (password.length < 6) throw new Error('La contraseña del administrador debe tener al menos 6 caracteres.');

  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    charset: 'utf8mb4',
    multipleStatements: true,
  });

  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${env.db.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${env.db.database}\``);

    const [[{ tablas }]] = await conn.query(
      "SELECT COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema = ? AND table_name = 'usuarios'",
      [env.db.database]
    );
    if (tablas) {
      console.log('La base ya estaba instalada: no se modificaron los datos.');
      return;
    }

    console.log('Creando tablas...');
    await conn.query(leerSql('01_schema.sql'));
    await conn.query(leerSql('02_seed.sql'));
    await aplicarPendientes(conn);

    console.log('Preparando los datos del local...');
    // Se quita todo lo que en el seed es de demostración.
    await conn.query('DELETE FROM movimientos_stock');
    await conn.query('DELETE FROM clientes');
    if (respuestas.con_catalogo) {
      // Catálogo de ejemplo: productos y precios como punto de partida, sin stock ni proveedores ficticios.
      await conn.query('UPDATE productos SET proveedor_id = NULL, stock = 0');
    } else {
      await conn.query('DELETE FROM productos');
    }
    await conn.query('DELETE FROM proveedores');
    await conn.query('DELETE FROM usuarios WHERE id <> 1');
    for (const tabla of ['clientes', 'proveedores', 'movimientos_stock', ...(respuestas.con_catalogo ? [] : ['productos'])]) {
      await conn.query(`ALTER TABLE ${tabla} AUTO_INCREMENT = 1`);
    }

    await conn.query("UPDATE usuarios SET password_hash = ?, email = NULL, nombre = 'Administrador' WHERE id = 1", [
      await bcrypt.hash(password, 10),
    ]);
    await conn.query(
      `INSERT INTO configuracion (clave, valor) VALUES ?
       ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
      [[['nombre_comercio', nombreComercio.slice(0, 80)], ['direccion', ''], ['telefono', '']]]
    );

    const [[conteo]] = await conn.query(
      'SELECT (SELECT COUNT(*) FROM productos) AS productos, (SELECT COUNT(*) FROM categorias) AS categorias'
    );
    console.log(`Base lista: ${conteo.categorias} categorías y ${conteo.productos} productos. Usuario inicial: admin.`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(`No se pudo preparar la base de datos: ${error.sqlMessage || error.message}`);
  process.exit(1);
});
