'use strict';

/**
 * Punto de entrada del servidor en una PC instalada. Lo ejecuta la tarea programada "MacKiosco"
 * al encender la computadora (sin ventana, con la cuenta del sistema).
 * Indica dónde está la configuración de este local y arranca la aplicación.
 */

const path = require('path');
const { rutas } = require('./comun');

process.env.KIOSCO_ENV_FILE = rutas.archivoEnv;
process.chdir(rutas.backend);
require(path.join(rutas.backend, 'src', 'server.js'));
