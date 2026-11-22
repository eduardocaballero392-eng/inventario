/**
 * Copia las librerías del frontend desde node_modules a public/vendor.
 * Se ejecuta en "npm install" (postinstall) y en el build de Vercel,
 * así el frontend no depende de CDNs externos.
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const nm = (p) => path.join(root, 'node_modules', p);
const out = path.join(root, 'public', 'vendor');

const files = {
  'chart.js': 'chart.js/dist/chart.umd.min.js',
  'lucide.js': 'lucide/dist/umd/lucide.min.js',
  'motion.js': 'motion/dist/motion.js',
  'xlsx.js': 'xlsx/dist/xlsx.full.min.js',
  'jspdf.js': 'jspdf/dist/jspdf.umd.min.js',
  'jspdf-autotable.js': 'jspdf-autotable/dist/jspdf.plugin.autotable.min.js',
};

fs.mkdirSync(path.join(out, 'fonts', 'files'), { recursive: true });
for (const [name, src] of Object.entries(files)) {
  fs.copyFileSync(nm(src), path.join(out, name));
}

// Fuente Inter (solo latín, suficiente para español)
const fontDir = nm('@fontsource-variable/inter');
fs.copyFileSync(path.join(fontDir, 'files', 'inter-latin-wght-normal.woff2'), path.join(out, 'fonts', 'files', 'inter-latin-wght-normal.woff2'));
fs.writeFileSync(
  path.join(out, 'fonts', 'inter.css'),
  `@font-face {
  font-family: 'Inter Variable';
  font-style: normal;
  font-display: swap;
  font-weight: 100 900;
  src: url(./files/inter-latin-wght-normal.woff2) format('woff2-variations');
}
`
);

console.log('✓ Librerías del frontend copiadas a public/vendor');
