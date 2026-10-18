'use strict';

const licenciaService = require('../services/licencia.service');
const copiasService = require('../services/copias.service');

/** Licencia de uso y copias de seguridad. */

const licencia = {
  async estado(req, res) {
    res.json(await licenciaService.estado());
  },
  async activar(req, res) {
    res.json(await licenciaService.activar(req.body.clave));
  },
};

const copias = {
  async estado(req, res) {
    res.json(await copiasService.estado());
  },
  async crear(req, res) {
    await copiasService.crear('MANUAL');
    res.status(201).json(await copiasService.estado());
  },
  async configurar(req, res) {
    res.json(await copiasService.configurar(req.body));
  },
  async descargar(req, res) {
    res.download(copiasService.rutaDeArchivo(req.params.nombre), req.params.nombre);
  },
};

module.exports = { licencia, copias };
