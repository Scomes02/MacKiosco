'use strict';

const {
  z,
  texto,
  textoOpcional,
  emailOpcional,
  dinero,
  entero,
  id,
  idOpcional,
  booleano,
  fechaOpcional,
  paginacion,
  busqueda,
} = require('./comunes');

/**
 * Esquemas de validación de todos los módulos.
 * Cada ruta valida su entrada acá ANTES de llegar al controlador.
 */

const rangoFechas = (schema) =>
  schema.refine((f) => !f.desde || !f.hasta || f.desde <= f.hasta, {
    message: 'La fecha "desde" no puede ser posterior a la fecha "hasta".',
    path: ['desde'],
  });

// ------------------------------------------------------------ Autenticación
const login = z.object({
  usuario: texto('El usuario', { max: 30 }),
  password: z
    .string({ required_error: 'La contraseña es obligatoria.' })
    .min(1, 'La contraseña es obligatoria.')
    .max(72, 'La contraseña es demasiado larga.'),
});

const passwordNueva = z
  .string({ required_error: 'La contraseña es obligatoria.' })
  .min(6, 'La contraseña debe tener al menos 6 caracteres.')
  .max(72, 'La contraseña no puede superar los 72 caracteres.');

const cambiarPassword = z.object({
  actual: z.string({ required_error: 'Ingresá tu contraseña actual.' }).min(1, 'Ingresá tu contraseña actual.'),
  nueva: passwordNueva,
});

// ------------------------------------------------------------ Usuarios
const nombreUsuario = texto('El usuario', { min: 3, max: 30 }).regex(
  /^[a-zA-Z0-9._-]+$/,
  'El usuario solo puede tener letras, números, punto, guion y guion bajo.'
);
const rol = z.enum(['ADMIN', 'CAJERO'], { errorMap: () => ({ message: 'El rol no es válido.' }) });

const usuarioCrear = z.object({
  nombre: texto('El nombre', { max: 80 }),
  usuario: nombreUsuario,
  email: emailOpcional(),
  rol,
  password: passwordNueva,
});

const usuarioActualizar = z.object({
  nombre: texto('El nombre', { max: 80 }),
  usuario: nombreUsuario,
  email: emailOpcional(),
  rol,
  activo: booleano('El estado', true),
});

const usuarioPassword = z.object({ password: passwordNueva });

// ------------------------------------------------------------ Categorías
const categoria = z.object({
  nombre: texto('El nombre', { max: 60 }),
  descripcion: textoOpcional('La descripción', 255),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'El color no es válido.')
    .default('#6366f1'),
  icono: z.string().trim().min(1, 'Elegí un ícono.').max(16, 'El ícono no es válido.').default('📦'),
  activo: booleano('El estado', true),
});

// ------------------------------------------------------------ Proveedores
const cuitOpcional = (campo) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v ?? null),
    z
      .string()
      .trim()
      .regex(/^(\d{2}-\d{7,8}-\d|\d{7,11})$/, `${campo} debe tener el formato 20-12345678-9 o solo números.`)
      .nullable()
  );

const proveedor = z.object({
  razon_social: texto('La razón social', { max: 120 }),
  cuit: cuitOpcional('El CUIT'),
  contacto: textoOpcional('El contacto', 80),
  telefono: textoOpcional('El teléfono', 30),
  email: emailOpcional(),
  direccion: textoOpcional('La dirección', 160),
  notas: textoOpcional('Las notas', 255),
  activo: booleano('El estado', true),
});

// ------------------------------------------------------------ Clientes
const cliente = z.object({
  nombre: texto('El nombre', { max: 120 }),
  documento: cuitOpcional('El CUIT/DNI'),
  condicion_iva: z
    .enum(['CONSUMIDOR_FINAL', 'MONOTRIBUTISTA', 'RESPONSABLE_INSCRIPTO', 'EXENTO'], {
      errorMap: () => ({ message: 'La condición frente al IVA no es válida.' }),
    })
    .default('CONSUMIDOR_FINAL'),
  telefono: textoOpcional('El teléfono', 30),
  email: emailOpcional(),
  direccion: textoOpcional('La dirección', 160),
  notas: textoOpcional('Las notas', 255),
  activo: booleano('El estado', true),
});

const filtrosCatalogo = z.object({
  q: busqueda,
  estado: z.enum(['activos', 'inactivos', 'todos']).default('todos'),
});

// ------------------------------------------------------------ Métodos de pago
const metodoPago = z.object({
  nombre: texto('El nombre', { max: 40 }),
  es_efectivo: booleano('El tipo', false),
  activo: booleano('El estado', true),
  orden: entero('El orden', { min: 0, max: 999 }).default(0),
});

// ------------------------------------------------------------ Productos
const productoBase = {
  codigo: texto('El código', { max: 30 }).regex(
    /^[A-Za-z0-9._-]+$/,
    'El código solo puede tener letras, números, punto y guiones (sin espacios).'
  ),
  nombre: texto('El nombre', { min: 2, max: 120 }),
  descripcion: textoOpcional('La descripción', 255),
  categoria_id: id('La categoría'),
  proveedor_id: idOpcional('El proveedor'),
  precio_costo: dinero('El precio de costo'),
  precio_venta: dinero('El precio de venta', { min: 0.01 }),
  iva: z
    .enum(['21', '10.5', '27', 'EXENTO', 'NO_GRAVADO'], { errorMap: () => ({ message: 'La alícuota de IVA no es válida.' }) })
    .default('21'),
  stock_minimo: entero('El stock mínimo'),
  imagen_url: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v ?? null),
    z
      .string()
      .trim()
      .max(500, 'La URL de la imagen es demasiado larga.')
      .regex(/^https?:\/\/\S+$/i, 'La URL de la imagen debe empezar con http:// o https://')
      .nullable()
  ),
  activo: booleano('El estado', true),
};

const productoCrear = z.object({
  ...productoBase,
  stock: entero('El stock inicial').default(0),
});

// El stock no se edita desde el producto: se modifica con ajustes, compras y ventas.
const productoActualizar = z.object(productoBase);

const productoFiltros = z.object({
  q: busqueda,
  categoria_id: idOpcional('La categoría'),
  proveedor_id: idOpcional('El proveedor'),
  estado: z.enum(['activos', 'inactivos', 'todos']).default('todos'),
  stock: z.enum(['todos', 'bajo', 'sin', 'ok']).default('todos'),
  orden: z.enum(['nombre', 'codigo', 'precio_venta', 'stock', 'categoria']).default('nombre'),
  direccion: z.enum(['asc', 'desc']).default('asc'),
  ...paginacion,
});

const productoBusquedaVenta = z.object({
  q: busqueda,
  categoria_id: idOpcional('La categoría'),
  limit: z.preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().int().min(1).max(200).default(60)),
});

// ------------------------------------------------------------ Stock
const ajusteStock = z.object({
  producto_id: id('El producto'),
  tipo: z.enum(['ENTRADA', 'SALIDA'], { errorMap: () => ({ message: 'El tipo de ajuste no es válido.' }) }),
  cantidad: entero('La cantidad', { min: 1 }),
  motivo: texto('El motivo', { min: 3, max: 255 }),
});

const movimientosFiltros = rangoFechas(
  z.object({
    q: busqueda,
    producto_id: idOpcional('El producto'),
    tipo: z
      .enum(['todos', 'INICIAL', 'VENTA', 'COMPRA', 'AJUSTE_ENTRADA', 'AJUSTE_SALIDA', 'ANULACION_VENTA'])
      .default('todos'),
    desde: fechaOpcional('La fecha "desde"'),
    hasta: fechaOpcional('La fecha "hasta"'),
    ...paginacion,
  })
);

// ------------------------------------------------------------ Ventas
const ventaCrear = z.object({
  cliente_id: idOpcional('El cliente'),
  descuento_porcentaje: z.preprocess(
    (v) => (v === undefined || v === null || v === '' ? 0 : Number(v)),
    z
      .number({ invalid_type_error: 'El descuento debe ser un número.' })
      .min(0, 'El descuento no puede ser negativo.')
      .max(100, 'El descuento no puede superar el 100%.')
  ),
  observaciones: textoOpcional('Las observaciones', 255),
  comprobante: z
    .enum(['RECIBO', 'FACTURA'], { errorMap: () => ({ message: 'El tipo de comprobante no es válido.' }) })
    .default('RECIBO'),
  items: z
    .array(
      z.object({
        producto_id: id('El producto'),
        cantidad: entero('La cantidad', { min: 1, max: 9999 }),
      }),
      { required_error: 'La venta no tiene productos.', invalid_type_error: 'La venta no tiene productos.' }
    )
    .min(1, 'Agregá al menos un producto a la venta.')
    .max(200, 'La venta tiene demasiados productos.'),
  pagos: z
    .array(
      z.object({
        metodo_pago_id: id('El método de pago'),
        monto: dinero('El monto del pago', { min: 0.01 }),
      }),
      { required_error: 'Seleccioná un método de pago.', invalid_type_error: 'Seleccioná un método de pago.' }
    )
    .min(1, 'Seleccioná un método de pago.')
    .max(5, 'La venta tiene demasiados pagos.'),
});

const ventaAnular = z.object({
  motivo: texto('El motivo de la anulación', { min: 3, max: 255 }),
});

const ventasFiltros = rangoFechas(
  z.object({
    q: busqueda,
    desde: fechaOpcional('La fecha "desde"'),
    hasta: fechaOpcional('La fecha "hasta"'),
    estado: z.enum(['todas', 'COMPLETADA', 'ANULADA']).default('todas'),
    comprobante: z.enum(['todos', 'RECIBO', 'FACTURA', 'FACTURA_PENDIENTE']).default('todos'),
    metodo_pago_id: idOpcional('El método de pago'),
    usuario_id: idOpcional('El usuario'),
    caja_id: idOpcional('La caja'),
    ...paginacion,
  })
);

// ------------------------------------------------------------ Caja
const cajaAbrir = z.object({
  monto_inicial: dinero('El monto inicial'),
});

const cajaCerrar = z.object({
  monto_contado: dinero('El efectivo contado'),
  observaciones: textoOpcional('Las observaciones', 255),
});

const cajaMovimiento = z.object({
  tipo: z.enum(['INGRESO', 'EGRESO'], { errorMap: () => ({ message: 'El tipo de movimiento no es válido.' }) }),
  monto: dinero('El monto', { min: 0.01 }),
  concepto: texto('El concepto', { min: 3, max: 160 }),
});

const cajasFiltros = z.object({ ...paginacion });

// ------------------------------------------------------------ Compras
const compraCrear = z.object({
  proveedor_id: id('El proveedor'),
  numero_comprobante: textoOpcional('El número de comprobante', 40),
  observaciones: textoOpcional('Las observaciones', 255),
  actualizar_costos: booleano('La opción de actualizar costos', true),
  items: z
    .array(
      z.object({
        producto_id: id('El producto'),
        cantidad: entero('La cantidad', { min: 1, max: 100000 }),
        costo_unitario: dinero('El costo unitario'),
      }),
      { required_error: 'La compra no tiene productos.', invalid_type_error: 'La compra no tiene productos.' }
    )
    .min(1, 'Agregá al menos un producto a la compra.')
    .max(300, 'La compra tiene demasiados productos.'),
});

const comprasFiltros = rangoFechas(
  z.object({
    proveedor_id: idOpcional('El proveedor'),
    desde: fechaOpcional('La fecha "desde"'),
    hasta: fechaOpcional('La fecha "hasta"'),
    ...paginacion,
  })
);

// ------------------------------------------------------------ Reportes
const reporteFiltros = rangoFechas(
  z.object({
    desde: fechaOpcional('La fecha "desde"'),
    hasta: fechaOpcional('La fecha "hasta"'),
  })
);

// ------------------------------------------------------------ Configuración
const configuracion = z.object({
  nombre_comercio: texto('El nombre del comercio', { max: 80 }),
  razon_social: z.string().trim().max(120, 'La razón social es demasiado larga.').default(''),
  cuit: z.string().trim().max(13, 'El CUIT es demasiado largo.').default(''),
  direccion: z.string().trim().max(160, 'La dirección es demasiado larga.').default(''),
  telefono: z.string().trim().max(30, 'El teléfono es demasiado largo.').default(''),
  mensaje_ticket: z.string().trim().max(160, 'El mensaje del ticket es demasiado largo.').default(''),
  ingresos_brutos: z.string().trim().max(30, 'El número de Ingresos Brutos es demasiado largo.').default(''),
  inicio_actividades: z.string().trim().max(10, 'La fecha de inicio de actividades es demasiado larga.').default(''),
});

// ------------------------------------------------------------ Facturación electrónica (ARCA)
const ambienteArca = z.enum(['HOMOLOGACION', 'PRODUCCION'], {
  errorMap: () => ({ message: 'El ambiente no es válido.' }),
});

const arcaConfiguracion = z.object({
  habilitada: booleano('La opción de habilitar la facturación', false),
  ambiente: ambienteArca,
  punto_venta: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? null : Number(v)),
    z
      .number({ invalid_type_error: 'El punto de venta debe ser un número.' })
      .int('El punto de venta debe ser un número entero.')
      .min(1, 'El punto de venta debe ser mayor a cero.')
      .max(99999, 'El punto de venta no puede tener más de 5 dígitos.')
      .nullable()
  ),
});

const arcaCertificado = z.object({
  ambiente: ambienteArca,
  certificado: z
    .string({ required_error: 'Pegá el contenido del certificado.' })
    .trim()
    .min(100, 'Pegá el contenido completo del certificado (.crt).')
    .max(20000, 'El certificado es demasiado largo.'),
});

// ------------------------------------------------------------ Licencia y copias de seguridad
const licenciaActivar = z.object({
  clave: z
    .string({ required_error: 'Pegá la clave de licencia.' })
    .trim()
    .min(20, 'Pegá la clave de licencia completa.')
    .max(480, 'La clave de licencia es demasiado larga.'),
});

const copiasConfiguracion = z.object({
  carpeta_extra: z.string().trim().max(250, 'La ruta de la carpeta es demasiado larga.').default(''),
});

module.exports = {
  login,
  cambiarPassword,
  usuarioCrear,
  usuarioActualizar,
  usuarioPassword,
  categoria,
  proveedor,
  cliente,
  filtrosCatalogo,
  metodoPago,
  productoCrear,
  productoActualizar,
  productoFiltros,
  productoBusquedaVenta,
  ajusteStock,
  movimientosFiltros,
  ventaCrear,
  ventaAnular,
  ventasFiltros,
  cajaAbrir,
  cajaCerrar,
  cajaMovimiento,
  cajasFiltros,
  compraCrear,
  comprasFiltros,
  reporteFiltros,
  configuracion,
  arcaConfiguracion,
  arcaCertificado,
  licenciaActivar,
  copiasConfiguracion,
};
