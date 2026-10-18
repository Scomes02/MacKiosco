import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Boxes,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  Tags,
  Truck,
  UserCog,
  Users,
  Wallet,
  PackagePlus,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../api/client';
import { Boton, Campo, Modal } from './ui';
import { AvisoLicencia } from './Sistema';

const MENU = [
  {
    titulo: 'Operación',
    items: [
      { a: '/', texto: 'Inicio', icono: LayoutDashboard, soloAdmin: true },
      { a: '/vender', texto: 'Vender', icono: ShoppingCart },
      { a: '/ventas', texto: 'Ventas', icono: Receipt },
      { a: '/caja', texto: 'Caja', icono: Wallet },
      { a: '/clientes', texto: 'Clientes', icono: Users },
    ],
  },
  {
    titulo: 'Mercadería',
    items: [
      { a: '/productos', texto: 'Productos', icono: Package },
      { a: '/categorias', texto: 'Categorías', icono: Tags, soloAdmin: true },
      { a: '/inventario', texto: 'Inventario', icono: Boxes, soloAdmin: true },
      { a: '/compras', texto: 'Compras', icono: PackagePlus, soloAdmin: true },
      { a: '/proveedores', texto: 'Proveedores', icono: Truck, soloAdmin: true },
    ],
  },
  {
    titulo: 'Administración',
    items: [
      { a: '/reportes', texto: 'Reportes', icono: BarChart3, soloAdmin: true },
      { a: '/usuarios', texto: 'Usuarios', icono: UserCog, soloAdmin: true },
      { a: '/configuracion', texto: 'Configuración', icono: Settings, soloAdmin: true },
    ],
  },
];

function CambiarPassword({ onCerrar }) {
  const toast = useToast();
  const [form, setForm] = useState({ actual: '', nueva: '', repetir: '' });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  const cambiar = (campo) => (evento) => setForm({ ...form, [campo]: evento.target.value });

  const guardar = async (evento) => {
    evento.preventDefault();
    const nuevos = {};
    if (!form.actual) nuevos.actual = 'Ingresá tu contraseña actual.';
    if (form.nueva.length < 6) nuevos.nueva = 'La contraseña debe tener al menos 6 caracteres.';
    if (form.nueva !== form.repetir) nuevos.repetir = 'Las contraseñas no coinciden.';
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;

    setGuardando(true);
    try {
      await api.put('/auth/password', { actual: form.actual, nueva: form.nueva });
      toast.exito('Contraseña actualizada.');
      onCerrar();
    } catch (error) {
      setErrores(error.fields || {});
      toast.error(error.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Modal
      titulo="Cambiar mi contraseña"
      ancho="chico"
      onCerrar={onCerrar}
      bloqueado={guardando}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-password" cargando={guardando}>
            Guardar
          </Boton>
        </>
      }
    >
      <form id="form-password" onSubmit={guardar} className="formulario" noValidate>
        <Campo etiqueta="Contraseña actual" error={errores.actual} requerido>
          {(id) => <input id={id} type="password" autoComplete="current-password" value={form.actual} onChange={cambiar('actual')} />}
        </Campo>
        <Campo etiqueta="Nueva contraseña" error={errores.nueva} ayuda="Mínimo 6 caracteres." requerido>
          {(id) => <input id={id} type="password" autoComplete="new-password" value={form.nueva} onChange={cambiar('nueva')} />}
        </Campo>
        <Campo etiqueta="Repetir nueva contraseña" error={errores.repetir} requerido>
          {(id) => <input id={id} type="password" autoComplete="new-password" value={form.repetir} onChange={cambiar('repetir')} />}
        </Campo>
      </form>
    </Modal>
  );
}

export default function Layout({ children }) {
  const { usuario, comercio, esAdmin, logout } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [cambiandoPassword, setCambiandoPassword] = useState(false);
  const ubicacion = useLocation();

  // En pantallas chicas el menú se cierra al navegar.
  useEffect(() => setMenuAbierto(false), [ubicacion.pathname]);

  const iniciales = usuario.nombre
    .split(' ')
    .map((parte) => parte[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="app">
      <aside className={`lateral ${menuAbierto ? 'abierto' : ''}`}>
        <div className="lateral-marca">
          <span className="lateral-logo" aria-hidden="true">
            <Store size={20} />
          </span>
          <div>
            <strong>{comercio.nombre_comercio}</strong>
            <small>Sistema de gestión</small>
          </div>
          <button type="button" className="lateral-cerrar" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú">
            <X size={20} />
          </button>
        </div>

        <nav className="lateral-nav" aria-label="Menú principal">
          {MENU.map((grupo) => {
            const items = grupo.items.filter((item) => esAdmin || !item.soloAdmin);
            if (!items.length) return null;
            return (
              <div key={grupo.titulo} className="lateral-grupo">
                <span className="lateral-titulo">{grupo.titulo}</span>
                {items.map(({ a, texto, icono: Icono }) => (
                  <NavLink key={a} to={a} end={a === '/'} className={({ isActive }) => `lateral-enlace ${isActive ? 'activo' : ''}`}>
                    <Icono size={18} aria-hidden="true" />
                    <span>{texto}</span>
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>

        <div className="lateral-usuario">
          <span className="avatar" aria-hidden="true">
            {iniciales}
          </span>
          <div className="lateral-usuario-datos">
            <strong>{usuario.nombre}</strong>
            <small>{usuario.rol === 'ADMIN' ? 'Administrador' : 'Cajero'}</small>
          </div>
          <button type="button" className="lateral-accion" onClick={() => setCambiandoPassword(true)} title="Cambiar mi contraseña" aria-label="Cambiar mi contraseña">
            <KeyRound size={18} />
          </button>
          <button type="button" className="lateral-accion" onClick={logout} title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {menuAbierto ? <div className="lateral-fondo" onClick={() => setMenuAbierto(false)} aria-hidden="true" /> : null}

      <div className="principal">
        <div className="barra-movil">
          <button type="button" className="btn-icono" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú">
            <Menu size={22} />
          </button>
          <strong>{comercio.nombre_comercio}</strong>
        </div>
        <main className="contenido">
          <AvisoLicencia />
          {children}
        </main>
      </div>

      {cambiandoPassword ? <CambiarPassword onCerrar={() => setCambiandoPassword(false)} /> : null}
    </div>
  );
}
