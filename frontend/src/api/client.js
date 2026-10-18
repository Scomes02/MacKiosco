/**
 * Cliente HTTP de la API. Toda la comunicación con el backend pasa por acá.
 * La sesión viaja en una cookie httpOnly, por eso no se maneja ningún token en JavaScript.
 */

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'ERROR', fields = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

const EVENTO_SESION_VENCIDA = 'kiosco:sesion-vencida';

/** Permite que la aplicación reaccione cuando el servidor informa que la sesión venció. */
export function alVencerSesion(callback) {
  window.addEventListener(EVENTO_SESION_VENCIDA, callback);
  return () => window.removeEventListener(EVENTO_SESION_VENCIDA, callback);
}

function armarQuery(params) {
  if (!params) return '';
  const query = new URLSearchParams();
  for (const [clave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') query.append(clave, valor);
  }
  const texto = query.toString();
  return texto ? `?${texto}` : '';
}

async function pedir(metodo, ruta, { params, body, signal } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`/api${ruta}${armarQuery(params)}`, {
      method: metodo,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('No se pudo conectar con el servidor. Verificá que el sistema esté en funcionamiento.', {
      code: 'SIN_CONEXION',
    });
  }

  let datos = null;
  try {
    datos = await respuesta.json();
  } catch {
    datos = null;
  }

  if (!respuesta.ok) {
    const error = datos?.error || {};
    if (respuesta.status === 401 && !ruta.startsWith('/auth/')) {
      window.dispatchEvent(new Event(EVENTO_SESION_VENCIDA));
    }
    throw new ApiError(error.message || 'Ocurrió un error inesperado. Intentá nuevamente.', {
      status: respuesta.status,
      code: error.code,
      fields: error.fields || null,
    });
  }
  return datos;
}

export const api = {
  get: (ruta, params, opciones) => pedir('GET', ruta, { params, ...opciones }),
  post: (ruta, body = {}) => pedir('POST', ruta, { body }),
  put: (ruta, body = {}) => pedir('PUT', ruta, { body }),
  delete: (ruta) => pedir('DELETE', ruta),
};
