import { useState } from 'react';
import { Banknote, Download, PackageCheck, Percent, Receipt, TrendingUp } from 'lucide-react';
import { api } from '../api/client';
import { useDatos } from '../utils/hooks';
import { aISO, descargarCSV, diaCorto, diasAtrasISO, dinero, dineroCompacto, hoyISO, nombreComprobante, numero } from '../utils/format';
import { Boton, Cargando, Encabezado, ErrorCarga, Etiqueta, Vacio } from '../components/ui';
import { GraficoBarras, Indicador, ListaBarras } from '../components/graficos';

function rangosRapidos() {
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const inicioMesPasado = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const finMesPasado = new Date(hoy.getFullYear(), hoy.getMonth(), 0);
  return [
    { clave: 'hoy', texto: 'Hoy', desde: hoyISO(), hasta: hoyISO() },
    { clave: '7', texto: 'Últimos 7 días', desde: diasAtrasISO(6), hasta: hoyISO() },
    { clave: '30', texto: 'Últimos 30 días', desde: diasAtrasISO(29), hasta: hoyISO() },
    { clave: 'mes', texto: 'Este mes', desde: aISO(inicioMes), hasta: hoyISO() },
    { clave: 'mes-pasado', texto: 'Mes pasado', desde: aISO(inicioMesPasado), hasta: aISO(finMesPasado) },
  ];
}

export default function Reportes() {
  const rapidos = rangosRapidos();
  const [rango, setRango] = useState({ desde: rapidos[2].desde, hasta: rapidos[2].hasta });
  const { datos, cargando, error, recargar } = useDatos(() => api.get('/reportes/ventas', rango), [rango]);

  const exportar = () => {
    descargarCSV(
      `ventas-por-producto-${datos.desde}-a-${datos.hasta}.csv`,
      ['Código', 'Producto', 'Unidades', 'Importe', 'Ganancia bruta'],
      datos.top_productos.map((p) => [p.codigo, p.nombre, p.unidades, p.total, p.ganancia])
    );
  };

  const exportarDias = () => {
    descargarCSV(
      `ventas-por-dia-${datos.desde}-a-${datos.hasta}.csv`,
      ['Día', 'Ventas', 'Importe'],
      datos.por_dia.map((d) => [d.dia, d.ventas, d.total])
    );
  };

  const resumen = datos?.resumen;
  const margen = resumen && resumen.total > 0 ? Math.round((resumen.ganancia / resumen.total) * 1000) / 10 : 0;

  return (
    <>
      <Encabezado titulo="Reportes" descripcion="Estadísticas de ventas del período elegido">
        {datos?.por_dia.length ? (
          <Boton variante="secundario" icono={Download} onClick={exportarDias}>
            Exportar ventas por día
          </Boton>
        ) : null}
      </Encabezado>

      <div className="filtros">
        <div className="chips" role="group" aria-label="Períodos rápidos">
          {rapidos.map((r) => (
            <button
              key={r.clave}
              type="button"
              className={rango.desde === r.desde && rango.hasta === r.hasta ? 'activa' : ''}
              onClick={() => setRango({ desde: r.desde, hasta: r.hasta })}
            >
              {r.texto}
            </button>
          ))}
        </div>
        <label>
          <span>Desde</span>
          <input type="date" value={rango.desde} max={rango.hasta} onChange={(e) => e.target.value && setRango({ ...rango, desde: e.target.value })} />
        </label>
        <label>
          <span>Hasta</span>
          <input type="date" value={rango.hasta} min={rango.desde} onChange={(e) => e.target.value && setRango({ ...rango, hasta: e.target.value })} />
        </label>
      </div>

      {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
      {cargando && !datos ? <Cargando texto="Calculando…" /> : null}

      {datos ? (
        <div className={cargando ? 'actualizando' : ''}>
          <section className="indicadores" aria-label="Resumen del período">
            <Indicador titulo="Total vendido" valor={dinero(resumen.total)} icono={Banknote} detalle={`Descuentos otorgados: ${dinero(resumen.descuentos)}`} />
            <Indicador titulo="Ventas" valor={numero(resumen.ventas)} icono={Receipt} detalle={`${resumen.anuladas} anuladas en el período`} tono="celeste" />
            <Indicador titulo="Ticket promedio" valor={dinero(resumen.ticket_promedio)} icono={Percent} detalle="Importe promedio por venta" tono="violeta" />
            <Indicador titulo="Unidades vendidas" valor={numero(resumen.unidades)} icono={PackageCheck} detalle="Productos entregados" tono="ambar" />
            <Indicador titulo="Ganancia bruta" valor={dinero(resumen.ganancia)} icono={TrendingUp} detalle={`Margen sobre ventas: ${numero(margen)}%`} tono="verde" />
          </section>

          {!resumen.ventas ? (
            <section className="tarjeta">
              <Vacio titulo="No hubo ventas en este período" descripcion="Elegí otro rango de fechas." />
            </section>
          ) : (
            <>
              <div className="grilla-2-1">
                <section className="tarjeta">
                  <div className="tarjeta-cabecera">
                    <h2>Ventas por día</h2>
                  </div>
                  <GraficoBarras
                    descripcion="Importe vendido por día"
                    datos={datos.por_dia.map((d) => ({ etiqueta: diaCorto(d.dia), valor: d.total, detalle: `${d.ventas} ventas` }))}
                    formatoValor={dinero}
                    formatoEje={dineroCompacto}
                  />
                </section>
                <section className="tarjeta">
                  <div className="tarjeta-cabecera">
                    <h2>Métodos de pago</h2>
                  </div>
                  <ListaBarras
                    mostrarPorcentaje
                    formatoValor={dinero}
                    datos={datos.por_metodo_pago.map((m) => ({ clave: m.id, etiqueta: m.nombre, valor: m.total }))}
                  />
                </section>
              </div>

              <div className="grilla-2">
                <section className="tarjeta">
                  <div className="tarjeta-cabecera">
                    <h2>Ventas por hora del día</h2>
                    <small>Para planificar turnos</small>
                  </div>
                  <GraficoBarras
                    descripcion="Cantidad de ventas por hora del día"
                    alto={180}
                    datos={datos.por_hora.map((h) => ({ etiqueta: `${h.hora} hs`, etiquetaCorta: `${h.hora}h`, valor: h.ventas, detalle: dinero(h.total) }))}
                    formatoValor={(v) => `${numero(v)} ventas`}
                    formatoEje={numero}
                  />
                </section>
                <section className="tarjeta">
                  <div className="tarjeta-cabecera">
                    <h2>Ventas por categoría</h2>
                  </div>
                  <ListaBarras
                    mostrarPorcentaje
                    formatoValor={dinero}
                    datos={datos.por_categoria.slice(0, 8).map((c) => ({ clave: c.id, etiqueta: c.nombre, prefijo: c.icono, valor: c.total }))}
                  />
                </section>
              </div>

              <section className="tarjeta tarjeta-tabla">
                <div className="tarjeta-cabecera">
                  <h2>Comprobantes emitidos</h2>
                  {datos.comprobantes.facturas_pendientes ? (
                    <Etiqueta tono="alerta">
                      {datos.comprobantes.facturas_pendientes} factura(s) pendiente(s) de autorizar
                    </Etiqueta>
                  ) : null}
                </div>
                <div className="tabla-contenedor">
                  <table className="tabla tabla-compacta">
                    <thead>
                      <tr>
                        <th>Comprobante</th>
                        <th className="num">Cantidad</th>
                        <th>Numeración</th>
                        <th className="num">Neto gravado</th>
                        <th className="num">IVA</th>
                        <th className="num">Exento / no gravado</th>
                        <th className="num">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datos.comprobantes.fiscales.map((c) => (
                        <tr key={`${c.clase}-${c.letra}`}>
                          <td>{nombreComprobante(c)}</td>
                          <td className="num">{numero(c.cantidad)}</td>
                          <td>
                            {c.primer_numero} a {c.ultimo_numero}
                          </td>
                          <td className="num">{dinero(c.neto)}</td>
                          <td className="num">{dinero(c.iva)}</td>
                          <td className="num">{dinero(c.exento)}</td>
                          <td className="num">{dinero(c.total)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td>Recibos (no fiscales)</td>
                        <td className="num">{numero(datos.comprobantes.recibos)}</td>
                        <td>—</td>
                        <td className="num">—</td>
                        <td className="num">—</td>
                        <td className="num">—</td>
                        <td className="num">{dinero(datos.comprobantes.total_recibos)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="grilla-2-1">
                <section className="tarjeta tarjeta-tabla">
                  <div className="tarjeta-cabecera">
                    <h2>Productos más vendidos</h2>
                    <Boton variante="fantasma" tamano="chico" icono={Download} onClick={exportar}>
                      Exportar
                    </Boton>
                  </div>
                  <div className="tabla-contenedor">
                    <table className="tabla tabla-compacta">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Producto</th>
                          <th className="num">Unidades</th>
                          <th className="num">Importe</th>
                          <th className="num">Ganancia bruta</th>
                        </tr>
                      </thead>
                      <tbody>
                        {datos.top_productos.map((p, indice) => (
                          <tr key={p.id}>
                            <td>{indice + 1}</td>
                            <td>{p.nombre}</td>
                            <td className="num">{numero(p.unidades)}</td>
                            <td className="num">{dinero(p.total)}</td>
                            <td className="num">{dinero(p.ganancia)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
                <section className="tarjeta">
                  <div className="tarjeta-cabecera">
                    <h2>Ventas por usuario</h2>
                  </div>
                  <ListaBarras
                    formatoValor={dinero}
                    datos={datos.por_usuario.map((u) => ({ clave: u.id, etiqueta: u.nombre, valor: u.total, detalle: `${u.ventas} ventas` }))}
                  />
                </section>
              </div>
            </>
          )}
        </div>
      ) : null}
    </>
  );
}
