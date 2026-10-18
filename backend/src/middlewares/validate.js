'use strict';

/**
 * Valida y normaliza la entrada de una ruta con esquemas de Zod.
 * - body   -> reemplaza req.body por los datos ya validados
 * - query  -> deja los filtros validados en req.filtros
 * - params -> reemplaza req.params por los parámetros validados
 * Si algo no es válido, Zod lanza un error que maneja el errorHandler central.
 */
function validate({ body, query, params } = {}) {
  return (req, res, next) => {
    if (params) req.params = params.parse(req.params);
    if (query) req.filtros = query.parse(req.query);
    if (body) req.body = body.parse(req.body ?? {});
    next();
  };
}

module.exports = validate;
