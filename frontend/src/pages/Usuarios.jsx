import { useState } from 'react';
import { KeyRound, Pencil, Plus } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDatos } from '../utils/hooks';
import { fechaHora } from '../utils/format';
import { Boton, BotonIcono, Campo, Cargando, Encabezado, ErrorCarga, Etiqueta, Modal } from '../components/ui';

function FormularioUsuario({ usuario, onCerrar, onGuardado }) {
  const toast = useToast();
  const { usuario: actual } = useAuth();
  const esNuevo = !usuario;
  const esYo = usuario?.id === actual.id;
  const [form, setForm] = useState({
    nombre: usuario?.nombre ?? '',
    usuario: usuario?.usuario ?? '',
    email: usuario?.email ?? '',
    rol: usuario?.rol ?? 'CAJERO',
    activo: usuario ? Boolean(usuario.activo) : true,
    password: '',
  });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (evento) => setForm({ ...form, [campo]: evento.target.value });

  const guardar = async (evento) => {
    evento.preventDefault();
    const nuevos = {};
    if (!form.nombre.trim()) nuevos.nombre = 'El nombre es obligatorio.';
    if (!/^[a-zA-Z0-9._-]{3,30}$/.test(form.usuario.trim())) nuevos.usuario = 'Entre 3 y 30 caracteres: letras, números, punto o guiones.';
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) nuevos.email = 'El email no tiene un formato válido.';
    if (esNuevo && form.password.length < 6) nuevos.password = 'La contraseña debe tener al menos 6 caracteres.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setGuardando(true);
    try {
      const datos = { nombre: form.nombre.trim(), usuario: form.usuario.trim(), email: form.email.trim(), rol: form.rol };
      if (esNuevo) await api.post('/usuarios', { ...datos, password: form.password });
      else await api.put(`/usuarios/${usuario.id}`, { ...datos, activo: form.activo });
      toast.exito(esNuevo ? 'Usuario creado correctamente.' : 'Cambios guardados.');
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
      titulo={esNuevo ? 'Nuevo usuario' : 'Editar usuario'}
      onCerrar={onCerrar}
      bloqueado={guardando}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-usuario" cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-usuario" className="formulario formulario-2" onSubmit={guardar} noValidate>
        <Campo etiqueta="Nombre y apellido" error={errores.nombre} requerido className="campo-completo">
          {(id) => <input id={id} value={form.nombre} onChange={cambiar('nombre')} maxLength={80} />}
        </Campo>
        <Campo etiqueta="Usuario" error={errores.usuario} ayuda="Con este nombre inicia sesión." requerido>
          {(id) => <input id={id} value={form.usuario} onChange={cambiar('usuario')} maxLength={30} autoCapitalize="none" autoComplete="off" />}
        </Campo>
        <Campo etiqueta="Email" error={errores.email}>
          {(id) => <input id={id} type="email" value={form.email} onChange={cambiar('email')} maxLength={120} />}
        </Campo>
        <Campo etiqueta="Rol" error={errores.rol} ayuda={esYo ? 'No podés cambiar tu propio rol.' : 'El cajero vende y maneja la caja; el administrador accede a todo.'} requerido>
          {(id) => (
            <select id={id} value={form.rol} onChange={cambiar('rol')} disabled={esYo}>
              <option value="CAJERO">Cajero</option>
              <option value="ADMIN">Administrador</option>
            </select>
          )}
        </Campo>
        {esNuevo ? (
          <Campo etiqueta="Contraseña" error={errores.password} ayuda="Mínimo 6 caracteres." requerido>
            {(id) => <input id={id} type="password" value={form.password} onChange={cambiar('password')} autoComplete="new-password" maxLength={72} />}
          </Campo>
        ) : (
          <label className="casilla casilla-alineada">
            <input type="checkbox" checked={form.activo} disabled={esYo} onChange={(evento) => setForm({ ...form, activo: evento.target.checked })} />
            <span>Usuario activo (puede iniciar sesión)</span>
          </label>
        )}
      </form>
    </Modal>
  );
}

function RestablecerPassword({ usuario, onCerrar }) {
  const toast = useToast();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const guardar = async (evento) => {
    evento.preventDefault();
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    setGuardando(true);
    try {
      await api.put(`/usuarios/${usuario.id}/password`, { password });
      toast.exito(`Contraseña de ${usuario.nombre} actualizada.`);
      onCerrar();
    } catch (fallo) {
      setError(fallo.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      titulo="Restablecer contraseña"
      ancho="chico"
      onCerrar={onCerrar}
      bloqueado={guardando}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-reset" cargando={guardando}>
            Guardar contraseña
          </Boton>
        </>
      }
    >
      <form id="form-reset" className="formulario" onSubmit={guardar} noValidate>
        <p className="texto-confirmacion">
          Definí una nueva contraseña para <strong>{usuario.nombre}</strong> ({usuario.usuario}).
        </p>
        <Campo etiqueta="Nueva contraseña" error={error} ayuda="Mínimo 6 caracteres." requerido>
          {(id) => <input id={id} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" maxLength={72} />}
        </Campo>
      </form>
    </Modal>
  );
}

export default function Usuarios() {
  const { usuario: actual } = useAuth();
  const { datos, error, recargar } = useDatos(() => api.get('/usuarios'), []);
  const [editando, setEditando] = useState(undefined);
  const [restableciendo, setRestableciendo] = useState(null);

  return (
    <>
      <Encabezado titulo="Usuarios" descripcion="Personas que pueden usar el sistema y sus permisos">
        <Boton icono={Plus} onClick={() => setEditando(null)}>
          Nuevo usuario
        </Boton>
      </Encabezado>

      <section className="tarjeta tarjeta-tabla">
        {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
        {!datos && !error ? <Cargando /> : null}
        {datos ? (
          <div className="tabla-contenedor">
            <table className="tabla">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Último acceso</th>
                  <th>Estado</th>
                  <th className="acciones">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {datos.map((u) => (
                  <tr key={u.id} className={u.activo ? '' : 'fila-apagada'}>
                    <td>
                      <strong>{u.nombre}</strong> {u.id === actual.id ? <Etiqueta tono="info">Vos</Etiqueta> : null}
                      {u.email ? <small className="bloque">{u.email}</small> : null}
                    </td>
                    <td>{u.usuario}</td>
                    <td>{u.rol === 'ADMIN' ? 'Administrador' : 'Cajero'}</td>
                    <td>{u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : 'Nunca'}</td>
                    <td>
                      <Etiqueta tono={u.activo ? 'exito' : 'neutro'}>{u.activo ? 'Activo' : 'Inactivo'}</Etiqueta>
                    </td>
                    <td className="acciones">
                      <BotonIcono icono={KeyRound} titulo={`Restablecer contraseña de ${u.nombre}`} onClick={() => setRestableciendo(u)} />
                      <BotonIcono icono={Pencil} titulo={`Editar ${u.nombre}`} onClick={() => setEditando(u)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      {editando !== undefined ? (
        <FormularioUsuario
          usuario={editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={() => {
            setEditando(undefined);
            recargar();
          }}
        />
      ) : null}
      {restableciendo ? <RestablecerPassword usuario={restableciendo} onCerrar={() => setRestableciendo(null)} /> : null}
    </>
  );
}
