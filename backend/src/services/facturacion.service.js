'use strict';

const AppError = require('../utils/AppError');
const { aCentavos, aPesos } = require('../utils/dinero');
const { aFecha } = require('../utils/fechas');
const configuracionRepo = require('../repositories/configuracion.repository');
const fiscalRepo = require('../repositories/fiscal.repository');
const ventasRepo = require('../repositories/ventas.repository');
const certificados = require('./arca/certificados');
const wsaa = require('./arca/wsaa');
const wsfe = require('./arca/wsfe');

/**
 * Facturación electrónica con ARCA para un Responsable Inscripto.
 *
 * - Factura A (código 1): a clientes con CUIT que son Responsables Inscriptos o Monotributistas.
 * - Factura B (código 6): al resto (consumidor final, exentos).
 * - Nota de crédito A/B (códigos 3 y 8): al anular una venta ya facturada.
 *
 * Los precios del sistema son finales (IVA incluido): acá se separa el neto y el IVA de cada alícuota.
 */

const AMBIENTES = ['HOMOLOGACION', 'PRODUCCION'];
const CODIGO_COMPROBANTE = { FACTURA: { A: 1, B: 6 }, NOTA_CREDITO: { A: 3, B: 8 } };
const ALICUOTAS = { 21: { id: 5, tasa: 21 }, 10.5: { id: 4, tasa: 10.5 }, 27: { id: 6, tasa: 27 } };
const CONDICION_IVA_RECEPTOR = { RESPONSABLE_INSCRIPTO: 1, EXENTO: 4, CONSUMIDOR_FINAL: 5, MONOTRIBUTISTA: 6 };
const DOCUMENTO = { CUIT: 80, DNI: 96, SIN_IDENTIFICAR: 99 };

// ------------------------------------------------------------ Configuración y estado
async function leerConfiguracion() {
  const c = await configuracionRepo.obtenerTodo();
  const ambiente = AMBIENTES.includes(c.arca_ambiente) ? c.arca_ambiente : 'HOMOLOGACION';
  const puntoVenta = Number.parseInt(c.arca_punto_venta, 10);
  return {
    habilitada: c.arca_habilitada === '1',
    ambiente,
    punto_venta: Number.isInteger(puntoVenta) && puntoVenta > 0 ? puntoVenta : null,
    cuit: String(c.cuit || '').replace(/\D/g, ''),
    razon_social: String(c.razon_social || '').trim(),
  };
}

/** Lista, en palabras simples, lo que falta para poder facturar en el ambiente elegido. */
function calcularFaltantes(config) {
  const faltantes = [];
  if (config.cuit.length !== 11) faltantes.push('Cargar el CUIT del comercio (11 dígitos) en "Datos del comercio".');
  if (!config.razon_social) faltantes.push('Cargar la razón social en "Datos del comercio".');
  if (!config.punto_venta) faltantes.push('Indicar el número de punto de venta habilitado en ARCA para Web Services.');
  const certificado = certificados.estadoCertificado(config.ambiente);
  if (!certificado) faltantes.push(`Cargar el certificado de ${config.ambiente === 'PRODUCCION' ? 'producción' : 'pruebas (homologación)'}.`);
  else if (certificado.vencido) faltantes.push('El certificado cargado está vencido: hay que generar uno nuevo en ARCA.');
  return faltantes;
}

async function estado() {
  const config = await leerConfiguracion();
  const faltantes = calcularFaltantes(config);
  return {
    ...config,
    clave_generada: certificados.existeClave(),
    certificados: {
      HOMOLOGACION: certificados.estadoCertificado('HOMOLOGACION'),
      PRODUCCION: certificados.estadoCertificado('PRODUCCION'),
    },
    faltantes,
    lista: faltantes.length === 0,
    operativa: config.habilitada && faltantes.length === 0,
  };
}

async function guardarConfiguracion({ habilitada, ambiente, punto_venta }) {
  const actual = await leerConfiguracion();
  const nueva = { ...actual, habilitada, ambiente, punto_venta };
  if (habilitada) {
    const faltantes = calcularFaltantes(nueva);
    if (faltantes.length) {
      throw AppError.badRequest(`Todavía no se puede habilitar la facturación. Falta: ${faltantes.join(' ')}`);
    }
  }
  await configuracionRepo.guardar({
    arca_habilitada: habilitada ? '1' : '0',
    arca_ambiente: ambiente,
    arca_punto_venta: punto_venta ? String(punto_venta) : '',
  });
  return estado();
}

async function generarPedidoDeCertificado() {
  const config = await leerConfiguracion();
  if (config.cuit.length !== 11 || !config.razon_social) {
    throw AppError.badRequest('Antes de generar el pedido, cargá el CUIT (11 dígitos) y la razón social en "Datos del comercio".');
  }
  return {
    nombre_archivo: `pedido-certificado-${config.cuit}.csr`,
    contenido: certificados.generarPedido({ cuit: config.cuit, razonSocial: config.razon_social, alias: 'kiosco' }),
  };
}

async function cargarCertificado({ ambiente, certificado }) {
  const config = await leerConfiguracion();
  certificados.guardarCertificado(ambiente, certificado, config.cuit);
  // Un certificado nuevo invalida el acceso que se hubiera obtenido con el anterior.
  await wsaa.olvidarAcceso(ambiente);
  return estado();
}

// ------------------------------------------------------------ Comunicación con ARCA
/** Ejecuta `tarea` con un acceso válido; si ARCA dice que venció, pide uno nuevo y reintenta una vez. */
async function conAcceso({ ambiente, cuit }, tarea) {
  const ejecutar = async () => {
    const acceso = await wsaa.obtenerAcceso(ambiente, cuit);
    return tarea({ ...acceso, cuit });
  };
  try {
    return await ejecutar();
  } catch (error) {
    if (!error.accesoInvalido) throw error;
    await wsaa.olvidarAcceso(ambiente);
    return ejecutar();
  }
}

/** Prueba de punta a punta: servidores, certificado y punto de venta. No emite ningún comprobante. */
async function probarConexion() {
  const config = await leerConfiguracion();
  const pasos = [];
  const registrar = async (nombre, accion) => {
    try {
      pasos.push({ nombre, ok: true, detalle: await accion() });
      return true;
    } catch (error) {
      pasos.push({ nombre, ok: false, detalle: error.message });
      return false;
    }
  };

  const hayServidores = await registrar('Servidores de ARCA', async () => {
    const s = await wsfe.estadoServidores(config.ambiente);
    if (s.aplicacion !== 'OK' || s.base_de_datos !== 'OK' || s.autenticacion !== 'OK') {
      throw new Error('ARCA informa que alguno de sus servidores no está disponible en este momento.');
    }
    return 'En línea.';
  });

  const faltantes = calcularFaltantes(config);
  if (hayServidores && faltantes.length) {
    pasos.push({ nombre: 'Configuración', ok: false, detalle: faltantes.join(' ') });
  } else if (hayServidores) {
    const hayAcceso = await registrar('Certificado digital', async () => {
      await wsaa.obtenerAcceso(config.ambiente, config.cuit);
      return 'ARCA aceptó el certificado.';
    });
    if (hayAcceso) {
      await registrar(`Punto de venta ${config.punto_venta}`, async () => {
        const ultimo = await conAcceso(config, (auth) =>
          wsfe.ultimoAutorizado(config.ambiente, auth, { puntoVenta: config.punto_venta, tipo: CODIGO_COMPROBANTE.FACTURA.B })
        );
        return `Habilitado. Última Factura B autorizada: N° ${ultimo}.`;
      });
    }
  }

  return { ambiente: config.ambiente, ok: pasos.every((p) => p.ok), pasos };
}

// ------------------------------------------------------------ Cálculo del comprobante
/** Determina la letra del comprobante y cómo se identifica al receptor. */
function resolverReceptor(venta) {
  const documento = String(venta.cliente_documento || '').replace(/\D/g, '');
  const condicion = venta.cliente_condicion_iva || 'CONSUMIDOR_FINAL';

  if (documento.length === 11) {
    const letra = condicion === 'RESPONSABLE_INSCRIPTO' || condicion === 'MONOTRIBUTISTA' ? 'A' : 'B';
    return {
      letra,
      doc_tipo: DOCUMENTO.CUIT,
      doc_nro: documento,
      condicion_iva: CONDICION_IVA_RECEPTOR[condicion],
      nombre: venta.cliente,
    };
  }
  if (documento.length === 7 || documento.length === 8) {
    return {
      letra: 'B',
      doc_tipo: DOCUMENTO.DNI,
      doc_nro: documento,
      condicion_iva: CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL,
      nombre: venta.cliente,
    };
  }
  return {
    letra: 'B',
    doc_tipo: DOCUMENTO.SIN_IDENTIFICAR,
    doc_nro: '0',
    condicion_iva: CONDICION_IVA_RECEPTOR.CONSUMIDOR_FINAL,
    nombre: venta.cliente || null,
  };
}

/**
 * Separa el total de la venta en neto gravado, IVA por alícuota, exento y no gravado.
 * El descuento de la venta se reparte en proporción entre los renglones y todo se calcula
 * en centavos, de modo que la suma siempre coincide exactamente con el total cobrado.
 */
function calcularImportes(venta) {
  const totalCentavos = aCentavos(venta.total);
  const subtotalCentavos = aCentavos(venta.subtotal);

  const porIva = new Map();
  let repartido = 0;
  venta.detalles.forEach((detalle, indice) => {
    const esUltimo = indice === venta.detalles.length - 1;
    const importe = esUltimo
      ? totalCentavos - repartido
      : Math.round((aCentavos(detalle.subtotal) * totalCentavos) / subtotalCentavos);
    repartido += importe;
    porIva.set(detalle.iva, (porIva.get(detalle.iva) || 0) + importe);
  });

  let neto = 0;
  let iva = 0;
  const alicuotas = [];
  for (const [clave, { id, tasa }] of Object.entries(ALICUOTAS)) {
    const conIva = porIva.get(clave);
    if (!conIva) continue;
    const base = Math.round(conIva / (1 + tasa / 100));
    neto += base;
    iva += conIva - base;
    alicuotas.push({ id, tasa, base: aPesos(base), importe: aPesos(conIva - base) });
  }

  return {
    neto: aPesos(neto),
    iva: aPesos(iva),
    exento: aPesos(porIva.get('EXENTO') || 0),
    no_gravado: aPesos(porIva.get('NO_GRAVADO') || 0),
    total: aPesos(totalCentavos),
    alicuotas,
  };
}

const aFechaArca = (fecha) => String(fecha).slice(0, 10).replace(/-/g, '');
const deFechaArca = (texto) => `${texto.slice(0, 4)}-${texto.slice(4, 6)}-${texto.slice(6, 8)}`;

// ------------------------------------------------------------ Emisión
// Los comprobantes se numeran de a uno: una cola evita que dos pedidos simultáneos tomen el mismo número.
let cola = Promise.resolve();
function enSerie(tarea) {
  const resultado = cola.then(tarea, tarea);
  cola = resultado.catch(() => {});
  return resultado;
}

/**
 * Pide el CAE de un comprobante ya calculado. Nunca lanza errores de ARCA: el resultado
 * (autorizado, rechazado o pendiente con su mensaje) queda guardado en el comprobante.
 */
async function autorizar(datos, previo) {
  const emisor = { ambiente: datos.ambiente, cuit: datos.emisor_cuit };
  const referencia = { puntoVenta: datos.punto_venta, tipo: datos.codigo_arca };
  let registro = previo;

  try {
    // 1. Si un intento anterior quedó sin respuesta, puede que ARCA sí lo haya autorizado: se verifica.
    const mismoComprobante =
      previo &&
      previo.estado === 'PENDIENTE' &&
      previo.numero &&
      previo.ambiente === datos.ambiente &&
      previo.punto_venta === datos.punto_venta &&
      previo.codigo_arca === datos.codigo_arca;
    if (mismoComprobante) {
      const existente = await conAcceso(emisor, (auth) =>
        wsfe.consultar(datos.ambiente, auth, { ...referencia, numero: previo.numero })
      );
      const coincide =
        existente &&
        existente.resultado === 'A' &&
        aCentavos(existente.total) === aCentavos(previo.importe_total) &&
        existente.doc_nro === String(previo.receptor_doc_nro);
      if (coincide) {
        await fiscalRepo.marcarAutorizado(previo.id, {
          numero: existente.numero,
          fecha_emision: deFechaArca(existente.fecha),
          cae: existente.cae,
          cae_vencimiento: deFechaArca(existente.cae_vencimiento),
        });
        return fiscalRepo.obtener(datos.venta_id, datos.clase);
      }
    }

    // 2. Nuevo intento: se registra antes de llamar a ARCA para no perder el rastro si se corta la conexión.
    registro = await fiscalRepo.guardarIntento({ ...datos, numero: null, fecha_emision: null });

    const ultimo = await conAcceso(emisor, (auth) => wsfe.ultimoAutorizado(datos.ambiente, auth, referencia));
    const numero = ultimo + 1;
    const fecha = aFecha(new Date());
    await fiscalRepo.asignarNumero(registro.id, { ...datos, numero, fecha_emision: fecha });

    const respuesta = await conAcceso(emisor, (auth) =>
      wsfe.solicitarCae(datos.ambiente, auth, {
        ...referencia,
        numero,
        fecha: aFechaArca(fecha),
        docTipo: datos.receptor_doc_tipo,
        docNro: datos.receptor_doc_nro,
        condicionIvaReceptor: datos.receptor_condicion_iva,
        total: datos.importe_total,
        neto: datos.importe_neto,
        iva: datos.importe_iva,
        exento: datos.importe_exento,
        noGravado: datos.importe_no_gravado,
        alicuotas: datos.detalle_iva,
        asociado: datos.asociado,
      })
    );

    if (respuesta.aprobado) {
      await fiscalRepo.marcarAutorizado(registro.id, {
        numero,
        fecha_emision: fecha,
        cae: respuesta.cae,
        cae_vencimiento: deFechaArca(respuesta.cae_vencimiento),
        mensaje: respuesta.mensaje || null,
      });
    } else {
      await fiscalRepo.marcarRechazado(registro.id, respuesta.mensaje);
    }
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    // Sin respuesta de ARCA o configuración incompleta: queda pendiente para reintentar.
    if (!registro) registro = await fiscalRepo.guardarIntento({ ...datos, numero: null, fecha_emision: null });
    await fiscalRepo.marcarPendiente(registro.id, error.message);
  }

  return fiscalRepo.obtener(datos.venta_id, datos.clase);
}

async function exigirOperativa() {
  const config = await leerConfiguracion();
  const faltantes = calcularFaltantes(config);
  if (!config.habilitada || faltantes.length) {
    throw new AppError(
      409,
      'La facturación electrónica no está habilitada. Un administrador debe completarla en Configuración → Facturación electrónica (ARCA).',
      'FACTURACION_NO_HABILITADA'
    );
  }
  return config;
}

/**
 * Emite (o reintenta) la factura electrónica de una venta.
 * Devuelve el comprobante con su estado; si ARCA no lo autorizó, el motivo queda en `mensaje`.
 */
function emitirFactura(ventaId, usuario) {
  return enSerie(async () => {
    const config = await exigirOperativa();
    const venta = await ventasRepo.obtenerPorId(ventaId);
    if (!venta) throw AppError.notFound('La venta no existe.');
    if (venta.estado !== 'COMPLETADA') throw AppError.conflict('No se puede facturar una venta anulada.');

    const previo = await fiscalRepo.obtener(ventaId, 'FACTURA');
    if (previo?.estado === 'AUTORIZADO') throw AppError.conflict('Esta venta ya tiene una factura autorizada.');

    await ventasRepo.marcarComprobante(ventaId, 'FACTURA');

    const receptor = resolverReceptor(venta);
    const importes = calcularImportes(venta);
    return autorizar(
      {
        venta_id: ventaId,
        clase: 'FACTURA',
        letra: receptor.letra,
        codigo_arca: CODIGO_COMPROBANTE.FACTURA[receptor.letra],
        ambiente: config.ambiente,
        punto_venta: config.punto_venta,
        emisor_cuit: config.cuit,
        receptor_doc_tipo: receptor.doc_tipo,
        receptor_doc_nro: receptor.doc_nro,
        receptor_condicion_iva: receptor.condicion_iva,
        receptor_nombre: receptor.nombre,
        importe_neto: importes.neto,
        importe_iva: importes.iva,
        importe_exento: importes.exento,
        importe_no_gravado: importes.no_gravado,
        importe_total: importes.total,
        detalle_iva: importes.alicuotas,
        usuario_id: usuario.id,
      },
      previo
    );
  });
}

/**
 * Antes de anular una venta facturada hay que emitir su nota de crédito.
 * Si ARCA no la autoriza se lanza un error y la venta NO se anula.
 */
function emitirNotaDeCreditoSiCorresponde(ventaId, usuario) {
  return enSerie(async () => {
    const factura = await fiscalRepo.obtener(ventaId, 'FACTURA');
    if (!factura) return null;

    if (factura.estado === 'PENDIENTE' && factura.numero) {
      throw AppError.conflict(
        'La factura de esta venta quedó pendiente de confirmación con ARCA. ' +
          'Abrí la venta y tocá "Reintentar factura" antes de anularla.'
      );
    }
    if (factura.estado !== 'AUTORIZADO') return null;

    const previa = await fiscalRepo.obtener(ventaId, 'NOTA_CREDITO');
    if (previa?.estado === 'AUTORIZADO') return previa;

    const nota = await autorizar(
      {
        venta_id: ventaId,
        clase: 'NOTA_CREDITO',
        letra: factura.letra,
        codigo_arca: CODIGO_COMPROBANTE.NOTA_CREDITO[factura.letra],
        // La nota de crédito se emite en el mismo ambiente y punto de venta que la factura original.
        ambiente: factura.ambiente,
        punto_venta: factura.punto_venta,
        emisor_cuit: factura.emisor_cuit,
        receptor_doc_tipo: factura.receptor_doc_tipo,
        receptor_doc_nro: factura.receptor_doc_nro,
        receptor_condicion_iva: factura.receptor_condicion_iva,
        receptor_nombre: factura.receptor_nombre,
        importe_neto: factura.importe_neto,
        importe_iva: factura.importe_iva,
        importe_exento: factura.importe_exento,
        importe_no_gravado: factura.importe_no_gravado,
        importe_total: factura.importe_total,
        detalle_iva: factura.detalle_iva,
        comprobante_asociado_id: factura.id,
        asociado: {
          tipo: factura.codigo_arca,
          puntoVenta: factura.punto_venta,
          numero: factura.numero,
          fecha: aFechaArca(factura.fecha_emision),
        },
        usuario_id: usuario.id,
      },
      previa
    );

    if (nota.estado !== 'AUTORIZADO') {
      throw new AppError(
        502,
        `No se pudo emitir la nota de crédito en ARCA, por eso la venta no se anuló. Motivo: ${nota.mensaje}`,
        'NOTA_CREDITO_NO_AUTORIZADA'
      );
    }
    return nota;
  });
}

module.exports = {
  AMBIENTES,
  estado,
  guardarConfiguracion,
  generarPedidoDeCertificado,
  cargarCertificado,
  probarConexion,
  exigirOperativa,
  emitirFactura,
  emitirNotaDeCreditoSiCorresponde,
  // Exportadas para las pruebas automáticas
  calcularImportes,
  resolverReceptor,
};
