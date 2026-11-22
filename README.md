# Sistema de Inventario y Punto de Venta

Sistema web para bodegas, minimarkets y distribuidoras de bebidas (gaseosas, cervezas, aguas y más). Controla productos, stock, compras, ventas en caja (POS), proveedores, usuarios y reportes.

- **Frontend:** HTML + CSS + JavaScript puro (sin compilación), con Chart.js (gráficos), Lucide (íconos), Motion (animaciones), SheetJS (Excel) y jsPDF (PDF).
- **Backend:** Node.js + Express (API REST) con autenticación JWT y contraseñas cifradas con bcrypt.
- **Base de datos:** MySQL 8.
- **Despliegue:** en la nube con **Vercel** (más un MySQL en la nube) o **local en Windows** (con WAMP o XAMPP).

---

## Contenido

1. [Módulos](#módulos)
2. [Usuarios de prueba](#usuarios-de-prueba)
3. [Instalación local en Windows](#instalación-local-en-windows)
4. [Despliegue en Vercel](#despliegue-en-vercel)
5. [Variables de entorno](#variables-de-entorno)
6. [Comandos](#comandos)
7. [Estructura del proyecto](#estructura-del-proyecto)
8. [Roles y permisos](#roles-y-permisos)
9. [Copias de seguridad](#copias-de-seguridad)
10. [Solución de problemas](#solución-de-problemas)

---

## Módulos

| Módulo | Qué hace |
|---|---|
| **Panel principal** | Ventas de hoy y del mes, ganancia estimada, valor del inventario, stock bajo, gráfico de ventas (7, 30 o 90 días), más vendidos, stock crítico y actividad reciente. |
| **Punto de venta** | Venta rápida con lector de código de barras o búsqueda por nombre, carrito, descuento, pago en efectivo (con vuelto), tarjeta, transferencia, Yape o Plin, y ticket imprimible de 80 mm. Atajos: `F2` cobrar, `F4` vaciar, `Esc` buscar. |
| **Ventas** | Historial con filtros (fecha, método de pago, estado y cajero), detalle, reimpresión, anulación con devolución de stock, y exportación a Excel y PDF. |
| **Productos** | Alta, edición y baja de productos, con imagen, código de barras, categoría, marca, presentación, precios, stock mínimo, proveedor y vencimiento. Incluye búsqueda, filtros, orden, paginación, alertas visuales, kardex por producto y gestión de categorías. Se importa y exporta en Excel o CSV. |
| **Control de stock** | Compras con varios productos y costos, salidas, mermas y ajustes por conteo físico (con justificación obligatoria). Historial de movimientos con usuario y motivo, y alertas de stock bajo y de vencimiento. |
| **Proveedores** | Alta, edición y baja (razón social, RUC, teléfono, correo, dirección y contacto), con sus productos y últimas compras. |
| **Reportes** | Ventas por día, producto, categoría, método de pago, hora y cajero. Muestra ganancia y margen. Se exporta a Excel (varias hojas) y PDF. |
| **Usuarios** | Roles Administrador, Cajero y Almacenero. Permite activar y desactivar usuarios y cambiar contraseñas. |
| **Configuración** | Datos del negocio y logo, moneda, impuesto (IGV incluido o no), serie del ticket, alertas, venta sin stock, y copia de seguridad y restauración. |

Además tiene modo claro y oscuro, diseño adaptable a celular y PC, notificaciones, animaciones suaves y bloqueo temporal tras 5 intentos fallidos de inicio de sesión.

---

## Usuarios de prueba

Se crean con `npm run db:setup` (modo demostración):

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `admin123` | Administrador |
| `cajero` | `cajero123` | Cajero |
| `almacen` | `almacen123` | Almacenero |

> ⚠️ **Antes de entregar el sistema al cliente**, cambia estas contraseñas desde **Usuarios**, o instala la base sin datos de demostración con `npm run db:setup:clean`, que deja solo `admin / admin123` para cambiarla en el primer ingreso.

---

## Instalación local en Windows

### Requisitos

1. **Node.js 18 o superior**: descárgalo de <https://nodejs.org> (versión LTS) e instálalo con las opciones por defecto.
2. **MySQL 8**. La forma más simple es instalar **WAMP** (<https://www.wampserver.com>) o **XAMPP** (<https://www.apachefriends.org>) y encender MySQL. El ícono debe quedar en verde.

### Pasos

1. Copia la carpeta del proyecto a la PC (por ejemplo, a `C:\Inventario`).
2. Enciende MySQL (WAMP o XAMPP).
3. Haz doble clic en **`INSTALAR.bat`**. Este archivo:
   - instala las dependencias;
   - crea el archivo `.env` con una clave de seguridad única;
   - crea la base de datos `inventario` con las tablas y los datos de ejemplo.

   Por defecto se conecta como `root` sin contraseña, que es lo que traen WAMP y XAMPP. Si tu MySQL tiene contraseña, edita `DB_PASSWORD` en el archivo `.env` cuando el instalador se detenga.
4. Haz doble clic en **`INICIAR.bat`**. Se abre el navegador en <http://localhost:3000>.

**Para usarlo desde el celular o desde otra PC de la red:** al iniciar, la ventana negra muestra una dirección como `http://192.168.1.50:3000`. Ábrela desde cualquier dispositivo conectado al mismo WiFi. Si no carga, permite Node.js en el Firewall de Windows.

> No cierres la ventana negra mientras uses el sistema: es el servidor.

### Instalación manual (alternativa a los .bat)

```bash
npm install
copy .env.example .env      # luego edita .env
npm run db:setup
npm start
```

---

## Despliegue en Vercel

Vercel ejecuta el backend como funciones serverless y sirve el frontend como archivos estáticos. **Vercel no incluye MySQL**, así que necesitas una base MySQL en la nube.

### 1. Crear la base de datos MySQL en la nube

Cualquier proveedor compatible con MySQL sirve. Algunas opciones:

| Proveedor | Notas |
|---|---|
| **TiDB Cloud Serverless** (<https://tidbcloud.com>) | Plan gratuito generoso y compatible con MySQL. Requiere `DB_SSL=true`. |
| **Aiven for MySQL** (<https://aiven.io>) | Tiene plan gratuito. Requiere `DB_SSL=true`. |
| **Railway** (<https://railway.app>) | Simple; de pago según uso. |
| **Clever Cloud**, **DigitalOcean**, **AWS RDS**… | Cualquier MySQL 8 con acceso público. |

Del proveedor necesitas: **host, puerto, usuario, contraseña y nombre de la base**, o una sola URL del tipo `mysql://usuario:clave@host:puerto/base`.

### 2. Crear las tablas desde tu PC

Edita tu `.env` local para que apunte a la base en la nube y ejecuta:

```bash
npm run db:setup          # con datos de demostración
# o
npm run db:setup:clean    # vacía, solo con el usuario admin
```

### 3. Subir a Vercel

1. Sube el proyecto a un repositorio de GitHub. El archivo `.gitignore` ya excluye `.env` y `node_modules`.
2. En <https://vercel.com> → **Add New → Project** → importa el repositorio.
3. Deja **Framework Preset: Other**. `vercel.json` ya define el comando de build y la carpeta `public`.
4. En **Environment Variables** agrega (ver la tabla de abajo):
   - `DATABASE_URL` (o `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD` y `DB_NAME`)
   - `DB_SSL` = `true` (si el proveedor lo exige)
   - `JWT_SECRET` = una cadena larga y aleatoria
   - `TZ_OFFSET` = `-05:00`
5. Pulsa **Deploy**. Cuando termine, abre la URL y entra con `admin`.

Para verificar la conexión abre `https://tu-proyecto.vercel.app/api/health`. Debe responder `{"ok":true,"db":"ok"}`.

### Consideraciones de Vercel

- **Imágenes y logo** se guardan en la base de datos, reducidas automáticamente en el navegador, porque Vercel no conserva archivos subidos.
- **Límite de 4.5 MB por petición:** alcanza de sobra para el uso normal. Si una copia de seguridad crece mucho (muchas imágenes), restáurala desde la instalación local.
- **Copias de seguridad automáticas:** actívalas en el panel del proveedor de MySQL. La mayoría las incluye. Además puedes descargar una copia manual desde **Configuración**.
- **Hora:** Vercel trabaja en UTC. El sistema usa `TZ_OFFSET` para que "hoy" y los reportes correspondan a la hora de Perú.

---

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Una de las dos opciones | URL completa de MySQL: `mysql://usuario:clave@host:3306/inventario` |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Una de las dos opciones | Datos de conexión por separado (por defecto: `localhost`, `3306`, `root`, vacío, `inventario`) |
| `DB_SSL` | Según el proveedor | `true` para conexiones cifradas (TiDB, Aiven) |
| `JWT_SECRET` | **Sí** en producción | Clave para firmar las sesiones. Genérala con `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES` | No | Duración de la sesión (por defecto `12h`) |
| `TZ_OFFSET` | No | Zona horaria del negocio (por defecto `-05:00`, Perú) |
| `PORT` | No | Puerto local (por defecto `3000`; no se usa en Vercel) |

---

## Comandos

| Comando | Descripción |
|---|---|
| `npm start` | Inicia el servidor local (API y frontend) |
| `npm run dev` | Igual que `start`, pero se reinicia al editar archivos |
| `npm run db:setup` | Crea las tablas si no existen y carga la demostración si la base está vacía |
| `npm run db:setup:clean` | Crea las tablas y deja solo el usuario `admin` y categorías básicas |
| `npm run db:reset` | ⚠️ **Borra todas las tablas** y vuelve a cargar la demostración |
| `npm run build` | Copia las librerías del frontend a `public/vendor` (Vercel lo ejecuta solo) |

---

## Estructura del proyecto

```
Inventario/
├── api/
│   └── index.js            # Entrada serverless de Vercel (exporta la app Express)
├── server/
│   ├── app.js              # App Express: middlewares y montaje de rutas /api
│   ├── index.js            # Servidor local (API + frontend estático)
│   ├── config.js           # Configuración desde variables de entorno
│   ├── db/
│   │   ├── index.js        # Pool MySQL y helpers (all/get/run/tx)
│   │   ├── schema.sql      # Script de creación de tablas
│   │   ├── seed.sql        # Catálogo de ejemplo (categorías, proveedores, productos)
│   │   └── setup.js        # Instalador: tablas + usuarios + ventas simuladas
│   ├── middleware/
│   │   ├── auth.js         # JWT y autorización por rol
│   │   └── errors.js       # Manejo centralizado de errores
│   ├── routes/             # auth, products, categories, stock, sales, suppliers,
│   │                       # reports, dashboard, users, settings
│   └── utils/
│       ├── http.js         # Validación, paginación, fechas, errores HTTP
│       └── stock.js        # Único punto que modifica el stock (kardex)
├── public/                 # Frontend (HTML/CSS/JS sin compilación)
│   ├── index.html
│   ├── css/app.css         # Sistema de diseño (tema claro/oscuro, responsive)
│   ├── img/favicon.svg
│   ├── vendor/             # Librerías copiadas desde node_modules (se genera solo)
│   └── js/
│       ├── main.js         # Arranque, enrutador, layout, sesión
│       ├── api.js          # Cliente HTTP
│       ├── state.js        # Sesión y permisos
│       ├── ui.js           # Toasts, modales, tablas, formato, exportación
│       ├── charts.js       # Gráficos (Chart.js)
│       ├── ticket.js       # Ticket imprimible 80 mm
│       └── views/          # login, dashboard, pos, sales, products, stock,
│                           # suppliers, reports, users, settings
├── scripts/copy-vendor.js
├── vercel.json
├── .env.example
├── INSTALAR.bat / INICIAR.bat
└── package.json
```

### Base de datos

| Tabla | Contenido |
|---|---|
| `users` | Usuarios, rol y contraseña cifrada con bcrypt |
| `categories` | Categorías de productos |
| `suppliers` | Proveedores |
| `products` | Catálogo. El stock **solo** cambia mediante movimientos |
| `stock_movements` | Kardex: cada entrada, salida, venta, merma, ajuste o anulación, con stock anterior y nuevo, usuario y motivo |
| `sales` / `sale_items` | Ventas y su detalle (guarda el precio y el costo del momento de la venta) |
| `settings` | Configuración del negocio (clave/valor) |

El script completo está en [server/db/schema.sql](server/db/schema.sql) y también se puede importar desde phpMyAdmin.

---

## Roles y permisos

| Acción | Administrador | Cajero | Almacenero |
|---|:-:|:-:|:-:|
| Panel principal | ✅ | ✅ | ✅ |
| Punto de venta | ✅ | ✅ | — |
| Ver ventas | Todas | Solo las suyas | — |
| Anular ventas | ✅ | — | — |
| Ver productos | ✅ | ✅ (sin costos) | ✅ |
| Crear y editar productos | ✅ | — | ✅ |
| Eliminar productos | ✅ | — | — |
| Control de stock y compras | ✅ | — | ✅ |
| Proveedores | ✅ | — | ✅ |
| Reportes | ✅ | — | — |
| Usuarios y configuración | ✅ | — | — |

Los permisos se validan **en el servidor**. El frontend solo oculta lo que no corresponde a cada rol.

---

## Copias de seguridad

- **Manual:** en **Configuración → Copias de seguridad → Descargar** se genera un archivo `.json` con todos los datos. Guárdalo en un USB o en Google Drive cada semana.
- **Restaurar:** en la misma pantalla, con **Restaurar desde archivo**. Reemplaza todos los datos actuales.
- **Instalación local:** también puedes respaldar con phpMyAdmin (Exportar) o con `mysqldump inventario > backup.sql`.
- **Vercel:** activa los respaldos automáticos del proveedor de MySQL.

---

## Solución de problemas

| Problema | Solución |
|---|---|
| `No se pudo conectar con la base de datos` | Verifica que MySQL esté encendido y que los datos de `.env` sean correctos. |
| `La base de datos no está inicializada` | Ejecuta `npm run db:setup`. |
| `El puerto 3000 ya está en uso` | El sistema ya está abierto en otra ventana, o cambia `PORT` en `.env`. |
| No abre desde el celular | Ambos equipos deben estar en el mismo WiFi. Permite Node.js en el Firewall de Windows. |
| En Vercel sale error 500 o 503 | Revisa las variables de entorno y abre `/api/health`. Mira los logs en Vercel → Deployments → Functions. |
| Error de SSL con TiDB o Aiven | Agrega `DB_SSL=true`. |
| Olvidé la contraseña del admin | Si hay otro administrador, puede cambiarla desde **Usuarios**. Si no, ejecuta `npm run db:setup:clean` sobre una base nueva, o actualiza `password_hash` en MySQL con un hash bcrypt. |

### Nota legal

El ticket que genera el sistema es un **comprobante interno de venta**. No reemplaza a la boleta o factura electrónica de SUNAT. Para emitir comprobantes electrónicos se requiere integrar un OSE o PSE autorizado.
