'use strict';

const { query, likeContiene } = require('../config/db');
const fiscalRepo = require('./fiscal.repository');

async function crear(
  { usuario_id, cliente_id, caja_id, subtotal, descuento_porcentaje, descuento_monto, total, comprobante, observaciones },
  conn
) {
  const resultado = await query(
    `INSERT INTO ventas
       (usuario_id, cliente_id, caja_id, subtotal, descuento_porcentaje, descuento_monto, total, comprobante, observaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [usuario_id, cliente_id, caja_id, subtotal, descuento_porcentaje, descuento_monto, total, comprobante, observaciones],
    conn
  );
  return resultado.insertId;
}

async function insertarDetalles(ventaId, detalles, conn) {
  const filas = detalles.map((d) => [
    ventaId,
    d.producto_id,
    d.producto_codigo,
    d.producto_nombre,
    d.cantidad,
    d.precio_unitario,
    d.precio_costo,
    d.iva,
    d.subtotal,
  ]);
  await query(
    `INSERT INTO venta_detalles
       (venta_id, producto_id, producto_codigo, producto_nombre, cantidad, precio_unitario, precio_costo, iva, subtotal)
     VALUES ?`,
    [filas],
    conn
  );
}

async function insertarPagos(ventaId, pagos, conn) {
  const filas = pagos.map((p) => [ventaId, p.metodo_pago_id, p.monto]);
  await query('INSERT INTO venta_pagos (venta_id, metodo_pago_id, monto) VALUES ?', [filas], conn);
}

function armarFiltros({ q, desde, hasta, estado, metodo_pago_id, usuario_id, caja_id, comprobante }) {
  const condiciones = [];
  const params = [];

  if (q) {
    // Permite buscar por número de venta o por nombre del cliente.
    const numero = Number.parseInt(q.replace(/\D/g, ''), 10);
    if (/^[#\s\dVv-]+$/.test(q) && !Number.isNaN(numero)) {
      condiciones.push('v.id = ?');
      params.push(numero);
    } else {
      condiciones.push('c.nombre LIKE ?');
      params.push(likeContiene(q));
    }
  }
  if (desde) {
    condiciones.push('v.fecha >= ?');
    params.push(`${desde} 00:00:00`);
  }
  if (hasta) {
    condiciones.push('v.fecha < DATE_ADD(?, INTERVAL 1 DAY)');
    params.push(hasta);
  }
  if (estado && estado !== 'todas') {
    condiciones.push('v.estado = ?');
    params.push(estado);
  }
  if (usuario_id) {
    condiciones.push('v.usuario_id = ?');
    params.push(usuario_id);
  }
  if (caja_id) {
    condiciones.push('v.caja_id = ?');
    params.push(caja_id);
  }
  if (metodo_pago_id) {
    condiciones.push('EXISTS (SELECT 1 FROM venta_pagos vp WHERE vp.venta_id = v.id AND vp.metodo_pago_id = ?)');
    params.push(metodo_pago_id);
  }
  if (comprobante === 'RECIBO') condiciones.push("v.comprobante = 'RECIBO'");
  if (comprobante === 'FACTURA') condiciones.push("f.estado = 'AUTORIZADO'");
  if (comprobante === 'FACTURA_PENDIENTE') {
    condiciones.push("v.comprobante = 'FACTURA' AND (f.id IS NULL OR f.estado <> 'AUTORIZADO')");
  }

  return { where: condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '', params };
}

async function listar(filtros) {
  const { where, params } = armarFiltros(filtros);
  const tablas = `
    FROM ventas v
    LEFT JOIN clientes c ON c.id = v.cliente_id
    LEFT JOIN comprobantes_fiscales f ON f.venta_id = v.id AND f.clase = 'FACTURA'`;

  const [items, totales] = await Promise.all([
    query(
      `SELECT v.id, v.fecha, v.subtotal, v.descuento_porcentaje, v.descuento_monto, v.total, v.estado, v.caja_id,
              v.comprobante,
              f.estado AS factura_estado, f.letra AS factura_letra,
              f.punto_venta AS factura_punto_venta, f.numero AS factura_numero,
              u.nombre AS usuario,
              c.nombre AS cliente,
              (SELECT COALESCE(SUM(d.cantidad), 0) FROM venta_detalles d WHERE d.venta_id = v.id) AS unidades,
              (SELECT GROUP_CONCAT(mp.nombre ORDER BY vp.id SEPARATOR ' + ')
                 FROM venta_pagos vp JOIN metodos_pago mp ON mp.id = vp.metodo_pago_id
                WHERE vp.venta_id = v.id) AS metodos_pago
         ${tablas}
         JOIN usuarios u ON u.id = v.usuario_id
         ${where}
        ORDER BY v.fecha DESC, v.id DESC
        LIMIT ? OFFSET ?`,
      [...params, filtros.limit, (filtros.page - 1) * filtros.limit]
    ),
    query(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(v.estado = 'COMPLETADA'), 0) AS completadas,
              COALESCE(SUM(v.estado = 'ANULADA'), 0) AS anuladas,
              COALESCE(SUM(IF(v.estado = 'COMPLETADA', v.total, 0)), 0) AS importe
         ${tablas}
         ${where}`,
      params
    ),
  ]);

  const t = totales[0];
  return {
    items: items.map((v) => ({ ...v, unidades: Number(v.unidades) })),
    total: t.total,
    resumen: {
      completadas: Number(t.completadas),
      anuladas: Number(t.anuladas),
      importe: Number(t.importe),
    },
  };
}

/** Venta completa: cabecera, renglones, pagos y comprobantes fiscales (factura y nota de crédito). */
async function obtenerPorId(id, conn) {
  const filas = await query(
    `SELECT v.*, u.nombre AS usuario,
            c.nombre AS cliente, c.documento AS cliente_documento, c.condicion_iva AS cliente_condicion_iva,
            c.direccion AS cliente_direccion,
            ua.nombre AS anulada_por_nombre, cj.estado AS caja_estado
       FROM ventas v
       JOIN usuarios u ON u.id = v.usuario_id
       JOIN cajas cj ON cj.id = v.caja_id
       LEFT JOIN clientes c ON c.id = v.cliente_id
       LEFT JOIN usuarios ua ON ua.id = v.anulada_por
      WHERE v.id = ?`,
    [id],
    conn
  );
  if (!filas[0]) return null;

  const [detalles, pagos, comprobantes] = await Promise.all([
    query(
      `SELECT id, producto_id, producto_codigo, producto_nombre, cantidad, precio_unitario, iva, subtotal
         FROM venta_detalles WHERE venta_id = ? ORDER BY id`,
      [id],
      conn
    ),
    query(
      `SELECT vp.id, vp.metodo_pago_id, mp.nombre AS metodo, mp.es_efectivo, vp.monto
         FROM venta_pagos vp JOIN metodos_pago mp ON mp.id = vp.metodo_pago_id
        WHERE vp.venta_id = ? ORDER BY vp.id`,
      [id],
      conn
    ),
    fiscalRepo.listarPorVenta(id, conn),
  ]);

  return {
    ...filas[0],
    detalles,
    pagos,
    factura: comprobantes.find((c) => c.clase === 'FACTURA') || null,
    nota_credito: comprobantes.find((c) => c.clase === 'NOTA_CREDITO') || null,
  };
}

/** Bloquea la venta para anularla sin que otra operación la modifique al mismo tiempo. */
async function obtenerParaAnular(id, conn) {
  const filas = await query(
    `SELECT v.id, v.estado, v.caja_id, cj.estado AS caja_estado
       FROM ventas v JOIN cajas cj ON cj.id = v.caja_id
      WHERE v.id = ? FOR UPDATE`,
    [id],
    conn
  );
  return filas[0] || null;
}

async function listarDetalles(ventaId, conn) {
  return query('SELECT producto_id, cantidad FROM venta_detalles WHERE venta_id = ? ORDER BY producto_id', [ventaId], conn);
}

async function marcarAnulada(id, { usuario_id, motivo }, conn) {
  await query(
    `UPDATE ventas SET estado = 'ANULADA', anulada_en = NOW(), anulada_por = ?, motivo_anulacion = ? WHERE id = ?`,
    [usuario_id, motivo, id],
    conn
  );
}

async function marcarComprobante(id, comprobante) {
  await query('UPDATE ventas SET comprobante = ? WHERE id = ?', [comprobante, id]);
}

module.exports = {
  crear,
  insertarDetalles,
  insertarPagos,
  listar,
  obtenerPorId,
  obtenerParaAnular,
  listarDetalles,
  marcarAnulada,
  marcarComprobante,
};
