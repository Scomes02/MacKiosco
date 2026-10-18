'use strict';

/**
 * Lo ejecuta el desinstalador: detiene y quita el arranque automático, el servicio de la base
 * de datos y la regla del firewall.
 *
 * NO borra los datos del local (C:\ProgramData\MacKiosco): ventas, productos, copias de seguridad,
 * certificados y configuración quedan en la PC por si se vuelve a instalar.
 */

const comun = require('./comun');

const { registrar, intentar } = comun;

/** Estado del servicio de la base: 'STOPPED', 'RUNNING', 'STOP_PENDING'... o null si no existe. */
function estadoDelServicio() {
  try {
    const salida = comun.ejecutar('sc', ['query', comun.SERVICIO_BASE]);
    const coincidencia = salida.match(/\b(STOPPED|RUNNING|START_PENDING|STOP_PENDING|PAUSED)\b/);
    return coincidencia ? coincidencia[1] : 'DESCONOCIDO';
  } catch {
    return null;
  }
}

async function main() {
  registrar('=== Desinstalación de MacKiosco ===');

  registrar('Quitando el arranque automático...');
  intentar('schtasks', ['/End', '/TN', comun.TAREA]);
  intentar('schtasks', ['/Delete', '/TN', comun.TAREA, '/F']);

  if (estadoDelServicio() !== null) {
    registrar('Deteniendo la base de datos...');
    intentar('sc', ['stop', comun.SERVICIO_BASE]);
    // MySQL tarda unos segundos en cerrar: el servicio se quita recién cuando terminó de detenerse.
    const limite = Date.now() + 90000;
    while (Date.now() < limite && !['STOPPED', null].includes(estadoDelServicio())) await comun.esperar(1000);
    registrar(`Quitando el servicio de la base de datos (estado: ${estadoDelServicio()})...`);
    intentar('sc', ['delete', comun.SERVICIO_BASE]);
    registrar(estadoDelServicio() === null ? '  Servicio quitado.' : '  AVISO: el servicio sigue registrado; se quitará al reiniciar la PC.');
  }

  intentar('netsh', ['advfirewall', 'firewall', 'delete', 'rule', `name=${comun.REGLA_FIREWALL}`]);
  registrar(`Desinstalación terminada. Los datos del local se conservan en ${comun.rutas.datos}`);
}

main().catch((error) => registrar(`ERROR al desinstalar: ${error.message}`));
