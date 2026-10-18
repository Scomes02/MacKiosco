'use strict';

/**
 * Instalación de la base de datos del kiosco.
 *
 *   npm run db:setup          Crea la base, las tablas y carga los datos (solo si la base está vacía).
 *   npm run db:reset          BORRA todo y vuelve a crear la base con los datos de demostración.
 *   npm run db:reset:vacio    BORRA todo y deja solo el catálogo (sin historial de ventas de demostración).
 *
 * Usa las credenciales del archivo backend/.env
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');
const { generarHistorial } = require('./historial-demo');
const { aplicarPendientes } = require('./migraciones');

const argumentos = new Set(process.argv.slice(2));
const RESET = argumentos.has('--reset');
const SIN_HISTORIAL = argumentos.has('--sin-historial');
const DIRECTORIO_SQL = path.join(__dirname, '..', 'database');

function leerSql(archivo) {
  return fs.readFileSync(path.join(DIRECTORIO_SQL, archivo), 'utf8');
}

function explicarErrorDeConexion(error) {
  const ayudas = {
    ER_ACCESS_DENIED_ERROR: 'Usuario o contraseña de MySQL incorrectos. Revisá DB_USER y DB_PASSWORD en backend/.env',
    ECONNREFUSED: `No hay ningún MySQL escuchando en ${env.db.host}:${env.db.port}. Verificá que el servicio esté iniciado.`,
    ENOTFOUND: `No se encontró el servidor "${env.db.host}". Revisá DB_HOST en backend/.env`,
    ETIMEDOUT: 'MySQL no respondió a tiempo. Verificá DB_HOST y DB_PORT en backend/.env',
  };
  return ayudas[error.code] || error.message;
}

async function main() {
  const nombreBase = env.db.database;
  if (!/^[A-Za-z0-9_]+$/.test(nombreBase)) {
    throw new Error('DB_NAME solo puede contener letras, números y guion bajo.');
  }

  console.log(`Conectando a MySQL en ${env.db.host}:${env.db.port} con el usuario "${env.db.user}"...`);
  let conn;
  try {
    conn = await mysql.createConnection({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      charset: 'utf8mb4',
      multipleStatements: true,
    });
  } catch (error) {
    throw new Error(explicarErrorDeConexion(error));
  }

  try {
    await conn.query(
      `CREATE DATABASE IF NOT EXISTS \`${nombreBase}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await conn.query(`USE \`${nombreBase}\``);

    const [[{ tablas }]] = await conn.query(
      'SELECT COUNT(*) AS tablas FROM information_schema.tables WHERE table_schema = ?',
      [nombreBase]
    );
    if (tablas > 0 && !RESET) {
      // Si falta alguna tabla propia del sistema, la base es de otro proyecto o quedó a medio instalar.
      const [[{ propias }]] = await conn.query(
        `SELECT COUNT(*) AS propias FROM information_schema.tables
          WHERE table_schema = ? AND table_name IN ('usuarios', 'movimientos_stock', 'configuracion')`,
        [nombreBase]
      );
      if (propias < 3) {
        console.log(`\nATENCIÓN: la base "${nombreBase}" ya existe, pero sus tablas NO son las de este sistema`);
        console.log('(puede ser de un proyecto anterior). No se modificó nada y el sistema no va a funcionar así.');
        console.log('Opciones:');
        console.log('  1) Reemplazarla: "npm run db:reset" BORRA esas tablas y crea las del sistema.');
        console.log('  2) Conservarla: cambiá DB_NAME en backend/.env por otro nombre y ejecutá "npm run db:setup".\n');
        process.exitCode = 1;
        return;
      }
      console.log(`\nLa base "${nombreBase}" ya tiene tablas, así que no se modificó nada.`);
      console.log('Si querés BORRAR todos los datos y volver a cargar los de demostración, ejecutá:');
      console.log('  npm run db:reset\n');
      return;
    }

    console.log(`Creando tablas en "${nombreBase}"...`);
    await conn.query(leerSql('01_schema.sql'));

    console.log('Cargando datos iniciales (usuarios, categorías, proveedores, clientes y productos)...');
    await conn.query(leerSql('02_seed.sql'));

    // Las actualizaciones posteriores al esquema base viven en database/migraciones.
    const migraciones = await aplicarPendientes(conn);
    if (migraciones.length) console.log(`Aplicando actualizaciones del esquema (${migraciones.length})...`);

    if (SIN_HISTORIAL) {
      console.log('Se omitió el historial de demostración (--sin-historial).');
    } else {
      console.log('Generando historial de demostración (cajas, ventas, compras y movimientos de stock)...');
      const resumen = await generarHistorial(conn);
      console.log(
        `  ${resumen.ventas} ventas, ${resumen.compras} compras, ${resumen.cajas} cajas y ` +
          `${resumen.movimientos} movimientos de stock en ${resumen.dias} días.`
      );
    }

    const [[conteo]] = await conn.query(
      `SELECT (SELECT COUNT(*) FROM productos) AS productos,
              (SELECT COUNT(*) FROM categorias) AS categorias,
              (SELECT COUNT(*) FROM ventas) AS ventas`
    );
    console.log(`\nListo. La base "${nombreBase}" tiene ${conteo.productos} productos, ${conteo.categorias} categorías y ${conteo.ventas} ventas.`);
    console.log('Usuarios iniciales:  admin / admin123   ·   cajero / cajero123');
    console.log('Ahora podés iniciar el sistema con:  npm start\n');
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(`\nNo se pudo preparar la base de datos: ${error.message}\n`);
  process.exit(1);
});
