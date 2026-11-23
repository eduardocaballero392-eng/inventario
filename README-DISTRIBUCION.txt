═══════════════════════════════════════════════════════════════
  SISTEMA DE INVENTARIO Y VENTAS - GUÍA RÁPIDA
═══════════════════════════════════════════════════════════════

📦 PARA DISTRIBUIR A OTRAS COMPUTADORAS:

┌─────────────────────────────────────────────────────────────┐
│  PASO 1: Preparar el sistema (en TU PC)                     │
└─────────────────────────────────────────────────────────────┘

1. Ejecuta: PREPARAR-PARA-DISTRIBUIR.bat
   → Limpia archivos temporales
   → Verifica que todo esté completo

2. Copia toda la carpeta "Inventario" a:
   - Una memoria USB, o
   - Un archivo ZIP para enviar por internet


┌─────────────────────────────────────────────────────────────┐
│  PASO 2: Instalar en la OTRA PC                             │
└─────────────────────────────────────────────────────────────┘

REQUISITOS en la otra PC:
✓ Windows 7 o superior
✓ Node.js instalado (https://nodejs.org)
✓ MySQL instalado (WAMP o XAMPP)

INSTALACIÓN (en orden):
1. Copia la carpeta completa al escritorio
2. Asegúrate que MySQL esté ejecutándose (WAMP/XAMPP en verde)
3. Ejecuta: INSTALAR.bat (espera 2-3 minutos)
4. Ejecuta: CREAR-ACCESO-DIRECTO.bat
5. Haz doble clic en el icono del escritorio


┌─────────────────────────────────────────────────────────────┐
│  CREDENCIALES POR DEFECTO                                    │
└─────────────────────────────────────────────────────────────┘

Usuario: admin
Contraseña: admin123

(Cambialas desde el módulo Usuarios una vez dentro)


┌─────────────────────────────────────────────────────────────┐
│  ARCHIVOS IMPORTANTES                                        │
└─────────────────────────────────────────────────────────────┘

INSTALAR.bat              → Instalar el sistema (PRIMERO)
CREAR-ACCESO-DIRECTO.bat  → Crear icono en escritorio
APLICACION.bat            → Abrir el sistema directamente
INICIAR.bat               → Abrir en navegador
VERIFICAR-SISTEMA.bat     → Verificar que todo esté completo
GUIA-DISTRIBUCION.md      → Guía completa y detallada


┌─────────────────────────────────────────────────────────────┐
│  TAMAÑOS                                                     │
└─────────────────────────────────────────────────────────────┘

Carpeta completa:    ~350-400 MB
Archivo ZIP:         ~100-150 MB

IMPORTANTE: NO elimines la carpeta "node_modules", es necesaria


┌─────────────────────────────────────────────────────────────┐
│  PROBLEMAS COMUNES                                           │
└─────────────────────────────────────────────────────────────┘

❌ "Node.js no está instalado"
   → Descarga e instala desde: https://nodejs.org

❌ "Error al crear la base de datos"
   → Verifica que MySQL esté ejecutándose (verde en WAMP/XAMPP)

❌ "Puerto 3000 en uso"
   → Cierra otras instancias o reinicia la PC

❌ El acceso directo no funciona
   → Ejecuta directamente APLICACION.bat


┌─────────────────────────────────────────────────────────────┐
│  MÉTODOS DE DISTRIBUCIÓN                                     │
└─────────────────────────────────────────────────────────────┘

MÉTODO 1: USB (Recomendado para pocas PCs)
  1. Copia carpeta completa a USB
  2. Lleva a la otra PC
  3. Copia al escritorio
  4. Instala

MÉTODO 2: Internet (Recomendado para enviar)
  1. Comprime carpeta en ZIP
  2. Sube a Google Drive / WeTransfer / etc.
  3. Descarga en la otra PC
  4. Descomprime e instala

MÉTODO 3: Red local
  1. Comparte carpeta en red
  2. Accede desde la otra PC
  3. Copia e instala


┌─────────────────────────────────────────────────────────────┐
│  CHECKLIST ANTES DE DISTRIBUIR                               │
└─────────────────────────────────────────────────────────────┘

□ Ejecuté PREPARAR-PARA-DISTRIBUIR.bat
□ El sistema funciona en mi PC
□ Incluí todos los archivos .bat
□ Incluí la carpeta node_modules completa
□ Incluí las carpetas server y public
□ NO incluí el archivo .env (se crea en cada PC)
□ Incluí el archivo .env.example
□ Incluí esta guía y LEEME-PRIMERO.txt


═══════════════════════════════════════════════════════════════
  ¿NECESITAS MÁS AYUDA?
═══════════════════════════════════════════════════════════════

Lee el archivo: GUIA-DISTRIBUCION.md
(Contiene información detallada y soluciones avanzadas)

═══════════════════════════════════════════════════════════════
