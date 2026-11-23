/**
 * Servidor LOCAL: API + frontend estático en un solo proceso.
 * Iniciar con:  npm start   (o doble clic en INICIAR.bat)
 * En Vercel no se usa este archivo (ver api/index.js y vercel.json).
 */
const os = require('os');
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('./config');
const app = require('./app');
const { errorHandler } = require('./middleware/errors');

if (!fs.existsSync(path.join(config.PUBLIC_DIR, 'vendor', 'chart.js'))) {
  console.log('Copiando librerías del frontend...');
  require('../scripts/copy-vendor');
}

app.use(express.static(config.PUBLIC_DIR, { index: 'index.html', maxAge: 0, etag: false, lastModified: false }));
// SPA: cualquier otra ruta GET devuelve index.html
app.use((req, res, next) => {
  if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
  res.sendFile(path.join(config.PUBLIC_DIR, 'index.html'));
});
app.use(errorHandler);

const server = app.listen(config.PORT, async () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => `http://${i.address}:${config.PORT}`);
  console.log('');
  console.log('  ==============================================');
  console.log('   SISTEMA DE INVENTARIO Y VENTAS - EN LÍNEA');
  console.log('  ==============================================');
  console.log(`   En esta PC:          http://localhost:${config.PORT}`);
  ips.forEach((u) => console.log(`   En la red (celular): ${u}`));
  console.log('   No cierres esta ventana mientras uses el sistema.');

  try {
    const { db } = require('./db');
    await db.get('SELECT 1 FROM users LIMIT 1');
    console.log('   Base de datos: conectada ✓\n');
  } catch (err) {
    console.error(`\n   [!] Base de datos: ${err.code === 'ER_NO_SUCH_TABLE' ? 'sin tablas. Ejecuta "npm run db:setup"' : `no conecta (${err.code || err.message}). Revisa el archivo .env`}\n`);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  El puerto ${config.PORT} ya está en uso. ¿El sistema ya está abierto en otra ventana?\n`);
    process.exit(1);
  }
  throw err;
});
