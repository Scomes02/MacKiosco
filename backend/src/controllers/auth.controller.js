'use strict';

const authService = require('../services/auth.service');
const { iniciarSesion, cerrarSesion } = require('../middlewares/auth');

async function login(req, res) {
  const { usuario, token } = await authService.login(req.body);
  iniciarSesion(res, token);
  res.json({ usuario });
}

async function logout(req, res) {
  cerrarSesion(res);
  res.json({ ok: true });
}

async function yo(req, res) {
  res.json({ usuario: req.usuario });
}

async function cambiarPassword(req, res) {
  await authService.cambiarPassword(req.usuario.id, req.body);
  res.json({ ok: true });
}

module.exports = { login, logout, yo, cambiarPassword };
