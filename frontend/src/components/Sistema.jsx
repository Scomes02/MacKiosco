import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Copy, DatabaseBackup, Download, KeyRound, Save, ShieldAlert, ShieldCheck } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDatos } from '../utils/hooks';
import { fechaHora, fechaSola, numero } from '../utils/format';
import { Boton, Campo, Cargando, ErrorCarga, Etiqueta, Vacio } from './ui';

const ESTADOS_LICENCIA = {
  DESARROLLO: { texto: 'Equipo del fabricante', tono: 'info' },
  PRUEBA: { texto: 'Período de prueba', tono: 'info' },
  ACTIVA: { texto: 'Licencia activa', tono: 'exito' },
  GRACIA: { texto: 'Vencida · en días de gracia', tono: 'alerta' },
  BLOQUEADA: { texto: 'Vencida · solo consulta', tono: 'peligro' },
};

/** Franja de aviso que se ve en todas las pantallas cuando la licencia está en prueba, por vencer o vencida. */
export function AvisoLicencia() {
  const { licencia, esAdmin } = useAuth();
  if (!licencia?.aviso) return null;
  const tono = licencia.estado === 'BLOQUEADA' ? 'peligro' : licencia.estado === 'PRUEBA' ? 'info' : 'alerta';
  const Icono = licencia.estado === 'BLOQUEADA' ? ShieldAlert : KeyRound;
  return (
    <div className={`alerta alerta-${tono} aviso-licencia`} role="status">
      <Icono size={18} aria-hidden="true" />
      <span>
        {licencia.aviso} {esAdmin ? <Link to="/configuracion">Cargar clave de licencia</Link> : 'Avisale al administrador.'}
      </span>
    </div>
  );
}

/** Estado de la licencia, código de este equipo y carga de la clave. */
export function Licencia() {
  const toast = useToast();
  const { licencia, setLicencia } = useAuth();
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  if (!licencia) return null;
  const estado = ESTADOS_LICENCIA[licencia.estado];

  const copiarCodigo = async () => {
    try {
      await navigator.clipboard.writeText(licencia.codigo_equipo);
      toast.exito('Código de equipo copiado.');
    } catch {
      toast.info(`Código de equipo: ${licencia.codigo_equipo}`);
    }
  };

  const activar = async (evento) => {
    evento.preventDefault();
    if (clave.trim().length < 20) {
      setError('Pegá la clave de licencia completa.');
      return;
    }
    setGuardando(true);
    setError('');
    try {
      setLicencia(await api.put('/licencia', { clave: clave.trim() }));
      setClave('');
      toast.exito('Licencia activada correctamente.');
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="tarjeta">
      <div className="tarjeta-cabecera">
        <h2>Licencia</h2>
        <Etiqueta tono={estado.tono}>{estado.texto}</Etiqueta>
      </div>

      <div className="resumen-fila">
        <div>
          <span>Código de este equipo</span>
          <strong className="codigo-equipo">{licencia.codigo_equipo}</strong>
        </div>
        {licencia.estado !== 'DESARROLLO' ? (
          <>
            <div>
              <span>{licencia.con_clave ? 'Vencimiento de la licencia' : 'Fin del período de prueba'}</span>
              <strong>{fechaSola(licencia.vence)}</strong>
            </div>
            <div>
              <span>Días restantes</span>
              <strong>{licencia.dias_restantes > 0 ? licencia.dias_restantes : 'Vencida'}</strong>
            </div>
            {licencia.titular ? (
              <div>
                <span>Titular</span>
                <strong className="texto-normal">{licencia.titular}</strong>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {licencia.estado === 'DESARROLLO' ? (
        <p className="nota">
          Esta es la PC del fabricante (tiene la clave para firmar licencias), por eso el sistema no pide licencia acá.
        </p>
      ) : (
        <form className="formulario" onSubmit={activar} noValidate>
          <p className="nota">
            Para obtener o renovar la licencia, enviá el <strong>código de este equipo</strong> a tu proveedor. Te va a
            devolver una clave para pegar acá. La clave sirve solo para esta PC.
          </p>
          <div className="fila-botones fila-izquierda">
            <Boton variante="secundario" tamano="chico" icono={Copy} onClick={copiarCodigo}>
              Copiar código de equipo
            </Boton>
          </div>
          <Campo etiqueta="Clave de licencia" error={error}>
            {(id) => (
              <textarea
                id={id}
                rows={3}
                value={clave}
                onChange={(evento) => setClave(evento.target.value)}
                placeholder="MK1...."
                spellCheck="false"
                className="texto-codigo"
              />
            )}
          </Campo>
          <div className="fila-botones">
            <Boton type="submit" icono={ShieldCheck} cargando={guardando}>
              Activar licencia
            </Boton>
          </div>
        </form>
      )}
    </section>
  );
}

const megas = (bytes) => `${numero(Math.max(0.01, Math.round((bytes / 1048576) * 100) / 100))} MB`;

/** Copias de seguridad: estado, copia manual, carpeta extra y descarga. */
export function CopiasDeSeguridad() {
  const toast = useToast();
  const { datos, error, recargar } = useDatos(() => api.get('/copias'), []);
  const [carpetaExtra, setCarpetaExtra] = useState('');
  const [errorCarpeta, setErrorCarpeta] = useState('');
  const [ocupado, setOcupado] = useState('');

  useEffect(() => {
    if (datos) setCarpetaExtra(datos.carpeta_extra);
  }, [datos]);

  if (error) return <ErrorCarga error={error} onReintentar={recargar} />;
  if (!datos) return <Cargando />;

  const copiarAhora = async () => {
    setOcupado('copia');
    try {
      await api.post('/copias');
      toast.exito('Copia de seguridad creada.');
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setOcupado('');
      recargar();
    }
  };

  const guardarCarpeta = async (evento) => {
    evento.preventDefault();
    setOcupado('carpeta');
    setErrorCarpeta('');
    try {
      await api.put('/copias/configuracion', { carpeta_extra: carpetaExtra });
      toast.exito(carpetaExtra.trim() ? 'Carpeta extra guardada. Se usará desde la próxima copia.' : 'Se quitó la carpeta extra.');
      recargar();
    } catch (fallo) {
      setErrorCarpeta(fallo.message);
    } finally {
      setOcupado('');
    }
  };

  return (
    <section className="tarjeta">
      <div className="tarjeta-cabecera">
        <h2>Copias de seguridad</h2>
        <Boton variante="secundario" tamano="chico" icono={DatabaseBackup} onClick={copiarAhora} cargando={ocupado === 'copia'}>
          Hacer una copia ahora
        </Boton>
      </div>

      <p className="nota">
        El sistema hace una copia automática por día y conserva las últimas {datos.conservar}. Cada copia guarda todo:
        productos, ventas, caja, clientes y configuración.
      </p>

      <div className="resumen-fila">
        <div>
          <span>Última copia</span>
          <strong>{datos.ultima_copia ? fechaHora(datos.ultima_copia) : 'Todavía no hay'}</strong>
        </div>
        <div>
          <span>Copias guardadas</span>
          <strong>{datos.archivos.length}</strong>
        </div>
        <div>
          <span>Carpeta en este equipo</span>
          <strong className="texto-normal texto-ruta">{datos.carpeta}</strong>
        </div>
      </div>

      {datos.ultimo_error ? (
        <div className="alerta alerta-peligro" role="alert">
          <span>La última copia falló: {datos.ultimo_error}</span>
        </div>
      ) : null}
      {datos.resultado_extra && datos.resultado_extra !== 'OK' ? (
        <div className="alerta alerta-alerta" role="alert">
          <span>{datos.resultado_extra}</span>
        </div>
      ) : null}

      <form className="formulario" onSubmit={guardarCarpeta} noValidate>
        <Campo
          etiqueta="Carpeta extra (recomendado)"
          error={errorCarpeta}
          ayuda="Una segunda carpeta donde se duplica cada copia: un pendrive (E:\CopiasKiosco) o una carpeta de OneDrive o Google Drive. Así los datos se salvan aunque se rompa el disco de esta PC."
        >
          {(id) => (
            <input
              id={id}
              value={carpetaExtra}
              maxLength={250}
              onChange={(evento) => setCarpetaExtra(evento.target.value)}
              placeholder="Ej.: E:\CopiasKiosco"
              spellCheck="false"
            />
          )}
        </Campo>
        <div className="fila-botones">
          {datos.carpeta_extra && datos.resultado_extra === 'OK' ? <Etiqueta tono="exito">Última copia duplicada correctamente</Etiqueta> : null}
          <Boton type="submit" variante="secundario" icono={Save} cargando={ocupado === 'carpeta'}>
            Guardar carpeta
          </Boton>
        </div>
      </form>

      {datos.archivos.length ? (
        <div className="tabla-contenedor tabla-baja">
          <table className="tabla tabla-compacta">
            <thead>
              <tr>
                <th>Copia</th>
                <th>Fecha</th>
                <th className="num">Tamaño</th>
                <th className="acciones">Descargar</th>
              </tr>
            </thead>
            <tbody>
              {datos.archivos.map((archivo) => (
                <tr key={archivo.nombre}>
                  <td>{archivo.nombre}</td>
                  <td>{fechaHora(archivo.fecha)}</td>
                  <td className="num">{megas(archivo.tamano)}</td>
                  <td className="acciones">
                    <a className="btn-icono" href={`/api/copias/${archivo.nombre}/descargar`} title={`Descargar ${archivo.nombre}`} aria-label={`Descargar ${archivo.nombre}`}>
                      <Download size={18} aria-hidden="true" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Vacio titulo="Todavía no hay copias" descripcion="La primera se hace sola a los pocos minutos de iniciar el sistema." icono={DatabaseBackup} />
      )}
    </section>
  );
}
