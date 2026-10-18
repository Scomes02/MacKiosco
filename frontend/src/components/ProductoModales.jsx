import { useState } from 'react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { OPCIONES_IVA, aNumero, dinero } from '../utils/format';
import { Boton, Campo, Modal } from './ui';

const redondear = (n) => Math.round(n * 100) / 100;

/** Alta y edición de productos. El stock solo se carga al crear; después se modifica con ajustes, compras y ventas. */
export function FormularioProducto({ producto, categorias, proveedores, onCerrar, onGuardado }) {
  const toast = useToast();
  const esNuevo = !producto;
  const [form, setForm] = useState({
    codigo: producto?.codigo ?? '',
    nombre: producto?.nombre ?? '',
    descripcion: producto?.descripcion ?? '',
    categoria_id: producto?.categoria_id ?? '',
    proveedor_id: producto?.proveedor_id ?? '',
    precio_costo: producto?.precio_costo ?? '',
    precio_venta: producto?.precio_venta ?? '',
    iva: producto?.iva ?? '21',
    stock: '0',
    stock_minimo: producto?.stock_minimo ?? '0',
    imagen_url: producto?.imagen_url ?? '',
    activo: producto ? Boolean(producto.activo) : true,
  });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (evento) => setForm({ ...form, [campo]: evento.target.value });

  const costo = aNumero(form.precio_costo);
  const venta = aNumero(form.precio_venta);
  const margen = costo > 0 && !Number.isNaN(venta) ? redondear(((venta - costo) / costo) * 100) : '';

  const cambiarMargen = (evento) => {
    const porcentaje = aNumero(evento.target.value);
    if (Number.isNaN(porcentaje) || !(costo > 0)) return;
    setForm({ ...form, precio_venta: String(redondear(costo * (1 + porcentaje / 100))) });
  };

  const validar = () => {
    const nuevos = {};
    if (!form.codigo.trim()) nuevos.codigo = 'El código es obligatorio.';
    else if (!/^[A-Za-z0-9._-]+$/.test(form.codigo.trim())) nuevos.codigo = 'Solo letras, números, punto y guiones (sin espacios).';
    if (form.nombre.trim().length < 2) nuevos.nombre = 'El nombre es obligatorio.';
    if (!form.categoria_id) nuevos.categoria_id = 'Elegí una categoría.';
    if (Number.isNaN(costo) || costo < 0) nuevos.precio_costo = 'Ingresá un costo válido (puede ser 0).';
    if (Number.isNaN(venta) || venta <= 0) nuevos.precio_venta = 'El precio de venta debe ser mayor a cero.';
    const minimo = aNumero(form.stock_minimo);
    if (!Number.isInteger(minimo) || minimo < 0) nuevos.stock_minimo = 'Debe ser un número entero, 0 o mayor.';
    if (esNuevo) {
      const stock = aNumero(form.stock);
      if (!Number.isInteger(stock) || stock < 0) nuevos.stock = 'Debe ser un número entero, 0 o mayor.';
    }
    if (form.imagen_url.trim() && !/^https?:\/\/\S+$/i.test(form.imagen_url.trim())) nuevos.imagen_url = 'Debe empezar con http:// o https://';
    return nuevos;
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    const nuevos = validar();
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    const datos = {
      codigo: form.codigo.trim(),
      nombre: form.nombre.trim(),
      descripcion: form.descripcion,
      categoria_id: Number(form.categoria_id),
      proveedor_id: form.proveedor_id ? Number(form.proveedor_id) : null,
      precio_costo: costo,
      precio_venta: venta,
      iva: form.iva,
      stock_minimo: aNumero(form.stock_minimo),
      imagen_url: form.imagen_url.trim(),
      activo: form.activo,
    };

    setGuardando(true);
    try {
      if (esNuevo) await api.post('/productos', { ...datos, stock: aNumero(form.stock) });
      else await api.put(`/productos/${producto.id}`, datos);
      toast.exito(esNuevo ? 'Producto creado correctamente.' : 'Cambios guardados.');
      onGuardado();
    } catch (error) {
      setErrores(error.fields || {});
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      titulo={esNuevo ? 'Nuevo producto' : 'Editar producto'}
      onCerrar={onCerrar}
      ancho="grande"
      bloqueado={guardando}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-producto" cargando={guardando}>
            {esNuevo ? 'Crear producto' : 'Guardar cambios'}
          </Boton>
        </>
      }
    >
      <form id="form-producto" className="formulario formulario-3" onSubmit={guardar} noValidate>
        <Campo etiqueta="Código de barras / interno" error={errores.codigo} requerido>
          {(id) => <input id={id} value={form.codigo} onChange={cambiar('codigo')} maxLength={30} autoComplete="off" />}
        </Campo>
        <Campo etiqueta="Nombre" error={errores.nombre} requerido className="campo-doble">
          {(id) => <input id={id} value={form.nombre} onChange={cambiar('nombre')} maxLength={120} />}
        </Campo>

        <Campo etiqueta="Descripción" error={errores.descripcion} className="campo-completo">
          {(id) => <input id={id} value={form.descripcion} onChange={cambiar('descripcion')} maxLength={255} />}
        </Campo>

        <Campo etiqueta="Categoría" error={errores.categoria_id} requerido>
          {(id) => (
            <select id={id} value={form.categoria_id} onChange={cambiar('categoria_id')}>
              <option value="">Elegir…</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icono} {c.nombre}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="Proveedor" error={errores.proveedor_id} className="campo-doble">
          {(id) => (
            <select id={id} value={form.proveedor_id} onChange={cambiar('proveedor_id')}>
              <option value="">Sin proveedor</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.razon_social}
                </option>
              ))}
            </select>
          )}
        </Campo>

        <Campo etiqueta="Precio de costo" error={errores.precio_costo} requerido>
          {(id) => <input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={form.precio_costo} onChange={cambiar('precio_costo')} />}
        </Campo>
        <Campo etiqueta="Margen %" ayuda="Al cambiarlo se recalcula el precio de venta.">
          {(id) => <input id={id} type="number" inputMode="decimal" step="0.1" value={margen} onChange={cambiarMargen} disabled={!(costo > 0)} />}
        </Campo>
        <Campo etiqueta="Precio de venta" error={errores.precio_venta} requerido>
          {(id) => <input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={form.precio_venta} onChange={cambiar('precio_venta')} />}
        </Campo>

        {esNuevo ? (
          <Campo etiqueta="Stock inicial" error={errores.stock} requerido>
            {(id) => <input id={id} type="number" inputMode="numeric" min="0" step="1" value={form.stock} onChange={cambiar('stock')} />}
          </Campo>
        ) : (
          <Campo etiqueta="Stock actual" ayuda="Se modifica desde «Ajustar stock» o con una compra.">
            {(id) => <input id={id} value={producto.stock} disabled readOnly />}
          </Campo>
        )}
        <Campo etiqueta="Stock mínimo" error={errores.stock_minimo} ayuda="Avisa cuando el stock llega a este valor." requerido>
          {(id) => <input id={id} type="number" inputMode="numeric" min="0" step="1" value={form.stock_minimo} onChange={cambiar('stock_minimo')} />}
        </Campo>
        <Campo etiqueta="IVA" ayuda="Se usa al emitir facturas. El precio de venta ya lo incluye.">
          {(id) => (
            <select id={id} value={form.iva} onChange={cambiar('iva')}>
              {OPCIONES_IVA.map(([clave, texto]) => (
                <option key={clave} value={clave}>
                  {texto}
                </option>
              ))}
            </select>
          )}
        </Campo>

        <label className="casilla campo-completo">
          <input type="checkbox" checked={form.activo} onChange={(evento) => setForm({ ...form, activo: evento.target.checked })} />
          <span>Activo (disponible para la venta)</span>
        </label>

        <Campo etiqueta="Imagen (URL, opcional)" error={errores.imagen_url} ayuda="Si se deja vacío se muestra el ícono de la categoría." className="campo-completo">
          {(id) => <input id={id} type="url" value={form.imagen_url} onChange={cambiar('imagen_url')} maxLength={500} placeholder="https://…" />}
        </Campo>
      </form>
    </Modal>
  );
}

const MOTIVOS = {
  ENTRADA: ['Reposición de mercadería', 'Corrección de inventario', 'Devolución de cliente'],
  SALIDA: ['Rotura o producto dañado', 'Producto vencido', 'Consumo interno', 'Corrección de inventario', 'Robo o faltante'],
};

/** Ajuste manual de stock con motivo obligatorio (queda registrado en los movimientos). */
export function AjusteStock({ producto, onCerrar, onGuardado }) {
  const toast = useToast();
  const [tipo, setTipo] = useState('ENTRADA');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState(MOTIVOS.ENTRADA[0]);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const valor = aNumero(cantidad);
  const resultante = Number.isInteger(valor) && valor > 0 ? producto.stock + (tipo === 'ENTRADA' ? valor : -valor) : null;

  const elegirTipo = (nuevo) => {
    setTipo(nuevo);
    setMotivo(MOTIVOS[nuevo][0]);
    setErrores({});
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    const nuevos = {};
    if (!Number.isInteger(valor) || valor <= 0) nuevos.cantidad = 'Ingresá una cantidad entera mayor a cero.';
    else if (tipo === 'SALIDA' && valor > producto.stock) nuevos.cantidad = `No podés descontar más que el stock actual (${producto.stock}).`;
    if (motivo.trim().length < 3) nuevos.motivo = 'Indicá el motivo del ajuste.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setGuardando(true);
    try {
      await api.post('/stock/ajustes', { producto_id: producto.id, tipo, cantidad: valor, motivo: motivo.trim() });
      toast.exito(`Stock de "${producto.nombre}" actualizado: ${resultante} unidades.`);
      onGuardado();
    } catch (error) {
      setErrores(error.fields || {});
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      titulo="Ajustar stock"
      ancho="chico"
      onCerrar={onCerrar}
      bloqueado={guardando}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-ajuste" cargando={guardando}>
            Guardar ajuste
          </Boton>
        </>
      }
    >
      <form id="form-ajuste" className="formulario" onSubmit={guardar} noValidate>
        <div className="ajuste-producto">
          <strong>{producto.nombre}</strong>
          <span>
            Stock actual: <b>{producto.stock}</b> · Costo {dinero(producto.precio_costo)}
          </span>
        </div>

        <div className="segmentado" role="radiogroup" aria-label="Tipo de ajuste">
          <button type="button" role="radio" aria-checked={tipo === 'ENTRADA'} className={tipo === 'ENTRADA' ? 'elegido' : ''} onClick={() => elegirTipo('ENTRADA')}>
            Entrada (suma)
          </button>
          <button type="button" role="radio" aria-checked={tipo === 'SALIDA'} className={tipo === 'SALIDA' ? 'elegido' : ''} onClick={() => elegirTipo('SALIDA')}>
            Salida (resta)
          </button>
        </div>

        <Campo etiqueta="Cantidad" error={errores.cantidad} requerido>
          {(id) => <input id={id} type="number" inputMode="numeric" min="1" step="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} data-autofocus />}
        </Campo>
        <Campo etiqueta="Motivo" error={errores.motivo} requerido>
          {(id) => (
            <>
              <input id={id} list="motivos-ajuste" value={motivo} maxLength={255} onChange={(e) => setMotivo(e.target.value)} />
              <datalist id="motivos-ajuste">
                {MOTIVOS[tipo].map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </>
          )}
        </Campo>
        {resultante !== null && resultante >= 0 ? (
          <div className="alerta alerta-info">
            El stock quedará en <b>{resultante}</b> unidades.
          </div>
        ) : null}
      </form>
    </Modal>
  );
}
