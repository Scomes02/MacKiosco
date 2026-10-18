'use strict';

const { query, likeContiene } = require('../config/db');

const SELECT_PRODUCTO = `
  SELECT p.id, p.codigo, p.nombre, p.descripcion, p.categoria_id, p.proveedor_id,
         p.precio_costo, p.precio_venta, p.iva, p.stock, p.stock_minimo, p.imagen_url, p.activo,
         p.creado_en, p.actualizado_en,
         c.nombre AS categoria, c.color AS categoria_color, c.icono AS categoria_icono,
         pr.razon_social AS proveedor
    FROM productos p
    JOIN categorias c ON c.id = p.categoria_id
    LEFT JOIN proveedores pr ON pr.id = p.proveedor_id`;

// Lista blanca de columnas para ordenar (nunca se interpola texto del usuario en el SQL).
const ORDENES = {
  nombre: 'p.nombre',
  codigo: 'p.codigo',
  precio_venta: 'p.precio_venta',
  stock: 'p.stock',
  categoria: 'c.nombre',
};

function armarFiltros({ q, categoria_id, proveedor_id, estado, stock }) {
  const condiciones = ['p.eliminado_en IS NULL'];
  const params = [];

  if (q) {
    condiciones.push('(p.nombre LIKE ? OR p.codigo LIKE ?)');
    const like = likeContiene(q);
    params.push(like, like);
  }
  if (categoria_id) {
    condiciones.push('p.categoria_id = ?');
    params.push(categoria_id);
  }
  if (proveedor_id) {
    condiciones.push('p.proveedor_id = ?');
    params.push(proveedor_id);
  }
  if (estado === 'activos') condiciones.push('p.activo = 1');
  if (estado === 'inactivos') condiciones.push('p.activo = 0');
  if (stock === 'sin') condiciones.push('p.stock = 0');
  if (stock === 'bajo') condiciones.push('p.stock > 0 AND p.stock <= p.stock_minimo');
  if (stock === 'ok') condiciones.push('p.stock > p.stock_minimo');

  return { where: `WHERE ${condiciones.join(' AND ')}`, params };
}

async function listar(filtros) {
  const { where, params } = armarFiltros(filtros);
  const columna = ORDENES[filtros.orden] || ORDENES.nombre;
  const direccion = filtros.direccion === 'desc' ? 'DESC' : 'ASC';
  const desplazamiento = (filtros.page - 1) * filtros.limit;

  const [items, conteo] = await Promise.all([
    query(`${SELECT_PRODUCTO} ${where} ORDER BY ${columna} ${direccion}, p.id ASC LIMIT ? OFFSET ?`, [
      ...params,
      filtros.limit,
      desplazamiento,
    ]),
    query(`SELECT COUNT(*) AS total FROM productos p JOIN categorias c ON c.id = p.categoria_id ${where}`, params),
  ]);
  return { items, total: conteo[0].total };
}

/** Totales del inventario para los mismos filtros del listado. */
async function resumenInventario(filtros) {
  const { where, params } = armarFiltros(filtros);
  const filas = await query(
    `SELECT COUNT(*) AS productos,
            COALESCE(SUM(p.stock), 0) AS unidades,
            COALESCE(SUM(p.stock * p.precio_costo), 0) AS capital_costo,
            COALESCE(SUM(p.stock * p.precio_venta), 0) AS valor_venta,
            COALESCE(SUM(p.stock = 0), 0) AS sin_stock,
            COALESCE(SUM(p.stock > 0 AND p.stock <= p.stock_minimo), 0) AS stock_bajo
       FROM productos p
       JOIN categorias c ON c.id = p.categoria_id
       ${where}`,
    params
  );
  const r = filas[0];
  return {
    productos: r.productos,
    unidades: Number(r.unidades),
    capital_costo: Number(r.capital_costo),
    valor_venta: Number(r.valor_venta),
    ganancia_potencial: Math.round((Number(r.valor_venta) - Number(r.capital_costo)) * 100) / 100,
    sin_stock: Number(r.sin_stock),
    stock_bajo: Number(r.stock_bajo),
  };
}

/** Búsqueda rápida para el punto de venta: solo productos activos; primero la coincidencia exacta de código. */
async function buscarParaVenta({ q, categoria_id, limit }) {
  const condiciones = ['p.eliminado_en IS NULL', 'p.activo = 1'];
  const params = [];
  if (q) {
    condiciones.push('(p.nombre LIKE ? OR p.codigo LIKE ?)');
    const like = likeContiene(q);
    params.push(like, like);
  }
  if (categoria_id) {
    condiciones.push('p.categoria_id = ?');
    params.push(categoria_id);
  }
  return query(
    `SELECT p.id, p.codigo, p.nombre, p.precio_venta, p.stock, p.stock_minimo, p.imagen_url, p.categoria_id,
            c.nombre AS categoria, c.color AS categoria_color, c.icono AS categoria_icono
       FROM productos p
       JOIN categorias c ON c.id = p.categoria_id
      WHERE ${condiciones.join(' AND ')}
      ORDER BY (p.codigo = ?) DESC, (p.stock > 0) DESC, p.nombre ASC
      LIMIT ?`,
    [...params, q || '', limit]
  );
}

async function obtenerPorId(id, conn) {
  const filas = await query(`${SELECT_PRODUCTO} WHERE p.id = ? AND p.eliminado_en IS NULL`, [id], conn);
  return filas[0] || null;
}

async function existeCodigo(codigo, excluirId = 0) {
  const filas = await query(
    'SELECT id FROM productos WHERE codigo = ? AND eliminado_en IS NULL AND id <> ? LIMIT 1',
    [codigo, excluirId]
  );
  return filas.length > 0;
}

/**
 * Trae los productos indicados BLOQUEANDO sus filas hasta el fin de la transacción.
 * Se ordena por id para que dos operaciones simultáneas no se bloqueen entre sí (deadlock).
 */
async function obtenerParaActualizar(ids, conn) {
  if (!ids.length) return [];
  return query(
    `SELECT id, codigo, nombre, precio_costo, precio_venta, iva, stock, activo, eliminado_en
       FROM productos
      WHERE id IN (?)
      ORDER BY id
        FOR UPDATE`,
    [ids],
    conn
  );
}

async function crear(datos, conn) {
  const resultado = await query(
    `INSERT INTO productos
       (codigo, nombre, descripcion, categoria_id, proveedor_id, precio_costo, precio_venta, iva,
        stock, stock_minimo, imagen_url, activo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      datos.codigo,
      datos.nombre,
      datos.descripcion,
      datos.categoria_id,
      datos.proveedor_id,
      datos.precio_costo,
      datos.precio_venta,
      datos.iva,
      datos.stock,
      datos.stock_minimo,
      datos.imagen_url,
      datos.activo ? 1 : 0,
    ],
    conn
  );
  return resultado.insertId;
}

async function actualizar(id, datos) {
  await query(
    `UPDATE productos
        SET codigo = ?, nombre = ?, descripcion = ?, categoria_id = ?, proveedor_id = ?,
            precio_costo = ?, precio_venta = ?, iva = ?, stock_minimo = ?, imagen_url = ?, activo = ?
      WHERE id = ?`,
    [
      datos.codigo,
      datos.nombre,
      datos.descripcion,
      datos.categoria_id,
      datos.proveedor_id,
      datos.precio_costo,
      datos.precio_venta,
      datos.iva,
      datos.stock_minimo,
      datos.imagen_url,
      datos.activo ? 1 : 0,
      id,
    ]
  );
}

async function actualizarStock(id, stock, conn) {
  await query('UPDATE productos SET stock = ? WHERE id = ?', [stock, id], conn);
}

async function actualizarStockYCosto(id, stock, precioCosto, conn) {
  await query('UPDATE productos SET stock = ?, precio_costo = ? WHERE id = ?', [stock, precioCosto, id], conn);
}

/** Indica si el producto aparece en ventas o compras (en ese caso no se puede borrar físicamente). */
async function tieneHistorial(id, conn) {
  const filas = await query(
    `SELECT (SELECT COUNT(*) FROM venta_detalles WHERE producto_id = ?) +
            (SELECT COUNT(*) FROM compra_detalles WHERE producto_id = ?) AS total`,
    [id, id],
    conn
  );
  return filas[0].total > 0;
}

async function eliminarFisico(id, conn) {
  await query('DELETE FROM productos WHERE id = ?', [id], conn);
}

async function marcarEliminado(id, conn) {
  await query('UPDATE productos SET eliminado_en = NOW(), activo = 0 WHERE id = ?', [id], conn);
}

module.exports = {
  listar,
  resumenInventario,
  buscarParaVenta,
  obtenerPorId,
  existeCodigo,
  obtenerParaActualizar,
  crear,
  actualizar,
  actualizarStock,
  actualizarStockYCosto,
  tieneHistorial,
  eliminarFisico,
  marcarEliminado,
};
