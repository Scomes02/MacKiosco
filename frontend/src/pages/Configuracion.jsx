import { useEffect, useState } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDatos } from '../utils/hooks';
import { Boton, BotonIcono, Campo, Cargando, Confirmar, Encabezado, ErrorCarga, Etiqueta, Modal } from '../components/ui';
import FacturacionArca from '../components/FacturacionArca';
import { CopiasDeSeguridad, Licencia } from '../components/Sistema';

function DatosDelComercio() {
  const toast = useToast();
  const { comercio, setComercio } = useAuth();
  const [form, setForm] = useState(comercio);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => setForm(comercio), [comercio]);

  const cambiar = (campo) => (evento) => setForm({ ...form, [campo]: evento.target.value });

  const guardar = async (evento) => {
    evento.preventDefault();
    if (!form.nombre_comercio.trim()) {
      setErrores({ nombre_comercio: 'El nombre del comercio es obligatorio.' });
      return;
    }
    setGuardando(true);
    try {
      setComercio(await api.put('/configuracion', form));
      setErrores({});
      toast.exito('Datos del comercio guardados.');
    } catch (error) {
      setErrores(error.fields || {});
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="tarjeta">
      <div className="tarjeta-cabecera">
        <h2>Datos del comercio</h2>
        <small>Aparecen en el menú y en los tickets</small>
      </div>
      <form className="formulario formulario-2" onSubmit={guardar} noValidate>
        <Campo etiqueta="Nombre del comercio" error={errores.nombre_comercio} requerido>
          {(id) => <input id={id} value={form.nombre_comercio} onChange={cambiar('nombre_comercio')} maxLength={80} />}
        </Campo>
        <Campo etiqueta="Razón social" error={errores.razon_social}>
          {(id) => <input id={id} value={form.razon_social} onChange={cambiar('razon_social')} maxLength={120} />}
        </Campo>
        <Campo etiqueta="CUIT" error={errores.cuit}>
          {(id) => <input id={id} value={form.cuit} onChange={cambiar('cuit')} maxLength={13} placeholder="20-12345678-9" />}
        </Campo>
        <Campo etiqueta="Teléfono" error={errores.telefono}>
          {(id) => <input id={id} value={form.telefono} onChange={cambiar('telefono')} maxLength={30} />}
        </Campo>
        <Campo etiqueta="Dirección" error={errores.direccion} className="campo-completo">
          {(id) => <input id={id} value={form.direccion} onChange={cambiar('direccion')} maxLength={160} />}
        </Campo>
        <Campo etiqueta="Ingresos Brutos" error={errores.ingresos_brutos} ayuda="Se imprime en las facturas.">
          {(id) => <input id={id} value={form.ingresos_brutos} onChange={cambiar('ingresos_brutos')} maxLength={30} />}
        </Campo>
        <Campo etiqueta="Inicio de actividades" error={errores.inicio_actividades} ayuda="Se imprime en las facturas.">
          {(id) => <input id={id} value={form.inicio_actividades} onChange={cambiar('inicio_actividades')} maxLength={10} placeholder="DD/MM/AAAA" />}
        </Campo>
        <Campo etiqueta="Mensaje al pie del ticket" error={errores.mensaje_ticket} className="campo-completo">
          {(id) => <input id={id} value={form.mensaje_ticket} onChange={cambiar('mensaje_ticket')} maxLength={160} />}
        </Campo>
        <div className="campo-completo fila-botones">
          <Boton type="submit" icono={Save} cargando={guardando}>
            Guardar datos
          </Boton>
        </div>
      </form>
    </section>
  );
}

function FormularioMetodo({ metodo, onCerrar, onGuardado }) {
  const toast = useToast();
  const [form, setForm] = useState({
    nombre: metodo?.nombre ?? '',
    es_efectivo: metodo ? Boolean(metodo.es_efectivo) : false,
    activo: metodo ? Boolean(metodo.activo) : true,
    orden: metodo?.orden ?? 10,
  });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const guardar = async (evento) => {
    evento.preventDefault();
    if (!form.nombre.trim()) {
      setErrores({ nombre: 'El nombre es obligatorio.' });
      return;
    }
    setGuardando(true);
    try {
      const datos = { ...form, nombre: form.nombre.trim(), orden: Number(form.orden) || 0 };
      if (metodo) await api.put(`/metodos-pago/${metodo.id}`, datos);
      else await api.post('/metodos-pago', datos);
      toast.exito('Método de pago guardado.');
      onGuardado();
    } catch (error) {
      setErrores(error.fields || {});
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      titulo={metodo ? 'Editar método de pago' : 'Nuevo método de pago'}
      ancho="chico"
      onCerrar={onCerrar}
      bloqueado={guardando}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-metodo" cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-metodo" className="formulario" onSubmit={guardar} noValidate>
        <Campo etiqueta="Nombre" error={errores.nombre} requerido>
          {(id) => <input id={id} value={form.nombre} maxLength={40} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej.: Cuenta DNI, QR, Billetera…" />}
        </Campo>
        <Campo etiqueta="Orden en pantalla" error={errores.orden} ayuda="Los números más bajos aparecen primero al cobrar.">
          {(id) => <input id={id} type="number" min="0" max="999" step="1" value={form.orden} onChange={(e) => setForm({ ...form, orden: e.target.value })} />}
        </Campo>
        <label className="casilla">
          <input type="checkbox" checked={form.es_efectivo} onChange={(e) => setForm({ ...form, es_efectivo: e.target.checked })} />
          <span>Es dinero en efectivo (suma al arqueo de caja y permite calcular el vuelto)</span>
        </label>
        <label className="casilla">
          <input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} />
          <span>Activo (disponible al cobrar)</span>
        </label>
      </form>
    </Modal>
  );
}

function MetodosDePago() {
  const toast = useToast();
  const { datos, error, recargar } = useDatos(() => api.get('/metodos-pago'), []);
  const [editando, setEditando] = useState(undefined);
  const [eliminando, setEliminando] = useState(null);
  const [borrando, setBorrando] = useState(false);

  const eliminar = async () => {
    setBorrando(true);
    try {
      await api.delete(`/metodos-pago/${eliminando.id}`);
      toast.exito('Método de pago eliminado.');
      recargar();
    } catch (fallo) {
      toast.error(fallo.message);
    } finally {
      setBorrando(false);
      setEliminando(null);
    }
  };

  return (
    <section className="tarjeta tarjeta-tabla">
      <div className="tarjeta-cabecera">
        <h2>Métodos de pago</h2>
        <Boton variante="secundario" tamano="chico" icono={Plus} onClick={() => setEditando(null)}>
          Agregar
        </Boton>
      </div>
      {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
      {!datos && !error ? <Cargando /> : null}
      {datos ? (
        <div className="tabla-contenedor">
          <table className="tabla">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Tipo</th>
                <th className="num">Orden</th>
                <th>Estado</th>
                <th className="acciones">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {datos.map((m) => (
                <tr key={m.id} className={m.activo ? '' : 'fila-apagada'}>
                  <td>
                    <strong>{m.nombre}</strong>
                  </td>
                  <td>{m.es_efectivo ? 'Efectivo' : 'Electrónico'}</td>
                  <td className="num">{m.orden}</td>
                  <td>
                    <Etiqueta tono={m.activo ? 'exito' : 'neutro'}>{m.activo ? 'Activo' : 'Inactivo'}</Etiqueta>
                  </td>
                  <td className="acciones">
                    <BotonIcono icono={Pencil} titulo={`Editar ${m.nombre}`} onClick={() => setEditando(m)} />
                    <BotonIcono icono={Trash2} titulo={`Eliminar ${m.nombre}`} variante="peligro" onClick={() => setEliminando(m)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {editando !== undefined ? (
        <FormularioMetodo
          metodo={editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={() => {
            setEditando(undefined);
            recargar();
          }}
        />
      ) : null}
      {eliminando ? (
        <Confirmar
          titulo="Eliminar método de pago"
          mensaje={`¿Seguro que querés eliminar "${eliminando.nombre}"? Si ya se usó en alguna venta no se podrá eliminar, pero sí desactivar.`}
          textoConfirmar="Eliminar"
          peligro
          cargando={borrando}
          onConfirmar={eliminar}
          onCancelar={() => setEliminando(null)}
        />
      ) : null}
    </section>
  );
}

export default function Configuracion() {
  return (
    <>
      <Encabezado titulo="Configuración" descripcion="Datos del comercio, métodos de pago, facturación, copias de seguridad y licencia" />
      <DatosDelComercio />
      <MetodosDePago />
      <FacturacionArca />
      <CopiasDeSeguridad />
      <Licencia />
    </>
  );
}
