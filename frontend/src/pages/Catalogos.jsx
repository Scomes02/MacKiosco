import { useAuth } from '../context/AuthContext';
import CatalogoCrud from '../components/CatalogoCrud';
import { CONDICIONES_IVA, dinero, fecha } from '../utils/format';

/** Definición de los catálogos simples: cada uno describe sus columnas y los campos de su formulario. */

const CATEGORIAS = {
  recurso: '/categorias',
  titulo: 'Categorías',
  descripcion: 'Rubros en los que se organizan los productos',
  singular: 'Categoría',
  femenino: true,
  textoNuevo: 'Nueva categoría',
  placeholderBusqueda: 'Buscar categoría…',
  nombreDe: (item) => item.nombre,
  vacio: { nombre: '', descripcion: '', color: '#6366f1', icono: '📦' },
  columnas: [
    {
      titulo: 'Categoría',
      celda: (c) => (
        <span className="celda-con-icono">
          <span className="miniatura" style={{ width: 34, height: 34, fontSize: 17, '--color-categoria': c.color }} aria-hidden="true">
            <span>{c.icono}</span>
          </span>
          <strong>{c.nombre}</strong>
        </span>
      ),
    },
    { titulo: 'Descripción', celda: (c) => c.descripcion || '—' },
    { titulo: 'Productos', num: true, celda: (c) => c.productos },
  ],
  campos: [
    { nombre: 'nombre', etiqueta: 'Nombre', requerido: true, max: 60 },
    { nombre: 'descripcion', etiqueta: 'Descripción', tipo: 'area', max: 255 },
    { nombre: 'icono', etiqueta: 'Ícono', tipo: 'icono', ayuda: 'Se muestra en el punto de venta cuando el producto no tiene imagen.' },
    { nombre: 'color', etiqueta: 'Color', tipo: 'color', ancho: 'medio' },
  ],
};

const CLIENTES = {
  recurso: '/clientes',
  titulo: 'Clientes',
  descripcion: 'Clientes habituales para identificar en las ventas',
  singular: 'Cliente',
  textoNuevo: 'Nuevo cliente',
  placeholderBusqueda: 'Buscar por nombre, CUIT/DNI o dirección…',
  nombreDe: (item) => item.nombre,
  vacio: { nombre: '', documento: '', condicion_iva: 'CONSUMIDOR_FINAL', telefono: '', email: '', direccion: '', notas: '' },
  columnas: [
    {
      titulo: 'Cliente',
      celda: (c) => (
        <>
          <strong>{c.nombre}</strong>
          <small className="bloque">{c.documento || 'Sin documento'}</small>
        </>
      ),
    },
    { titulo: 'Condición IVA', celda: (c) => CONDICIONES_IVA[c.condicion_iva] },
    {
      titulo: 'Contacto',
      celda: (c) => (
        <>
          {c.telefono || '—'}
          {c.email ? <small className="bloque">{c.email}</small> : null}
        </>
      ),
    },
    { titulo: 'Compras', num: true, celda: (c) => c.compras },
    { titulo: 'Total comprado', num: true, celda: (c) => dinero(c.total_comprado) },
    { titulo: 'Última compra', celda: (c) => (c.ultima_compra ? fecha(c.ultima_compra) : '—') },
  ],
  campos: [
    { nombre: 'nombre', etiqueta: 'Nombre o razón social', requerido: true, max: 120 },
    { nombre: 'documento', etiqueta: 'CUIT / DNI', ancho: 'medio', max: 13, placeholder: '20-12345678-9' },
    { nombre: 'condicion_iva', etiqueta: 'Condición frente al IVA', tipo: 'select', ancho: 'medio', opciones: Object.entries(CONDICIONES_IVA) },
    { nombre: 'telefono', etiqueta: 'Teléfono', ancho: 'medio', max: 30 },
    { nombre: 'email', etiqueta: 'Email', tipo: 'email', ancho: 'medio', max: 120 },
    { nombre: 'direccion', etiqueta: 'Dirección', max: 160 },
    { nombre: 'notas', etiqueta: 'Notas', tipo: 'area', max: 255 },
  ],
};

const PROVEEDORES = {
  recurso: '/proveedores',
  titulo: 'Proveedores',
  descripcion: 'Empresas y distribuidores a los que se les compra mercadería',
  singular: 'Proveedor',
  textoNuevo: 'Nuevo proveedor',
  placeholderBusqueda: 'Buscar por razón social, CUIT o contacto…',
  nombreDe: (item) => item.razon_social,
  vacio: { razon_social: '', cuit: '', contacto: '', telefono: '', email: '', direccion: '', notas: '' },
  columnas: [
    {
      titulo: 'Proveedor',
      celda: (p) => (
        <>
          <strong>{p.razon_social}</strong>
          <small className="bloque">{p.cuit ? `CUIT ${p.cuit}` : 'Sin CUIT'}</small>
        </>
      ),
    },
    {
      titulo: 'Contacto',
      celda: (p) => (
        <>
          {p.contacto || '—'}
          <small className="bloque">{[p.telefono, p.email].filter(Boolean).join(' · ')}</small>
        </>
      ),
    },
    { titulo: 'Productos', num: true, celda: (p) => p.productos },
    { titulo: 'Última compra', celda: (p) => (p.ultima_compra ? fecha(p.ultima_compra) : '—') },
  ],
  campos: [
    { nombre: 'razon_social', etiqueta: 'Razón social', requerido: true, max: 120 },
    { nombre: 'cuit', etiqueta: 'CUIT', ancho: 'medio', max: 13, placeholder: '30-12345678-9' },
    { nombre: 'contacto', etiqueta: 'Persona de contacto', ancho: 'medio', max: 80 },
    { nombre: 'telefono', etiqueta: 'Teléfono', ancho: 'medio', max: 30 },
    { nombre: 'email', etiqueta: 'Email', tipo: 'email', ancho: 'medio', max: 120 },
    { nombre: 'direccion', etiqueta: 'Dirección', max: 160 },
    { nombre: 'notas', etiqueta: 'Notas', tipo: 'area', max: 255, ayuda: 'Días de reparto, condiciones de pago, etc.' },
  ],
};

export function Categorias() {
  return <CatalogoCrud config={CATEGORIAS} />;
}

export function Clientes() {
  const { esAdmin } = useAuth();
  return <CatalogoCrud config={CLIENTES} puedeEliminar={esAdmin} />;
}

export function Proveedores() {
  return <CatalogoCrud config={PROVEEDORES} />;
}
