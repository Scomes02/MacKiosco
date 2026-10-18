import { useEffect, useState } from 'react';
import { Lock, Store, User } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Boton } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [ingresando, setIngresando] = useState(false);
  const [nombreComercio, setNombreComercio] = useState('');

  // El nombre del kiosco se configura en cada instalación: se muestra también antes de ingresar.
  useEffect(() => {
    let vigente = true;
    api
      .get('/publico')
      .then((datos) => vigente && setNombreComercio(datos.nombre_comercio || ''))
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  const ingresar = async (evento) => {
    evento.preventDefault();
    if (!usuario.trim() || !password) {
      setError('Ingresá tu usuario y tu contraseña.');
      return;
    }
    setIngresando(true);
    setError('');
    try {
      await login({ usuario: usuario.trim(), password });
    } catch (fallo) {
      setError(fallo.message);
      setIngresando(false);
    }
  };

  return (
    <div className="login">
      <form className="login-tarjeta" onSubmit={ingresar} noValidate>
        <div className="login-marca">
          <span className="login-logo" aria-hidden="true">
            <Store size={28} />
          </span>
          <h1>{nombreComercio || 'MacKiosco'}</h1>
          <p>Ingresá con tu usuario para empezar a trabajar</p>
        </div>

        {error ? (
          <div className="alerta alerta-peligro" role="alert">
            {error}
          </div>
        ) : null}

        <label className="login-campo">
          <span>Usuario</span>
          <div className="input-con-icono">
            <User size={18} aria-hidden="true" />
            <input
              type="text"
              value={usuario}
              onChange={(evento) => setUsuario(evento.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck="false"
              autoFocus
            />
          </div>
        </label>

        <label className="login-campo">
          <span>Contraseña</span>
          <div className="input-con-icono">
            <Lock size={18} aria-hidden="true" />
            <input
              type="password"
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              autoComplete="current-password"
            />
          </div>
        </label>

        <Boton type="submit" tamano="grande" cargando={ingresando} className="btn-bloque">
          Ingresar
        </Boton>
      </form>
    </div>
  );
}
