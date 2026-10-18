'use strict';

const env = require('../config/env');
const AppError = require('../utils/AppError');
const authService = require('../services/auth.service');
const usuariosRepo = require('../repositories/usuarios.repository');

const NOMBRE_COOKIE = 'kiosco_sesion';

/**
 * Opciones de la cookie de sesión:
 * - httpOnly: JavaScript del navegador no puede leerla (protege ante XSS).
 * - sameSite strict: no se envía desde otros sitios (protege ante CSRF).
 */
function opcionesCookie() {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.cookieSecure,
    path: '/',
    maxAge: env.sessionHours * 60 * 60 * 1000,
  };
}

function iniciarSesion(res, token) {
  res.cookie(NOMBRE_COOKIE, token, opcionesCookie());
}

function cerrarSesion(res) {
  const { maxAge, ...opciones } = opcionesCookie();
  res.clearCookie(NOMBRE_COOKIE, opciones);
}

/**
 * Exige una sesión válida. Vuelve a leer el usuario de la base en cada pedido,
 * así un usuario desactivado o con el rol cambiado pierde el acceso al instante.
 */
async function autenticar(req, res, next) {
  const token = req.cookies ? req.cookies[NOMBRE_COOKIE] : null;
  const contenido = token ? authService.verificarToken(token) : null;
  if (!contenido) throw AppError.unauthorized();

  const usuario = await usuariosRepo.obtenerPorId(Number(contenido.sub));
  if (!usuario || !usuario.activo) {
    cerrarSesion(res);
    throw AppError.unauthorized('Tu sesión ya no es válida. Iniciá sesión nuevamente.');
  }

  req.usuario = authService.aPublico(usuario);
  next();
}

/** Restringe una ruta a los roles indicados. */
function requerirRol(...roles) {
  return (req, res, next) => {
    if (!req.usuario || !roles.includes(req.usuario.rol)) throw AppError.forbidden();
    next();
  };
}

const soloAdmin = requerirRol('ADMIN');

module.exports = { autenticar, requerirRol, soloAdmin, iniciarSesion, cerrarSesion };
