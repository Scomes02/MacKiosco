'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');

const rutas = require('./routes');
const { errorHandler, rutaNoEncontrada } = require('./middlewares/errorHandler');

const app = express();
const FRONTEND_DIST = path.join(__dirname, '..', '..', 'frontend', 'dist');

app.disable('x-powered-by');

// Cabeceras de seguridad. Se ajusta la política de contenido para permitir imágenes de
// productos alojadas en otros sitios y para que funcione por HTTP dentro de la red local.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'img-src': ["'self'", 'data:', 'https:', 'http:'],
        'upgrade-insecure-requests': null,
      },
    },
    strictTransportSecurity: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
  })
);

app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());

// La API nunca se guarda en caché: los datos siempre salen de la base.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', rutas);
app.use('/api', rutaNoEncontrada);

// En producción el mismo servidor entrega la aplicación web ya compilada (frontend/dist).
if (fs.existsSync(path.join(FRONTEND_DIST, 'index.html'))) {
  app.use(express.static(FRONTEND_DIST, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

app.use(rutaNoEncontrada);
app.use(errorHandler);

module.exports = app;
