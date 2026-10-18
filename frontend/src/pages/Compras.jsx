import { useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useDatos, useDebounce } from '../utils/hooks';
import { aNumero, dinero, fechaHora, numero } from '../utils/format';
import { Boton, BotonIcono, Campo, Cargando, Encabezado, ErrorCarga, Modal, Paginacion, Vacio } from '../components/ui';

/** Buscador de productos para agregarlos a la compra. */
function BuscadorProductos({ proveedorId, excluidos, onElegir }) {
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda.trim(), 250);
  const { datos } = useDatos(
    () => {
      if (q) return api.get('/productos', { q, limit: 8 });
      // Sin búsqueda: se sugieren los productos del proveedor elegido que tienen stock bajo.
      if (proveedorId) return api.get('/productos', { proveedor_id: proveedorId, stock: 'bajo', limit: 8, orden: 'stock' });
      return Promise.resolve({ items: [] });
    },
    [q, proveedorId]
  );
  const resultados = (datos?.items || []).filter((p) => !excluidos.has(p.id));

  return (
    <div className="buscador-compra">
      <div className="input-con-icono">
        <Search size={18} aria-hidden="true" />
        <input type="search" placeholder="Buscar producto por nombre o código para agregarlo…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} aria-label="Buscar producto" />
      </div>
      {resultados.length ? (
        <>
          {!q ? <small className="nota">Sugeridos: productos de este proveedor con stock bajo</small> : null}
          <ul className="lista-seleccion lista-compacta">
            {resultados.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    onElegir(p);
                    setBusqueda('');
                  }}
                >
                  <strong>{p.nombre}</strong>
                  <small>
                    {p.codigo} · Stock {p.stock} · Costo {dinero(p.precio_costo)}
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : q ? (
        <small className="nota">No se encontraron productos con «{q}».</small>
      ) : null}
    </div>
  );
}

function NuevaCompra({ proveedores, onCerrar, onGuardada }) {
  const toast = useToast();
  const [proveedorId, setProveedorId] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [actualizarCostos, setActualizarCostos] = useState(true);
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const total = items.reduce((suma, item) => {
    const cantidad = aNumero(item.cantidad);
    const costo = aNumero(item.costo);
    return suma + (Number.isNaN(cantidad) || Number.isNaN(costo) ? 0 : Math.round(cantidad * costo * 100));
  }, 0) / 100;

  const cambiarItem = (id, campo, valor) => setItems(items.map((item) => (item.id === id ? { ...item, [campo]: valor } : item)));

  const guardar = async (evento) => {
    evento.preventDefault();
    if (!proveedorId) return setError('Elegí el proveedor de la compra.');
    if (!items.length) return setError('Agregá al menos un producto a la compra.');
    for (const item of items) {
      const cantidad = aNumero(item.cantidad);
      const costo = aNumero(item.costo);
      if (!Number.isInteger(cantidad) || cantidad <= 0) return setError(`Revisá la cantidad de "${item.nombre}": debe ser un entero mayor a cero.`);
      if (Number.isNaN(costo) || costo < 0) return setError(`Revisá el costo de "${item.nombre}".`);
    }
    setError('');
    setGuardando(true);
    try {
      await api.post('/compras', {
        proveedor_id: Number(proveedorId),
        numero_comprobante: comprobante,
        observaciones,
        actualizar_costos: actualizarCostos,
        items: items.map((item) => ({ producto_id: item.id, cantidad: aNumero(item.cantidad), costo_unitario: aNumero(item.costo) })),
      });
      toast.exito('Compra registrada. El stock fue actualizado.');
      onGuardada();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
    return undefined;
  };

  return (
    <Modal
      titulo="Registrar compra (ingreso de mercadería)"
      ancho="grande"
      onCerrar={onCerrar}
      bloqueado={guardando}
      pie={
        <>
          <span className="modal-pie-total">
            Total <strong>{dinero(total)}</strong>
          </span>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-compra" cargando={guardando}>
            Registrar compra
          </Boton>
        </>
      }
    >
      <form id="form-compra" className="formulario formulario-2" onSubmit={guardar} noValidate>
        <Campo etiqueta="Proveedor" requerido>
          {(id) => (
            <select id={id} value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              <option value="">Elegir…</option>
              {proveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.razon_social}
                </option>
              ))}
            </select>
          )}
        </Campo>
        <Campo etiqueta="N° de factura o remito">
          {(id) => <input id={id} value={comprobante} maxLength={40} onChange={(e) => setComprobante(e.target.value)} placeholder="Opcional" />}
        </Campo>

        <div className="campo-completo">
          <BuscadorProductos
            proveedorId={proveedorId}
            excluidos={new Set(items.map((item) => item.id))}
            onElegir={(p) => setItems([...items, { id: p.id, nombre: p.nombre, codigo: p.codigo, stock: p.stock, cantidad: '12', costo: String(p.precio_costo) }])}
          />
        </div>

        <div className="campo-completo">
          {items.length ? (
            <div className="tabla-contenedor">
              <table className="tabla tabla-compacta">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th className="num">Stock actual</th>
                    <th className="num">Cantidad</th>
                    <th className="num">Costo unitario</th>
                    <th className="num">Subtotal</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <strong>{item.nombre}</strong>
                        <small className="bloque">{item.codigo}</small>
                      </td>
                      <td className="num">{item.stock}</td>
                      <td className="num">
                        <input className="input-chico" type="number" min="1" step="1" value={item.cantidad} onChange={(e) => cambiarItem(item.id, 'cantidad', e.target.value)} aria-label={`Cantidad de ${item.nombre}`} />
                      </td>
                      <td className="num">
                        <input className="input-chico" type="number" min="0" step="0.01" value={item.costo} onChange={(e) => cambiarItem(item.id, 'costo', e.target.value)} aria-label={`Costo de ${item.nombre}`} />
                      </td>
                      <td className="num">{dinero((aNumero(item.cantidad) || 0) * (aNumero(item.costo) || 0))}</td>
                      <td className="acciones">
                        <BotonIcono icono={Trash2} titulo={`Quitar ${item.nombre}`} variante="peligro" onClick={() => setItems(items.filter((i) => i.id !== item.id))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Vacio titulo="Todavía no agregaste productos" descripcion="Usá el buscador para sumar los productos que ingresaron." />
          )}
        </div>

        <label className="casilla campo-completo">
          <input type="checkbox" checked={actualizarCostos} onChange={(e) => setActualizarCostos(e.target.checked)} />
          <span>Actualizar el precio de costo de los productos con los valores de esta compra</span>
        </label>
        <Campo etiqueta="Observaciones" className="campo-completo">
          {(id) => <input id={id} value={observaciones} maxLength={255} onChange={(e) => setObservaciones(e.target.value)} />}
        </Campo>

        {error ? (
          <div className="alerta alerta-peligro campo-completo" role="alert">
            {error}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

function DetalleCompra({ compraId, onCerrar }) {
  const { datos, error, recargar } = useDatos(() => api.get(`/compras/${compraId}`), [compraId]);
  return (
    <Modal titulo={`Compra N° ${compraId}`} onCerrar={onCerrar}>
      {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
      {!datos && !error ? <Cargando /> : null}
      {datos ? (
        <>
          <p className="nota">
            {datos.proveedor} · {fechaHora(datos.fecha)} · Registró {datos.usuario}
            {datos.numero_comprobante ? ` · Comprobante ${datos.numero_comprobante}` : ''}
          </p>
          <div className="tabla-contenedor">
            <table className="tabla tabla-compacta">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th className="num">Cantidad</th>
                  <th className="num">Costo unitario</th>
                  <th className="num">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {datos.detalles.map((d) => (
                  <tr key={d.id}>
                    <td>{d.producto_nombre}</td>
                    <td className="num">{d.cantidad}</td>
                    <td className="num">{dinero(d.costo_unitario)}</td>
                    <td className="num">{dinero(d.subtotal)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Total</td>
                  <td className="num">
                    <strong>{dinero(datos.total)}</strong>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          {datos.observaciones ? <p className="nota">Observaciones: {datos.observaciones}</p> : null}
        </>
      ) : null}
    </Modal>
  );
}

export default function Compras() {
  const [filtros, setFiltros] = useState({ proveedor_id: '', desde: '', hasta: '' });
  const [page, setPage] = useState(1);
  const [creando, setCreando] = useState(false);
  const [detalle, setDetalle] = useState(null);

  const proveedores = useDatos(() => api.get('/proveedores'), []);
  const { datos, cargando, error, recargar } = useDatos(() => api.get('/compras', { ...filtros, page, limit: 15 }), [filtros, page]);

  const cambiar = (campo) => (evento) => {
    setFiltros({ ...filtros, [campo]: evento.target.value });
    setPage(1);
  };

  return (
    <>
      <Encabezado titulo="Compras" descripcion="Ingreso de mercadería de proveedores">
        <Boton icono={Plus} onClick={() => setCreando(true)}>
          Registrar compra
        </Boton>
      </Encabezado>

      <div className="filtros">
        <label>
          <span>Proveedor</span>
          <select value={filtros.proveedor_id} onChange={cambiar('proveedor_id')}>
            <option value="">Todos</option>
            {(proveedores.datos || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.razon_social}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Desde</span>
          <input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={cambiar('desde')} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={cambiar('hasta')} />
        </label>
        {datos ? (
          <div className="filtros-total">
            <span>Total comprado</span>
            <strong>{dinero(datos.resumen.importe)}</strong>
          </div>
        ) : null}
      </div>

      <section className="tarjeta tarjeta-tabla">
        {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
        {cargando && !datos ? <Cargando /> : null}
        {datos && !datos.items.length ? <Vacio titulo="No hay compras con esos filtros" /> : null}
        {datos?.items.length ? (
          <div className={`tabla-contenedor ${cargando ? 'actualizando' : ''}`}>
            <table className="tabla tabla-clic">
              <thead>
                <tr>
                  <th>Compra</th>
                  <th>Fecha</th>
                  <th>Proveedor</th>
                  <th>Comprobante</th>
                  <th className="num">Productos</th>
                  <th className="num">Unidades</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((c) => (
                  <tr key={c.id} onClick={() => setDetalle(c.id)} onKeyDown={(e) => e.key === 'Enter' && setDetalle(c.id)} tabIndex={0}>
                    <td>N° {c.id}</td>
                    <td>{fechaHora(c.fecha)}</td>
                    <td>{c.proveedor}</td>
                    <td>{c.numero_comprobante || '—'}</td>
                    <td className="num">{c.renglones}</td>
                    <td className="num">{numero(c.unidades)}</td>
                    <td className="num">
                      <strong>{dinero(c.total)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {datos ? <Paginacion page={datos.page} pages={datos.pages} total={datos.total} onCambiar={setPage} etiqueta="compras" /> : null}
      </section>

      {creando ? (
        <NuevaCompra
          proveedores={(proveedores.datos || []).filter((p) => p.activo)}
          onCerrar={() => setCreando(false)}
          onGuardada={() => {
            setCreando(false);
            recargar();
          }}
        />
      ) : null}
      {detalle ? <DetalleCompra compraId={detalle} onCerrar={() => setDetalle(null)} /> : null}
    </>
  );
}
