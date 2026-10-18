import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShoppingCart } from 'lucide-react';
import { api } from '../api/client';
import { useDatos, useDebounce } from '../utils/hooks';
import { diasAtrasISO, dinero, fechaHora, hoyISO, numero, numeroComprobante, numeroVenta } from '../utils/format';
import { Cargando, Encabezado, ErrorCarga, Etiqueta, Paginacion, Vacio } from '../components/ui';
import VentaDetalle from '../components/VentaDetalle';

const FILTROS_INICIALES = { desde: diasAtrasISO(6), hasta: hoyISO(), estado: 'todas', comprobante: 'todos', metodo_pago_id: '' };

/** Comprobante de una fila del listado: recibo, factura con su número o factura pendiente. */
function ComprobanteDeVenta({ venta }) {
  if (venta.factura_estado === 'AUTORIZADO') {
    return (
      <>
        Factura {venta.factura_letra}
        <small className="bloque">{numeroComprobante(venta.factura_punto_venta, venta.factura_numero)}</small>
      </>
    );
  }
  if (venta.comprobante === 'FACTURA') return <Etiqueta tono="alerta">Factura pendiente</Etiqueta>;
  return 'Recibo';
}

export default function Ventas() {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [busqueda, setBusqueda] = useState('');
  const [page, setPage] = useState(1);
  const [ventaAbierta, setVentaAbierta] = useState(null);
  const q = useDebounce(busqueda.trim(), 300);

  const metodos = useDatos(() => api.get('/metodos-pago'), []);
  const { datos, cargando, error, recargar } = useDatos(
    () => api.get('/ventas', { ...filtros, q, page, limit: 20 }),
    [filtros, q, page]
  );

  const cambiar = (campo) => (evento) => {
    setFiltros({ ...filtros, [campo]: evento.target.value });
    setPage(1);
  };

  return (
    <>
      <Encabezado titulo="Ventas" descripcion="Historial de ventas realizadas">
        <Link to="/vender" className="btn btn-primario">
          <ShoppingCart size={18} aria-hidden="true" />
          <span>Nueva venta</span>
        </Link>
      </Encabezado>

      <div className="filtros">
        <div className="input-con-icono filtro-busqueda">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por N° de venta o cliente…"
            value={busqueda}
            onChange={(evento) => {
              setBusqueda(evento.target.value);
              setPage(1);
            }}
            aria-label="Buscar venta"
          />
        </div>
        <label>
          <span>Desde</span>
          <input type="date" value={filtros.desde} max={filtros.hasta || undefined} onChange={cambiar('desde')} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={filtros.hasta} min={filtros.desde || undefined} onChange={cambiar('hasta')} />
        </label>
        <label>
          <span>Estado</span>
          <select value={filtros.estado} onChange={cambiar('estado')}>
            <option value="todas">Todas</option>
            <option value="COMPLETADA">Completadas</option>
            <option value="ANULADA">Anuladas</option>
          </select>
        </label>
        <label>
          <span>Comprobante</span>
          <select value={filtros.comprobante} onChange={cambiar('comprobante')}>
            <option value="todos">Todos</option>
            <option value="RECIBO">Recibos</option>
            <option value="FACTURA">Facturas</option>
            <option value="FACTURA_PENDIENTE">Facturas pendientes</option>
          </select>
        </label>
        <label>
          <span>Método de pago</span>
          <select value={filtros.metodo_pago_id} onChange={cambiar('metodo_pago_id')}>
            <option value="">Todos</option>
            {(metodos.datos || []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>

      {datos ? (
        <div className="resumen-fila">
          <div>
            <span>Importe vendido</span>
            <strong>{dinero(datos.resumen.importe)}</strong>
          </div>
          <div>
            <span>Ventas completadas</span>
            <strong>{numero(datos.resumen.completadas)}</strong>
          </div>
          <div>
            <span>Ventas anuladas</span>
            <strong>{numero(datos.resumen.anuladas)}</strong>
          </div>
        </div>
      ) : null}

      <section className="tarjeta tarjeta-tabla">
        {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
        {cargando && !datos ? <Cargando /> : null}
        {datos && !datos.items.length ? (
          <Vacio titulo="No hay ventas con esos filtros" descripcion="Probá ampliando el rango de fechas o quitando filtros." />
        ) : null}
        {datos?.items.length ? (
          <div className={`tabla-contenedor ${cargando ? 'actualizando' : ''}`}>
            <table className="tabla tabla-clic">
              <thead>
                <tr>
                  <th>Venta</th>
                  <th>Fecha y hora</th>
                  <th>Comprobante</th>
                  <th>Cliente</th>
                  <th>Método de pago</th>
                  <th>Atendió</th>
                  <th className="num">Unidades</th>
                  <th className="num">Total</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {datos.items.map((venta) => (
                  <tr
                    key={venta.id}
                    className={venta.estado === 'ANULADA' ? 'fila-apagada' : ''}
                    onClick={() => setVentaAbierta(venta.id)}
                    onKeyDown={(evento) => evento.key === 'Enter' && setVentaAbierta(venta.id)}
                    tabIndex={0}
                  >
                    <td>{numeroVenta(venta.id)}</td>
                    <td>{fechaHora(venta.fecha)}</td>
                    <td>
                      <ComprobanteDeVenta venta={venta} />
                    </td>
                    <td>{venta.cliente || 'Consumidor final'}</td>
                    <td>{venta.metodos_pago}</td>
                    <td>{venta.usuario}</td>
                    <td className="num">{venta.unidades}</td>
                    <td className="num">
                      <strong>{dinero(venta.total)}</strong>
                      {venta.descuento_monto > 0 ? <small className="bloque">desc. {venta.descuento_porcentaje}%</small> : null}
                    </td>
                    <td>
                      <Etiqueta tono={venta.estado === 'ANULADA' ? 'peligro' : 'exito'}>
                        {venta.estado === 'ANULADA' ? 'Anulada' : 'Completada'}
                      </Etiqueta>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {datos ? <Paginacion page={datos.page} pages={datos.pages} total={datos.total} onCambiar={setPage} etiqueta="ventas" /> : null}
      </section>

      {ventaAbierta ? <VentaDetalle ventaId={ventaAbierta} onCerrar={() => setVentaAbierta(null)} onCambio={recargar} /> : null}
    </>
  );
}
