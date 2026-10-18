'use strict';

const facturacionService = require('../services/facturacion.service');

/** Configuración de la facturación electrónica (ARCA). Solo administrador. */

async function estado(req, res) {
  res.json(await facturacionService.estado());
}

async function guardarConfiguracion(req, res) {
  res.json(await facturacionService.guardarConfiguracion(req.body));
}

async function generarPedido(req, res) {
  res.json(await facturacionService.generarPedidoDeCertificado());
}

async function cargarCertificado(req, res) {
  res.json(await facturacionService.cargarCertificado(req.body));
}

async function probar(req, res) {
  res.json(await facturacionService.probarConexion());
}

module.exports = { estado, guardarConfiguracion, generarPedido, cargarCertificado, probar };
