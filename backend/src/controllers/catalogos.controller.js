'use strict';

const categoriasService = require('../services/categorias.service');
const proveedoresService = require('../services/proveedores.service');
const clientesService = require('../services/clientes.service');
const metodosPagoService = require('../services/metodosPago.service');

/**
 * Controladores de los catálogos simples (categorías, proveedores, clientes y métodos de pago).
 * Todos comparten la misma forma: listar, crear, actualizar y eliminar.
 */
function crearControlador(servicio, opcionesDeListado = (req) => req.filtros) {
  return {
    async listar(req, res) {
      res.json(await servicio.listar(opcionesDeListado(req)));
    },
    async crear(req, res) {
      res.status(201).json(await servicio.crear(req.body));
    },
    async actualizar(req, res) {
      res.json(await servicio.actualizar(req.params.id, req.body));
    },
    async eliminar(req, res) {
      await servicio.eliminar(req.params.id);
      res.json({ ok: true });
    },
  };
}

module.exports = {
  categorias: crearControlador(categoriasService),
  proveedores: crearControlador(proveedoresService),
  clientes: crearControlador(clientesService),
  // Los cajeros solo ven los métodos de pago activos; el administrador los ve todos.
  metodosPago: crearControlador(metodosPagoService, (req) => ({
    soloActivos: req.usuario.rol !== 'ADMIN' || req.query.activos === '1',
  })),
};
