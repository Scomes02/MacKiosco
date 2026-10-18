import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Banknote, CalendarDays, PackageCheck, Receipt, RefreshCw, ShoppingCart, TrendingUp, Wallet } from 'lucide-react';
import { api } from '../api/client';
import { useDatos } from '../utils/hooks';
import { diaCorto, dinero, dineroCompacto, fechaHora, hora, numero, numeroVenta } from '../utils/format';
import { Boton, Cargando, Encabezado, ErrorCarga, EstadoStock, Etiqueta, Vacio } from '../components/ui';
import { GraficoBarras, Indicador, ListaBarras } from '../components/graficos';
import VentaDetalle from '../components/VentaDetalle';

export default function Dashboard() {
  const { datos, cargando, error, recargar } = useDatos(() => api.get('/dashboard'), []);
  const [ventaAbierta, setVentaAbierta] = useState(null);

  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
  if (!datos) return <Cargando texto="Calculando indicadores…" />;

  const { hoy, mes, stock, caja } = datos;

  return (
    <>
      <Encabezado titulo="Inicio" descripcion={`Resumen del negocio · actualizado ${hora(datos.generado_en)} hs`}>
        <Boton variante="secundario" icono={RefreshCw} onClick={recargar} cargando={cargando}>
          Actualizar
        </Boton>
        <Link to="/vender" className="btn btn-primario">
          <ShoppingCart size={18} aria-hidden="true" />
          <span>Nueva venta</span>
        </Link>
      </Encabezado>

      {!caja.abierta ? (
        <div className="alerta alerta-alerta">
          <Wallet size={18} aria-hidden="true" />
          <span>
            La caja está cerrada. <Link to="/caja">Abrila</Link> para empezar a vender.
          </span>
        </div>
      ) : null}

      <section className="indicadores" aria-label="Indicadores principales">
        <Indicador
          titulo="Ventas de hoy"
          valor={dinero(hoy.total)}
          icono={Banknote}
          variacion={hoy.variacion_vs_ayer}
          etiquetaVariacion="vs. ayer a esta hora"
          detalle="Sin ventas ayer a esta hora"
        />
        <Indicador titulo="Operaciones de hoy" valor={numero(hoy.ventas)} icono={Receipt} detalle={`Ticket promedio ${dinero(hoy.ticket_promedio)}`} tono="celeste" />
        <Indicador titulo="Productos vendidos hoy" valor={numero(hoy.unidades)} icono={PackageCheck} detalle={`Ganancia bruta ${dinero(hoy.ganancia)}`} tono="verde" />
        <Indicador
          titulo="Ventas del mes"
          valor={dinero(mes.total)}
          icono={CalendarDays}
          variacion={mes.variacion_vs_mes_anterior}
          etiquetaVariacion="vs. mismo tramo del mes pasado"
          detalle={`${numero(mes.ventas)} operaciones`}
          tono="violeta"
        />
        <Indicador titulo="Ganancia bruta del mes" valor={dinero(mes.ganancia)} icono={TrendingUp} detalle={`${numero(mes.ventas)} ventas · ${numero(mes.unidades)} unidades`} tono="verde" />
        <Indicador
          titulo="Alertas de stock"
          valor={numero(stock.sin_stock + stock.stock_bajo)}
          icono={AlertTriangle}
          detalle={`${stock.sin_stock} sin stock · ${stock.stock_bajo} con stock bajo`}
          tono={stock.sin_stock + stock.stock_bajo > 0 ? 'ambar' : 'verde'}
        />
      </section>

      <div className="grilla-2-1">
        <section className="tarjeta">
          <div className="tarjeta-cabecera">
            <h2>Ventas de los últimos 14 días</h2>
            <Link to="/reportes">Ver reportes</Link>
          </div>
          <GraficoBarras
            descripcion="Importe vendido por día en los últimos 14 días"
            datos={datos.ventas_por_dia.map((d) => ({
              etiqueta: diaCorto(d.dia),
              valor: d.total,
              detalle: `${d.ventas} ${d.ventas === 1 ? 'venta' : 'ventas'}`,
            }))}
            formatoValor={dinero}
            formatoEje={dineroCompacto}
          />
        </section>

        <section className="tarjeta">
          <div className="tarjeta-cabecera">
            <h2>Métodos de pago</h2>
            <small>Últimos {datos.dias_ranking} días</small>
          </div>
          {datos.metodos_pago.length ? (
            <ListaBarras
              mostrarPorcentaje
              formatoValor={dinero}
              datos={datos.metodos_pago.map((m) => ({ clave: m.id, etiqueta: m.nombre, valor: m.total }))}
            />
          ) : (
            <Vacio titulo="Todavía no hay ventas" />
          )}
        </section>
      </div>

      <div className="grilla-2">
        <section className="tarjeta">
          <div className="tarjeta-cabecera">
            <h2>Productos más vendidos</h2>
            <small>Últimos {datos.dias_ranking} días</small>
          </div>
          {datos.top_productos.length ? (
            <ListaBarras
              formatoValor={(v) => `${numero(v)} u.`}
              datos={datos.top_productos.map((p) => ({ clave: p.id, etiqueta: p.nombre, valor: p.unidades, detalle: dinero(p.total) }))}
            />
          ) : (
            <Vacio titulo="Todavía no hay ventas" />
          )}
        </section>

        <section className="tarjeta">
          <div className="tarjeta-cabecera">
            <h2>Productos para reponer</h2>
            <Link to="/inventario">Ver inventario</Link>
          </div>
          {stock.productos.length ? (
            <ul className="lista-simple">
              {stock.productos.map((p) => (
                <li key={p.id}>
                  <span>
                    <span aria-hidden="true">{p.categoria_icono} </span>
                    {p.nombre}
                    <small>Mínimo {p.stock_minimo} u.</small>
                  </span>
                  <EstadoStock stock={p.stock} minimo={p.stock_minimo} />
                </li>
              ))}
            </ul>
          ) : (
            <Vacio titulo="Stock en orden" descripcion="Ningún producto está por debajo de su stock mínimo." icono={PackageCheck} />
          )}
        </section>
      </div>

      <section className="tarjeta">
        <div className="tarjeta-cabecera">
          <h2>Últimas ventas</h2>
          <Link to="/ventas">Ver todas</Link>
        </div>
        <div className="tabla-contenedor">
          <table className="tabla tabla-clic">
            <thead>
              <tr>
                <th>Venta</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th>Pago</th>
                <th>Atendió</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {datos.ultimas_ventas.map((venta) => (
                <tr key={venta.id} onClick={() => setVentaAbierta(venta.id)} tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setVentaAbierta(venta.id)}>
                  <td>
                    {numeroVenta(venta.id)} {venta.estado === 'ANULADA' ? <Etiqueta tono="peligro">Anulada</Etiqueta> : null}
                  </td>
                  <td>{fechaHora(venta.fecha)}</td>
                  <td>{venta.cliente || 'Consumidor final'}</td>
                  <td>{venta.metodos_pago}</td>
                  <td>{venta.usuario}</td>
                  <td className="num">
                    <strong>{dinero(venta.total)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {ventaAbierta ? <VentaDetalle ventaId={ventaAbierta} onCerrar={() => setVentaAbierta(null)} onCambio={recargar} /> : null}
    </>
  );
}
