'use strict';

const configuracionRepo = require('../repositories/configuracion.repository');
const facturacion = require('./facturacion.service');

const POR_DEFECTO = {
  nombre_comercio: 'Mi Kiosco',
  razon_social: '',
  cuit: '',
  direccion: '',
  telefono: '',
  mensaje_ticket: '¡Gracias por su compra!',
  ingresos_brutos: '',
  inicio_actividades: '',
};

/**
 * Devuelve los datos del comercio (solo las claves conocidas, completando con valores por defecto)
 * y si la facturación electrónica está lista para usarse, para que el punto de venta lo sepa.
 */
async function obtener() {
  const [guardado, fiscal] = await Promise.all([configuracionRepo.obtenerTodo(), facturacion.estado()]);
  const datos = Object.fromEntries(Object.keys(POR_DEFECTO).map((clave) => [clave, guardado[clave] ?? POR_DEFECTO[clave]]));
  return { ...datos, facturacion: { operativa: fiscal.operativa, ambiente: fiscal.ambiente } };
}

async function actualizar(valores) {
  await configuracionRepo.guardar(valores);
  return obtener();
}

module.exports = { obtener, actualizar };
