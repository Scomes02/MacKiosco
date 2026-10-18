'use strict';

/**
 * Configura MacKiosco en la PC del local. Lo ejecuta el instalador (con permisos de administrador)
 * después de copiar los archivos, tanto en una instalación nueva como en una actualización.
 *
 *   node configurar.js --respuestas "C:\...\respuestas.json"
 *
 * Instalación nueva: crea la base de datos propia (MySQL incluido, en un puerto propio), genera las
 * claves de esta PC, carga los datos iniciales, registra el arranque automático y abre el firewall
 * si se pidió. Actualización: conserva TODO (datos, claves, configuración) y solo actualiza la
 * estructura de la base si la nueva versión lo necesita.
 *
 * Opción solo para pruebas: --sin-servicios (no registra servicios ni tareas de Windows; inicia
 * MySQL y la aplicación como procesos comunes, sin necesitar permisos de administrador).
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const comun = require('./comun');

const { rutas, registrar, ejecutar, intentar } = comun;
const SIN_SERVICIOS = process.argv.includes('--sin-servicios');
const SID_SISTEMA = '*S-1-5-18';
const SID_ADMINISTRADORES = '*S-1-5-32-544';

const aleatorio = (bytes) => crypto.randomBytes(bytes).toString('hex');
const conBarras = (ruta) => ruta.replace(/\\/g, '/');

function leerRespuestas() {
  const indice = process.argv.indexOf('--respuestas');
  const archivo = indice >= 0 ? process.argv[indice + 1] : null;
  if (!archivo || !fs.existsSync(archivo)) return {};
  return JSON.parse(fs.readFileSync(archivo, 'utf8').replace(/^\uFEFF/, ''));
}

/** Datos de la instalación de esta PC (puertos, clave de root de MySQL y si terminó bien). */
function leerInstalacion() {
  try {
    return JSON.parse(fs.readFileSync(rutas.archivoInstalacion, 'utf8'));
  } catch {
    return {};
  }
}

function guardarInstalacion(datos) {
  fs.mkdirSync(rutas.config, { recursive: true });
  fs.writeFileSync(rutas.archivoInstalacion, JSON.stringify(datos, null, 2));
}

// ------------------------------------------------------------ MySQL
function escribirMyIni(puerto) {
  fs.mkdirSync(path.dirname(rutas.mysqlIni), { recursive: true });
  fs.writeFileSync(
    rutas.mysqlIni,
    [
      '# Configuración del MySQL incluido con MacKiosco. Solo acepta conexiones desde esta misma PC.',
      '[mysqld]',
      `basedir="${conBarras(rutas.mysqlBase)}"`,
      `datadir="${conBarras(rutas.mysqlDatos)}"`,
      `port=${puerto}`,
      'bind-address=127.0.0.1',
      'mysqlx=0',
      'character-set-server=utf8mb4',
      'collation-server=utf8mb4_unicode_ci',
      'default_authentication_plugin=mysql_native_password',
      'skip-log-bin',
      'innodb_buffer_pool_size=128M',
      'max_connections=60',
      `log-error="${conBarras(path.join(rutas.logs, 'mysql.err'))}"`,
      '',
    ].join('\r\n')
  );
}

function servicioExiste() {
  try {
    ejecutar('sc', ['query', comun.SERVICIO_BASE]);
    return true;
  } catch {
    return false;
  }
}

async function iniciarMysql(puerto) {
  if (await comun.puertoAbierto(puerto)) return;

  if (SIN_SERVICIOS) {
    const proceso = comun.spawn(rutas.mysqld, [`--defaults-file=${rutas.mysqlIni}`], { detached: true, stdio: 'ignore', windowsHide: true });
    proceso.unref();
  } else {
    if (!servicioExiste()) {
      ejecutar(rutas.mysqld, ['--install', comun.SERVICIO_BASE, `--defaults-file=${rutas.mysqlIni}`]);
      ejecutar('sc', ['description', comun.SERVICIO_BASE, 'Base de datos de MacKiosco']);
    }
    intentar('sc', ['config', comun.SERVICIO_BASE, 'start=', 'auto']);
    intentar('sc', ['start', comun.SERVICIO_BASE]);
  }
  await comun.esperarPuerto(puerto, 90, 'La base de datos');
}

/** Crea la base de datos de esta PC: carpeta de datos, servicio, contraseñas propias y usuario de la aplicación. */
async function crearMysql(puerto, claves) {
  registrar('Creando la base de datos de este equipo...');
  fs.mkdirSync(rutas.logs, { recursive: true });
  escribirMyIni(puerto);

  if (!fs.existsSync(path.join(rutas.mysqlDatos, 'mysql'))) {
    fs.rmSync(rutas.mysqlDatos, { recursive: true, force: true });
    ejecutar(rutas.mysqld, [`--defaults-file=${rutas.mysqlIni}`, '--initialize-insecure']);
  }
  await iniciarMysql(puerto);

  // Recién creada, la base tiene un usuario root sin contraseña: se le pone una propia de esta PC
  // y se crea el usuario "kiosco", que solo puede usar la base del sistema.
  const mysql = require(path.join(rutas.backend, 'node_modules', 'mysql2', 'promise'));
  const conectar = (password) => mysql.createConnection({ host: '127.0.0.1', port: puerto, user: 'root', password, multipleStatements: true });
  let conn;
  try {
    conn = await conectar('');
  } catch (error) {
    // Si una instalación anterior quedó a medias, root ya tiene la contraseña de esta PC.
    if (error.code !== 'ER_ACCESS_DENIED_ERROR') throw error;
    conn = await conectar(claves.root);
  }
  try {
    for (const host of ['localhost', '127.0.0.1']) {
      await conn.query(`CREATE USER IF NOT EXISTS 'kiosco'@'${host}' IDENTIFIED WITH mysql_native_password BY ?`, [claves.aplicacion]);
      await conn.query(`ALTER USER 'kiosco'@'${host}' IDENTIFIED WITH mysql_native_password BY ?`, [claves.aplicacion]);
      await conn.query(`GRANT ALL PRIVILEGES ON \`kiosco_db\`.* TO 'kiosco'@'${host}'`);
    }
    await conn.query("ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY ?", [claves.root]);
    await conn.query('FLUSH PRIVILEGES');
  } finally {
    await conn.end();
  }
}

// ------------------------------------------------------------ Configuración de la aplicación
function escribirEnv({ puertoApp, puertoMysql, claveAplicacion, secretoSesion }) {
  fs.mkdirSync(rutas.config, { recursive: true });
  fs.writeFileSync(
    rutas.archivoEnv,
    [
      '# Configuración de MacKiosco en esta PC. Generada por el instalador: no compartir.',
      'NODE_ENV=production',
      `PORT=${puertoApp}`,
      '',
      'DB_HOST=127.0.0.1',
      `DB_PORT=${puertoMysql}`,
      'DB_USER=kiosco',
      `DB_PASSWORD=${claveAplicacion}`,
      'DB_NAME=kiosco_db',
      'DB_ESPERA_SEGUNDOS=120',
      '',
      `JWT_SECRET=${secretoSesion}`,
      'SESSION_HOURS=12',
      '',
      `ARCA_CERTS_DIR=${rutas.certificados}`,
      `BACKUP_DIR=${rutas.copias}`,
      `LOG_DIR=${rutas.logs}`,
      `MYSQLDUMP_PATH=${rutas.mysqldump}`,
      `MYSQL_CLIENT_PATH=${rutas.mysqlCliente}`,
      '',
    ].join('\r\n')
  );
}

/** La carpeta de configuración guarda claves: solo el sistema y los administradores pueden leerla. */
function protegerConfiguracion() {
  if (SIN_SERVICIOS) return;
  for (const carpeta of [rutas.config, rutas.certificados]) {
    fs.mkdirSync(carpeta, { recursive: true });
    intentar('icacls', [carpeta, '/inheritance:r', '/grant:r', `${SID_SISTEMA}:(OI)(CI)F`, `${SID_ADMINISTRADORES}:(OI)(CI)F`]);
  }
}

// ------------------------------------------------------------ Arranque automático
function definicionDeTarea() {
  const escapar = (texto) => texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Servidor de MacKiosco. Se inicia solo al encender la computadora.</Description>
  </RegistrationInfo>
  <Triggers>
    <BootTrigger>
      <Enabled>true</Enabled>
    </BootTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <UserId>S-1-5-18</UserId>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>5</Priority>
    <RestartOnFailure>
      <Interval>PT1M</Interval>
      <Count>999</Count>
    </RestartOnFailure>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${escapar(rutas.node)}</Command>
      <Arguments>"${escapar(rutas.servicio)}"</Arguments>
      <WorkingDirectory>${escapar(rutas.backend)}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`;
}

async function iniciarAplicacion(puertoApp) {
  if (SIN_SERVICIOS) {
    const proceso = comun.spawn(rutas.node, [rutas.servicio], { detached: true, stdio: 'ignore', windowsHide: true, cwd: rutas.backend });
    proceso.unref();
  } else {
    const archivoTarea = path.join(rutas.logs, 'tarea.xml');
    fs.writeFileSync(archivoTarea, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(definicionDeTarea(), 'utf16le')]));
    ejecutar('schtasks', ['/Create', '/TN', comun.TAREA, '/XML', archivoTarea, '/F']);
    fs.rmSync(archivoTarea, { force: true });
    ejecutar('schtasks', ['/Run', '/TN', comun.TAREA]);
  }
  await comun.esperarPuerto(puertoApp, 150, 'El sistema');
}

function abrirFirewall(puertoApp, permitirRed) {
  if (SIN_SERVICIOS) return;
  intentar('netsh', ['advfirewall', 'firewall', 'delete', 'rule', `name=${comun.REGLA_FIREWALL}`]);
  if (!permitirRed) return;
  ejecutar('netsh', [
    'advfirewall', 'firewall', 'add', 'rule',
    `name=${comun.REGLA_FIREWALL}`, 'dir=in', 'action=allow', 'protocol=TCP', `localport=${puertoApp}`, 'profile=private,domain',
    'description=Permite usar MacKiosco desde otras computadoras y celulares de la red del local',
  ]);
}

/** Marca de la primera instalación en esta PC (la usa el control de la licencia de prueba). */
function marcarPrimeraInstalacion() {
  if (SIN_SERVICIOS) return;
  try {
    ejecutar('reg', ['query', comun.CLAVE_REGISTRO, '/v', 'PrimeraInstalacion']);
  } catch {
    intentar('reg', ['add', comun.CLAVE_REGISTRO, '/v', 'PrimeraInstalacion', '/t', 'REG_SZ', '/d', String(Date.now()), '/f']);
  }
}

// ------------------------------------------------------------ Flujos
async function instalar(respuestas) {
  registrar('=== Instalación nueva de MacKiosco ===');
  for (const carpeta of [rutas.datos, rutas.config, rutas.certificados, rutas.copias, rutas.logs]) {
    fs.mkdirSync(carpeta, { recursive: true });
  }

  // Si una instalación anterior quedó a medias, se retoma con los mismos puertos y claves.
  const previa = leerInstalacion();
  const envPrevio = comun.leerEnv(rutas.archivoEnv);
  const puertoMysql = previa.puerto_mysql || (await comun.elegirPuerto(3311));
  const puertoApp = previa.puerto || (await comun.elegirPuerto(3001));
  const claves = { root: previa.mysql_root || aleatorio(16), aplicacion: envPrevio.DB_PASSWORD || aleatorio(16) };
  const datosInstalacion = {
    instalado_en: previa.instalado_en || new Date().toISOString(),
    puerto: puertoApp,
    puerto_mysql: puertoMysql,
    mysql_root: claves.root,
    permitir_red: Boolean(respuestas.permitir_red),
    completa: false,
  };
  guardarInstalacion(datosInstalacion);
  protegerConfiguracion();

  await crearMysql(puertoMysql, claves);
  escribirEnv({ puertoApp, puertoMysql, claveAplicacion: claves.aplicacion, secretoSesion: envPrevio.JWT_SECRET || aleatorio(48) });
  fs.writeFileSync(rutas.archivoPuerto, String(puertoApp));

  registrar('Cargando los datos iniciales...');
  const archivoRespuestas = path.join(rutas.config, 'respuestas.tmp.json');
  fs.writeFileSync(
    archivoRespuestas,
    JSON.stringify({
      nombre_comercio: respuestas.nombre_comercio || comun.NOMBRE,
      admin_password: respuestas.admin_password,
      con_catalogo: Boolean(respuestas.con_catalogo),
    })
  );
  try {
    registrar(comun.ejecutarScriptDelBackend('instalar-local.js', [archivoRespuestas]).trim());
  } finally {
    fs.rmSync(archivoRespuestas, { force: true });
  }

  marcarPrimeraInstalacion();
  registrar('Registrando el arranque automático...');
  await iniciarAplicacion(puertoApp);
  abrirFirewall(puertoApp, Boolean(respuestas.permitir_red));
  guardarInstalacion({ ...datosInstalacion, completa: true });
  registrar(`Instalación terminada. El sistema responde en http://localhost:${puertoApp}`);
}

async function actualizar() {
  registrar('=== Actualización de MacKiosco ===');
  const env = comun.leerEnv(rutas.archivoEnv);
  const puertoMysql = Number(env.DB_PORT);
  const puertoApp = Number(env.PORT);

  await iniciarMysql(puertoMysql);
  registrar('Actualizando la estructura de la base (no se borra ningún dato)...');
  registrar(comun.ejecutarScriptDelBackend('db-migrar.js').trim());

  fs.writeFileSync(rutas.archivoPuerto, String(puertoApp));
  registrar('Reiniciando el sistema...');
  await iniciarAplicacion(puertoApp);
  // Si se desinstaló y se volvió a instalar, hay que recrear la regla del firewall elegida al instalar.
  abrirFirewall(puertoApp, Boolean(leerInstalacion().permitir_red));
  registrar('Actualización terminada.');
}

async function main() {
  fs.rmSync(rutas.archivoError, { force: true });
  if (leerInstalacion().completa) await actualizar();
  else await instalar(leerRespuestas());
}

main().catch((error) => {
  registrar(`ERROR: ${error.message}`);
  try {
    fs.mkdirSync(rutas.logs, { recursive: true });
    fs.writeFileSync(rutas.archivoError, error.message);
  } catch {
    // Nada más que hacer.
  }
  process.exit(1);
});
