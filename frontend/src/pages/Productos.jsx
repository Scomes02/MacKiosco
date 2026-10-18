import { useState } from 'react';
import { ArrowDownUp, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDatos, useDebounce } from '../utils/hooks';
import { dinero } from '../utils/format';
import { Boton, BotonIcono, Cargando, Confirmar, Encabezado, ErrorCarga, EstadoStock, Etiqueta, MiniaturaProducto, Paginacion, Vacio } from '../components/ui';
import { AjusteStock, FormularioProducto } from '../components/ProductoModales';

const FILTROS_INICIALES = { categoria_id: '', proveedor_id: '', estado: 'todos', stock: 'todos', orden: 'nombre', direccion: 'asc' };

export default function Productos() {
  const { esAdmin } = useAuth();
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [page, setPage] = useState(1);
  const [editando, setEditando] = useState(undefined); // undefined = cerrado, null = nuevo
  const [ajustando, setAjustando] = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const q = useDebounce(busqueda.trim(), 250);

  const categorias = useDatos(() => api.get('/categorias'), []);
  const proveedores = useDatos(() => (esAdmin ? api.get('/proveedores') : Promise.resolve([])), [esAdmin]);
  const { datos, cargando, error, recargar } = useDatos(
    () => api.get('/productos', { ...filtros, q, page, limit: 15 }),
    [filtros, q, page]
  );

  const cambiar = (campo) => (evento) => {
    setFiltros({ ...filtros, [campo]: evento.target.value });
    setPage(1);
  };

  const ordenarPor = (columna) => {
    setFiltros({
      ...filtros,
      orden: columna,
      direccion: filtros.orden === columna && filtros.direccion === 'asc' ? 'desc' : 'asc',
    });
    setPage(1);
  };

  const eliminar = async () => {
    setBorrando(true);
    try {
      const { modo } = await api.delete(`/productos/${eliminando.id}`);
      toast.exito(
        modo === 'archivado'
          ? 'Producto eliminado. Sus ventas anteriores se conservan en el historial.'
          : 'Producto eliminado definitivamente.'
      );
      recargar();
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setBorrando(false);
      setEliminando(null);
    }
  };

  const Ordenable = ({ columna, children, num }) => (
    <th className={num ? 'num' : ''} aria-sort={filtros.orden === columna ? (filtros.direccion === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="th-orden" onClick={() => ordenarPor(columna)}>
        {children}
        <ArrowDownUp size={13} aria-hidden="true" className={filtros.orden === columna ? 'activo' : ''} />
      </button>
    </th>
  );

  return (
    <>
      <Encabezado titulo="Productos" descripcion={esAdmin ? 'Alta, edición y precios de los productos' : 'Consulta de precios y stock'}>
        {esAdmin ? (
          <Boton icono={Plus} onClick={() => setEditando(null)}>
            Nuevo producto
          </Boton>
        ) : null}
      </Encabezado>

      <div className="filtros">
        <div className="input-con-icono filtro-busqueda">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por nombre o código…"
            value={busqueda}
            onChange={(evento) => {
              setBusqueda(evento.target.value);
              setPage(1);
            }}
            aria-label="Buscar producto"
          />
        </div>
        <label>
          <span>Categoría</span>
          <select value={filtros.categoria_id} onChange={cambiar('categoria_id')}>
            <option value="">Todas</option>
            {(categorias.datos || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        {esAdmin ? (
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
        ) : null}
        <label>
          <span>Stock</span>
          <select value={filtros.stock} onChange={cambiar('stock')}>
            <option value="todos">Todos</option>
            <option value="ok">Con stock suficiente</option>
            <option value="bajo">Stock bajo</option>
            <option value="sin">Sin stock</option>
          </select>
        </label>
        <label>
          <span>Estado</span>
          <select value={filtros.estado} onChange={cambiar('estado')}>
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </label>
      </div>

      <section className="tarjeta tarjeta-tabla">
        {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
        {cargando && !datos ? <Cargando /> : null}
        {datos && !datos.items.length ? (
          <Vacio titulo="No se encontraron productos" descripcion="Probá con otra búsqueda o cambiá los filtros." />
        ) : null}
        {datos?.items.length ? (
          <div className={`tabla-contenedor ${cargando ? 'actualizando' : ''}`}>
            <table className="tabla">
              <thead>
                <tr>
                  <Ordenable columna="nombre">Producto</Ordenable>
                  <Ordenable columna="categoria">Categoría</Ordenable>
                  {esAdmin ? <th className="num">Costo</th> : null}
                  <Ordenable columna="precio_venta" num>
                    Precio
                  </Ordenable>
                  {esAdmin ? <th className="num">Margen</th> : null}
                  <Ordenable columna="stock">Stock</Ordenable>
                  <th>Estado</th>
                  {esAdmin ? <th className="acciones">Acciones</th> : null}
                </tr>
              </thead>
              <tbody>
                {datos.items.map((p) => (
                  <tr key={p.id} className={p.activo ? '' : 'fila-apagada'}>
                    <td>
                      <span className="celda-con-icono">
                        <MiniaturaProducto producto={p} tamano={38} />
                        <span>
                          <strong>{p.nombre}</strong>
                          <small className="bloque">{p.codigo}</small>
                        </span>
                      </span>
                    </td>
                    <td>{p.categoria}</td>
                    {esAdmin ? <td className="num">{dinero(p.precio_costo)}</td> : null}
                    <td className="num">
                      <strong>{dinero(p.precio_venta)}</strong>
                    </td>
                    {esAdmin ? (
                      <td className="num">{p.precio_costo > 0 ? `${Math.round(((p.precio_venta - p.precio_costo) / p.precio_costo) * 100)}%` : '—'}</td>
                    ) : null}
                    <td>
                      <EstadoStock stock={p.stock} minimo={p.stock_minimo} />
                    </td>
                    <td>
                      <Etiqueta tono={p.activo ? 'exito' : 'neutro'}>{p.activo ? 'Activo' : 'Inactivo'}</Etiqueta>
                    </td>
                    {esAdmin ? (
                      <td className="acciones">
                        <BotonIcono icono={ArrowDownUp} titulo={`Ajustar stock de ${p.nombre}`} onClick={() => setAjustando(p)} />
                        <BotonIcono icono={Pencil} titulo={`Editar ${p.nombre}`} onClick={() => setEditando(p)} />
                        <BotonIcono icono={Trash2} titulo={`Eliminar ${p.nombre}`} variante="peligro" onClick={() => setEliminando(p)} />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {datos ? <Paginacion page={datos.page} pages={datos.pages} total={datos.total} onCambiar={setPage} etiqueta="productos" /> : null}
      </section>

      {editando !== undefined ? (
        <FormularioProducto
          producto={editando}
          categorias={(categorias.datos || []).filter((c) => c.activo || c.id === editando?.categoria_id)}
          proveedores={(proveedores.datos || []).filter((p) => p.activo || p.id === editando?.proveedor_id)}
          onCerrar={() => setEditando(undefined)}
          onGuardado={() => {
            setEditando(undefined);
            recargar();
          }}
        />
      ) : null}

      {ajustando ? (
        <AjusteStock
          producto={ajustando}
          onCerrar={() => setAjustando(null)}
          onGuardado={() => {
            setAjustando(null);
            recargar();
          }}
        />
      ) : null}

      {eliminando ? (
        <Confirmar
          titulo="Eliminar producto"
          mensaje={`¿Seguro que querés eliminar "${eliminando.nombre}"? Dejará de aparecer en el sistema.`}
          textoConfirmar="Eliminar"
          peligro
          cargando={borrando}
          onConfirmar={eliminar}
          onCancelar={() => setEliminando(null)}
        />
      ) : null}
    </>
  );
}
