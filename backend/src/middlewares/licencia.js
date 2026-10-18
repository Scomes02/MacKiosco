'use strict';

const AppError = require('../utils/AppError');
const licenciaService = require('../services/licencia.service');

// Con la licencia vencida igual se puede iniciar sesión, cambiar la contraseña,
// cargar la clave nueva y hacer copias de seguridad.
const RUTAS_SIEMPRE_PERMITIDAS = ['/auth/', '/licencia', '/copias'];

/**
 * Modo "solo consulta": con la licencia vencida (pasados los días de gracia) se permite leer
 * y exportar todo, pero se rechaza cualquier operación que modifique datos.
 */
async function exigirLicenciaParaModificar(req, res, next) {
  if (req.method === 'GET' || RUTAS_SIEMPRE_PERMITIDAS.some((ruta) => req.path.startsWith(ruta))) return next();
  const estado = await licenciaService.estado();
  if (estado.solo_consulta) throw new AppError(402, estado.aviso, 'LICENCIA_VENCIDA');
  return next();
}

module.exports = { exigirLicenciaParaModificar };
