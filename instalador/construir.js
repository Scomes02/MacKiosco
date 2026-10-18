'use strict';

/**
 * Arma el instalador de MacKiosco:  npm run instalador
 *
 *  1. Compila la interfaz (frontend/dist).
 *  2. Prepara la carpeta instalador/paquete con todo lo que va a la PC del local:
 *     la aplicación, Node.js, MySQL y los scripts de instalación.
 *  3. Compila instalador/MacKiosco.iss con Inno Setup.
 *
 * Resultado: instalador/salida/Instalar-MacKiosco.exe  (un solo archivo para llevar al local).
 *
 * Requisitos en la PC donde se arma (no en la del local):
 *  - Inno Setup 6                    https://jrsoftware.org/isinfo.php
 *  - Una carpeta con MySQL 8.0 para Windows (por defecto la de Laragon). Se puede indicar otra
 *    con la variable de entorno MYSQL_ORIGEN (carpeta que contiene "bin" y "share").
 *  - La clave pública de licencias (se crea con: node herramientas/generar-licencia.js --crear-claves)
 */

const fs = require('fs');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const RAIZ = path.join(__dirname, '..');
const PAQUETE = path.join(__dirname, 'paquete');
const SALIDA = path.join(__dirname, 'salida');
const BACKEND = path.join(RAIZ, 'backend');
const FRONTEND = path.join(RAIZ, 'frontend');

const MYSQL_ORIGEN = process.env.MYSQL_ORIGEN || 'C:\\laragon\\bin\\mysql\\mysql-8.0.30-winx64';
const COMPILADORES = [
  process.env.ISCC,
  'C:\\Program Files (x86)\\Inno Setup 6\\ISCC.exe',
  'C:\\Program Files\\Inno Setup 6\\ISCC.exe',
].filter(Boolean);

// Programas de MySQL que necesita el local: el servidor, el cliente (restaurar) y mysqldump (copias).
const EJECUTABLES_MYSQL = ['mysqld.exe', 'mysql.exe', 'mysqldump.exe', 'mysqladmin.exe'];
// Bibliotecas de Visual C++ que usa MySQL: se incluyen para no depender de que la PC las tenga instaladas.
const RUNTIME_VC = ['vcruntime140.dll', 'vcruntime140_1.dll', 'msvcp140.dll', 'msvcp140_1.dll', 'msvcp140_2.dll'];
// Nada de esto puede terminar dentro del instalador.
const PROHIBIDOS = [/(^|[\\/])\.env$/i, /clave-privada/i, /[\\/]licencias[\\/]/i, /[\\/]certs[\\/]/i, /emitidas\.csv$/i, /estado-licencia\.json$/i];

const paso = (texto) => console.log(`\n> ${texto}`);

function copiar(origen, destino, filtro) {
  fs.cpSync(origen, destino, { recursive: true, filter: filtro });
}

function listarArchivos(carpeta) {
  return fs.readdirSync(carpeta, { recursive: true, withFileTypes: true })
    .filter((entrada) => entrada.isFile())
    .map((entrada) => path.join(entrada.parentPath || entrada.path, entrada.name));
}

function megas(bytes) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function main() {
  const version = require(path.join(BACKEND, 'package.json')).version;
  console.log(`=== Instalador de MacKiosco ${version} ===`);

  // ---------- Controles previos
  const compilador = COMPILADORES.find((ruta) => fs.existsSync(ruta));
  if (!compilador) throw new Error('No se encontró Inno Setup 6 (ISCC.exe). Instalalo desde https://jrsoftware.org/isinfo.php');
  if (!fs.existsSync(path.join(MYSQL_ORIGEN, 'bin', 'mysqld.exe'))) {
    throw new Error(`No se encontró MySQL en ${MYSQL_ORIGEN}. Indicá la carpeta con la variable MYSQL_ORIGEN.`);
  }
  const clavePublica = path.join(BACKEND, 'src', 'config', 'licencia-publica.pem');
  if (!fs.existsSync(clavePublica)) {
    throw new Error('Falta la clave pública de licencias. Ejecutá: node herramientas/generar-licencia.js --crear-claves');
  }
  if (!fs.existsSync(path.join(RAIZ, 'licencias', 'clave-privada.pem'))) {
    console.log('  AVISO: no está la clave privada en "licencias/". No vas a poder generar claves para los instaladores que armes desde esta PC.');
  }

  // ---------- 1. Interfaz
  paso('Compilando la interfaz...');
  const compilacion = spawnSync('npm run build', { cwd: FRONTEND, shell: true, stdio: 'inherit' });
  if (compilacion.status !== 0) throw new Error('No se pudo compilar la interfaz.');

  // ---------- 2. Paquete
  paso('Preparando el paquete...');
  fs.rmSync(PAQUETE, { recursive: true, force: true });
  const destinoBackend = path.join(PAQUETE, 'app', 'backend');
  for (const carpeta of ['src', 'scripts', 'database', 'node_modules']) {
    copiar(path.join(BACKEND, carpeta), path.join(destinoBackend, carpeta));
  }
  fs.copyFileSync(path.join(BACKEND, 'package.json'), path.join(destinoBackend, 'package.json'));
  copiar(path.join(FRONTEND, 'dist'), path.join(PAQUETE, 'app', 'frontend', 'dist'));

  // Node.js: el mismo ejecutable con el que se está armando (ya probado con esta versión del sistema).
  fs.mkdirSync(path.join(PAQUETE, 'runtime', 'node'), { recursive: true });
  fs.copyFileSync(process.execPath, path.join(PAQUETE, 'runtime', 'node', 'node.exe'));

  // MySQL: solo lo necesario para funcionar.
  const mysqlBin = path.join(PAQUETE, 'runtime', 'mysql', 'bin');
  fs.mkdirSync(mysqlBin, { recursive: true });
  for (const archivo of fs.readdirSync(path.join(MYSQL_ORIGEN, 'bin'))) {
    const esBiblioteca = archivo.toLowerCase().endsWith('.dll') && !archivo.toLowerCase().includes('-debug');
    if (EJECUTABLES_MYSQL.includes(archivo.toLowerCase()) || esBiblioteca) {
      fs.copyFileSync(path.join(MYSQL_ORIGEN, 'bin', archivo), path.join(mysqlBin, archivo));
    }
  }
  for (const dll of RUNTIME_VC) {
    const origen = path.join(process.env.WINDIR || 'C:\\Windows', 'System32', dll);
    if (fs.existsSync(origen) && !fs.existsSync(path.join(mysqlBin, dll))) fs.copyFileSync(origen, path.join(mysqlBin, dll));
  }
  const share = path.join(MYSQL_ORIGEN, 'share');
  for (const entrada of fs.readdirSync(share, { withFileTypes: true })) {
    // De los idiomas de mensajes alcanza con el inglés (los mensajes al usuario los da MacKiosco).
    if (entrada.isFile() || ['english', 'charsets'].includes(entrada.name)) {
      copiar(path.join(share, entrada.name), path.join(PAQUETE, 'runtime', 'mysql', 'share', entrada.name));
    }
  }

  // Scripts de instalación, herramientas e ícono.
  const programa = path.join(__dirname, 'programa');
  fs.mkdirSync(path.join(PAQUETE, 'instalador'), { recursive: true });
  for (const archivo of ['comun.js', 'configurar.js', 'desinstalar.js', 'servicio.js', 'abrir.vbs']) {
    fs.copyFileSync(path.join(programa, archivo), path.join(PAQUETE, 'instalador', archivo));
  }
  copiar(path.join(programa, 'herramientas'), path.join(PAQUETE, 'herramientas'));
  fs.copyFileSync(path.join(__dirname, 'recursos', 'mackiosco.ico'), path.join(PAQUETE, 'mackiosco.ico'));
  fs.copyFileSync(path.join(__dirname, 'recursos', 'LICENCIAS-DE-TERCEROS.txt'), path.join(PAQUETE, 'LICENCIAS-DE-TERCEROS.txt'));

  // ---------- Control de seguridad: ningún secreto dentro del paquete
  const archivos = listarArchivos(PAQUETE);
  const filtrados = archivos.filter((archivo) => PROHIBIDOS.some((patron) => patron.test(archivo)));
  if (filtrados.length) {
    throw new Error(`El paquete contiene archivos que no deben distribuirse:\n  ${filtrados.join('\n  ')}`);
  }
  const total = archivos.reduce((suma, archivo) => suma + fs.statSync(archivo).size, 0);
  console.log(`  ${archivos.length} archivos, ${megas(total)} sin comprimir.`);

  // ---------- 3. Instalador
  paso('Compilando el instalador (puede tardar un par de minutos)...');
  fs.mkdirSync(SALIDA, { recursive: true });
  execFileSync(compilador, ['/Q', `/DVersionApp=${version}`, path.join(__dirname, 'MacKiosco.iss')], { stdio: 'inherit' });

  const resultado = path.join(SALIDA, 'Instalar-MacKiosco.exe');
  console.log(`\nListo: ${resultado}  (${megas(fs.statSync(resultado).size)})`);
}

try {
  main();
} catch (error) {
  console.error(`\nNo se pudo armar el instalador: ${error.message}\n`);
  process.exit(1);
}
