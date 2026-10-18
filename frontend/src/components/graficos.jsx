import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

/**
 * Indicadores y gráficos simples hechos con HTML/CSS (sin librerías externas).
 * Todos usan una única serie y un único color: el valor se lee por el largo de la barra,
 * con el número siempre visible o disponible al pasar el mouse.
 */

/** Tarjeta de indicador: un número principal con contexto. */
export function Indicador({ titulo, valor, detalle, variacion, etiquetaVariacion, icono: Icono, tono = 'primario' }) {
  const tieneVariacion = variacion !== null && variacion !== undefined;
  const sube = variacion >= 0;
  return (
    <div className="indicador">
      <div className="indicador-cabecera">
        <span>{titulo}</span>
        {Icono ? (
          <span className={`indicador-icono tono-${tono}`} aria-hidden="true">
            <Icono size={18} />
          </span>
        ) : null}
      </div>
      <strong className="indicador-valor">{valor}</strong>
      <div className="indicador-pie">
        {tieneVariacion ? (
          <span className={`variacion ${sube ? 'variacion-sube' : 'variacion-baja'}`}>
            {sube ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
            {sube ? '+' : ''}
            {String(variacion).replace('.', ',')}%
          </span>
        ) : null}
        <span>{tieneVariacion ? etiquetaVariacion : detalle}</span>
      </div>
    </div>
  );
}

function pasosDelEje(maximo) {
  if (maximo <= 0) return { tope: 1, pasos: [0, 1] };
  const magnitud = 10 ** Math.floor(Math.log10(maximo));
  const candidato = [1, 2, 2.5, 5, 10].map((m) => m * magnitud).find((paso) => maximo / paso <= 4) || magnitud * 10;
  const tope = Math.ceil(maximo / candidato) * candidato;
  const pasos = [];
  for (let v = 0; v <= tope + 1e-9; v += candidato) pasos.push(v);
  return { tope, pasos };
}

/**
 * Gráfico de barras verticales de una sola serie.
 * datos: [{ etiqueta, valor, detalle }]
 */
export function GraficoBarras({ datos, formatoValor, formatoEje = formatoValor, alto = 220, descripcion }) {
  const [activo, setActivo] = useState(null);
  const maximo = Math.max(0, ...datos.map((d) => d.valor));
  const { tope, pasos } = pasosDelEje(maximo);
  const cadaCuanto = Math.ceil(datos.length / 8);

  return (
    <figure className="grafico" aria-label={descripcion}>
      <div className="grafico-area" style={{ height: alto }}>
        <div className="grafico-eje" aria-hidden="true">
          {[...pasos].reverse().map((paso) => (
            <span key={paso}>{formatoEje(paso)}</span>
          ))}
        </div>
        <div className="grafico-lienzo">
          <div className="grafico-grilla" aria-hidden="true">
            {pasos.map((paso) => (
              <i key={paso} />
            ))}
          </div>
          <div className="grafico-barras" onMouseLeave={() => setActivo(null)}>
            {datos.map((dato, indice) => (
              <div
                key={dato.etiqueta}
                className={`grafico-columna ${activo === indice ? 'activa' : ''}`}
                onMouseEnter={() => setActivo(indice)}
                onFocus={() => setActivo(indice)}
                onBlur={() => setActivo(null)}
                tabIndex={0}
                aria-label={`${dato.etiqueta}: ${formatoValor(dato.valor)}${dato.detalle ? `, ${dato.detalle}` : ''}`}
              >
                <div className="grafico-barra" style={{ height: `${(dato.valor / tope) * 100}%` }} />
                {activo === indice ? (
                  <div className={`grafico-tooltip ${indice > datos.length / 2 ? 'a-la-izquierda' : ''}`} role="tooltip">
                    <span>{dato.etiqueta}</span>
                    <strong>{formatoValor(dato.valor)}</strong>
                    {dato.detalle ? <span>{dato.detalle}</span> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="grafico-etiquetas" aria-hidden="true">
        {datos.map((dato, indice) => (
          <span key={dato.etiqueta}>{indice % cadaCuanto === 0 ? dato.etiquetaCorta || dato.etiqueta : ''}</span>
        ))}
      </div>
    </figure>
  );
}

/**
 * Lista de barras horizontales: ideal para rankings y participaciones.
 * datos: [{ clave, etiqueta, valor, detalle, prefijo }]
 */
export function ListaBarras({ datos, formatoValor, mostrarPorcentaje = false }) {
  const maximo = Math.max(1, ...datos.map((d) => d.valor));
  const total = datos.reduce((suma, d) => suma + d.valor, 0) || 1;
  return (
    <ul className="lista-barras">
      {datos.map((dato) => (
        <li key={dato.clave ?? dato.etiqueta}>
          <div className="lista-barras-texto">
            <span className="lista-barras-etiqueta">
              {dato.prefijo ? <span aria-hidden="true">{dato.prefijo} </span> : null}
              {dato.etiqueta}
            </span>
            <span className="lista-barras-valor">
              <strong>{formatoValor(dato.valor)}</strong>
              {mostrarPorcentaje ? <small>{Math.round((dato.valor / total) * 100)}%</small> : null}
              {dato.detalle ? <small>{dato.detalle}</small> : null}
            </span>
          </div>
          <div className="lista-barras-pista" aria-hidden="true">
            <div style={{ width: `${Math.max(1.5, (dato.valor / maximo) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
