'use strict';

const { Router } = require('express');
const rateLimit = require('express-rate-limit');

const validate = require('../middlewares/validate');
const { autenticar, soloAdmin } = require('../middlewares/auth');
const esquemas = require('../validators/esquemas');
const { paramsId } = require('../validators/comunes');

const auth = require('../controllers/auth.controller');
const usuarios = require('../controllers/usuarios.controller');
const catalogos = require('../controllers/catalogos.controller');
const productos = require('../controllers/productos.controller');
const ventas = require('../controllers/ventas.controller');
const cajas = require('../controllers/cajas.controller');
const gestion = require('../controllers/gestion.controller');
const facturacion = require('../controllers/facturacion.controller');
const sistema = require('../controllers/sistema.controller');
const { exigirLicenciaParaModificar } = require('../middlewares/licencia');

const router = Router();
const conId = validate({ params: paramsId });

// Frena los intentos de adivinar contraseñas por fuerza bruta.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: {
      message: 'Demasiados intentos de ingreso. Esperá unos minutos y probá de nuevo.',
      code: 'DEMASIADOS_INTENTOS',
    },
  },
});

// ------------------------------------------------------------ Públicas
router.get('/salud', (req, res) => res.json({ ok: true }));
// Nombre del comercio para la pantalla de ingreso (no es un dato sensible).
router.get('/publico', gestion.configuracion.publico);
router.post('/auth/login', limiteLogin, validate({ body: esquemas.login }), auth.login);
router.post('/auth/logout', auth.logout);

// ------------------------------------------------------------ Requieren sesión
router.use(autenticar);
router.use(exigirLicenciaParaModificar);

router.get('/auth/yo', auth.yo);
router.get('/licencia', sistema.licencia.estado);
router.put('/auth/password', validate({ body: esquemas.cambiarPassword }), auth.cambiarPassword);

// Datos que necesita el punto de venta (cualquier usuario con sesión)
router.get('/configuracion', gestion.configuracion.obtener);
router.get('/metodos-pago', catalogos.metodosPago.listar);
router.get('/categorias', validate({ query: esquemas.filtrosCatalogo }), catalogos.categorias.listar);
router.get('/productos/buscar', validate({ query: esquemas.productoBusquedaVenta }), productos.buscarParaVenta);

// Clientes: los puede gestionar cualquier usuario (se cargan desde el mostrador)
router.get('/clientes', validate({ query: esquemas.filtrosCatalogo }), catalogos.clientes.listar);
router.post('/clientes', validate({ body: esquemas.cliente }), catalogos.clientes.crear);
router.put('/clientes/:id', conId, validate({ body: esquemas.cliente }), catalogos.clientes.actualizar);
router.delete('/clientes/:id', soloAdmin, conId, catalogos.clientes.eliminar);

// Caja
router.get('/cajas/actual', cajas.actual);
router.post('/cajas/abrir', validate({ body: esquemas.cajaAbrir }), cajas.abrir);
router.post('/cajas/cerrar', validate({ body: esquemas.cajaCerrar }), cajas.cerrar);
router.post('/cajas/movimientos', validate({ body: esquemas.cajaMovimiento }), cajas.registrarMovimiento);
router.get('/cajas', validate({ query: esquemas.cajasFiltros }), cajas.listar);
router.get('/cajas/:id', conId, cajas.obtener);

// Ventas
router.get('/ventas', validate({ query: esquemas.ventasFiltros }), ventas.listar);
router.get('/ventas/:id', conId, ventas.obtener);
router.post('/ventas', validate({ body: esquemas.ventaCrear }), ventas.crear);
router.post('/ventas/:id/facturar', conId, ventas.facturar);
router.post('/ventas/:id/anular', soloAdmin, conId, validate({ body: esquemas.ventaAnular }), ventas.anular);

// Productos (consulta para todos; altas, bajas y cambios solo administrador)
router.get('/productos', validate({ query: esquemas.productoFiltros }), productos.listar);
router.get('/productos/:id', conId, productos.obtener);

// ------------------------------------------------------------ Solo administrador
router.use(soloAdmin);

router.post('/productos', validate({ body: esquemas.productoCrear }), productos.crear);
router.put('/productos/:id', conId, validate({ body: esquemas.productoActualizar }), productos.actualizar);
router.delete('/productos/:id', conId, productos.eliminar);

router.get('/stock/movimientos', validate({ query: esquemas.movimientosFiltros }), productos.listarMovimientos);
router.post('/stock/ajustes', validate({ body: esquemas.ajusteStock }), productos.ajustarStock);

router.post('/categorias', validate({ body: esquemas.categoria }), catalogos.categorias.crear);
router.put('/categorias/:id', conId, validate({ body: esquemas.categoria }), catalogos.categorias.actualizar);
router.delete('/categorias/:id', conId, catalogos.categorias.eliminar);

router.get('/proveedores', validate({ query: esquemas.filtrosCatalogo }), catalogos.proveedores.listar);
router.post('/proveedores', validate({ body: esquemas.proveedor }), catalogos.proveedores.crear);
router.put('/proveedores/:id', conId, validate({ body: esquemas.proveedor }), catalogos.proveedores.actualizar);
router.delete('/proveedores/:id', conId, catalogos.proveedores.eliminar);

router.get('/compras', validate({ query: esquemas.comprasFiltros }), gestion.compras.listar);
router.get('/compras/:id', conId, gestion.compras.obtener);
router.post('/compras', validate({ body: esquemas.compraCrear }), gestion.compras.crear);

router.post('/metodos-pago', validate({ body: esquemas.metodoPago }), catalogos.metodosPago.crear);
router.put('/metodos-pago/:id', conId, validate({ body: esquemas.metodoPago }), catalogos.metodosPago.actualizar);
router.delete('/metodos-pago/:id', conId, catalogos.metodosPago.eliminar);

router.get('/dashboard', gestion.reportes.dashboard);
router.get('/reportes/ventas', validate({ query: esquemas.reporteFiltros }), gestion.reportes.ventas);

router.put('/configuracion', validate({ body: esquemas.configuracion }), gestion.configuracion.actualizar);

// Facturación electrónica (ARCA)
router.get('/facturacion', facturacion.estado);
router.put('/facturacion', validate({ body: esquemas.arcaConfiguracion }), facturacion.guardarConfiguracion);
router.post('/facturacion/pedido-certificado', facturacion.generarPedido);
router.put('/facturacion/certificado', validate({ body: esquemas.arcaCertificado }), facturacion.cargarCertificado);
router.post('/facturacion/probar', facturacion.probar);

// Licencia y copias de seguridad
router.put('/licencia', validate({ body: esquemas.licenciaActivar }), sistema.licencia.activar);
router.get('/copias', sistema.copias.estado);
router.post('/copias', sistema.copias.crear);
router.put('/copias/configuracion', validate({ body: esquemas.copiasConfiguracion }), sistema.copias.configurar);
router.get('/copias/:nombre/descargar', sistema.copias.descargar);

router.get('/usuarios', usuarios.listar);
router.post('/usuarios', validate({ body: esquemas.usuarioCrear }), usuarios.crear);
router.put('/usuarios/:id', conId, validate({ body: esquemas.usuarioActualizar }), usuarios.actualizar);
router.put('/usuarios/:id/password', conId, validate({ body: esquemas.usuarioPassword }), usuarios.restablecerPassword);

module.exports = router;
