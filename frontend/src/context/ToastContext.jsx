import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const ICONOS = { exito: CheckCircle2, error: AlertCircle, info: Info };
const DURACION = { exito: 3500, info: 4000, error: 6000 };

/** Avisos breves que aparecen arriba a la derecha y se cierran solos. */
export function ToastProvider({ children }) {
  const [avisos, setAvisos] = useState([]);
  const siguienteId = useRef(1);

  const cerrar = useCallback((id) => {
    setAvisos((lista) => lista.filter((aviso) => aviso.id !== id));
  }, []);

  const mostrar = useCallback(
    (tipo, mensaje) => {
      const id = siguienteId.current++;
      setAvisos((lista) => [...lista.slice(-3), { id, tipo, mensaje }]);
      setTimeout(() => cerrar(id), DURACION[tipo]);
    },
    [cerrar]
  );

  const valor = useMemo(
    () => ({
      exito: (mensaje) => mostrar('exito', mensaje),
      error: (mensaje) => mostrar('error', mensaje),
      info: (mensaje) => mostrar('info', mensaje),
    }),
    [mostrar]
  );

  return (
    <ToastContext.Provider value={valor}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {avisos.map((aviso) => {
          const Icono = ICONOS[aviso.tipo];
          return (
            <div key={aviso.id} className={`toast toast-${aviso.tipo}`}>
              <Icono size={20} aria-hidden="true" />
              <span>{aviso.mensaje}</span>
              <button type="button" className="toast-cerrar" onClick={() => cerrar(aviso.id)} aria-label="Cerrar aviso">
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const contexto = useContext(ToastContext);
  if (!contexto) throw new Error('useToast debe usarse dentro de <ToastProvider>');
  return contexto;
}
