'use strict';

const usuariosService = require('../services/usuarios.service');

async function listar(req, res) {
  res.json(await usuariosService.listar());
}

async function crear(req, res) {
  res.status(201).json(await usuariosService.crear(req.body));
}

async function actualizar(req, res) {
  res.json(await usuariosService.actualizar(req.params.id, req.body, req.usuario));
}

async function restablecerPassword(req, res) {
  await usuariosService.restablecerPassword(req.params.id, req.body.password);
  res.json({ ok: true });
}

module.exports = { listar, crear, actualizar, restablecerPassword };
