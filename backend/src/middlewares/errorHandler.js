'use strict';

const { ZodError } = require('zod');
const AppError = require('../utils/AppError');

/** Errores de MySQL que tienen una explicación entendible para el usuario. */
const ERRORES_MYSQL = {
  ER_DUP_ENTRY: [409, 'Ya existe un registro con esos datos.'],
  ER_ROW_IS_REFERENCED_2: [409, 'No se puede eliminar porque tiene registros asociados.'],
  ER_NO_REFERENCED_ROW_2: [400, 'Alguno de los datos relacionados no existe.'],
  ER_CHECK_CONSTRAINT_VIOLATED: [400, 'Alguno de los valores ingresados no es válido.'],
  ER_DATA_TOO_LONG: [400, 'Alguno de los textos ingresados es demasiado largo.'],
  ER_WARN_DATA_OUT_OF_RANGE: [400, 'Alguno de los números ingresados está fuera de rango.'],
  ER_LOCK_WAIT_TIMEOUT: [503, 'El sistema está ocupado. Probá de nuevo en unos segundos.'],
  ER_LOCK_DEADLOCK: [503, 'El sistema está ocupado. Probá de nuevo en unos segundos.'],
};

const ERRORES_CONEXION = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'PROTOCOL_CONNECTION_LOST',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_CON_COUNT_ERROR',
]);

function responder(res, status, message, code, fields) {
  const error = { message, code };
  if (fields) error.fields = fields;
  res.status(status).json({ error });
}

function rutaNoEncontrada(req, res) {
  responder(res, 404, 'La ruta solicitada no existe.', 'RUTA_NO_ENCONTRADA');
}

/**
 * Manejador central de errores: nunca expone stack traces, SQL ni detalles internos.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return responder(res, err.status, err.message, err.code, err.fields);
  }

  if (err instanceof ZodError) {
    const fields = {};
    for (const issue of err.issues) {
      const campo = issue.path.join('.') || 'general';
      if (!fields[campo]) fields[campo] = issue.message;
    }
    const primerMensaje = Object.values(fields)[0] || 'Revisá los datos ingresados.';
    return responder(res, 400, primerMensaje, 'VALIDACION', fields);
  }

  // La base existe pero no tiene las tablas del sistema (falta instalarla o es de otro proyecto).
  if (err && (err.code === 'ER_NO_SUCH_TABLE' || err.code === 'ER_BAD_FIELD_ERROR')) {
    console.error(`[db] ${err.code}: ${err.sqlMessage || err.message}`);
    console.error('     La base no coincide con esta versión del sistema.');
    console.error('     Base nueva: npm run db:setup  ·  Base existente sin actualizar: npm run db:migrar');
    return responder(
      res,
      503,
      'La base de datos no está instalada o le falta una actualización. ' +
        'Hay que ejecutar "npm run db:setup" (instalación nueva) o "npm run db:migrar" (actualización).',
      'BASE_SIN_INSTALAR'
    );
  }

  // JSON mal formado o cuerpo demasiado grande (body-parser)
  if (err && err.type === 'entity.parse.failed') {
    return responder(res, 400, 'Los datos enviados no tienen un formato válido.', 'JSON_INVALIDO');
  }
  if (err && err.type === 'entity.too.large') {
    return responder(res, 413, 'Los datos enviados son demasiado grandes.', 'CUERPO_GRANDE');
  }

  if (err && ERRORES_MYSQL[err.code]) {
    const [status, message] = ERRORES_MYSQL[err.code];
    console.error(`[db] ${err.code}: ${err.sqlMessage || err.message}`);
    return responder(res, status, message, 'BASE_DE_DATOS');
  }

  if (err && ERRORES_CONEXION.has(err.code)) {
    console.error(`[db] Sin conexión a MySQL (${err.code}): ${err.message}`);
    return responder(
      res,
      503,
      'No se pudo conectar con la base de datos. Verificá que MySQL esté en funcionamiento.',
      'SIN_BASE_DE_DATOS'
    );
  }

  console.error('[error]', req.method, req.originalUrl, err);
  return responder(res, 500, 'Ocurrió un error inesperado. Intentá nuevamente.', 'ERROR_INTERNO');
}

module.exports = { errorHandler, rutaNoEncontrada };
