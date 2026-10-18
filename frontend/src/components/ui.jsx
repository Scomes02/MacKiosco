import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Inbox, Loader2, X } from 'lucide-react';

/**
 * Componentes de interfaz reutilizables: botones, ventanas modales, campos de formulario,
 * paginación, estados vacíos, etc.
 */

export function Boton({ variante = 'primario', tamano, icono: Icono, cargando = false, children, className = '', ...props }) {
  const clases = ['btn', `btn-${variante}`, tamano ? `btn-${tamano}` : '', className].filter(Boolean).join(' ');
  return (
    <button type="button" {...props} className={clases} disabled={cargando || props.disabled}>
      {cargando ? <Loader2 size={18} className="girar" aria-hidden="true" /> : Icono ? <Icono size={18} aria-hidden="true" /> : null}
      {children ? <span>{children}</span> : null}
    </button>
  );
}

export function BotonIcono({ icono: Icono, titulo, variante = '', ...props }) {
  return (
    <button type="button" className={`btn-icono ${variante}`} title={titulo} aria-label={titulo} {...props}>
      <Icono size={18} aria-hidden="true" />
    </button>
  );
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="estado-cargando" role="status">
      <Loader2 size={22} className="girar" aria-hidden="true" />
      <span>{texto}</span>
    </div>
  );
}

export function Vacio({ titulo = 'No hay datos para mostrar', descripcion, icono: Icono = Inbox, children }) {
  return (
    <div className="estado-vacio">
      <Icono size={36} aria-hidden="true" />
      <strong>{titulo}</strong>
      {descripcion ? <p>{descripcion}</p> : null}
      {children}
    </div>
  );
}

export function ErrorCarga({ error, onReintentar }) {
  return (
    <div className="estado-vacio estado-error" role="alert">
      <AlertTriangle size={36} aria-hidden="true" />
      <strong>No se pudieron cargar los datos</strong>
      <p>{error?.message || 'Ocurrió un error inesperado.'}</p>
      {onReintentar ? (
        <Boton variante="secundario" onClick={onReintentar}>
          Reintentar
        </Boton>
      ) : null}
    </div>
  );
}

export function Etiqueta({ tono = 'neutro', children }) {
  return <span className={`etiqueta etiqueta-${tono}`}>{children}</span>;
}

/** Encabezado de cada pantalla: título, descripción y acciones principales. */
export function Encabezado({ titulo, descripcion, children }) {
  return (
    <header className="encabezado">
      <div>
        <h1>{titulo}</h1>
        {descripcion ? <p>{descripcion}</p> : null}
      </div>
      {children ? <div className="encabezado-acciones">{children}</div> : null}
    </header>
  );
}

/**
 * Ventana modal accesible: se cierra con Escape o haciendo clic afuera,
 * y lleva el foco al primer campo al abrirse.
 */
export function Modal({ titulo, onCerrar, children, pie, ancho = 'medio', bloqueado = false }) {
  const idTitulo = useId();
  const contenedor = useRef(null);

  useEffect(() => {
    const manejarTecla = (evento) => {
      if (evento.key === 'Escape' && !bloqueado) {
        evento.stopPropagation();
        onCerrar();
      }
    };
    document.addEventListener('keydown', manejarTecla);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', manejarTecla);
      document.body.style.overflow = overflowAnterior;
    };
  }, [onCerrar, bloqueado]);

  useEffect(() => {
    const primero = contenedor.current?.querySelector(
      '[data-autofocus], .modal-cuerpo input:not([disabled]), .modal-cuerpo select, .modal-cuerpo textarea'
    );
    (primero || contenedor.current)?.focus();
  }, []);

  return (
    <div
      className="modal-fondo"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget && !bloqueado) onCerrar();
      }}
    >
      <div className={`modal modal-${ancho}`} role="dialog" aria-modal="true" aria-labelledby={idTitulo} ref={contenedor} tabIndex={-1}>
        <div className="modal-cabecera">
          <h2 id={idTitulo}>{titulo}</h2>
          <BotonIcono icono={X} titulo="Cerrar" onClick={onCerrar} disabled={bloqueado} />
        </div>
        <div className="modal-cuerpo">{children}</div>
        {pie ? <div className="modal-pie">{pie}</div> : null}
      </div>
    </div>
  );
}

/** Diálogo de confirmación para acciones que no se pueden deshacer. */
export function Confirmar({ titulo, mensaje, textoConfirmar = 'Confirmar', peligro = false, cargando = false, onConfirmar, onCancelar, children }) {
  return (
    <Modal
      titulo={titulo}
      onCerrar={onCancelar}
      ancho="chico"
      bloqueado={cargando}
      pie={
        <>
          <Boton variante="secundario" onClick={onCancelar} disabled={cargando}>
            Cancelar
          </Boton>
          <Boton variante={peligro ? 'peligro' : 'primario'} onClick={onConfirmar} cargando={cargando} data-autofocus>
            {textoConfirmar}
          </Boton>
        </>
      }
    >
      <p className="texto-confirmacion">{mensaje}</p>
      {children}
    </Modal>
  );
}

/** Campo de formulario con etiqueta, ayuda y mensaje de error. */
export function Campo({ etiqueta, error, ayuda, requerido = false, children, className = '' }) {
  const id = useId();
  return (
    <div className={`campo ${error ? 'campo-con-error' : ''} ${className}`}>
      <label htmlFor={id}>
        {etiqueta}
        {requerido ? <span className="campo-requerido" aria-hidden="true"> *</span> : null}
      </label>
      {typeof children === 'function' ? children(id) : children}
      {error ? (
        <span className="campo-error" role="alert">
          {error}
        </span>
      ) : ayuda ? (
        <span className="campo-ayuda">{ayuda}</span>
      ) : null}
    </div>
  );
}

export function Paginacion({ page, pages, total, onCambiar, etiqueta = 'resultados' }) {
  if (!total) return null;
  return (
    <div className="paginacion">
      <span>
        {total} {etiqueta} · página {page} de {pages}
      </span>
      <div className="paginacion-botones">
        <BotonIcono icono={ChevronLeft} titulo="Página anterior" disabled={page <= 1} onClick={() => onCambiar(page - 1)} />
        <BotonIcono icono={ChevronRight} titulo="Página siguiente" disabled={page >= pages} onClick={() => onCambiar(page + 1)} />
      </div>
    </div>
  );
}

/** Imagen del producto; si no tiene (o falla la carga) muestra el ícono y color de su categoría. */
export function MiniaturaProducto({ producto, tamano = 40 }) {
  const estilo = { width: tamano, height: tamano, fontSize: tamano * 0.5, '--color-categoria': producto.categoria_color || '#6366f1' };
  return (
    <span className="miniatura" style={estilo} aria-hidden="true">
      <span>{producto.categoria_icono || '📦'}</span>
      {producto.imagen_url ? (
        <img
          src={producto.imagen_url}
          alt=""
          loading="lazy"
          onError={(evento) => {
            evento.currentTarget.style.display = 'none';
          }}
        />
      ) : null}
    </span>
  );
}

/** Indicador de stock con color y texto (nunca solo color). */
export function EstadoStock({ stock, minimo }) {
  if (stock <= 0) return <Etiqueta tono="peligro">Sin stock</Etiqueta>;
  if (stock <= minimo) return <Etiqueta tono="alerta">Stock bajo · {stock}</Etiqueta>;
  return <Etiqueta tono="exito">{stock} u.</Etiqueta>;
}
