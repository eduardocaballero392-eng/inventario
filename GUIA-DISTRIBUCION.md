# 📦 Guía de Distribución - Sistema de Inventario

## 🎯 Cómo distribuir el sistema a otras computadoras

---

## 📋 MÉTODO 1: Copiar carpeta completa (Recomendado)

### **Preparación (solo una vez en TU PC):**

1. Ejecuta: **`PREPARAR-PARA-DISTRIBUIR.bat`**
   - Limpia archivos temporales
   - Verifica que todo esté completo
   - Crea archivo de instrucciones

### **Distribución:**

**Opción A - USB:**
1. Copia toda la carpeta `Inventario` a una memoria USB
2. Lleva la USB a la otra computadora
3. Copia la carpeta al escritorio o donde quieras

**Opción B - Red/Internet:**
1. Comprime la carpeta `Inventario` en un archivo ZIP
   - Clic derecho → Enviar a → Carpeta comprimida
2. Envía el ZIP por correo, WeTransfer, Google Drive, etc.
3. Descomprime en la otra PC

---

## 🖥️ INSTALACIÓN EN LA OTRA PC

### **Requisitos previos:**
- ✅ Windows 7 o superior
- ✅ MySQL instalado (WAMP o XAMPP)
- ✅ Conexión a internet (solo para la instalación)

### **Pasos de instalación:**

#### **1. Instalar Node.js (si no lo tiene)**
- Ve a: https://nodejs.org
- Descarga la versión LTS
- Instala con las opciones por defecto

#### **2. Asegurar que MySQL esté ejecutándose**
- Si usa WAMP: El ícono debe estar en VERDE
- Si usa XAMPP: Abrir panel y hacer Start en MySQL

#### **3. Ejecutar INSTALAR.bat**
- Haz doble clic en `INSTALAR.bat`
- Espera a que termine (2-3 minutos)
- Se creará la base de datos automáticamente

#### **4. Crear acceso directo**
- Haz doble clic en `CREAR-ACCESO-DIRECTO.bat`
- Se creará un icono en el escritorio

#### **5. ¡Listo para usar!**
- Haz doble clic en el icono del escritorio
- Inicia sesión con: **admin / admin123**

---

## 🔧 CONFIGURACIÓN DE MYSQL

### **Si usa WAMP/XAMPP con configuración por defecto:**
✅ No necesita hacer nada, funciona automáticamente:
- Host: localhost
- Usuario: root
- Contraseña: (vacía)
- Puerto: 3306

### **Si usa MySQL con contraseña personalizada:**
Edita el archivo `.env` y cambia:
```
DB_USER=root
DB_PASSWORD=tu_contraseña_aqui
```

---

## 📂 ESTRUCTURA DE ARCHIVOS NECESARIOS

```
Inventario/
├── INSTALAR.bat                    ← Ejecutar PRIMERO
├── CREAR-ACCESO-DIRECTO.bat       ← Ejecutar SEGUNDO
├── APLICACION.bat                  ← Ejecutar para abrir (o usar acceso directo)
├── INICIAR.bat                     ← Alternativa: abre en navegador
├── Sistema-Inventario.vbs          ← Usado por el acceso directo
├── LEEME-PRIMERO.txt              ← Instrucciones rápidas
├── GUIA-DISTRIBUCION.md           ← Esta guía
├── package.json
├── .env.example
├── .env                            ← Se crea al instalar
├── node_modules/                   ← Librerías (pesado, necesario)
├── server/                         ← Código del servidor
├── public/                         ← Interfaz web
└── ...
```

---

## ⚠️ PROBLEMAS COMUNES Y SOLUCIONES

### **"Node.js no está instalado"**
→ Instala Node.js desde: https://nodejs.org

### **"Error al crear la base de datos"**
→ Verifica que MySQL esté ejecutándose (WAMP/XAMPP en verde)
→ Revisa usuario/contraseña en el archivo `.env`

### **"Puerto 3000 en uso"**
→ Cierra otras instancias del sistema
→ O cambia el puerto en `.env`: `PORT=3001`

### **"No se encuentra el archivo .env"**
→ Ejecuta `INSTALAR.bat` de nuevo

### **El acceso directo no funciona**
→ Ejecuta directamente: `APLICACION.bat`
→ O ejecuta: `CREAR-ACCESO-DIRECTO.bat` de nuevo

---

## 💾 TAMAÑOS APROXIMADOS

| Componente | Tamaño |
|------------|--------|
| Carpeta completa | ~350-400 MB |
| Archivo ZIP comprimido | ~100-150 MB |
| Sin node_modules (no funciona) | ~5 MB |

**IMPORTANTE:** La carpeta `node_modules` es GRANDE pero NECESARIA.
No la borres ni intentes distribuir sin ella.

---

## 🚀 MÉTODO ALTERNATIVO: Instalación desde cero

Si prefieres que cada PC descargue sus propias librerías:

**En tu PC:**
1. Copia solo estos archivos (sin node_modules):
   - Todos los `.bat`
   - Carpetas: server, public, scripts
   - Archivos: package.json, .env.example, README.md

**En la otra PC:**
1. Instala Node.js
2. Ejecuta `INSTALAR.bat` (descargará node_modules automáticamente)
3. Ejecuta `CREAR-ACCESO-DIRECTO.bat`

**Ventaja:** Paquete más pequeño (~5 MB)
**Desventaja:** Requiere internet en cada PC para instalar

---

## 📊 COMPARACIÓN DE MÉTODOS

| Método | Tamaño | Internet necesario | Tiempo instalación |
|--------|--------|-------------------|-------------------|
| **Carpeta completa** | 350 MB | ❌ No | 2-3 min |
| **Carpeta sin node_modules** | 5 MB | ✅ Sí | 5-10 min |
| **Archivo .exe portable** | 200 MB | ❌ No | ⚠️ Problemático |

**Recomendado:** Carpeta completa (más confiable)

---

## ✅ CHECKLIST DE DISTRIBUCIÓN

Antes de distribuir, verifica:

- [ ] Ejecutaste `PREPARAR-PARA-DISTRIBUIR.bat`
- [ ] El sistema funciona en TU PC
- [ ] Incluiste el archivo `LEEME-PRIMERO.txt`
- [ ] Incluiste todos los archivos `.bat`
- [ ] Incluiste la carpeta `node_modules` completa
- [ ] Incluiste las carpetas `server` y `public`
- [ ] No incluiste el archivo `.env` (se crea en cada PC)
- [ ] Incluiste el archivo `.env.example`

---

## 🆘 SOPORTE

Si tienes problemas:
1. Lee `LEEME-PRIMERO.txt`
2. Verifica que MySQL esté ejecutándose
3. Revisa que Node.js esté instalado: `node -v` en cmd
4. Verifica el archivo `.env` tenga la configuración correcta

---

## 📝 NOTAS ADICIONALES

### **Actualizar el sistema en otra PC:**
1. Copia los archivos nuevos sobre los viejos
2. NO borres el archivo `.env` (tiene la configuración)
3. NO borres la carpeta `node_modules` si no hay cambios

### **Desinstalar:**
1. Elimina el acceso directo del escritorio
2. Elimina la carpeta completa
3. (Opcional) Elimina la base de datos desde phpMyAdmin

### **Migrar a otra PC conservando datos:**
1. Exporta la base de datos desde phpMyAdmin (SQL)
2. Instala el sistema en la nueva PC
3. Importa el SQL desde phpMyAdmin

---

¡Listo! Ahora puedes distribuir tu sistema fácilmente. 🚀
