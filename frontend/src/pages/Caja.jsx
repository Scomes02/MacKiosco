import { useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Lock, Unlock, Wallet } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useDatos } from '../utils/hooks';
import { aNumero, dinero, fechaHora, numero } from '../utils/format';
import { Boton, Campo, Cargando, Encabezado, ErrorCarga, Etiqueta, Modal, Paginacion, Vacio } from '../components/ui';

/** Resumen de una caja (abierta o cerrada): totales, medios de pago y movimientos de efectivo. */
function ResumenCaja({ caja }) {
  const { totales } = caja;
  const ventasEfectivo = totales.por_metodo.filter((m) => m.es_efectivo).reduce((suma, m) => suma + m.total, 0);
  return (
    <>
      <div className="resumen-fila">
        <div>
          <span>Efectivo inicial</span>
          <strong>{dinero(caja.monto_inicial)}</strong>
        </div>
        <div>
          <span>Ventas en efectivo</span>
          <strong>{dinero(ventasEfectivo)}</strong>
        </div>
        <div>
          <span>Ingresos / Egresos</span>
          <strong>
            +{dinero(totales.ingresos)} / -{dinero(totales.egresos)}
          </strong>
        </div>
        <div className="destacado">
          <span>{caja.estado === 'ABIERTA' ? 'Efectivo que debería haber' : 'Efectivo esperado al cierre'}</span>
          <strong>{dinero(caja.estado === 'ABIERTA' ? caja.efectivo_esperado : caja.monto_esperado)}</strong>
        </div>
      </div>

      <div className="grilla-2">
        <section className="tarjeta">
          <div className="tarjeta-cabecera">
            <h2>Ventas por método de pago</h2>
            <small>
              {numero(totales.ventas_cantidad)} ventas · {dinero(totales.ventas_total)}
            </small>
          </div>
          {totales.por_metodo.length ? (
            <ul className="lista-simple">
              {totales.por_metodo.map((m) => (
                <li key={m.id}>
                  <span>
                    {m.nombre}
                    <small>
                      {m.operaciones} {m.operaciones === 1 ? 'operación' : 'operaciones'}
                    </small>
                  </span>
                  <strong>{dinero(m.total)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio titulo="Todavía no hay ventas en esta caja" />
          )}
          {totales.ventas_anuladas ? <p className="nota">{totales.ventas_anuladas} venta(s) anulada(s) no se cuentan.</p> : null}
        </section>

        <section className="tarjeta">
          <div className="tarjeta-cabecera">
            <h2>Ingresos y egresos de efectivo</h2>
          </div>
          {caja.movimientos.length ? (
            <ul className="lista-simple">
              {caja.movimientos.map((m) => (
                <li key={m.id}>
                  <span>
                    {m.concepto}
                    <small>
                      {fechaHora(m.fecha)} · {m.usuario}
                    </small>
                  </span>
                  <strong className={m.tipo === 'EGRESO' ? 'texto-peligro' : 'texto-exito'}>
                    {m.tipo === 'EGRESO' ? '-' : '+'}
                    {dinero(m.monto)}
                  </strong>
                </li>
              ))}
            </ul>
          ) : (
            <Vacio titulo="Sin movimientos manuales" descripcion="Los retiros y los ingresos de cambio aparecen acá." />
          )}
        </section>
      </div>
    </>
  );
}

function FormularioMovimiento({ tipo, onCerrar, onGuardado }) {
  const toast = useToast();
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);
  const esIngreso = tipo === 'INGRESO';

  const guardar = async (evento) => {
    evento.preventDefault();
    const valor = aNumero(monto);
    const nuevos = {};
    if (Number.isNaN(valor) || valor <= 0) nuevos.monto = 'Ingresá un monto mayor a cero.';
    if (concepto.trim().length < 3) nuevos.concepto = 'Describí el motivo (mínimo 3 caracteres).';
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setEnviando(true);
    try {
      await api.post('/cajas/movimientos', { tipo, monto: valor, concepto: concepto.trim() });
      toast.exito(esIngreso ? 'Ingreso registrado.' : 'Egreso registrado.');
      onGuardado();
    } catch (error) {
      setErrores(error.fields || {});
      toast.error(error.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={esIngreso ? 'Registrar ingreso de efectivo' : 'Registrar egreso de efectivo'}
      ancho="chico"
      onCerrar={onCerrar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-movimiento" cargando={enviando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-movimiento" className="formulario" onSubmit={guardar} noValidate>
        <Campo etiqueta="Monto" error={errores.monto} requerido>
          {(id) => <input id={id} type="number" inputMode="decimal" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} />}
        </Campo>
        <Campo etiqueta="Concepto" error={errores.concepto} requerido>
          {(id) => (
            <input
              id={id}
              value={concepto}
              maxLength={160}
              onChange={(e) => setConcepto(e.target.value)}
              placeholder={esIngreso ? 'Ej.: ingreso de cambio' : 'Ej.: retiro de efectivo, pago a proveedor'}
            />
          )}
        </Campo>
      </form>
    </Modal>
  );
}

function CerrarCaja({ caja, onCerrar, onCerrada }) {
  const toast = useToast();
  const [contado, setContado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const valor = aNumero(contado);
  const diferencia = Number.isNaN(valor) ? null : Math.round((valor - caja.efectivo_esperado) * 100) / 100;

  const cerrar = async (evento) => {
    evento.preventDefault();
    if (Number.isNaN(valor) || valor < 0) {
      setError('Ingresá el efectivo que contaste en la caja.');
      return;
    }
    setEnviando(true);
    try {
      await api.post('/cajas/cerrar', { monto_contado: valor, observaciones });
      toast.exito('Caja cerrada correctamente.');
      onCerrada();
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo="Cerrar caja"
      ancho="chico"
      onCerrar={onCerrar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-cierre" icono={Lock} cargando={enviando}>
            Cerrar caja
          </Boton>
        </>
      }
    >
      <form id="form-cierre" className="formulario" onSubmit={cerrar} noValidate>
        <div className="cobro-total">
          <span>Efectivo esperado</span>
          <strong>{dinero(caja.efectivo_esperado)}</strong>
        </div>
        <Campo etiqueta="Efectivo contado en la caja" error={error} requerido>
          {(id) => (
            <input
              id={id}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={contado}
              onChange={(e) => {
                setContado(e.target.value);
                setError('');
              }}
            />
          )}
        </Campo>
        {diferencia !== null ? (
          <div className={`alerta ${diferencia === 0 ? 'alerta-exito' : 'alerta-alerta'}`}>
            {diferencia === 0
              ? 'La caja cierra perfecto: no hay diferencia.'
              : diferencia > 0
                ? `Sobran ${dinero(diferencia)} respecto de lo esperado.`
                : `Faltan ${dinero(Math.abs(diferencia))} respecto de lo esperado.`}
          </div>
        ) : null}
        <Campo etiqueta="Observaciones">
          {(id) => <textarea id={id} rows={2} maxLength={255} value={observaciones} onChange={(e) => setObservaciones(e.target.value)} />}
        </Campo>
      </form>
    </Modal>
  );
}

function AbrirCaja({ onAbierta }) {
  const toast = useToast();
  const [monto, setMonto] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const abrir = async (evento) => {
    evento.preventDefault();
    const valor = monto === '' ? 0 : aNumero(monto);
    if (Number.isNaN(valor) || valor < 0) {
      setError('Ingresá un monto válido (puede ser 0).');
      return;
    }
    setEnviando(true);
    try {
      await api.post('/cajas/abrir', { monto_inicial: valor });
      toast.exito('Caja abierta.');
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setEnviando(false);
      onAbierta();
    }
  };

  return (
    <section className="tarjeta">
      <form className="caja-cerrada" onSubmit={abrir} noValidate>
        <Wallet size={32} aria-hidden="true" />
        <strong>La caja está cerrada</strong>
        <p>Contá el efectivo con el que arrancás el turno y abrí la caja para empezar a vender.</p>
        <Campo etiqueta="Efectivo inicial en caja" error={error}>
          {(id) => (
            <input id={id} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus />
          )}
        </Campo>
        <Boton type="submit" icono={Unlock} cargando={enviando}>
          Abrir caja
        </Boton>
      </form>
    </section>
  );
}

function DetalleCajaCerrada({ cajaId, onCerrar }) {
  const { datos, error, recargar } = useDatos(() => api.get(`/cajas/${cajaId}`), [cajaId]);
  return (
    <Modal titulo={`Caja N° ${cajaId}`} onCerrar={onCerrar} ancho="grande">
      {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
      {!datos && !error ? <Cargando /> : null}
      {datos ? (
        <>
          <p className="nota">
            Abierta el {fechaHora(datos.abierta_en)} por {datos.usuario_apertura}
            {datos.cerrada_en ? ` · Cerrada el ${fechaHora(datos.cerrada_en)} por ${datos.usuario_cierre}` : ''}
          </p>
          <ResumenCaja caja={datos} />
          {datos.estado === 'CERRADA' ? (
            <div className="resumen-fila">
              <div>
                <span>Efectivo contado</span>
                <strong>{dinero(datos.monto_contado)}</strong>
              </div>
              <div>
                <span>Diferencia</span>
                <strong className={datos.diferencia < 0 ? 'texto-peligro' : datos.diferencia > 0 ? 'texto-alerta' : 'texto-exito'}>
                  {dinero(datos.diferencia)}
                </strong>
              </div>
              {datos.observaciones ? (
                <div>
                  <span>Observaciones</span>
                  <strong className="texto-normal">{datos.observaciones}</strong>
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}

export default function Caja() {
  const [page, setPage] = useState(1);
  const [movimiento, setMovimiento] = useState(null);
  const [cerrando, setCerrando] = useState(false);
  const [detalle, setDetalle] = useState(null);

  const actual = useDatos(() => api.get('/cajas/actual'), []);
  const historial = useDatos(() => api.get('/cajas', { page, limit: 10 }), [page]);

  const refrescar = () => {
    actual.recargar();
    historial.recargar();
  };

  const caja = actual.datos?.caja;

  return (
    <>
      <Encabezado
        titulo="Caja"
        descripcion={caja ? `Abierta el ${fechaHora(caja.abierta_en)} por ${caja.usuario_apertura}` : 'Apertura, cierre y movimientos de efectivo'}
      >
        {caja ? (
          <>
            <Boton variante="secundario" icono={ArrowDownCircle} onClick={() => setMovimiento('INGRESO')}>
              Ingreso
            </Boton>
            <Boton variante="secundario" icono={ArrowUpCircle} onClick={() => setMovimiento('EGRESO')}>
              Egreso
            </Boton>
            <Boton icono={Lock} onClick={() => setCerrando(true)}>
              Cerrar caja
            </Boton>
          </>
        ) : null}
      </Encabezado>

      {actual.error ? <ErrorCarga error={actual.error} onReintentar={actual.recargar} /> : null}
      {!actual.datos && !actual.error ? <Cargando /> : null}
      {actual.datos && !caja ? <AbrirCaja onAbierta={refrescar} /> : null}
      {caja ? <ResumenCaja caja={caja} /> : null}

      <section className="tarjeta tarjeta-tabla">
        <div className="tarjeta-cabecera">
          <h2>Historial de cajas</h2>
        </div>
        {historial.error ? <ErrorCarga error={historial.error} onReintentar={historial.recargar} /> : null}
        {historial.datos?.items.length ? (
          <div className="tabla-contenedor">
            <table className="tabla tabla-clic">
              <thead>
                <tr>
                  <th>Caja</th>
                  <th>Apertura</th>
                  <th>Cierre</th>
                  <th>Responsable</th>
                  <th className="num">Ventas</th>
                  <th className="num">Total vendido</th>
                  <th className="num">Diferencia</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.datos.items.map((c) => (
                  <tr key={c.id} onClick={() => setDetalle(c.id)} onKeyDown={(e) => e.key === 'Enter' && setDetalle(c.id)} tabIndex={0}>
                    <td>N° {c.id}</td>
                    <td>{fechaHora(c.abierta_en)}</td>
                    <td>{c.cerrada_en ? fechaHora(c.cerrada_en) : '—'}</td>
                    <td>{c.usuario_apertura}</td>
                    <td className="num">{c.ventas_cantidad}</td>
                    <td className="num">{dinero(c.ventas_total)}</td>
                    <td className={`num ${c.diferencia < 0 ? 'texto-peligro' : c.diferencia > 0 ? 'texto-alerta' : ''}`}>
                      {c.diferencia === null ? '—' : dinero(c.diferencia)}
                    </td>
                    <td>
                      <Etiqueta tono={c.estado === 'ABIERTA' ? 'exito' : 'neutro'}>{c.estado === 'ABIERTA' ? 'Abierta' : 'Cerrada'}</Etiqueta>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {historial.datos && !historial.datos.items.length ? <Vacio titulo="Todavía no hay cajas registradas" /> : null}
        {historial.datos ? (
          <Paginacion page={historial.datos.page} pages={historial.datos.pages} total={historial.datos.total} onCambiar={setPage} etiqueta="cajas" />
        ) : null}
      </section>

      {movimiento ? (
        <FormularioMovimiento
          tipo={movimiento}
          onCerrar={() => setMovimiento(null)}
          onGuardado={() => {
            setMovimiento(null);
            refrescar();
          }}
        />
      ) : null}
      {cerrando && caja ? (
        <CerrarCaja
          caja={caja}
          onCerrar={() => setCerrando(false)}
          onCerrada={() => {
            setCerrando(false);
            refrescar();
          }}
        />
      ) : null}
      {detalle ? <DetalleCajaCerrada cajaId={detalle} onCerrar={() => setDetalle(null)} /> : null}
    </>
  );
}
