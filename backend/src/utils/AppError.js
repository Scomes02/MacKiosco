'use strict';

/**
 * Error "esperado" de la aplicación: tiene un mensaje pensado para mostrarle al usuario
 * y un código HTTP. Cualquier otro error se trata como interno (500) y no se expone.
 */
class AppError extends Error {
  /**
   * @param {number} status código HTTP
   * @param {string} message mensaje claro para el usuario
   * @param {string} [code] código corto para el frontend
   * @param {object} [fields] errores por campo { campo: mensaje }
   */
  constructor(status, message, code = 'ERROR', fields = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }

  static badRequest(message, fields) {
    return new AppError(400, message, 'SOLICITUD_INVALIDA', fields);
  }

  static unauthorized(message = 'Tenés que iniciar sesión para continuar.') {
    return new AppError(401, message, 'NO_AUTENTICADO');
  }

  static forbidden(message = 'No tenés permisos para realizar esta acción.') {
    return new AppError(403, message, 'SIN_PERMISOS');
  }

  static notFound(message = 'El recurso solicitado no existe.') {
    return new AppError(404, message, 'NO_ENCONTRADO');
  }

  static conflict(message, fields) {
    return new AppError(409, message, 'CONFLICTO', fields);
  }
}

module.exports = AppError;
