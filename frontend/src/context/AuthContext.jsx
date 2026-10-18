import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, alVencerSesion } from '../api/client';

const AuthContext = createContext(null);

const COMERCIO_POR_DEFECTO = {
  nombre_comercio: 'MacKiosco',
  direccion: '',
  telefono: '',
  cuit: '',
  razon_social: '',
  mensaje_ticket: '',
  ingresos_brutos: '',
  inicio_actividades: '',
  facturacion: { operativa: false, ambiente: 'HOMOLOGACION' },
};

/**
 * Mantiene la sesión del usuario, los datos del comercio (nombre, dirección, etc. que se usan
 * en el encabezado y en los tickets) y el estado de la licencia de uso.
 */
export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [comercio, setComercio] = useState(COMERCIO_POR_DEFECTO);
  const [licencia, setLicencia] = useState(null);
  const [verificando, setVerificando] = useState(true);

  const cargarComercio = useCallback(async () => {
    try {
      setComercio({ ...COMERCIO_POR_DEFECTO, ...(await api.get('/configuracion')) });
    } catch {
      // Si falla se mantienen los valores por defecto: no impide usar el sistema.
    }
  }, []);

  const cargarLicencia = useCallback(async () => {
    try {
      setLicencia(await api.get('/licencia'));
    } catch {
      setLicencia(null);
    }
  }, []);

  const cargarDatosDelLocal = useCallback(() => Promise.all([cargarComercio(), cargarLicencia()]), [cargarComercio, cargarLicencia]);

  // Al abrir la aplicación se consulta si ya hay una sesión iniciada.
  useEffect(() => {
    let vigente = true;
    (async () => {
      try {
        const { usuario: actual } = await api.get('/auth/yo');
        if (!vigente) return;
        setUsuario(actual);
        await cargarDatosDelLocal();
      } catch {
        if (vigente) setUsuario(null);
      } finally {
        if (vigente) setVerificando(false);
      }
    })();
    return () => {
      vigente = false;
    };
  }, [cargarDatosDelLocal]);

  useEffect(() => alVencerSesion(() => setUsuario(null)), []);

  const login = useCallback(
    async (credenciales) => {
      const { usuario: actual } = await api.post('/auth/login', credenciales);
      setUsuario(actual);
      await cargarDatosDelLocal();
      return actual;
    },
    [cargarDatosDelLocal]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUsuario(null);
    }
  }, []);

  const valor = useMemo(
    () => ({
      usuario,
      comercio,
      licencia,
      verificando,
      esAdmin: usuario?.rol === 'ADMIN',
      login,
      logout,
      setComercio,
      setLicencia,
      recargarComercio: cargarComercio,
    }),
    [usuario, comercio, licencia, verificando, login, logout, cargarComercio]
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return contexto;
}
