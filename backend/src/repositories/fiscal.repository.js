'use strict';

const { query } = require('../config/db');

const CAMPOS = `id, venta_id, clase, letra, codigo_arca, ambiente, punto_venta, numero, fecha_emision,
                cae, cae_vencimiento, emisor_cuit, receptor_doc_tipo, receptor_doc_nro, receptor_condicion_iva,
                receptor_nombre, importe_neto, importe_iva, importe_exento, importe_no_gravado, importe_total,
                detalle_iva, estado, mensaje, comprobante_asociado_id, creado_en, actualizado_en`;

/**
 * Dirección del código QR obligatorio en los comprobantes electrónicos (RG 4892):
 * al escanearlo, la web de ARCA muestra los datos del comprobante para verificarlo.
 */
function armarQr(c) {
  if (c.estado !== 'AUTORIZADO') return null;
  const datos = {
    ver: 1,
    fecha: String(c.fecha_emision).slice(0, 10),
    cuit: Number(c.emisor_cuit),
    ptoVta: c.punto_venta,
    tipoCmp: c.codigo_arca,
    nroCmp: c.numero,
    importe: Number(c.importe_total),
    moneda: 'PES',
    ctz: 1,
    tipoDocRec: c.receptor_doc_tipo,
    nroDocRec: Number(c.receptor_doc_nro),
    tipoCodAut: 'E',
    codAut: Number(c.cae),
  };
  return `https://www.afip.gob.ar/fe/qr/?p=${Buffer.from(JSON.stringify(datos)).toString('base64')}`;
}

function normalizar(fila) {
  if (!fila) return null;
  // Según la versión de MySQL/driver, las columnas JSON llegan como texto o ya convertidas.
  const detalle = typeof fila.detalle_iva === 'string' ? JSON.parse(fila.detalle_iva) : fila.detalle_iva;
  return { ...fila, detalle_iva: detalle || [], qr_url: armarQr(fila) };
}

async function listarPorVenta(ventaId, conn) {
  const filas = await query(`SELECT ${CAMPOS} FROM comprobantes_fiscales WHERE venta_id = ? ORDER BY id`, [ventaId], conn);
  return filas.map(normalizar);
}

async function obtener(ventaId, clase, conn) {
  const filas = await query(
    `SELECT ${CAMPOS} FROM comprobantes_fiscales WHERE venta_id = ? AND clase = ?`,
    [ventaId, clase],
    conn
  );
  return normalizar(filas[0]);
}

/** Crea el comprobante (o reemplaza los datos de un intento anterior no autorizado) y lo deja PENDIENTE. */
async function guardarIntento(datos) {
  await query(
    `INSERT INTO comprobantes_fiscales
       (venta_id, clase, letra, codigo_arca, ambiente, punto_venta, numero, fecha_emision, emisor_cuit,
        receptor_doc_tipo, receptor_doc_nro, receptor_condicion_iva, receptor_nombre,
        importe_neto, importe_iva, importe_exento, importe_no_gravado, importe_total, detalle_iva,
        estado, mensaje, comprobante_asociado_id, usuario_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDIENTE', ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       letra = VALUES(letra), codigo_arca = VALUES(codigo_arca), ambiente = VALUES(ambiente),
       punto_venta = VALUES(punto_venta), numero = VALUES(numero), fecha_emision = VALUES(fecha_emision),
       emisor_cuit = VALUES(emisor_cuit), receptor_doc_tipo = VALUES(receptor_doc_tipo),
       receptor_doc_nro = VALUES(receptor_doc_nro), receptor_condicion_iva = VALUES(receptor_condicion_iva),
       receptor_nombre = VALUES(receptor_nombre), importe_neto = VALUES(importe_neto),
       importe_iva = VALUES(importe_iva), importe_exento = VALUES(importe_exento),
       importe_no_gravado = VALUES(importe_no_gravado), importe_total = VALUES(importe_total),
       detalle_iva = VALUES(detalle_iva), estado = 'PENDIENTE', mensaje = VALUES(mensaje),
       comprobante_asociado_id = VALUES(comprobante_asociado_id), usuario_id = VALUES(usuario_id)`,
    [
      datos.venta_id,
      datos.clase,
      datos.letra,
      datos.codigo_arca,
      datos.ambiente,
      datos.punto_venta,
      datos.numero,
      datos.fecha_emision,
      datos.emisor_cuit,
      datos.receptor_doc_tipo,
      datos.receptor_doc_nro,
      datos.receptor_condicion_iva,
      datos.receptor_nombre,
      datos.importe_neto,
      datos.importe_iva,
      datos.importe_exento,
      datos.importe_no_gravado,
      datos.importe_total,
      JSON.stringify(datos.detalle_iva),
      datos.mensaje || null,
      datos.comprobante_asociado_id || null,
      datos.usuario_id,
    ]
  );
  return obtener(datos.venta_id, datos.clase);
}

async function marcarAutorizado(id, { numero, fecha_emision, cae, cae_vencimiento, mensaje = null }) {
  await query(
    `UPDATE comprobantes_fiscales
        SET estado = 'AUTORIZADO', numero = ?, fecha_emision = ?, cae = ?, cae_vencimiento = ?, mensaje = ?
      WHERE id = ?`,
    [numero, fecha_emision, cae, cae_vencimiento, mensaje, id]
  );
}

/** Rechazado por ARCA: se libera el número para que no bloquee al próximo comprobante. */
async function marcarRechazado(id, mensaje) {
  await query("UPDATE comprobantes_fiscales SET estado = 'RECHAZADO', numero = NULL, mensaje = ? WHERE id = ?", [
    String(mensaje).slice(0, 500),
    id,
  ]);
}

/** Sin respuesta de ARCA: queda pendiente conservando el número intentado para poder verificarlo luego. */
async function marcarPendiente(id, mensaje) {
  await query("UPDATE comprobantes_fiscales SET estado = 'PENDIENTE', mensaje = ? WHERE id = ?", [
    String(mensaje).slice(0, 500),
    id,
  ]);
}

/**
 * Reserva el número que se va a pedir a ARCA. Si otro comprobante NO autorizado tenía ese mismo
 * número (un intento viejo que ARCA nunca registró), se lo libera: el número sigue disponible.
 */
async function asignarNumero(id, { ambiente, codigo_arca, punto_venta, numero, fecha_emision }) {
  await query(
    `UPDATE comprobantes_fiscales SET numero = NULL
      WHERE ambiente = ? AND codigo_arca = ? AND punto_venta = ? AND numero = ? AND estado <> 'AUTORIZADO' AND id <> ?`,
    [ambiente, codigo_arca, punto_venta, numero, id]
  );
  await query('UPDATE comprobantes_fiscales SET numero = ?, fecha_emision = ? WHERE id = ?', [numero, fecha_emision, id]);
}

// ------------------------------------------------------------ Ticket de acceso (WSAA)
async function obtenerTicket(ambiente, servicio) {
  const filas = await query(
    'SELECT cuit, token, firma, vence_en FROM arca_tickets WHERE ambiente = ? AND servicio = ? AND vence_en > NOW() + INTERVAL 5 MINUTE',
    [ambiente, servicio]
  );
  return filas[0] || null;
}

async function guardarTicket({ ambiente, servicio, cuit, token, firma, vence_en }) {
  await query(
    `INSERT INTO arca_tickets (ambiente, servicio, cuit, token, firma, vence_en) VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE cuit = VALUES(cuit), token = VALUES(token), firma = VALUES(firma), vence_en = VALUES(vence_en)`,
    [ambiente, servicio, cuit, token, firma, vence_en]
  );
}

async function borrarTicket(ambiente, servicio) {
  await query('DELETE FROM arca_tickets WHERE ambiente = ? AND servicio = ?', [ambiente, servicio]);
}

// ------------------------------------------------------------ Reportes
/** Totales por tipo de comprobante de las ventas de un período [desde, hasta). */
async function resumenPorPeriodo(desde, hasta) {
  const [fiscales, ventas] = await Promise.all([
    query(
      `SELECT c.clase, c.letra, COUNT(*) AS cantidad,
              MIN(c.numero) AS primer_numero, MAX(c.numero) AS ultimo_numero,
              SUM(c.importe_neto) AS neto, SUM(c.importe_iva) AS iva,
              SUM(c.importe_exento + c.importe_no_gravado) AS exento, SUM(c.importe_total) AS total
         FROM comprobantes_fiscales c
        WHERE c.estado = 'AUTORIZADO' AND c.actualizado_en >= ? AND c.actualizado_en < ?
        GROUP BY c.clase, c.letra
        ORDER BY c.clase, c.letra`,
      [desde, hasta]
    ),
    query(
      `SELECT COALESCE(SUM(v.comprobante = 'RECIBO'), 0) AS recibos,
              COALESCE(SUM(IF(v.comprobante = 'RECIBO', v.total, 0)), 0) AS total_recibos,
              COALESCE(SUM(v.comprobante = 'FACTURA' AND NOT EXISTS (
                 SELECT 1 FROM comprobantes_fiscales c
                  WHERE c.venta_id = v.id AND c.clase = 'FACTURA' AND c.estado = 'AUTORIZADO')), 0) AS facturas_pendientes
         FROM ventas v
        WHERE v.estado = 'COMPLETADA' AND v.fecha >= ? AND v.fecha < ?`,
      [desde, hasta]
    ),
  ]);

  return {
    fiscales: fiscales.map((f) => ({
      ...f,
      neto: Number(f.neto),
      iva: Number(f.iva),
      exento: Number(f.exento),
      total: Number(f.total),
    })),
    recibos: Number(ventas[0].recibos),
    total_recibos: Number(ventas[0].total_recibos),
    facturas_pendientes: Number(ventas[0].facturas_pendientes),
  };
}

module.exports = {
  listarPorVenta,
  obtener,
  guardarIntento,
  marcarAutorizado,
  marcarRechazado,
  marcarPendiente,
  asignarNumero,
  obtenerTicket,
  guardarTicket,
  borrarTicket,
  resumenPorPeriodo,
};
