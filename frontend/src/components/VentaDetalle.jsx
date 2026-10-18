import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Ban, FileCheck2, Printer } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDatos } from '../utils/hooks';
import { CONDICION_IVA_ARCA, dinero, fechaHora, fechaSola, nombreComprobante, numeroComprobante, numeroVenta } from '../utils/format';
import { Boton, Campo, Cargando, ErrorCarga, Etiqueta, Modal } from './ui';

/** Código QR de verificación de ARCA (se genera en el navegador, sin servicios externos). */
function CodigoQr({ url }) {
  const [imagen, setImagen] = useState(null);
  useEffect(() => {
    let vigente = true;
    QRCode.toDataURL(url, { margin: 0, width: 220, errorCorrectionLevel: 'M' })
      .then((datos) => vigente && setImagen(datos))
      .catch(() => vigente && setImagen(null));
    return () => {
      vigente = false;
    };
  }, [url]);
  return imagen ? <img className="ticket-qr" src={imagen} alt="Código QR para verificar el comprobante en ARCA" /> : null;
}

/** Bloque con los datos fiscales de un comprobante autorizado (factura o nota de crédito). */
function DatosFiscales({ comprobante }) {
  const esPrueba = comprobante.ambiente === 'HOMOLOGACION';
  return (
    <div className="ticket-fiscal">
      {esPrueba ? <div className="ticket-anulada">COMPROBANTE DE PRUEBA · SIN VALIDEZ FISCAL</div> : null}
      <div className="ticket-cae">
        <span>CAE N° {comprobante.cae}</span>
        <span>Vto. CAE: {fechaSola(comprobante.cae_vencimiento)}</span>
      </div>
      {comprobante.qr_url ? <CodigoQr url={comprobante.qr_url} /> : null}
    </div>
  );
}

/**
 * Comprobante de una venta con formato de ticket (es lo único que se imprime).
 * - Venta con factura autorizada: se imprime como Factura A/B con CAE y código QR.
 * - En cualquier otro caso: recibo interno, no válido como factura.
 */
export function Ticket({ venta, vuelto = null, recibido = null }) {
  const { comercio } = useAuth();
  const factura = venta.factura?.estado === 'AUTORIZADO' ? venta.factura : null;
  const notaCredito = venta.nota_credito?.estado === 'AUTORIZADO' ? venta.nota_credito : null;

  return (
    <div className="ticket">
      <div className="ticket-cabecera">
        <strong>{comercio.nombre_comercio}</strong>
        {comercio.razon_social ? <span>{comercio.razon_social}</span> : null}
        {comercio.cuit ? <span>CUIT {comercio.cuit}</span> : null}
        {factura ? <span>IVA Responsable Inscripto</span> : null}
        {comercio.direccion ? <span>{comercio.direccion}</span> : null}
        {factura && comercio.ingresos_brutos ? <span>Ing. Brutos: {comercio.ingresos_brutos}</span> : null}
        {factura && comercio.inicio_actividades ? <span>Inicio de actividades: {comercio.inicio_actividades}</span> : null}
        {comercio.telefono ? <span>Tel. {comercio.telefono}</span> : null}
      </div>

      {factura ? (
        <div className="ticket-tipo">
          <span className="ticket-letra">{factura.letra}</span>
          <div>
            <strong>FACTURA</strong>
            <span>Cód. {String(factura.codigo_arca).padStart(3, '0')}</span>
            <span>N° {numeroComprobante(factura.punto_venta, factura.numero)}</span>
          </div>
        </div>
      ) : (
        <div className="ticket-tipo ticket-tipo-recibo">
          <strong>RECIBO</strong>
        </div>
      )}

      <div className="ticket-datos">
        <span>{factura ? `Fecha de emisión: ${fechaSola(factura.fecha_emision)}` : `Fecha: ${fechaHora(venta.fecha)}`}</span>
        <span>
          Venta {numeroVenta(venta.id)}
          {factura ? ` del ${fechaHora(venta.fecha)}` : ''}
        </span>
        <span>Atendió: {venta.usuario}</span>
        {factura ? (
          <>
            <span>Cliente: {factura.receptor_nombre || 'Consumidor final'}</span>
            {factura.receptor_doc_tipo !== 99 ? (
              <span>
                {factura.receptor_doc_tipo === 80 ? 'CUIT' : 'DNI'}: {factura.receptor_doc_nro}
              </span>
            ) : null}
            <span>Cond. IVA: {CONDICION_IVA_ARCA[factura.receptor_condicion_iva]}</span>
            {venta.cliente_direccion ? <span>Domicilio: {venta.cliente_direccion}</span> : null}
          </>
        ) : (
          <span>Cliente: {venta.cliente || 'Consumidor final'}</span>
        )}
      </div>

      <table className="ticket-items">
        <tbody>
          {venta.detalles.map((detalle) => (
            <tr key={detalle.id}>
              <td>
                {detalle.producto_nombre}
                <small>
                  {detalle.cantidad} x {dinero(detalle.precio_unitario)}
                </small>
              </td>
              <td>{dinero(detalle.subtotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ticket-totales">
        {venta.descuento_monto > 0 ? (
          <>
            <div>
              <span>Subtotal</span>
              <span>{dinero(venta.subtotal)}</span>
            </div>
            <div>
              <span>Descuento ({venta.descuento_porcentaje}%)</span>
              <span>-{dinero(venta.descuento_monto)}</span>
            </div>
          </>
        ) : null}

        {/* Factura A: el IVA se discrimina. */}
        {factura?.letra === 'A' ? (
          <>
            <div>
              <span>Neto gravado</span>
              <span>{dinero(factura.importe_neto)}</span>
            </div>
            {factura.detalle_iva.map((alicuota) => (
              <div key={alicuota.id}>
                <span>IVA {String(alicuota.tasa).replace('.', ',')}%</span>
                <span>{dinero(alicuota.importe)}</span>
              </div>
            ))}
            {factura.importe_exento > 0 ? (
              <div>
                <span>Exento</span>
                <span>{dinero(factura.importe_exento)}</span>
              </div>
            ) : null}
            {factura.importe_no_gravado > 0 ? (
              <div>
                <span>No gravado</span>
                <span>{dinero(factura.importe_no_gravado)}</span>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="ticket-total">
          <span>TOTAL</span>
          <span>{dinero(venta.total)}</span>
        </div>
        {venta.pagos.map((pago) => (
          <div key={pago.id}>
            <span>{pago.metodo}</span>
            <span>{dinero(pago.monto)}</span>
          </div>
        ))}
        {recibido !== null && vuelto !== null && vuelto > 0 ? (
          <>
            <div>
              <span>Recibido</span>
              <span>{dinero(recibido)}</span>
            </div>
            <div>
              <span>Vuelto</span>
              <span>{dinero(vuelto)}</span>
            </div>
          </>
        ) : null}
      </div>

      {/* Factura B: se informa el IVA contenido en el precio (Ley 27.743). */}
      {factura?.letra === 'B' ? (
        <div className="ticket-transparencia">
          <span>Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</span>
          <span>IVA contenido: {dinero(factura.importe_iva)}</span>
        </div>
      ) : null}

      {factura ? <DatosFiscales comprobante={factura} /> : null}

      {venta.estado === 'ANULADA' ? <div className="ticket-anulada">VENTA ANULADA</div> : null}
      {notaCredito ? (
        <div className="ticket-nota-credito">
          <strong>
            {nombreComprobante(notaCredito).toUpperCase()} N° {numeroComprobante(notaCredito.punto_venta, notaCredito.numero)}
          </strong>
          <span>
            Anula la factura N° {numeroComprobante(factura.punto_venta, factura.numero)} por {dinero(notaCredito.importe_total)}
          </span>
          <DatosFiscales comprobante={notaCredito} />
        </div>
      ) : null}

      {comercio.mensaje_ticket ? <div className="ticket-pie">{comercio.mensaje_ticket}</div> : null}
      {!factura ? <div className="ticket-pie">Comprobante no válido como factura</div> : null}
    </div>
  );
}

/** Estado del comprobante de una venta, en palabras: recibo, factura autorizada o factura pendiente. */
export function EstadoComprobante({ venta }) {
  const { factura } = venta;
  if (factura?.estado === 'AUTORIZADO') {
    return (
      <Etiqueta tono="info">
        {nombreComprobante(factura)} {numeroComprobante(factura.punto_venta, factura.numero)}
      </Etiqueta>
    );
  }
  if (venta.comprobante === 'FACTURA') return <Etiqueta tono="alerta">Factura pendiente</Etiqueta>;
  return <Etiqueta tono="neutro">Recibo</Etiqueta>;
}

/**
 * Aviso y botón para emitir o reintentar la factura de una venta que todavía no la tiene autorizada.
 * Se usa en el detalle de la venta y en la confirmación del punto de venta.
 */
export function AccionFactura({ venta, onActualizada }) {
  const { comercio } = useAuth();
  const toast = useToast();
  const [enviando, setEnviando] = useState(false);

  const autorizada = venta.factura?.estado === 'AUTORIZADO';
  if (autorizada || venta.estado !== 'COMPLETADA') return null;
  const pidioFactura = venta.comprobante === 'FACTURA';
  if (!pidioFactura && !comercio.facturacion.operativa) return null;

  const facturar = async () => {
    setEnviando(true);
    try {
      const actualizada = await api.post(`/ventas/${venta.id}/facturar`);
      if (actualizada.factura?.estado === 'AUTORIZADO') toast.exito('Factura autorizada por ARCA.');
      else toast.error(actualizada.factura?.mensaje || 'ARCA no autorizó la factura.');
      onActualizada(actualizada);
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className={`alerta ${pidioFactura ? 'alerta-alerta' : 'alerta-info'} alerta-con-accion`}>
      <div>
        {pidioFactura ? (
          <>
            <strong>La factura todavía no fue autorizada por ARCA.</strong>
            <span>{venta.factura?.mensaje || 'La venta quedó registrada. Podés reintentar ahora o más tarde.'}</span>
          </>
        ) : (
          <span>Esta venta tiene un recibo interno. Si el cliente la pide, podés emitir la factura.</span>
        )}
      </div>
      <Boton variante="secundario" tamano="chico" icono={FileCheck2} onClick={facturar} cargando={enviando}>
        {pidioFactura ? 'Reintentar factura' : 'Emitir factura'}
      </Boton>
    </div>
  );
}

/** Ventana con el detalle de una venta: permite imprimirla, facturarla y (solo administrador) anularla. */
export default function VentaDetalle({ ventaId, onCerrar, onCambio }) {
  const { esAdmin } = useAuth();
  const toast = useToast();
  const { datos: venta, cargando, error, recargar } = useDatos(() => api.get(`/ventas/${ventaId}`), [ventaId]);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [errorMotivo, setErrorMotivo] = useState('');
  const [enviando, setEnviando] = useState(false);

  const puedeAnular = esAdmin && venta?.estado === 'COMPLETADA' && venta?.caja_estado === 'ABIERTA';
  const tieneFactura = venta?.factura?.estado === 'AUTORIZADO';

  const anular = async (evento) => {
    evento.preventDefault();
    if (motivo.trim().length < 3) {
      setErrorMotivo('Escribí el motivo de la anulación (mínimo 3 caracteres).');
      return;
    }
    setEnviando(true);
    try {
      await api.post(`/ventas/${ventaId}/anular`, { motivo: motivo.trim() });
      toast.exito(tieneFactura ? 'Venta anulada con nota de crédito. El stock fue devuelto.' : 'Venta anulada. El stock fue devuelto.');
      setAnulando(false);
      await recargar();
      onCambio?.();
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={`Venta ${numeroVenta(ventaId)}`}
      onCerrar={onCerrar}
      ancho="chico"
      bloqueado={enviando}
      pie={
        venta && !anulando ? (
          <>
            {puedeAnular ? (
              <Boton variante="peligro-suave" icono={Ban} onClick={() => setAnulando(true)}>
                Anular venta
              </Boton>
            ) : null}
            <Boton variante="secundario" icono={Printer} onClick={() => window.print()}>
              Imprimir
            </Boton>
          </>
        ) : null
      }
    >
      {cargando && !venta ? <Cargando /> : null}
      {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
      {venta ? (
        <>
          <div className="venta-estado">
            <Etiqueta tono={venta.estado === 'ANULADA' ? 'peligro' : 'exito'}>
              {venta.estado === 'ANULADA' ? 'Anulada' : 'Completada'}
            </Etiqueta>
            <EstadoComprobante venta={venta} />
            {venta.estado === 'ANULADA' ? (
              <small>
                {fechaHora(venta.anulada_en)} · {venta.anulada_por_nombre} · {venta.motivo_anulacion}
              </small>
            ) : null}
          </div>
          {!anulando ? (
            <AccionFactura
              venta={venta}
              onActualizada={() => {
                recargar();
                onCambio?.();
              }}
            />
          ) : null}
          <Ticket venta={venta} />
          {esAdmin && venta.estado === 'COMPLETADA' && venta.caja_estado !== 'ABIERTA' ? (
            <p className="nota">
              Esta venta pertenece a una caja ya cerrada, por eso no se puede anular. Si devolvés dinero, registralo como
              egreso en la caja actual.
            </p>
          ) : null}
          {anulando ? (
            <form className="formulario caja-anular" onSubmit={anular} noValidate>
              <Campo etiqueta="Motivo de la anulación" error={errorMotivo} requerido>
                {(id) => (
                  <input
                    id={id}
                    data-autofocus
                    autoFocus
                    value={motivo}
                    maxLength={255}
                    onChange={(evento) => {
                      setMotivo(evento.target.value);
                      setErrorMotivo('');
                    }}
                    placeholder="Ej.: error al cargar los productos"
                  />
                )}
              </Campo>
              <p className="nota">
                Al anular se devuelve el stock de los productos y la venta deja de contar en la caja.
                {tieneFactura ? ' Como la venta está facturada, se emite una nota de crédito en ARCA.' : ''}
              </p>
              <div className="fila-botones">
                <Boton variante="secundario" onClick={() => setAnulando(false)} disabled={enviando}>
                  Volver
                </Boton>
                <Boton type="submit" variante="peligro" cargando={enviando}>
                  Confirmar anulación
                </Boton>
              </div>
            </form>
          ) : null}
        </>
      ) : null}
    </Modal>
  );
}
