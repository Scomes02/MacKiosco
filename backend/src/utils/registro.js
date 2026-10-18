'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

/**
 * Cuando el sistema corre como servicio de Windows no hay una ventana donde ver los mensajes.
 * Si se configura LOG_DIR, todo lo que se escribe con console.log / console.error se guarda
 * además en LOG_DIR/kiosco.log (con rotación simple al superar los 5 MB).
 */

const TAMANO_MAXIMO = 5 * 1024 * 1024;

function activarArchivoDeRegistro(carpeta) {
  if (!carpeta) return;
  fs.mkdirSync(carpeta, { recursive: true });
  const archivo = path.join(carpeta, 'kiosco.log');

  const escribir = (nivel, argumentos) => {
    try {
      if (fs.existsSync(archivo) && fs.statSync(archivo).size > TAMANO_MAXIMO) {
        fs.renameSync(archivo, path.join(carpeta, 'kiosco.anterior.log'));
      }
      const momento = new Date().toLocaleString('sv-SE'); // AAAA-MM-DD HH:MM:SS en hora local
      fs.appendFileSync(archivo, `${momento} ${nivel} ${util.format(...argumentos)}\n`);
    } catch {
      // Si no se puede escribir el registro, el sistema sigue funcionando igual.
    }
  };

  for (const [metodo, nivel] of [['log', 'INFO '], ['warn', 'AVISO'], ['error', 'ERROR']]) {
    const original = console[metodo].bind(console);
    console[metodo] = (...argumentos) => {
      original(...argumentos);
      escribir(nivel, argumentos);
    };
  }

  process.on('uncaughtException', (error) => {
    console.error('[fatal] Error no controlado:', error);
    process.exit(1);
  });
}

module.exports = { activarArchivoDeRegistro };
