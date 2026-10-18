'use strict';

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const { aFecha } = require('../utils/fechas');
const { codigoDeEquipo, leerLicencia } = require('../utils/licencia-formato');
const configuracionRepo = require('../repositories/configuracion.repository');

/**
 * Licencia de uso por PC, con vencimiento.
 *
 *  PRUEBA      sin clave, durante los primeros 15 días desde la instalación.
 *  ACTIVA      con una clave válida para esta PC y sin vencer (avisa 10 días antes).
 *  GRACIA      prueba o clave vencida hace 5 días o menos: sigue funcionando, con aviso.
 *  BLOQUEADA   solo consulta: se puede entrar, ver, exportar y cargar una clave nueva,
 *              pero no vender ni modificar datos. Nunca se pierde información.
 *  DESARROLLO  en la PC del fabricante (donde está la clave privada) no hay restricciones.
 */

const DIAS_PRUEBA = 15;
const DIAS_GRACIA = 5;
const DIAS_AVISO = 10;
const UN_DIA = 24 * 60 * 60 * 1000;
const UNA_HORA = 60 * 60 * 1000;

const ARCHIVO_CLAVE_PUBLICA = path.join(__dirname, '..', 'config', 'licencia-publica.pem');
const ARCHIVO_CLAVE_PRIVADA = path.join(__dirname, '..', '..', '..', 'licencias', 'clave-privada.pem');
const ARCHIVO_MARCAS = path.join(env.carpetaConfiguracion, 'estado-licencia.json');
const CLAVE_REGISTRO = 'HKLM\\SOFTWARE\\MacKiosco';

const clavePublica = fs.existsSync(ARCHIVO_CLAVE_PUBLICA) ? fs.readFileSync(ARCHIVO_CLAVE_PUBLICA, 'utf8') : null;

// ------------------------------------------------------------ Identidad de la PC
function consultarRegistro(clave, valor) {
  if (process.platform !== 'win32') return null;
  try {
    const salida = execFileSync('reg', ['query', clave, '/v', valor], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });
    const coincidencia = salida.match(new RegExp(`${valor}\\s+REG_\\w+\\s+(.+)`));
    return coincidencia ? coincidencia[1].trim() : null;
  } catch {
    return null;
  }
}

let codigoEnMemoria = null;
/** Código que identifica a esta PC. Se calcula a partir del identificador único de Windows. */
function obtenerCodigoDeEquipo() {
  if (!codigoEnMemoria) {
    const identificador =
      consultarRegistro('HKLM\\SOFTWARE\\Microsoft\\Cryptography', 'MachineGuid') || `${os.hostname()}:${os.platform()}:${os.arch()}`;
    codigoEnMemoria = codigoDeEquipo(identificador);
  }
  return codigoEnMemoria;
}

let desarrolloEnMemoria = null;
/** Verdadero solo donde está la clave privada que corresponde a la clave pública de la aplicación. */
function esEquipoDelFabricante() {
  if (desarrolloEnMemoria === null) {
    desarrolloEnMemoria = false;
    try {
      if (clavePublica && fs.existsSync(ARCHIVO_CLAVE_PRIVADA)) {
        const derivada = crypto.createPublicKey(fs.readFileSync(ARCHIVO_CLAVE_PRIVADA, 'utf8')).export({ type: 'spki', format: 'der' });
        const propia = crypto.createPublicKey(clavePublica).export({ type: 'spki', format: 'der' });
        desarrolloEnMemoria = derivada.equals(propia);
      }
    } catch {
      desarrolloEnMemoria = false;
    }
  }
  return desarrolloEnMemoria;
}

// ------------------------------------------------------------ Marcas de tiempo
// La fecha de instalación y el último uso se guardan en la base, en un archivo y (la instalación)
// en el registro de Windows. Se toma siempre el valor más desfavorable, para que borrar uno solo
// o atrasar el reloj de la PC no extienda la prueba ni la licencia.
function leerArchivoDeMarcas() {
  try {
    return JSON.parse(fs.readFileSync(ARCHIVO_MARCAS, 'utf8'));
  } catch {
    return {};
  }
}

function guardarArchivoDeMarcas(marcas) {
  try {
    fs.mkdirSync(path.dirname(ARCHIVO_MARCAS), { recursive: true });
    fs.writeFileSync(ARCHIVO_MARCAS, JSON.stringify(marcas));
  } catch {
    // Sin permisos de escritura: quedan las marcas de la base.
  }
}

const aMilisegundos = (valor) => {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : null;
};

let instalacionEnRegistro;
async function leerMarcas() {
  if (instalacionEnRegistro === undefined) {
    instalacionEnRegistro = aMilisegundos(consultarRegistro(CLAVE_REGISTRO, 'PrimeraInstalacion'));
  }
  const base = await configuracionRepo.obtenerTodo();
  const archivo = leerArchivoDeMarcas();
  const ahoraReal = Date.now();

  const inicios = [aMilisegundos(base.licencia_inicio), aMilisegundos(archivo.inicio), instalacionEnRegistro].filter(Boolean);
  const usos = [aMilisegundos(base.licencia_ultimo_uso), aMilisegundos(archivo.ultimo_uso)].filter(Boolean);
  const inicio = inicios.length ? Math.min(...inicios) : ahoraReal;
  const ultimoUso = usos.length ? Math.max(...usos) : 0;
  // Si el reloj se atrasó, se sigue contando desde el último momento en que se usó el sistema.
  const ahora = Math.max(ahoraReal, ultimoUso);

  const faltaInicio = aMilisegundos(base.licencia_inicio) !== inicio || aMilisegundos(archivo.inicio) !== inicio;
  if (faltaInicio || ahora - ultimoUso > UNA_HORA) {
    await configuracionRepo.guardar({ licencia_inicio: String(inicio), licencia_ultimo_uso: String(ahora) });
    guardarArchivoDeMarcas({ inicio, ultimo_uso: ahora });
  }
  return { inicio, ahora, clave: base.licencia_clave || '' };
}

// ------------------------------------------------------------ Estado
const finDelDia = (fecha) => new Date(`${fecha}T23:59:59`).getTime();
const diasHasta = (momento, ahora) => Math.ceil((momento - ahora) / UN_DIA);

function calcular({ inicio, ahora, clave }) {
  const equipo = obtenerCodigoDeEquipo();
  const basico = { codigo_equipo: equipo, titular: null, vence: null, dias_restantes: null, aviso: null };

  if (esEquipoDelFabricante()) {
    return { ...basico, estado: 'DESARROLLO', solo_consulta: false };
  }

  const licencia = clave && clavePublica ? leerLicencia(clave, clavePublica) : null;
  const deEstaPc = licencia && licencia.equipo === equipo;

  // El plazo vigente es el de la licencia si hay una válida para esta PC; si no, el de la prueba.
  const limite = deEstaPc ? finDelDia(licencia.vence) : inicio + DIAS_PRUEBA * UN_DIA;
  const dias = diasHasta(limite, ahora);
  const datos = {
    ...basico,
    titular: deEstaPc ? licencia.titular : null,
    vence: aFecha(new Date(limite)),
    dias_restantes: dias,
    con_clave: Boolean(deEstaPc),
  };
  const queVence = deEstaPc ? 'La licencia' : 'El período de prueba';

  if (ahora <= limite) {
    const porVencer = dias <= DIAS_AVISO;
    return {
      ...datos,
      estado: deEstaPc ? 'ACTIVA' : 'PRUEBA',
      solo_consulta: false,
      aviso: deEstaPc
        ? porVencer
          ? `La licencia vence en ${dias} día(s). Pedí la renovación para no interrumpir el servicio.`
          : null
        : `Período de prueba: quedan ${dias} día(s). Pedí tu clave de licencia para seguir usando el sistema.`,
    };
  }

  const finDeGracia = limite + DIAS_GRACIA * UN_DIA;
  if (ahora <= finDeGracia) {
    const diasDeGracia = diasHasta(finDeGracia, ahora);
    return {
      ...datos,
      estado: 'GRACIA',
      solo_consulta: false,
      aviso: `${queVence} venció. El sistema seguirá funcionando ${diasDeGracia} día(s) más; después quedará en modo solo consulta.`,
    };
  }

  return {
    ...datos,
    estado: 'BLOQUEADA',
    solo_consulta: true,
    aviso: `${queVence} venció. El sistema está en modo solo consulta: cargá una clave de licencia para volver a vender.`,
  };
}

// El estado se recalcula como mucho una vez por minuto (se consulta en cada operación de escritura).
let enMemoria = { momento: 0, estado: null };

async function estado({ forzar = false } = {}) {
  if (!forzar && enMemoria.estado && Date.now() - enMemoria.momento < 60 * 1000) return enMemoria.estado;
  const calculado = calcular(await leerMarcas());
  enMemoria = { momento: Date.now(), estado: calculado };
  return calculado;
}

/** Carga una clave de licencia. Solo se acepta si es auténtica, es de esta PC y no está vencida. */
async function activar(claveIngresada) {
  const clave = String(claveIngresada || '').replace(/\s+/g, '');
  const licencia = clavePublica ? leerLicencia(clave, clavePublica) : null;
  if (!licencia) {
    throw AppError.badRequest('La clave de licencia no es válida. Copiala completa, tal como te la enviaron.');
  }
  const equipo = obtenerCodigoDeEquipo();
  if (licencia.equipo !== equipo) {
    throw AppError.badRequest(
      `Esta clave fue generada para otra PC (${licencia.equipo}). El código de este equipo es ${equipo}: pedí una clave para este código.`
    );
  }
  const { ahora } = await leerMarcas();
  if (ahora > finDelDia(licencia.vence) + DIAS_GRACIA * UN_DIA) {
    throw AppError.badRequest(`Esta clave venció el ${licencia.vence.split('-').reverse().join('/')}. Pedí una clave nueva.`);
  }
  await configuracionRepo.guardar({ licencia_clave: clave });
  return estado({ forzar: true });
}

module.exports = { estado, activar, obtenerCodigoDeEquipo, DIAS_PRUEBA, DIAS_GRACIA };
