'use strict';

const ventasService = require('../services/ventas.service');

async function listar(req, res) {
  res.json(await ventasService.listar(req.filtros));
}

async function obtener(req, res) {
  res.json(await ventasService.obtener(req.params.id));
}

async function crear(req, res) {
  res.status(201).json(await ventasService.crear(req.body, req.usuario));
}

async function facturar(req, res) {
  res.json(await ventasService.facturar(req.params.id, req.usuario));
}

async function anular(req, res) {
  res.json(await ventasService.anular(req.params.id, req.body, req.usuario));
}

module.exports = { listar, obtener, crear, facturar, anular };
