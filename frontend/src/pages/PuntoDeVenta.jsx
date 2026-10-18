import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Minus, Plus, Printer, ScanBarcode, Search, ShoppingCart, Trash2, User, Wallet, X } from 'lucide-react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDatos, useDebounce, useTecla } from '../utils/hooks';
import { aNumero, dinero, letraDeFactura, nombreComprobante, numeroComprobante, numeroVenta } from '../utils/format';
import { Boton, BotonIcono, Campo, Cargando, ErrorCarga, MiniaturaProducto, Modal, Vacio } from '../components/ui';
import { AccionFactura, Ticket } from '../components/VentaDetalle';

const CLAVE_CARRITO = 'kiosco:carrito';
const centavos = (importe) => Math.round(Number(importe) * 100);

function leerCarritoGuardado() {
  try {
    const guardado = JSON.parse(sessionStorage.getItem(CLAVE_CARRITO));
    return Array.isArray(guardado) ? guardado : [];
  } catch {
    return [];
  }
}

/** Billetes "redondos" sugeridos para cobrar en efectivo. */
function sugerenciasDeEfectivo(total) {
  const opciones = new Set();
  for (const multiplo of [1000, 2000, 5000, 10000, 20000]) {
    const valor = Math.ceil(total / multiplo) * multiplo;
    if (valor > total) opciones.add(valor);
  }
  return [...opciones].sort((a, b) => a - b).slice(0, 4);
}

// ------------------------------------------------------------ Selector de cliente
function SelectorCliente({ onElegir, onCerrar }) {
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda, 200);
  const { datos, cargando, error, recargar } = useDatos(() => api.get('/clientes', { q, estado: 'activos' }), [q]);

  return (
    <Modal titulo="Elegir cliente" onCerrar={onCerrar} ancho="chico">
      <div className="input-con-icono">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar por nombre o CUIT/DNI…"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          data-autofocus
        />
      </div>
      <ul className="lista-seleccion">
        <li>
          <button type="button" onClick={() => onElegir(null)}>
            <strong>Consumidor final</strong>
            <small>Venta sin cliente identificado</small>
          </button>
        </li>
        {(datos || []).map((cliente) => (
          <li key={cliente.id}>
            <button type="button" onClick={() => onElegir(cliente)}>
              <strong>{cliente.nombre}</strong>
              <small>{cliente.documento || 'Sin documento'}</small>
            </button>
          </li>
        ))}
      </ul>
      {cargando && !datos ? <Cargando /> : null}
      {error ? <ErrorCarga error={error} onReintentar={recargar} /> : null}
      <p className="nota">
        ¿No está en la lista? Cargalo desde <Link to="/clientes">Clientes</Link>.
      </p>
    </Modal>
  );
}

// ------------------------------------------------------------ Cobro
function Cobro({ total, metodos, cliente, facturacionOperativa, enviando, onConfirmar, onCerrar }) {
  const efectivo = metodos.find((m) => m.es_efectivo) || metodos[0];
  const [metodoId, setMetodoId] = useState(efectivo.id);
  // Comprobante: null = usar el sugerido según el método de pago; si el cajero elige uno, se respeta.
  const [comprobanteElegido, setComprobanteElegido] = useState(null);
  const [recibido, setRecibido] = useState('');
  const [combinado, setCombinado] = useState(false);
  const [montoPrimero, setMontoPrimero] = useState('');
  const [segundoId, setSegundoId] = useState((metodos.find((m) => m.id !== efectivo.id) || efectivo).id);
  const [error, setError] = useState('');

  const metodo = metodos.find((m) => m.id === metodoId);
  const recibidoNumero = aNumero(recibido);
  const vuelto = !combinado && metodo.es_efectivo && recibido !== '' && !Number.isNaN(recibidoNumero)
    ? (centavos(recibidoNumero) - centavos(total)) / 100
    : null;
  const primerMonto = aNumero(montoPrimero);
  const resto = combinado && !Number.isNaN(primerMonto) ? (centavos(total) - centavos(primerMonto)) / 100 : null;

  // Por defecto: efectivo -> recibo interno; cualquier otro medio (o pago combinado) -> factura electrónica.
  const sugerido = facturacionOperativa && (combinado || !metodo.es_efectivo) ? 'FACTURA' : 'RECIBO';
  const comprobante = facturacionOperativa ? comprobanteElegido || sugerido : 'RECIBO';
  const letra = letraDeFactura(cliente);

  const elegirMetodo = (id) => {
    setMetodoId(id);
    setError('');
    if (combinado && id === segundoId) {
      setSegundoId((metodos.find((m) => m.id !== id) || metodo).id);
    }
  };

  const confirmar = (evento) => {
    evento.preventDefault();
    if (combinado) {
      if (Number.isNaN(primerMonto) || primerMonto <= 0 || primerMonto >= total) {
        setError(`Ingresá cuánto se paga con ${metodo.nombre}: debe ser mayor a cero y menor al total.`);
        return;
      }
      if (segundoId === metodoId) {
        setError('Elegí dos métodos de pago distintos.');
        return;
      }
      onConfirmar(
        [
          { metodo_pago_id: metodoId, monto: primerMonto },
          { metodo_pago_id: segundoId, monto: resto },
        ],
        {},
        comprobante
      );
      return;
    }
    if (vuelto !== null && vuelto < 0) {
      setError('El importe recibido es menor al total de la venta.');
      return;
    }
    onConfirmar(
      [{ metodo_pago_id: metodoId, monto: total }],
      vuelto !== null ? { recibido: recibidoNumero, vuelto } : {},
      comprobante
    );
  };

  return (
    <Modal
      titulo="Cobrar venta"
      onCerrar={onCerrar}
      bloqueado={enviando}
      pie={
        <>
          <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
            Volver (Esc)
          </Boton>
          <Boton type="submit" form="form-cobro" variante="exito" tamano="grande" icono={CheckCircle2} cargando={enviando}>
            Confirmar venta
          </Boton>
        </>
      }
    >
      <form id="form-cobro" onSubmit={confirmar} className="cobro" noValidate>
        <div className="cobro-total">
          <span>Total a cobrar</span>
          <strong>{dinero(total)}</strong>
        </div>

        <div>
          <span className="cobro-subtitulo">{combinado ? 'Primer método de pago' : 'Método de pago'}</span>
          <div className="cobro-metodos" role="radiogroup" aria-label="Método de pago">
            {metodos.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={m.id === metodoId}
                className={`cobro-metodo ${m.id === metodoId ? 'elegido' : ''}`}
                onClick={() => elegirMetodo(m.id)}
              >
                {m.nombre}
              </button>
            ))}
          </div>
        </div>

        {!combinado && metodo.es_efectivo ? (
          <div className="cobro-efectivo">
            <Campo etiqueta="Paga con" ayuda="Opcional: ingresalo para calcular el vuelto.">
              {(id) => (
                <input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={recibido}
                  placeholder={String(total)}
                  onChange={(evento) => {
                    setRecibido(evento.target.value);
                    setError('');
                  }}
                  data-autofocus
                />
              )}
            </Campo>
            <div className="cobro-sugerencias">
              <button type="button" onClick={() => setRecibido(String(total))}>
                Justo
              </button>
              {sugerenciasDeEfectivo(total).map((valor) => (
                <button key={valor} type="button" onClick={() => setRecibido(String(valor))}>
                  {dinero(valor)}
                </button>
              ))}
            </div>
            <div className={`cobro-vuelto ${vuelto !== null && vuelto < 0 ? 'negativo' : ''}`}>
              <span>{vuelto !== null && vuelto < 0 ? 'Falta' : 'Vuelto'}</span>
              <strong>{dinero(Math.abs(vuelto ?? 0))}</strong>
            </div>
          </div>
        ) : null}

        {combinado ? (
          <div className="cobro-combinado">
            <Campo etiqueta={`Monto con ${metodo.nombre}`} requerido>
              {(id) => (
                <input
                  id={id}
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={montoPrimero}
                  onChange={(evento) => {
                    setMontoPrimero(evento.target.value);
                    setError('');
                  }}
                  data-autofocus
                />
              )}
            </Campo>
            <Campo etiqueta="El resto se paga con">
              {(id) => (
                <select id={id} value={segundoId} onChange={(evento) => setSegundoId(Number(evento.target.value))}>
                  {metodos
                    .filter((m) => m.id !== metodoId)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.nombre}
                      </option>
                    ))}
                </select>
              )}
            </Campo>
            <div className="cobro-vuelto">
              <span>Resto</span>
              <strong>{dinero(resto !== null && resto > 0 ? resto : 0)}</strong>
            </div>
          </div>
        ) : null}

        {metodos.length > 1 ? (
          <label className="casilla">
            <input
              type="checkbox"
              checked={combinado}
              onChange={(evento) => {
                setCombinado(evento.target.checked);
                setError('');
              }}
            />
            <span>Pago combinado (dos métodos de pago)</span>
          </label>
        ) : null}

        {facturacionOperativa ? (
          <div>
            <span className="cobro-subtitulo">Comprobante</span>
            <div className="segmentado" role="radiogroup" aria-label="Comprobante">
              <button
                type="button"
                role="radio"
                aria-checked={comprobante === 'RECIBO'}
                className={comprobante === 'RECIBO' ? 'elegido' : ''}
                onClick={() => setComprobanteElegido('RECIBO')}
              >
                Recibo
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={comprobante === 'FACTURA'}
                className={comprobante === 'FACTURA' ? 'elegido' : ''}
                onClick={() => setComprobanteElegido('FACTURA')}
              >
                Factura {letra}
              </button>
            </div>
            <p className="nota cobro-nota">
              {comprobante === 'RECIBO'
                ? 'Recibo interno: no se informa a ARCA.'
                : `Factura ${letra} electrónica a ${cliente ? cliente.nombre : 'consumidor final'}: se valida en ARCA al confirmar.`}
            </p>
          </div>
        ) : null}

        {error ? (
          <div className="alerta alerta-peligro" role="alert">
            {error}
          </div>
        ) : null}
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------ Confirmación
function VentaRegistrada({ resultado, onCerrar, onVentaActualizada }) {
  const { venta, recibido, vuelto } = resultado;
  const factura = venta.factura?.estado === 'AUTORIZADO' ? venta.factura : null;
  return (
    <Modal
      titulo="Venta registrada"
      onCerrar={onCerrar}
      ancho="chico"
      pie={
        <>
          <Boton variante="secundario" icono={Printer} onClick={() => window.print()}>
            Imprimir ticket
          </Boton>
          <Boton onClick={onCerrar} data-autofocus>
            Nueva venta
          </Boton>
        </>
      }
    >
      <div className="venta-ok">
        <CheckCircle2 size={44} aria-hidden="true" />
        <strong>{dinero(venta.total)}</strong>
        <span>Venta {numeroVenta(venta.id)} guardada correctamente</span>
        {factura ? (
          <span>
            {nombreComprobante(factura)} N° {numeroComprobante(factura.punto_venta, factura.numero)} autorizada por ARCA
          </span>
        ) : null}
        {vuelto > 0 ? (
          <div className="venta-ok-vuelto">
            <span>Vuelto a entregar</span>
            <strong>{dinero(vuelto)}</strong>
          </div>
        ) : null}
      </div>
      {venta.comprobante === 'FACTURA' ? <AccionFactura venta={venta} onActualizada={onVentaActualizada} /> : null}
      <Ticket venta={venta} recibido={recibido ?? null} vuelto={vuelto ?? null} />
    </Modal>
  );
}

// ------------------------------------------------------------ Caja cerrada
function AbrirCaja({ onAbierta }) {
  const toast = useToast();
  const [monto, setMonto] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const abrir = async (evento) => {
    evento.preventDefault();
    const valor = monto === '' ? 0 : aNumero(monto);
    if (Number.isNaN(valor) || valor < 0) {
      setError('Ingresá un monto válido (puede ser 0).');
      return;
    }
    setEnviando(true);
    try {
      await api.post('/cajas/abrir', { monto_inicial: valor });
      toast.exito('Caja abierta. ¡Ya podés vender!');
      onAbierta();
    } catch (fallo) {
      toast.error(fallo.message);
      onAbierta();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <form className="caja-cerrada" onSubmit={abrir} noValidate>
      <Wallet size={28} aria-hidden="true" />
      <strong>La caja está cerrada</strong>
      <p>Para registrar ventas primero hay que abrir la caja.</p>
      <Campo etiqueta="Efectivo inicial en caja" error={error}>
        {(id) => (
          <input id={id} type="number" inputMode="decimal" min="0" step="0.01" placeholder="0" value={monto} onChange={(evento) => setMonto(evento.target.value)} />
        )}
      </Campo>
      <Boton type="submit" cargando={enviando} className="btn-bloque">
        Abrir caja
      </Boton>
    </form>
  );
}

// ------------------------------------------------------------ Pantalla principal
export default function PuntoDeVenta() {
  const toast = useToast();
  const { comercio } = useAuth();
  const buscador = useRef(null);

  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda.trim(), 200);
  const [categoriaId, setCategoriaId] = useState(null);
  const [carrito, setCarrito] = useState(leerCarritoGuardado);
  const [descuento, setDescuento] = useState('');
  const [cliente, setCliente] = useState(null);
  const [eligiendoCliente, setEligiendoCliente] = useState(false);
  const [cobrando, setCobrando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [vista, setVista] = useState('productos');

  const categorias = useDatos(() => api.get('/categorias', { estado: 'activos' }), []);
  const metodos = useDatos(() => api.get('/metodos-pago', { activos: 1 }), []);
  const caja = useDatos(() => api.get('/cajas/actual'), []);
  const productos = useDatos(() => api.get('/productos/buscar', { q, categoria_id: categoriaId, limit: 80 }), [q, categoriaId]);

  // El carrito sobrevive a un cambio de pantalla o a una recarga accidental.
  useEffect(() => {
    sessionStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
  }, [carrito]);

  // Cuando llegan productos actualizados, se refresca el stock y el precio de lo que ya está en el carrito.
  useEffect(() => {
    if (!productos.datos) return;
    const frescos = new Map(productos.datos.map((p) => [p.id, p]));
    setCarrito((actual) => {
      let cambio = false;
      const nuevo = actual.map((item) => {
        const fresco = frescos.get(item.id);
        if (!fresco || (fresco.stock === item.stock && fresco.precio_venta === item.precio_venta)) return item;
        cambio = true;
        return { ...item, stock: fresco.stock, precio_venta: fresco.precio_venta };
      });
      return cambio ? nuevo : actual;
    });
  }, [productos.datos]);

  const enCarrito = useMemo(() => new Map(carrito.map((item) => [item.id, item.cantidad])), [carrito]);

  const porcentaje = Math.min(100, Math.max(0, aNumero(descuento) || 0));
  const subtotalCentavos = carrito.reduce((suma, item) => suma + centavos(item.precio_venta) * item.cantidad, 0);
  const descuentoCentavos = Math.round((subtotalCentavos * porcentaje) / 100);
  const total = (subtotalCentavos - descuentoCentavos) / 100;
  const unidades = carrito.reduce((suma, item) => suma + item.cantidad, 0);
  const hayExcesos = carrito.some((item) => item.cantidad > item.stock);
  const cajaAbierta = Boolean(caja.datos?.caja);
  const puedeCobrar = carrito.length > 0 && total > 0 && cajaAbierta && !hayExcesos && Boolean(metodos.datos?.length);

  const enfocarBuscador = () => buscador.current?.focus();

  const agregar = (producto) => {
    const actual = enCarrito.get(producto.id) || 0;
    if (producto.stock <= 0) {
      toast.error(`No hay stock de "${producto.nombre}".`);
      return;
    }
    if (actual + 1 > producto.stock) {
      toast.error(`Solo hay ${producto.stock} unidad(es) de "${producto.nombre}".`);
      return;
    }
    setCarrito((lista) =>
      actual
        ? lista.map((item) => (item.id === producto.id ? { ...item, cantidad: item.cantidad + 1, stock: producto.stock } : item))
        : [
            ...lista,
            {
              id: producto.id,
              codigo: producto.codigo,
              nombre: producto.nombre,
              precio_venta: producto.precio_venta,
              stock: producto.stock,
              categoria_icono: producto.categoria_icono,
              categoria_color: producto.categoria_color,
              imagen_url: producto.imagen_url,
              cantidad: 1,
            },
          ]
    );
  };

  const cambiarCantidad = (id, cantidad) => {
    setCarrito((lista) =>
      lista.map((item) => {
        if (item.id !== id) return item;
        const nueva = Math.max(1, Math.min(Math.floor(cantidad) || 1, Math.max(item.stock, 1)));
        return { ...item, cantidad: nueva };
      })
    );
  };

  const quitar = (id) => setCarrito((lista) => lista.filter((item) => item.id !== id));

  const vaciar = () => {
    setCarrito([]);
    setDescuento('');
    setCliente(null);
    enfocarBuscador();
  };

  /** Enter en el buscador: pensado para el lector de códigos de barras. */
  const buscarYAgregar = async (evento) => {
    evento.preventDefault();
    const texto = busqueda.trim();
    if (!texto) return;
    try {
      const encontrados = await api.get('/productos/buscar', { q: texto, limit: 5 });
      const exacto = encontrados.find((p) => p.codigo.toLowerCase() === texto.toLowerCase());
      const elegido = exacto || (encontrados.length === 1 ? encontrados[0] : null);
      if (elegido) {
        agregar(elegido);
        setBusqueda('');
      } else if (!encontrados.length) {
        toast.error(`No se encontró ningún producto con "${texto}".`);
      }
    } catch (fallo) {
      toast.error(fallo.message);
    }
  };

  const abrirCobro = () => {
    if (puedeCobrar && !resultado) setCobrando(true);
  };

  const confirmarVenta = async (pagos, extra, comprobante) => {
    setEnviando(true);
    try {
      const venta = await api.post('/ventas', {
        cliente_id: cliente?.id ?? null,
        descuento_porcentaje: porcentaje,
        comprobante,
        items: carrito.map((item) => ({ producto_id: item.id, cantidad: item.cantidad })),
        pagos,
      });
      setCobrando(false);
      setResultado({ venta, ...extra });
      setCarrito([]);
      setDescuento('');
      setCliente(null);
      setBusqueda('');
      setVista('productos');
      productos.recargar();
    } catch (fallo) {
      toast.error(fallo.message);
      // Si cambió el stock, el precio o el estado de la caja, se refrescan los datos.
      setCobrando(false);
      productos.recargar();
      caja.recargar();
    } finally {
      setEnviando(false);
    }
  };

  const cerrarResultado = () => {
    setResultado(null);
    enfocarBuscador();
  };

  const sinModal = !cobrando && !resultado && !eligiendoCliente;
  useTecla('F2', enfocarBuscador, sinModal);
  useTecla('F9', abrirCobro, sinModal);

  return (
    <div className="pos">
      <div className="pos-pestanas" role="tablist">
        <button type="button" role="tab" aria-selected={vista === 'productos'} className={vista === 'productos' ? 'activa' : ''} onClick={() => setVista('productos')}>
          Productos
        </button>
        <button type="button" role="tab" aria-selected={vista === 'carrito'} className={vista === 'carrito' ? 'activa' : ''} onClick={() => setVista('carrito')}>
          Carrito {unidades ? `(${unidades})` : ''} · {dinero(total)}
        </button>
      </div>

      {/* ---------------- Productos ---------------- */}
      <section className={`pos-productos ${vista === 'productos' ? '' : 'oculto-movil'}`}>
        <form className="pos-buscador" onSubmit={buscarYAgregar} role="search">
          <ScanBarcode size={22} aria-hidden="true" />
          <input
            ref={buscador}
            type="search"
            placeholder="Buscá por nombre o escaneá el código de barras…"
            value={busqueda}
            onChange={(evento) => setBusqueda(evento.target.value)}
            autoFocus
            autoComplete="off"
            aria-label="Buscar producto"
          />
          <kbd>F2</kbd>
        </form>

        <div className="pos-categorias">
          <button type="button" className={categoriaId === null ? 'activa' : ''} onClick={() => setCategoriaId(null)}>
            Todas
          </button>
          {(categorias.datos || []).map((categoria) => (
            <button
              key={categoria.id}
              type="button"
              className={categoriaId === categoria.id ? 'activa' : ''}
              onClick={() => setCategoriaId(categoriaId === categoria.id ? null : categoria.id)}
            >
              <span aria-hidden="true">{categoria.icono}</span> {categoria.nombre}
            </button>
          ))}
        </div>

        <div className="pos-grilla-contenedor">
          {productos.error ? <ErrorCarga error={productos.error} onReintentar={productos.recargar} /> : null}
          {productos.cargando && !productos.datos ? <Cargando texto="Cargando productos…" /> : null}
          {productos.datos && !productos.datos.length ? (
            <Vacio titulo="No se encontraron productos" descripcion="Probá con otro nombre, código o categoría." icono={Search} />
          ) : null}
          <div className="pos-grilla">
            {(productos.datos || []).map((producto) => {
              const cantidad = enCarrito.get(producto.id) || 0;
              const agotado = producto.stock <= 0;
              return (
                <button
                  key={producto.id}
                  type="button"
                  className={`pos-producto ${agotado ? 'agotado' : ''} ${cantidad ? 'en-carrito' : ''}`}
                  onClick={() => agregar(producto)}
                  aria-disabled={agotado}
                  title={agotado ? 'Sin stock' : `Agregar ${producto.nombre}`}
                >
                  {cantidad ? <span className="pos-producto-cantidad">{cantidad}</span> : null}
                  <MiniaturaProducto producto={producto} tamano={44} />
                  <span className="pos-producto-nombre">{producto.nombre}</span>
                  <span className="pos-producto-pie">
                    <strong>{dinero(producto.precio_venta)}</strong>
                    <small className={agotado ? 'texto-peligro' : producto.stock <= producto.stock_minimo ? 'texto-alerta' : ''}>
                      {agotado ? 'Sin stock' : `Stock ${producto.stock}`}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------------- Carrito ---------------- */}
      <aside className={`pos-carrito ${vista === 'carrito' ? '' : 'oculto-movil'}`} aria-label="Carrito de la venta">
        <div className="pos-carrito-cabecera">
          <h2>
            <ShoppingCart size={18} aria-hidden="true" /> Venta actual
          </h2>
          {carrito.length ? (
            <Boton variante="fantasma" tamano="chico" icono={Trash2} onClick={vaciar}>
              Vaciar
            </Boton>
          ) : null}
        </div>

        <button type="button" className="pos-cliente" onClick={() => setEligiendoCliente(true)}>
          <User size={16} aria-hidden="true" />
          <span>{cliente ? cliente.nombre : 'Consumidor final'}</span>
          <small>Cambiar</small>
        </button>

        <div className="pos-items">
          {!carrito.length ? (
            <Vacio titulo="El carrito está vacío" descripcion="Tocá un producto o escaneá su código para agregarlo." icono={ShoppingCart} />
          ) : null}
          {carrito.map((item) => (
            <div key={item.id} className={`pos-item ${item.cantidad > item.stock ? 'con-error' : ''}`}>
              <div className="pos-item-info">
                <span className="pos-item-nombre">{item.nombre}</span>
                <small>
                  {dinero(item.precio_venta)} c/u
                  {item.cantidad > item.stock ? <b className="texto-peligro"> · Solo quedan {item.stock}</b> : null}
                </small>
              </div>
              <div className="pos-item-cantidad">
                <BotonIcono
                  icono={item.cantidad === 1 ? X : Minus}
                  titulo={item.cantidad === 1 ? `Quitar ${item.nombre}` : 'Restar una unidad'}
                  onClick={() => (item.cantidad === 1 ? quitar(item.id) : cambiarCantidad(item.id, item.cantidad - 1))}
                />
                <input
                  type="number"
                  min="1"
                  max={item.stock}
                  value={item.cantidad}
                  onChange={(evento) => cambiarCantidad(item.id, Number(evento.target.value))}
                  onFocus={(evento) => evento.target.select()}
                  aria-label={`Cantidad de ${item.nombre}`}
                />
                <BotonIcono icono={Plus} titulo="Sumar una unidad" disabled={item.cantidad >= item.stock} onClick={() => cambiarCantidad(item.id, item.cantidad + 1)} />
              </div>
              <strong className="pos-item-total">{dinero((centavos(item.precio_venta) * item.cantidad) / 100)}</strong>
              <BotonIcono icono={Trash2} titulo={`Quitar ${item.nombre}`} variante="peligro" onClick={() => quitar(item.id)} />
            </div>
          ))}
        </div>

        <div className="pos-resumen">
          {caja.datos && !cajaAbierta ? (
            <AbrirCaja onAbierta={caja.recargar} />
          ) : (
            <>
              <div className="pos-linea">
                <span>Subtotal · {unidades} {unidades === 1 ? 'unidad' : 'unidades'}</span>
                <span>{dinero(subtotalCentavos / 100)}</span>
              </div>
              <div className="pos-linea">
                <label htmlFor="pos-descuento">Descuento %</label>
                <span className="pos-descuento">
                  <input
                    id="pos-descuento"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="0"
                    value={descuento}
                    onChange={(evento) => setDescuento(evento.target.value)}
                    disabled={!carrito.length}
                  />
                  {descuentoCentavos > 0 ? <span>-{dinero(descuentoCentavos / 100)}</span> : null}
                </span>
              </div>
              <div className="pos-total">
                <span>Total</span>
                <strong>{dinero(total)}</strong>
              </div>
              {hayExcesos ? (
                <div className="alerta alerta-peligro" role="alert">
                  Hay productos con más cantidad que el stock disponible. Corregilos para poder cobrar.
                </div>
              ) : null}
              <Boton variante="exito" tamano="grande" className="btn-bloque" disabled={!puedeCobrar} onClick={abrirCobro}>
                Cobrar <kbd>F9</kbd>
              </Boton>
            </>
          )}
        </div>
      </aside>

      {eligiendoCliente ? (
        <SelectorCliente
          onCerrar={() => setEligiendoCliente(false)}
          onElegir={(elegido) => {
            setCliente(elegido);
            setEligiendoCliente(false);
          }}
        />
      ) : null}
      {cobrando ? (
        <Cobro
          total={total}
          metodos={metodos.datos}
          cliente={cliente}
          facturacionOperativa={comercio.facturacion.operativa}
          enviando={enviando}
          onConfirmar={confirmarVenta}
          onCerrar={() => setCobrando(false)}
        />
      ) : null}
      {resultado ? (
        <VentaRegistrada
          resultado={resultado}
          onCerrar={cerrarResultado}
          onVentaActualizada={(venta) => setResultado((actual) => ({ ...actual, venta }))}
        />
      ) : null}
    </div>
  );
}
