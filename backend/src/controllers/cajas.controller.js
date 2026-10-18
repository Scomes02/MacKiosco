'use strict';

const cajasService = require('../services/cajas.service');

async function actual(req, res) {
  res.json({ caja: await cajasService.obtenerActual() });
}

async function listar(req, res) {
  res.json(await cajasService.listar(req.filtros));
}

async function obtener(req, res) {
  res.json(await cajasService.obtenerDetalle(req.params.id));
}

async function abrir(req, res) {
  res.status(201).json({ caja: await cajasService.abrir(req.body, req.usuario) });
}

async function cerrar(req, res) {
  res.json({ caja: await cajasService.cerrar(req.body, req.usuario) });
}

async function registrarMovimiento(req, res) {
  res.status(201).json({ caja: await cajasService.registrarMovimiento(req.body, req.usuario) });
}

module.exports = { actual, listar, obtener, abrir, cerrar, registrarMovimiento };
