'use strict';

const productosService = require('../services/productos.service');
const stockService = require('../services/stock.service');

async function listar(req, res) {
  res.json(await productosService.listar(req.filtros));
}

async function buscarParaVenta(req, res) {
  res.json(await productosService.buscarParaVenta(req.filtros));
}

async function obtener(req, res) {
  res.json(await productosService.obtener(req.params.id));
}

async function crear(req, res) {
  res.status(201).json(await productosService.crear(req.body, req.usuario));
}

async function actualizar(req, res) {
  res.json(await productosService.actualizar(req.params.id, req.body));
}

async function eliminar(req, res) {
  res.json(await productosService.eliminar(req.params.id));
}

async function listarMovimientos(req, res) {
  res.json(await stockService.listarMovimientos(req.filtros));
}

async function ajustarStock(req, res) {
  res.status(201).json(await stockService.ajustar(req.body, req.usuario));
}

module.exports = { listar, buscarParaVenta, obtener, crear, actualizar, eliminar, listarMovimientos, ajustarStock };
