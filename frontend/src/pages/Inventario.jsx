import { useState } from 'react';
import { ArrowDownUp, Download, Search } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useDatos, useDebounce } from '../utils/hooks';
import { TIPOS_MOVIMIENTO, descargarCSV, dinero, fechaHora, hoyISO, numero } from '../utils/format';
import { Boton, Cargando, Encabezado, ErrorCarga, EstadoStock, Etiqueta, Paginacion, Vacio } from '../components/ui';
import { AjusteStock } from '../components/ProductoModales';

function Existencias() {
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [filtros, setFiltros] = useState({ categoria_id: '', stock: 'todos' });
  const [page, setPage] = useState(1);
  const [ajustando, setAjustando] = useState(null);
  const [exportando, setExportando] = useState(false);
  const q = useDebounce(busqueda.trim(), 250);

  const categorias = useDatos(() => api.get('/categorias'), []);
  const consulta = { ...filtros, q, estado: 'activos', orden: 'stock', direccion: 'asc' };
  const { datos, cargando, error, recargar } = useDatos(() => api.get('/productos', { ...consulta, page, limit: 15 }), [filtros, q, page]);

  const cambiar = (campo) => (evento) => {
    setFiltros({ ...filtros, [campo]: evento.target.value });
    setPage(1);
  };

  /** Exporta TODO el inventario filtrado (no solo la página visible). */
  const exportar = async () => {
    setExportando(true);
    try {
      const filas = [];
      let pagina = 1;
      let paginas = 1;
      do {
        const lote = await api.get('/productos', { ...consulta, page: pagina, limit: 200 });
        paginas = lote.pages;
        for (const p of lote.items) {
          filas.push([p.codigo, p.nombre, p.categoria, p.proveedor || '', p.stock, p.stock_minimo, p.precio_costo, p.precio_venta, p.stock * p.precio_costo, p.stock * p.precio_venta]);
        }
        pagina += 1;
      } while (pagina <= paginas);
      descargarCSV(
        `inventario-${hoyISO()}.csv`,
        ['Código', 'Producto', 'Categoría', 'Proveedor', 'Stock', 'Stock mínimo', 'Costo', 'Precio', 'Valorizado costo', 'Valorizado venta'],
        filas
      );
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setExportando(false);
    }
  };

  const resumen = datos?.resumen;

  return (
    <>
      {resumen ? (
        <div className="resumen-fila">
          <div>
            <span>Unidades en stock</span>
            <strong>{numero(resumen.unidades)}</strong>
          </div>
          <div>
            <span>Capital invertido (costo)</span>
            <strong>{dinero(resumen.capital_costo)}</strong>
          </div>
          <div>
            <span>Valor de venta</span>
            <strong>{dinero(resumen.valor_venta)}</strong>
          </div>
          <div>
            <span>Ganancia potencial</span>
            <strong>{dinero(resumen.ganancia_potencial)}</strong>
          </div>
          <div>
            <span>Sin stock / Stock bajo</span>
            <strong>
              {resumen.sin_stock} / {resumen.stock_bajo}
            </strong>
          </div>
        </div>
      ) : null}

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
        <label>
          <span>Mostrar</span>
          <select value={filtros.stock} onChange={cambiar('stock')}>
            <option value="todos">Todos los productos</option>
            <option value="bajo">Solo stock bajo</option>
            <option value="sin">Solo sin stock</option>
            <option value="ok">Solo con stock suficiente</option>
          </select>
        </label>
        <Boton variante="secundario" icono={Download} onClick={exportar} cargando={exportando}>
          Exportar a Excel
        </Boton>
      </div>

      <section className="tarjeta tarjeta-tabla">
        {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
        {cargando && !datos ? <Cargando /> : null}
        {datos && !datos.items.length ? <Vacio titulo="No hay productos con esos filtros" /> : null}
        {datos?.items.length ? (
          <div className={`tabla-contenedor ${cargando ? 'actualizando' : ''}`}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th className="num">Mínimo</th>
                  <th className="num">Costo</th>
                  <th className="num">Precio</th>
                  <th className="num">Valorizado (costo)</th>
                  <th className="num">Valorizado (venta)</th>
                  <th className="acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <strong>{p.nombre}</strong>
                      <small className="bloque">{p.codigo}</small>
                    </td>
                    <td>{p.categoria}</td>
                    <td>
                      <EstadoStock stock={p.stock} minimo={p.stock_minimo} />
                    </td>
                    <td className="num">{p.stock_minimo}</td>
                    <td className="num">{dinero(p.precio_costo)}</td>
                    <td className="num">{dinero(p.precio_venta)}</td>
                    <td className="num">{dinero(p.stock * p.precio_costo)}</td>
                    <td className="num">{dinero(p.stock * p.precio_venta)}</td>
                    <td className="acciones">
                      <Boton variante="secundario" tamano="chico" icono={ArrowDownUp} onClick={() => setAjustando(p)}>
                        Ajustar
                      </Boton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {datos ? <Paginacion page={datos.page} pages={datos.pages} total={datos.total} onCambiar={setPage} etiqueta="productos" /> : null}
      </section>

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
    </>
  );
}

const TONO_MOVIMIENTO = {
  INICIAL: 'neutro',
  VENTA: 'info',
  COMPRA: 'exito',
  AJUSTE_ENTRADA: 'exito',
  AJUSTE_SALIDA: 'alerta',
  ANULACION_VENTA: 'peligro',
};

function Movimientos() {
  const [busqueda, setBusqueda] = useState('');
  const [filtros, setFiltros] = useState({ tipo: 'todos', desde: '', hasta: '' });
  const [page, setPage] = useState(1);
  const q = useDebounce(busqueda.trim(), 250);

  const { datos, cargando, error, recargar } = useDatos(
    () => api.get('/stock/movimientos', { ...filtros, q, page, limit: 20 }),
    [filtros, q, page]
  );

  const cambiar = (campo) => (evento) => {
    setFiltros({ ...filtros, [campo]: evento.target.value });
    setPage(1);
  };

  return (
    <>
      <div className="filtros">
        <div className="input-con-icono filtro-busqueda">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por producto o código…"
            value={busqueda}
            onChange={(evento) => {
              setBusqueda(evento.target.value);
              setPage(1);
            }}
            aria-label="Buscar movimientos de un producto"
          />
        </div>
        <label>
          <span>Tipo</span>
          <select value={filtros.tipo} onChange={cambiar('tipo')}>
            <option value="todos">Todos</option>
            {Object.entries(TIPOS_MOVIMIENTO).map(([clave, texto]) => (
              <option key={clave} value={clave}>
                {texto}
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
      </div>

      <section className="tarjeta tarjeta-tabla">
        {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
        {cargando && !datos ? <Cargando /> : null}
        {datos && !datos.items.length ? <Vacio titulo="No hay movimientos con esos filtros" /> : null}
        {datos?.items.length ? (
          <div className={`tabla-contenedor ${cargando ? 'actualizando' : ''}`}>
            <table className="tabla">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th className="num">Cantidad</th>
                  <th className="num">Stock anterior</th>
                  <th className="num">Stock resultante</th>
                  <th>Detalle</th>
                  <th>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((m) => (
                  <tr key={m.id}>
                    <td>{fechaHora(m.fecha)}</td>
                    <td>
                      <strong>{m.producto_nombre}</strong>
                      <small className="bloque">{m.producto_codigo}</small>
                    </td>
                    <td>
                      <Etiqueta tono={TONO_MOVIMIENTO[m.tipo]}>{TIPOS_MOVIMIENTO[m.tipo]}</Etiqueta>
                    </td>
                    <td className={`num ${m.cantidad < 0 ? 'texto-peligro' : 'texto-exito'}`}>
                      <strong>
                        {m.cantidad > 0 ? '+' : ''}
                        {m.cantidad}
                      </strong>
                    </td>
                    <td className="num">{m.stock_anterior}</td>
                    <td className="num">{m.stock_resultante}</td>
                    <td>{m.motivo || '—'}</td>
                    <td>{m.usuario}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {datos ? <Paginacion page={datos.page} pages={datos.pages} total={datos.total} onCambiar={setPage} etiqueta="movimientos" /> : null}
      </section>
    </>
  );
}

export default function Inventario() {
  const [pestana, setPestana] = useState('existencias');
  return (
    <>
      <Encabezado titulo="Inventario" descripcion="Existencias valorizadas y movimientos de stock" />
      <div className="pestanas" role="tablist">
        <button type="button" role="tab" aria-selected={pestana === 'existencias'} className={pestana === 'existencias' ? 'activa' : ''} onClick={() => setPestana('existencias')}>
          Existencias
        </button>
        <button type="button" role="tab" aria-selected={pestana === 'movimientos'} className={pestana === 'movimientos' ? 'activa' : ''} onClick={() => setPestana('movimientos')}>
          Movimientos de stock
        </button>
      </div>
      {pestana === 'existencias' ? <Existencias /> : <Movimientos />}
    </>
  );
}
