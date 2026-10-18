'use strict';

const env = require('./config/env');
const { activarArchivoDeRegistro } = require('./utils/registro');

activarArchivoDeRegistro(env.carpetaLogs);

const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Comprueba la conexión a MySQL. Cuando el sistema arranca junto con Windows puede iniciar
 * antes que la base de datos: se reintenta durante DB_ESPERA_SEGUNDOS antes de darse por vencido.
 */
async function conectarBase(verificarConexion) {
  const limite = Date.now() + env.db.esperaSegundos * 1000;
  for (;;) {
    try {
      await verificarConexion();
      return;
    } catch (error) {
      if (Date.now() >= limite) throw error;
      console.log(`[db] MySQL todavía no responde (${error.code || error.message}). Reintentando...`);
      await esperar(3000);
    }
  }
}

async function iniciar() {
  env.validarParaServidor();

  const { verificarConexion, pool } = require('./config/db');
  const app = require('./app');

  try {
    await conectarBase(verificarConexion);
    console.log(`[db] Conectado a MySQL ${env.db.host}:${env.db.port} / ${env.db.database}`);
  } catch (error) {
    console.error('[db] No se pudo conectar a MySQL.');
    console.error(`     Motivo: ${error.code || error.message}`);
    console.error(`     Revisá los datos de conexión en ${env.archivoEnv} y que MySQL esté en funcionamiento.`);
    console.error('     Si todavía no creaste la base, ejecutá: npm run db:setup');
    process.exit(1);
  }

  // Si el programa se actualizó pero la base no, se avisa antes de arrancar (no se pierde ningún dato).
  const { contarPendientes } = require('../scripts/migraciones');
  try {
    if ((await contarPendientes(pool)) > 0) {
      console.error('[db] La base de datos necesita una actualización para esta versión del sistema.');
      console.error('     Ejecutá:  npm run db:migrar   (no borra datos) y volvé a iniciar.');
      process.exit(1);
    }
  } catch (error) {
    console.error(`[db] No se pudo verificar la versión de la base: ${error.code || error.message}`);
  }

  // En Express 5 el callback de listen también recibe los errores de arranque.
  const servidor = app.listen(env.port, (error) => {
    if (!error) {
      console.log(`[api] Kiosco escuchando en http://localhost:${env.port}`);
      require('./services/copias.service').programar();
      return;
    }
    if (error.code === 'EADDRINUSE') {
      console.error(`[api] El puerto ${env.port} ya está en uso. Cambiá PORT en ${env.archivoEnv} o cerrá el otro programa.`);
    } else {
      console.error('[api] No se pudo iniciar el servidor:', error.message);
    }
    process.exit(1);
  });

  const apagar = () => {
    servidor.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', apagar);
  process.on('SIGTERM', apagar);
}

iniciar().catch((error) => {
  console.error(`[api] ${error.message}`);
  process.exit(1);
});
