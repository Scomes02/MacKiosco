'use strict';

const comprasService = require('../services/compras.service');
const reportesService = require('../services/reportes.service');
const configuracionService = require('../services/configuracion.service');

/** Controladores de compras, reportes y configuración del comercio. */

const compras = {
  async listar(req, res) {
    res.json(await comprasService.listar(req.filtros));
  },
  async obtener(req, res) {
    res.json(await comprasService.obtener(req.params.id));
  },
  async crear(req, res) {
    res.status(201).json(await comprasService.crear(req.body, req.usuario));
  },
};

const reportes = {
  async dashboard(req, res) {
    res.json(await reportesService.dashboard());
  },
  async ventas(req, res) {
    res.json(await reportesService.ventas(req.filtros));
  },
};

const configuracion = {
  async publico(req, res) {
    const { nombre_comercio } = await configuracionService.obtener();
    res.json({ nombre_comercio });
  },
  async obtener(req, res) {
    res.json(await configuracionService.obtener());
  },
  async actualizar(req, res) {
    res.json(await configuracionService.actualizar(req.body));
  },
};

module.exports = { compras, reportes, configuracion };
