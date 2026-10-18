import { useCallback, useEffect, useRef, useState } from 'react';

/** Devuelve el valor recién cuando dejó de cambiar durante `demora` ms (para buscar mientras se escribe). */
export function useDebounce(valor, demora = 250) {
  const [estable, setEstable] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setEstable(valor), demora);
    return () => clearTimeout(temporizador);
  }, [valor, demora]);
  return estable;
}

/**
 * Carga datos desde la API y los vuelve a pedir cuando cambian las dependencias.
 * Ignora las respuestas viejas si llegó un pedido más nuevo.
 */
export function useDatos(cargar, dependencias = []) {
  const [estado, setEstado] = useState({ datos: null, cargando: true, error: null });
  const pedidoActual = useRef(0);

  const recargar = useCallback(async () => {
    const pedido = ++pedidoActual.current;
    setEstado((anterior) => ({ ...anterior, cargando: true, error: null }));
    try {
      const datos = await cargar();
      if (pedido === pedidoActual.current) setEstado({ datos, cargando: false, error: null });
    } catch (error) {
      if (pedido === pedidoActual.current) setEstado({ datos: null, cargando: false, error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencias);

  useEffect(() => {
    recargar();
  }, [recargar]);

  return { ...estado, recargar };
}

/** Ejecuta `accion` cuando se presiona la tecla indicada (por ejemplo 'F9'). */
export function useTecla(tecla, accion, activo = true) {
  const accionRef = useRef(accion);
  accionRef.current = accion;
  useEffect(() => {
    if (!activo) return undefined;
    const manejar = (evento) => {
      if (evento.key === tecla) {
        evento.preventDefault();
        accionRef.current(evento);
      }
    };
    window.addEventListener('keydown', manejar);
    return () => window.removeEventListener('keydown', manejar);
  }, [tecla, activo]);
}
