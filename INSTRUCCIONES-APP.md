# 🖥️ Sistema de Inventario - Aplicación de Escritorio

## 📋 Dos formas de usar el sistema:

### Opción 1: Aplicación de Escritorio (Recomendado)
Ejecuta el sistema como una aplicación nativa de Windows.

### Opción 2: Navegador Web
Usa el sistema desde cualquier navegador.

---

## 🚀 Opción 1: Usar como Aplicación de Escritorio

### Primera vez - Instalación:
1. Haz doble clic en **`APLICACION.bat`**
2. Espera a que se instalen los componentes (solo la primera vez, ~2-3 minutos)
3. La aplicación se abrirá automáticamente

### Siguientes veces:
- Solo haz doble clic en **`APLICACION.bat`**
- La app se abre directamente (en segundos)

### ✨ Ventajas:
- ✅ Se abre como programa de Windows
- ✅ No necesitas abrir el navegador
- ✅ Funciona como una app nativa
- ✅ Atajos de teclado (F5 recargar, F11 pantalla completa, F12 consola)
- ✅ Menú de archivo y ayuda
- ✅ Puedes minimizar a la barra de tareas

---

## 📦 Crear un Instalador .exe (Opcional)

Si quieres distribuir el sistema a otras computadoras sin que tengan que instalar nada:

1. Haz doble clic en **`CREAR-INSTALADOR.bat`**
2. Espera ~5-10 minutos (creará un instalador completo)
3. Busca en la carpeta **`dist\`** el archivo:
   - `Sistema de Inventario Setup X.X.X.exe`

### Con el instalador puedes:
- ✅ Instalar en otras computadoras
- ✅ Crear accesos directos en el escritorio
- ✅ Agregar al menú inicio
- ✅ Desinstalar desde Panel de Control

**Nota:** El instalador incluye TODO (Node.js embebido, todas las librerías, etc.)
Solo necesitarás MySQL en la computadora donde lo instales.

---

## 🌐 Opción 2: Usar desde el Navegador

Si prefieres usar el navegador (Chrome, Edge, Firefox):

1. Haz doble clic en **`INICIAR.bat`**
2. Se abrirá automáticamente en tu navegador en: http://localhost:3000

---

## 🔄 Comparación

| Característica | Aplicación de Escritorio | Navegador Web |
|----------------|-------------------------|---------------|
| Instalación inicial | ~2-3 min | Instantáneo |
| Siguientes usos | Instantáneo | Instantáneo |
| Experiencia | App nativa | Pestaña web |
| Atajos de teclado | Incluidos | Limitados |
| Acceso directo | Desde .bat | Desde .bat |
| Menú de opciones | Sí | No |

---

## 💡 Recomendación

- **Para uso diario:** Usa **APLICACION.bat** (mejor experiencia)
- **Para crear instalador:** Usa **CREAR-INSTALADOR.bat** (una sola vez)
- **Para pruebas rápidas:** Usa **INICIAR.bat** (navegador)

---

## ⚙️ Requisitos

Ambas opciones requieren:
- ✅ Node.js instalado
- ✅ MySQL ejecutándose (WAMP/XAMPP en verde)
- ✅ Base de datos creada (con INSTALAR.bat)

---

## ❓ Preguntas Frecuentes

### ¿Cuál es la diferencia entre APLICACION.bat y INICIAR.bat?
- **APLICACION.bat**: Abre el sistema en una ventana de aplicación (como Word, Excel)
- **INICIAR.bat**: Abre el sistema en tu navegador web

### ¿Necesito internet?
- No, funciona 100% offline (solo en tu red local)
- Internet solo se necesita para la instalación inicial de componentes

### ¿El instalador funciona sin Node.js?
- Sí, el instalador incluye todo lo necesario
- Solo necesitas MySQL en la computadora destino

### ¿Puedo usar ambas opciones?
- Sí, puedes alternar entre aplicación y navegador cuando quieras

---

## 🆘 Problemas Comunes

### "No se encuentra electron"
→ Ejecuta: `npm install` desde PowerShell en la carpeta del proyecto

### "Puerto 3000 en uso"
→ Cierra otras instancias del sistema o reinicia tu PC

### La aplicación no abre
→ Verifica que MySQL esté ejecutándose (WAMP/XAMPP en verde)
