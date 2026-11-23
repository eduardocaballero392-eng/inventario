const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

let mainWindow;
let serverProcess;

// Comprobar si ya hay un servidor respondiendo en el puerto
function isServerRunning(port) {
  return new Promise((resolve) => {
    const req = require('http').get({ host: 'localhost', port, path: '/', timeout: 1500 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// Iniciar el servidor Express
async function startServer() {
  const port = process.env.PORT || '3000';
  if (await isServerRunning(port)) {
    console.log(`Ya hay un servidor en el puerto ${port}, se reutiliza.`);
    return;
  }
  return new Promise((resolve, reject) => {
    // Determinar la ruta correcta según si está empaquetado o no
    let appPath, serverPath;
    
    if (app.isPackaged) {
      // En producción (asar: false): los archivos están en resources/app
      appPath = path.join(process.resourcesPath, 'app');
      serverPath = path.join(appPath, 'server', 'index.js');
    } else {
      // En desarrollo
      appPath = path.join(__dirname, '..');
      serverPath = path.join(appPath, 'server', 'index.js');
    }

    console.log('Iniciando servidor desde:', serverPath);
    console.log('Working directory:', appPath);
    
    // Usar el Node integrado en Electron: la PC no necesita tener Node.js instalado
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: appPath,
      windowsHide: true,
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: '1',
        NODE_ENV: 'production',
        // Configuración por defecto de MySQL (WAMP/XAMPP)
        DB_HOST: process.env.DB_HOST || 'localhost',
        DB_PORT: process.env.DB_PORT || '3306',
        DB_USER: process.env.DB_USER || 'root',
        DB_PASSWORD: process.env.DB_PASSWORD || '',
        DB_NAME: process.env.DB_NAME || 'inventario',
        DB_SSL: process.env.DB_SSL || 'false',
        JWT_SECRET: process.env.JWT_SECRET || 'sistema-inventario-secret-key-change-this',
        JWT_EXPIRES: process.env.JWT_EXPIRES || '12h',
        TZ_OFFSET: process.env.TZ_OFFSET || '-05:00',
        PORT: process.env.PORT || '3000'
      }
    });

    serverProcess.stdout.on('data', (data) => {
      console.log(`Servidor: ${data}`);
      // Esperar a que el servidor esté listo
      if (data.toString().includes('EN LÍNEA') || data.toString().includes('conectada')) {
        setTimeout(() => resolve(), 2000);
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(`Error servidor: ${data}`);
    });

    serverProcess.on('error', (error) => {
      console.error('Error al iniciar servidor:', error);
      reject(error);
    });

    serverProcess.on('close', (code) => {
      console.log(`Servidor cerrado con código: ${code}`);
    });

    // Timeout de seguridad - esperar más tiempo
    setTimeout(() => resolve(), 5000);
  });
}

// Crear ventana de la aplicación
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    icon: path.join(__dirname, '..', 'public', 'img', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false
    },
    autoHideMenuBar: false,
    title: 'Sistema de Inventario y Ventas'
  });

  // Crear menú simple
  const menuTemplate = [
    {
      label: 'Archivo',
      submenu: [
        {
          label: 'Recargar',
          accelerator: 'F5',
          click: () => mainWindow.reload()
        },
        { type: 'separator' },
        {
          label: 'Salir',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Ver',
      submenu: [
        {
          label: 'Pantalla completa',
          accelerator: 'F11',
          click: () => {
            mainWindow.setFullScreen(!mainWindow.isFullScreen());
          }
        },
        {
          label: 'Herramientas de desarrollo',
          accelerator: 'F12',
          click: () => mainWindow.webContents.toggleDevTools()
        }
      ]
    },
    {
      label: 'Ayuda',
      submenu: [
        {
          label: 'Acerca de',
          click: () => {
            const { dialog } = require('electron');
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'Acerca de',
              message: 'Sistema de Inventario y Ventas',
              detail: 'Versión 1.0.0\n\nSistema completo de gestión de inventario y punto de venta para bodegas y minimarkets.'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  // Cargar la aplicación
  mainWindow.loadURL('http://localhost:3000');

  // Eventos de la ventana
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Mostrar mensaje cuando la página cargue
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.executeJavaScript(`
      console.log('Sistema de Inventario cargado en modo escritorio');
    `);
  });
}

// Cuando Electron esté listo
app.whenReady().then(async () => {
  try {
    console.log('Iniciando servidor...');
    await startServer();
    console.log('Servidor iniciado, creando ventana...');
    createWindow();
  } catch (error) {
    console.error('Error al iniciar la aplicación:', error);
    app.quit();
  }
});

// Cerrar el servidor cuando se cierre la app
app.on('before-quit', () => {
  if (serverProcess) {
    console.log('Cerrando servidor...');
    serverProcess.kill();
  }
});

// Salir cuando todas las ventanas estén cerradas (excepto en macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// En macOS, recrear ventana cuando se hace clic en el dock
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Manejar errores no capturados
process.on('uncaughtException', (error) => {
  console.error('Error no capturado:', error);
});
