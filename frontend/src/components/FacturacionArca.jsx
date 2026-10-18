import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, Download, PlugZap, Save, Upload, XCircle } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDatos } from '../utils/hooks';
import { fecha } from '../utils/format';
import { Boton, Campo, Cargando, ErrorCarga, Etiqueta } from './ui';

const NOMBRE_AMBIENTE = { HOMOLOGACION: 'Pruebas (homologación)', PRODUCCION: 'Producción (facturas reales)' };

function descargarTexto(nombre, contenido) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/pkcs10' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

function Paso({ numero, titulo, listo, children }) {
  return (
    <li className={`paso ${listo ? 'paso-listo' : ''}`}>
      <span className="paso-numero" aria-hidden="true">
        {listo ? <CheckCircle2 size={18} /> : numero}
      </span>
      <div className="paso-cuerpo">
        <strong>
          {titulo} {listo ? <Etiqueta tono="exito">Listo</Etiqueta> : null}
        </strong>
        {children}
      </div>
    </li>
  );
}

/**
 * Configuración de la facturación electrónica con ARCA, guiada paso a paso:
 * pedido de certificado, carga del certificado, punto de venta, prueba y habilitación.
 */
export default function FacturacionArca() {
  const toast = useToast();
  const { comercio, recargarComercio } = useAuth();
  // Se vuelve a consultar cuando cambian los datos del comercio (el CUIT y la razón social son el paso 1).
  const { datos: estado, error, recargar } = useDatos(() => api.get('/facturacion'), [comercio.cuit, comercio.razon_social]);
  const [form, setForm] = useState({ ambiente: 'HOMOLOGACION', punto_venta: '', habilitada: false });
  const [certificado, setCertificado] = useState('');
  const [prueba, setPrueba] = useState(null);
  const [ocupado, setOcupado] = useState('');
  const [mensajeError, setMensajeError] = useState('');

  useEffect(() => {
    if (estado) setForm({ ambiente: estado.ambiente, punto_venta: estado.punto_venta ?? '', habilitada: estado.habilitada });
  }, [estado]);

  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
  if (!estado) return <Cargando />;

  const ejecutar = async (clave, accion) => {
    setOcupado(clave);
    setMensajeError('');
    try {
      await accion();
    } catch (fallo) {
      setMensajeError(fallo.message);
    } finally {
      setOcupado('');
    }
  };

  const descargarPedido = () =>
    ejecutar('pedido', async () => {
      const pedido = await api.post('/facturacion/pedido-certificado');
      descargarTexto(pedido.nombre_archivo, pedido.contenido);
      toast.exito('Pedido de certificado descargado. Subilo en la web de ARCA.');
      recargar();
    });

  const subirCertificado = () =>
    ejecutar('certificado', async () => {
      await api.put('/facturacion/certificado', { ambiente: form.ambiente, certificado });
      setCertificado('');
      toast.exito('Certificado cargado correctamente.');
      recargar();
    });

  const guardar = (habilitada) =>
    ejecutar('guardar', async () => {
      await api.put('/facturacion', { ambiente: form.ambiente, punto_venta: form.punto_venta, habilitada });
      toast.exito(habilitada ? 'Facturación electrónica habilitada.' : 'Configuración guardada.');
      await Promise.all([recargar(), recargarComercio()]);
    });

  const probar = () =>
    ejecutar('probar', async () => {
      // Se guarda antes de probar para que la prueba use el ambiente y punto de venta que se ven en pantalla.
      await api.put('/facturacion', { ambiente: form.ambiente, punto_venta: form.punto_venta, habilitada: false });
      setPrueba(await api.post('/facturacion/probar'));
      await Promise.all([recargar(), recargarComercio()]);
    });

  const leerArchivo = async (evento) => {
    const archivo = evento.target.files?.[0];
    if (archivo) setCertificado(await archivo.text());
    evento.target.value = '';
  };

  const certificadoActual = estado.certificados[form.ambiente];
  const datosComercio = estado.cuit.length === 11 && Boolean(estado.razon_social);

  return (
    <section className="tarjeta">
      <div className="tarjeta-cabecera">
        <h2>Facturación electrónica (ARCA)</h2>
        <Etiqueta tono={estado.operativa ? 'exito' : 'neutro'}>
          {estado.operativa ? `Habilitada · ${NOMBRE_AMBIENTE[estado.ambiente]}` : 'No habilitada'}
        </Etiqueta>
      </div>

      <p className="nota">
        Con la facturación habilitada, al cobrar se elige entre <strong>Recibo</strong> (comprobante interno) y{' '}
        <strong>Factura</strong> (se valida en ARCA y obtiene el CAE). Sin habilitar, todas las ventas se registran con recibo.
        El sistema factura como <strong>Responsable Inscripto</strong>: Factura A a clientes inscriptos o monotributistas con CUIT
        y Factura B al resto.
      </p>

      <Campo etiqueta="Ambiente" ayuda="Empezá por pruebas: las facturas de homologación no tienen validez fiscal.">
        {(id) => (
          <select id={id} value={form.ambiente} onChange={(e) => setForm({ ...form, ambiente: e.target.value })} disabled={estado.habilitada}>
            {Object.entries(NOMBRE_AMBIENTE).map(([clave, texto]) => (
              <option key={clave} value={clave}>
                {texto}
              </option>
            ))}
          </select>
        )}
      </Campo>

      <ol className="pasos">
        <Paso numero={1} titulo="Datos del comercio" listo={datosComercio}>
          <p>
            {datosComercio
              ? `CUIT ${estado.cuit} · ${estado.razon_social}`
              : 'Cargá el CUIT (11 dígitos) y la razón social en "Datos del comercio", arriba, y guardá.'}
          </p>
        </Paso>

        <Paso numero={2} titulo="Pedido de certificado" listo={estado.clave_generada}>
          <p>
            Descargá el pedido (archivo .csr) y subilo en la web de ARCA, en{' '}
            {form.ambiente === 'PRODUCCION' ? '"Administración de Certificados Digitales"' : '"WSASS - Autogestión Certificados Homologación"'}.
            La clave privada se genera y queda guardada solo en esta computadora.
          </p>
          <Boton variante="secundario" tamano="chico" icono={Download} onClick={descargarPedido} cargando={ocupado === 'pedido'} disabled={!datosComercio}>
            {estado.clave_generada ? 'Volver a descargar el pedido' : 'Generar y descargar el pedido'}
          </Boton>
        </Paso>

        <Paso numero={3} titulo={`Certificado de ${form.ambiente === 'PRODUCCION' ? 'producción' : 'pruebas'}`} listo={Boolean(certificadoActual) && !certificadoActual.vencido}>
          {certificadoActual ? (
            <p>
              Cargado: {certificadoActual.titular} · vence el {fecha(certificadoActual.valido_hasta.replace('T', ' '))}
              {certificadoActual.vencido ? ' (VENCIDO)' : ''}
            </p>
          ) : (
            <p>ARCA te devuelve un certificado (archivo .crt). Elegí el archivo o pegá su contenido acá.</p>
          )}
          <textarea
            rows={3}
            value={certificado}
            onChange={(e) => setCertificado(e.target.value)}
            placeholder="-----BEGIN CERTIFICATE-----"
            aria-label="Contenido del certificado"
            spellCheck="false"
          />
          <div className="fila-botones fila-izquierda">
            <label className="btn btn-secundario btn-chico">
              <Upload size={16} aria-hidden="true" />
              <span>Elegir archivo .crt</span>
              <input type="file" accept=".crt,.pem,.cer,.txt" onChange={leerArchivo} hidden />
            </label>
            <Boton tamano="chico" onClick={subirCertificado} cargando={ocupado === 'certificado'} disabled={certificado.trim().length < 100}>
              Guardar certificado
            </Boton>
          </div>
        </Paso>

        <Paso numero={4} titulo="Punto de venta" listo={Boolean(estado.punto_venta) && String(estado.punto_venta) === String(form.punto_venta)}>
          <p>
            Número del punto de venta dado de alta en ARCA con el sistema <strong>"RECE para aplicativo y web services"</strong>{' '}
            (no sirve el de "Comprobantes en línea").
          </p>
          <input
            className="input-chico input-izquierda"
            type="number"
            min="1"
            max="99999"
            step="1"
            value={form.punto_venta}
            onChange={(e) => setForm({ ...form, punto_venta: e.target.value })}
            aria-label="Punto de venta"
            disabled={estado.habilitada}
          />
        </Paso>

        <Paso numero={5} titulo="Probar la conexión" listo={Boolean(prueba?.ok)}>
          <p>Verifica los servidores de ARCA, el certificado y el punto de venta. No emite ningún comprobante.</p>
          <Boton variante="secundario" tamano="chico" icono={PlugZap} onClick={probar} cargando={ocupado === 'probar'} disabled={estado.habilitada}>
            Probar conexión con ARCA
          </Boton>
          {estado.habilitada ? <small className="nota">Para volver a probar, primero deshabilitá la facturación.</small> : null}
          {prueba ? (
            <ul className="prueba-resultado">
              {prueba.pasos.map((paso) => (
                <li key={paso.nombre} className={paso.ok ? 'texto-exito' : 'texto-peligro'}>
                  {paso.ok ? <CheckCircle2 size={16} aria-hidden="true" /> : <XCircle size={16} aria-hidden="true" />}
                  <span>
                    <strong>{paso.nombre}:</strong> {paso.detalle}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Paso>
      </ol>

      {mensajeError ? (
        <div className="alerta alerta-peligro" role="alert">
          <CircleAlert size={18} aria-hidden="true" />
          <span>{mensajeError}</span>
        </div>
      ) : null}

      {!estado.lista && !estado.habilitada ? (
        <div className="alerta alerta-info">
          <span>
            <strong>Falta para poder habilitar:</strong> {estado.faltantes.join(' ')}
          </span>
        </div>
      ) : null}

      <div className="fila-botones">
        {estado.habilitada ? (
          <Boton variante="peligro-suave" onClick={() => guardar(false)} cargando={ocupado === 'guardar'}>
            Deshabilitar la facturación
          </Boton>
        ) : (
          <>
            <Boton variante="secundario" icono={Save} onClick={() => guardar(false)} cargando={ocupado === 'guardar'}>
              Guardar sin habilitar
            </Boton>
            <Boton variante="exito" onClick={() => guardar(true)} disabled={ocupado !== ''}>
              Habilitar la facturación
            </Boton>
          </>
        )}
      </div>
    </section>
  );
}
