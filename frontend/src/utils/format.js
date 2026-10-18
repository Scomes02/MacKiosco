/** Funciones de formato para mostrar importes, números y fechas en es-AR. */

const formatoDineroEntero = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const formatoDineroDecimal = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });
const formatoNumero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const formatoCompacto = new Intl.NumberFormat('es-AR', { notation: 'compact', maximumFractionDigits: 1 });

/** Importes: sin decimales si es un valor entero ($ 1.500) y con dos si tiene centavos ($ 1.500,50). */
export function dinero(valor) {
  const importe = Number(valor) || 0;
  return (Number.isInteger(importe) ? formatoDineroEntero : formatoDineroDecimal).format(importe);
}
export const numero = (valor) => formatoNumero.format(Number(valor) || 0);
export const dineroCompacto = (valor) => `$ ${formatoCompacto.format(Number(valor) || 0)}`;

/** La API devuelve 'YYYY-MM-DD HH:MM:SS' en hora local. */
export function aDate(texto) {
  if (!texto) return null;
  const fecha = new Date(String(texto).replace(' ', 'T'));
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

const dos = (n) => String(n).padStart(2, '0');

export function fecha(texto) {
  const d = aDate(texto);
  return d ? `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}` : '—';
}

export function hora(texto) {
  const d = aDate(texto);
  return d ? `${dos(d.getHours())}:${dos(d.getMinutes())}` : '—';
}

export function fechaHora(texto) {
  const d = aDate(texto);
  return d ? `${fecha(texto)} ${hora(texto)}` : '—';
}

/** Date -> 'YYYY-MM-DD' (para los campos de tipo fecha). */
export function aISO(d) {
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
}

export const hoyISO = () => aISO(new Date());

export function diasAtrasISO(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return aISO(d);
}

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

/** 'YYYY-MM-DD' -> 'lun 28/09' */
export function diaCorto(iso) {
  const d = aDate(`${iso} 00:00:00`);
  return d ? `${DIAS_CORTOS[d.getDay()]} ${dos(d.getDate())}/${dos(d.getMonth() + 1)}` : iso;
}

export const numeroVenta = (id) => `N° ${String(id).padStart(6, '0')}`;

/** Fecha sin hora que llega como 'YYYY-MM-DD' (por ejemplo el vencimiento del CAE) -> 'DD/MM/YYYY'. */
export function fechaSola(texto) {
  const [anio, mes, dia] = String(texto || '').slice(0, 10).split('-');
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : '—';
}

// ---------- Comprobantes fiscales ----------
const CLASES_COMPROBANTE = { FACTURA: 'Factura', NOTA_CREDITO: 'Nota de crédito' };

/** 'Factura B', 'Nota de crédito A', etc. */
export const nombreComprobante = (c) => `${CLASES_COMPROBANTE[c.clase] || 'Factura'} ${c.letra}`;

/** Número fiscal completo: punto de venta (5 dígitos) y número (8 dígitos). */
export const numeroComprobante = (puntoVenta, numero) =>
  `${String(puntoVenta).padStart(5, '0')}-${String(numero).padStart(8, '0')}`;

/** Tratamientos de IVA de un producto, en el orden en que se muestran: [valor, texto]. */
export const OPCIONES_IVA = [
  ['21', 'IVA 21%'],
  ['10.5', 'IVA 10,5%'],
  ['27', 'IVA 27%'],
  ['EXENTO', 'Exento'],
  ['NO_GRAVADO', 'No gravado'],
];

/** Condición frente al IVA del receptor según los códigos de ARCA. */
export const CONDICION_IVA_ARCA = {
  1: 'IVA Responsable Inscripto',
  4: 'IVA Sujeto Exento',
  5: 'Consumidor Final',
  6: 'Responsable Monotributo',
};

/** Letra de la factura que corresponde a un cliente (el emisor es Responsable Inscripto). */
export function letraDeFactura(cliente) {
  const documento = String(cliente?.documento || '').replace(/\D/g, '');
  const conCuit = documento.length === 11;
  return conCuit && ['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA'].includes(cliente.condicion_iva) ? 'A' : 'B';
}

export const CONDICIONES_IVA = {
  CONSUMIDOR_FINAL: 'Consumidor final',
  MONOTRIBUTISTA: 'Monotributista',
  RESPONSABLE_INSCRIPTO: 'Responsable inscripto',
  EXENTO: 'Exento',
};

export const TIPOS_MOVIMIENTO = {
  INICIAL: 'Stock inicial',
  VENTA: 'Venta',
  COMPRA: 'Compra',
  AJUSTE_ENTRADA: 'Ajuste (entrada)',
  AJUSTE_SALIDA: 'Ajuste (salida)',
  ANULACION_VENTA: 'Anulación de venta',
};

/** Convierte el texto de un campo numérico ("1500,5" o "1500.5") a número, o NaN si está vacío o no es válido. */
export function aNumero(texto) {
  if (typeof texto === 'number') return texto;
  const limpio = String(texto ?? '').trim().replace(/\s/g, '').replace(',', '.');
  return limpio === '' ? NaN : Number(limpio);
}

/** Descarga una tabla como archivo CSV (se abre con Excel). */
export function descargarCSV(nombreArchivo, encabezados, filas) {
  const escapar = (valor) => {
    const texto = valor === null || valor === undefined ? '' : String(valor);
    return /[";\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const contenido = [encabezados, ...filas].map((fila) => fila.map(escapar).join(';')).join('\r\n');
  const blob = new Blob([`﻿${contenido}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
