'use strict';

const { z } = require('zod');

/**
 * Piezas reutilizables para armar los esquemas de validación.
 * Todos los mensajes están pensados para mostrarse tal cual al usuario.
 */

const aNumero = (valor) => {
  if (typeof valor === 'string') {
    const limpio = valor.trim().replace(',', '.');
    return limpio === '' ? undefined : Number(limpio);
  }
  return valor === null ? undefined : valor;
};

const vacioANulo = (valor) => {
  if (valor === undefined || valor === null) return null;
  if (typeof valor === 'string' && valor.trim() === '') return null;
  return valor;
};

const tieneHastaDosDecimales = (n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;

/** Texto obligatorio. */
const texto = (campo, { min = 1, max = 120 } = {}) =>
  z
    .string({ required_error: `${campo} es obligatorio.`, invalid_type_error: `${campo} no es válido.` })
    .trim()
    .min(min, min === 1 ? `${campo} es obligatorio.` : `${campo} debe tener al menos ${min} caracteres.`)
    .max(max, `${campo} no puede superar los ${max} caracteres.`);

/** Texto opcional: vacío, null o ausente se guardan como NULL. */
const textoOpcional = (campo, max = 255) =>
  z.preprocess(
    vacioANulo,
    z
      .string({ invalid_type_error: `${campo} no es válido.` })
      .trim()
      .max(max, `${campo} no puede superar los ${max} caracteres.`)
      .nullable()
  );

/** Email opcional. */
const emailOpcional = (campo = 'El email') =>
  z.preprocess(
    vacioANulo,
    z
      .string()
      .trim()
      .max(120, `${campo} no puede superar los 120 caracteres.`)
      .email(`${campo} no tiene un formato válido.`)
      .nullable()
  );

/** Importe en pesos, mayor o igual a cero y con hasta 2 decimales. */
const dinero = (campo, { min = 0, max = 99999999.99 } = {}) =>
  z.preprocess(
    aNumero,
    z
      .number({ required_error: `${campo} es obligatorio.`, invalid_type_error: `${campo} debe ser un número.` })
      .finite(`${campo} debe ser un número.`)
      .min(min, min > 0 ? `${campo} debe ser mayor a cero.` : `${campo} no puede ser negativo.`)
      .max(max, `${campo} es demasiado grande.`)
      .refine(tieneHastaDosDecimales, `${campo} admite hasta 2 decimales.`)
  );

/** Número entero dentro de un rango. */
const entero = (campo, { min = 0, max = 1000000 } = {}) =>
  z.preprocess(
    aNumero,
    z
      .number({ required_error: `${campo} es obligatorio.`, invalid_type_error: `${campo} debe ser un número.` })
      .int(`${campo} debe ser un número entero.`)
      .min(min, min === 1 ? `${campo} debe ser mayor a cero.` : `${campo} no puede ser menor a ${min}.`)
      .max(max, `${campo} no puede ser mayor a ${max}.`)
  );

/** Identificador de un registro relacionado (obligatorio). */
const id = (campo = 'El identificador') =>
  z.preprocess(
    aNumero,
    z
      .number({ required_error: `${campo} es obligatorio.`, invalid_type_error: `${campo} no es válido.` })
      .int(`${campo} no es válido.`)
      .positive(`${campo} no es válido.`)
  );

/** Identificador opcional: vacío, null o ausente quedan como NULL. */
const idOpcional = (campo = 'El identificador') =>
  z.preprocess(
    (v) => (vacioANulo(v) === null ? null : aNumero(v)),
    z
      .number({ invalid_type_error: `${campo} no es válido.` })
      .int(`${campo} no es válido.`)
      .positive(`${campo} no es válido.`)
      .nullable()
  );

/** Booleano que acepta true/false, 1/0 y "true"/"false". */
const booleano = (campo, porDefecto) => {
  const base = z.preprocess((v) => {
    if (v === 'true' || v === 1 || v === '1') return true;
    if (v === 'false' || v === 0 || v === '0') return false;
    return v;
  }, z.boolean({ invalid_type_error: `${campo} no es válido.`, required_error: `${campo} es obligatorio.` }));
  return porDefecto === undefined ? base : base.default(porDefecto);
};

/** Fecha 'YYYY-MM-DD' opcional para filtros. */
const fechaOpcional = (campo) =>
  z.preprocess(
    (v) => (vacioANulo(v) === null ? undefined : v),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, `${campo} debe tener el formato AAAA-MM-DD.`)
      .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00`)), `${campo} no es una fecha válida.`)
      .optional()
  );

/** Parámetro :id de las rutas. */
const paramsId = z.object({ id: id() });

/** Filtros comunes de los listados. */
const paginacion = {
  page: z.preprocess(aNumero, z.number().int().min(1).default(1)),
  limit: z.preprocess(aNumero, z.number().int().min(1).max(200).default(20)),
};

const busqueda = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim() : ''),
  z.string().max(100, 'La búsqueda es demasiado larga.')
);

module.exports = {
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
  paramsId,
  paginacion,
  busqueda,
};
