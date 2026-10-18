'use strict';

const path = require('path');

const CARPETA_BACKEND = path.join(__dirname, '..', '..');

// En desarrollo la configuración está en backend/.env. En una PC instalada, el instalador la
// guarda fuera de la carpeta del programa (ProgramData) y la indica con KIOSCO_ENV_FILE,
// así una actualización del programa nunca pisa la configuración ni los datos del local.
const ARCHIVO_ENV = process.env.KIOSCO_ENV_FILE || path.join(CARPETA_BACKEND, '.env');
require('dotenv').config({ path: ARCHIVO_ENV });

/**
 * Lee y valida las variables de entorno una sola vez.
 * Si falta algo imprescindible, el servidor no arranca y explica por qué.
 */
function leer(nombre, porDefecto) {
  const valor = process.env[nombre];
  return valor === undefined || valor === '' ? porDefecto : valor;
}

function entero(nombre, porDefecto) {
  const valor = Number.parseInt(leer(nombre, String(porDefecto)), 10);
  if (Number.isNaN(valor)) {
    throw new Error(`La variable de entorno ${nombre} debe ser un número entero.`);
  }
  return valor;
}

/** Las rutas relativas se interpretan desde la carpeta backend; las absolutas se respetan. */
const ruta = (nombre, porDefecto) => path.resolve(CARPETA_BACKEND, leer(nombre, porDefecto));

const env = {
  nodeEnv: leer('NODE_ENV', 'development'),
  port: entero('PORT', 3001),
  archivoEnv: ARCHIVO_ENV,
  // Carpeta donde vive la configuración del local (junto al archivo .env).
  carpetaConfiguracion: path.dirname(ARCHIVO_ENV),
  db: {
    host: leer('DB_HOST', 'localhost'),
    port: entero('DB_PORT', 3306),
    user: leer('DB_USER', 'root'),
    password: leer('DB_PASSWORD', ''),
    database: leer('DB_NAME', 'kiosco_db'),
    // Al encender la PC, el sistema puede arrancar antes que MySQL: se espera este tiempo antes de rendirse.
    esperaSegundos: entero('DB_ESPERA_SEGUNDOS', 0),
  },
  jwtSecret: leer('JWT_SECRET', ''),
  sessionHours: entero('SESSION_HOURS', 12),
  cookieSecure: leer('COOKIE_SECURE', 'false') === 'true',
  // Si se indica, los mensajes del servidor se guardan también en LOG_DIR/kiosco.log
  carpetaLogs: leer('LOG_DIR', '') ? ruta('LOG_DIR', 'logs') : null,
  copias: {
    carpeta: ruta('BACKUP_DIR', 'backups'),
    // Programas de MySQL usados para copiar y restaurar. Por defecto se buscan en el PATH.
    mysqldump: leer('MYSQLDUMP_PATH', 'mysqldump'),
    mysql: leer('MYSQL_CLIENT_PATH', 'mysql'),
    conservar: entero('BACKUP_CONSERVAR', 30),
  },
  arca: {
    // Carpeta donde se guardan la clave privada y los certificados (nunca se sube a Git).
    carpetaCertificados: ruta('ARCA_CERTS_DIR', 'certs'),
    // Direcciones oficiales de los servicios web. Solo se cambian para pruebas automáticas.
    urls: {
      HOMOLOGACION: {
        wsaa: leer('ARCA_WSAA_URL_HOMOLOGACION', 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms'),
        wsfe: leer('ARCA_WSFE_URL_HOMOLOGACION', 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx'),
      },
      PRODUCCION: {
        wsaa: leer('ARCA_WSAA_URL_PRODUCCION', 'https://wsaa.afip.gov.ar/ws/services/LoginCms'),
        wsfe: leer('ARCA_WSFE_URL_PRODUCCION', 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'),
      },
    },
  },
};

env.isProduction = env.nodeEnv === 'production';

/** Se llama al iniciar el servidor web (los scripts de base de datos no necesitan JWT). */
env.validarParaServidor = function validarParaServidor() {
  if (!env.jwtSecret || env.jwtSecret.length < 32) {
    throw new Error(
      `Falta configurar JWT_SECRET en ${ARCHIVO_ENV} (mínimo 32 caracteres). ` +
        'Copiá .env.example como .env y completá los valores.'
    );
  }
  if (!/^[A-Za-z0-9_]+$/.test(env.db.database)) {
    throw new Error('DB_NAME solo puede contener letras, números y guion bajo.');
  }
};

module.exports = env;
