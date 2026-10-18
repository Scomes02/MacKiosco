import { useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useDatos, useDebounce } from '../utils/hooks';
import { Boton, BotonIcono, Campo, Cargando, Confirmar, Encabezado, ErrorCarga, Etiqueta, Modal, Vacio } from './ui';

const ICONOS_SUGERIDOS = ['📦', '🥤', '💧', '🧃', '⚡', '🍺', '🍷', '🍬', '🍫', '🥮', '🍪', '🥨', '🚬', '🛒', '🍦', '🥛', '🥪', '☕', '🧀', '🍞', '🧴', '🧻', '🔋', '🎁', '📰', '🧊', '🧹', '💊', '🎮', '📱'];

function ControlDeCampo({ id, campo, valor, onCambiar }) {
  const comunes = { id, value: valor ?? '', onChange: (evento) => onCambiar(evento.target.value) };
  switch (campo.tipo) {
    case 'area':
      return <textarea {...comunes} rows={2} maxLength={campo.max} />;
    case 'select':
      return (
        <select {...comunes}>
          {campo.opciones.map(([clave, texto]) => (
            <option key={clave} value={clave}>
              {texto}
            </option>
          ))}
        </select>
      );
    case 'color':
      return <input {...comunes} type="color" className="input-color" />;
    case 'icono':
      return (
        <div className="selector-icono" id={id} role="radiogroup" aria-label={campo.etiqueta}>
          {[...new Set([valor, ...ICONOS_SUGERIDOS])].filter(Boolean).map((icono) => (
            <button key={icono} type="button" role="radio" aria-checked={icono === valor} className={icono === valor ? 'elegido' : ''} onClick={() => onCambiar(icono)}>
              {icono}
            </button>
          ))}
        </div>
      );
    default:
      return <input {...comunes} type={campo.tipo === 'email' ? 'email' : 'text'} maxLength={campo.max} placeholder={campo.placeholder} />;
  }
}

function Formulario({ config, item, onCerrar, onGuardado }) {
  const toast = useToast();
  const [form, setForm] = useState(() => {
    const base = { ...config.vacio, activo: true };
    if (!item) return base;
    return Object.fromEntries(Object.keys(base).map((clave) => [clave, clave === 'activo' ? Boolean(item.activo) : item[clave] ?? '']));
  });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const guardar = async (evento) => {
    evento.preventDefault();
    const nuevos = {};
    for (const campo of config.campos) {
      const valor = String(form[campo.nombre] ?? '').trim();
      if (campo.requerido && !valor) nuevos[campo.nombre] = 'Este campo es obligatorio.';
      else if (campo.tipo === 'email' && valor && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) nuevos[campo.nombre] = 'El email no tiene un formato válido.';
    }
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setGuardando(true);
    try {
      if (item) await api.put(`${config.recurso}/${item.id}`, form);
      else await api.post(config.recurso, form);
      toast.exito(item ? 'Cambios guardados.' : `${config.singular} ${config.femenino ? 'creada' : 'creado'} correctamente.`);
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
      titulo={item ? `Editar ${config.singular.toLowerCase()}` : config.textoNuevo}
      onCerrar={onCerrar}
      bloqueado={guardando}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-catalogo" cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-catalogo" className="formulario formulario-2" onSubmit={guardar} noValidate>
        {config.campos.map((campo) => (
          <Campo
            key={campo.nombre}
            etiqueta={campo.etiqueta}
            error={errores[campo.nombre]}
            ayuda={campo.ayuda}
            requerido={campo.requerido}
            className={campo.ancho === 'medio' ? '' : 'campo-completo'}
          >
            {(id) => <ControlDeCampo id={id} campo={campo} valor={form[campo.nombre]} onCambiar={(valor) => setForm({ ...form, [campo.nombre]: valor })} />}
          </Campo>
        ))}
        {item ? (
          <label className="casilla campo-completo">
            <input type="checkbox" checked={form.activo} onChange={(evento) => setForm({ ...form, activo: evento.target.checked })} />
            <span>Activo</span>
          </label>
        ) : null}
      </form>
    </Modal>
  );
}

/**
 * Pantalla genérica de alta, baja y modificación para catálogos simples
 * (categorías, clientes, proveedores). Cada catálogo solo define sus columnas y campos.
 */
export default function CatalogoCrud({ config, puedeEliminar = true }) {
  const toast = useToast();
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState('todos');
  const [editando, setEditando] = useState(undefined); // undefined = cerrado, null = nuevo, objeto = edición
  const [eliminando, setEliminando] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const q = useDebounce(busqueda.trim(), 250);

  const { datos, cargando, error, recargar } = useDatos(() => api.get(config.recurso, { q, estado }), [q, estado]);

  const eliminar = async () => {
    setBorrando(true);
    try {
      await api.delete(`${config.recurso}/${eliminando.id}`);
      toast.exito(`${config.singular} ${config.femenino ? 'eliminada' : 'eliminado'}.`);
      setEliminando(null);
      recargar();
    } catch (fallo) {
      toast.error(fallo.message);
      setEliminando(null);
    } finally {
      setBorrando(false);
    }
  };

  return (
    <>
      <Encabezado titulo={config.titulo} descripcion={config.descripcion}>
        <Boton icono={Plus} onClick={() => setEditando(null)}>
          {config.textoNuevo}
        </Boton>
      </Encabezado>

      <div className="filtros">
        <div className="input-con-icono filtro-busqueda">
          <Search size={18} aria-hidden="true" />
          <input type="search" placeholder={config.placeholderBusqueda} value={busqueda} onChange={(evento) => setBusqueda(evento.target.value)} aria-label="Buscar" />
        </div>
        <label>
          <span>Estado</span>
          <select value={estado} onChange={(evento) => setEstado(evento.target.value)}>
            <option value="todos">Todos</option>
            <option value="activos">Activos</option>
            <option value="inactivos">Inactivos</option>
          </select>
        </label>
      </div>

      <section className="tarjeta tarjeta-tabla">
        {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
        {cargando && !datos ? <Cargando /> : null}
        {datos && !datos.length ? <Vacio titulo="No hay resultados" descripcion="Probá con otra búsqueda o creá un registro nuevo." /> : null}
        {datos?.length ? (
          <div className={`tabla-contenedor ${cargando ? 'actualizando' : ''}`}>
            <table className="tabla">
              <thead>
                <tr>
                  {config.columnas.map((columna) => (
                    <th key={columna.titulo} className={columna.num ? 'num' : ''}>
                      {columna.titulo}
                    </th>
                  ))}
                  <th>Estado</th>
                  <th className="acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((item) => (
                  <tr key={item.id} className={item.activo ? '' : 'fila-apagada'}>
                    {config.columnas.map((columna) => (
                      <td key={columna.titulo} className={columna.num ? 'num' : ''}>
                        {columna.celda(item)}
                      </td>
                    ))}
                    <td>
                      <Etiqueta tono={item.activo ? 'exito' : 'neutro'}>{item.activo ? 'Activo' : 'Inactivo'}</Etiqueta>
                    </td>
                    <td className="acciones">
                      <BotonIcono icono={Pencil} titulo={`Editar ${config.nombreDe(item)}`} onClick={() => setEditando(item)} />
                      {puedeEliminar ? (
                        <BotonIcono icono={Trash2} titulo={`Eliminar ${config.nombreDe(item)}`} variante="peligro" onClick={() => setEliminando(item)} />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {editando !== undefined ? (
        <Formulario
          config={config}
          item={editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={() => {
            setEditando(undefined);
            recargar();
          }}
        />
      ) : null}

      {eliminando ? (
        <Confirmar
          titulo={`Eliminar ${config.singular.toLowerCase()}`}
          mensaje={`¿Seguro que querés eliminar "${config.nombreDe(eliminando)}"? Esta acción no se puede deshacer.`}
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
