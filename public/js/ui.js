/**
 * Utilidades de interfaz: íconos, formato, animaciones, toasts, modales,
 * tablas con orden y paginación, formularios, exportación Excel/PDF e imágenes.
 */
import { state } from './state.js';

// ---------------------------------------------------------------- DOM
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escapa texto para insertarlo en HTML (previene XSS). */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export const icon = (name, cls = '') => `<i data-lucide="${name}" class="${cls}"></i>`;

/** Reemplaza <i data-lucide> por SVG. */
export function icons() {
  if (window.lucide) window.lucide.createIcons({ icons: window.lucide.icons });
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ---------------------------------------------------------------- Formato
const numberFmt = new Intl.NumberFormat('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const intFmt = new Intl.NumberFormat('es-PE');

export function money(n) {
  const sym = state.settings?.currency_symbol || 'S/';
  const v = Number(n) || 0;
  return `${v < 0 ? '-' : ''}${sym} ${numberFmt.format(Math.abs(v))}`;
}
export const num = (n) => intFmt.format(Number(n) || 0);
export const dec = (n) => numberFmt.format(Number(n) || 0);

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
/** Fechas del servidor: 'YYYY-MM-DD' o 'YYYY-MM-DD HH:MM:SS' (hora local del negocio). */
export function fmtDate(s, withTime = false) {
  if (!s) return '—';
  const [d, t] = String(s).split(' ');
  const [y, m, day] = d.split('-');
  const base = `${day} ${MONTHS[Number(m) - 1]} ${y}`;
  if (!withTime || !t) return base;
  return `${base}, ${fmtTime(s)}`;
}
export function fmtTime(s) {
  const t = String(s).split(' ')[1];
  if (!t) return '';
  let [h, mi] = t.split(':').map(Number);
  const ap = h >= 12 ? 'p. m.' : 'a. m.';
  h = h % 12 || 12;
  return `${h}:${String(mi).padStart(2, '0')} ${ap}`;
}
export const shortDay = (d) => {
  const [, m, day] = d.split('-');
  return `${Number(day)} ${MONTHS[Number(m) - 1]}`;
};
/** 'YYYY-MM-DD' de hoy (hora del navegador) desplazado N días. */
export function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function relTime(s) {
  if (!s) return '';
  const [d, t = '00:00:00'] = String(s).split(' ');
  const diff = (Date.now() - new Date(`${d}T${t}`).getTime()) / 1000;
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'ayer';
  return fmtDate(s);
}
export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const PAYMENT = {
  efectivo: { label: 'Efectivo', icon: 'banknote', color: '#059669' },
  tarjeta: { label: 'Tarjeta', icon: 'credit-card', color: '#2563eb' },
  transferencia: { label: 'Transferencia', icon: 'landmark', color: '#0891b2' },
  yape: { label: 'Yape', icon: 'smartphone', color: '#742284' },
  plin: { label: 'Plin', icon: 'smartphone', color: '#00a6a6' },
};

export const MOVEMENT = {
  entrada: { label: 'Entrada', badge: 'badge-green', icon: 'arrow-down-to-line' },
  salida: { label: 'Salida', badge: 'badge-amber', icon: 'arrow-up-from-line' },
  venta: { label: 'Venta', badge: 'badge-blue', icon: 'shopping-cart' },
  merma: { label: 'Merma', badge: 'badge-red', icon: 'trash-2' },
  ajuste: { label: 'Ajuste', badge: 'badge-cyan', icon: 'sliders-horizontal' },
  anulacion: { label: 'Anulación', badge: '', icon: 'undo-2' },
};

/** Badge de estado de stock. */
export function stockBadge(p) {
  if (p.stock <= 0) return `<span class="badge badge-red">${icon('circle-x')}Agotado</span>`;
  if (p.stock <= p.min_stock) return `<span class="badge badge-amber">${icon('triangle-alert')}Stock bajo</span>`;
  return `<span class="badge badge-green">${icon('circle-check')}Disponible</span>`;
}

/** Medidor visual de stock respecto al mínimo. */
export function stockMeter(p) {
  const ref = Math.max(p.min_stock * 2, 1);
  const pct = Math.max(4, Math.min(100, (p.stock / ref) * 100));
  const color = p.stock <= 0 ? 'var(--danger)' : p.stock <= p.min_stock ? 'var(--warning)' : 'var(--success)';
  return `<div class="stock-meter"><strong class="tabular">${num(p.stock)}</strong><div class="bar"><span style="width:${pct}%;background:${color}"></span></div></div>`;
}

/** Miniatura de producto (imagen o ícono). */
export function productThumb(p, cls = 'prod-thumb') {
  const img = p.has_image ? `<img src="/api/products/${p.id}/image?v=${encodeURIComponent(p.updated_at || '')}" alt="" loading="lazy">` : icon('package');
  return `<div class="${cls}">${img}</div>`;
}

// ---------------------------------------------------------------- Animaciones (Motion)
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const M = () => (!reduced() && window.Motion) || null;

/** Entrada suave escalonada de elementos. */
export function animateIn(targets, { y = 14, delay = 0, stagger = 0.045, duration = 0.42 } = {}) {
  const m = M();
  const els = typeof targets === 'string' ? $$(targets) : [].concat(targets).filter(Boolean);
  if (!m || !els.length) return;
  m.animate(els, { opacity: [0, 1], y: [y, 0] }, { duration, delay: m.stagger(stagger, { startDelay: delay }), ease: [0.22, 1, 0.36, 1] });
}

export function animate(el, keyframes, opts) {
  const m = M();
  if (m && el) return m.animate(el, keyframes, opts);
  return null;
}

/** Contador animado de 0 al valor. */
export function countUp(el, value, format = num, duration = 0.9) {
  const m = M();
  if (!m || !el) { if (el) el.textContent = format(value); return; }
  m.animate(0, Number(value) || 0, {
    duration,
    ease: [0.16, 1, 0.3, 1],
    onUpdate: (v) => { el.textContent = format(v); },
  });
}

export const shake = (el) => animate(el, { x: [0, -10, 10, -7, 7, -3, 0] }, { duration: 0.45 });

// ---------------------------------------------------------------- Toasts
const TOAST_ICONS = { success: 'circle-check', error: 'circle-x', warning: 'triangle-alert', info: 'info' };
export function toast(type, title, message = '', ms = 4200) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', type === 'error' ? 'alert' : 'status');
  el.innerHTML = `
    <div class="t-icon">${icon(TOAST_ICONS[type] || 'info')}</div>
    <div><strong>${esc(title)}</strong>${message ? `<p>${esc(message)}</p>` : ''}</div>
    <button class="t-close" aria-label="Cerrar">${icon('x')}</button>
    <div class="t-progress"></div>`;
  box.prepend(el);
  icons();
  animate(el, { opacity: [0, 1], x: [40, 0], scale: [0.96, 1] }, { duration: 0.35, ease: [0.22, 1, 0.36, 1] });
  const bar = $('.t-progress', el);
  animate(bar, { scaleX: [1, 0] }, { duration: ms / 1000, ease: 'linear' });

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    const a = animate(el, { opacity: 0, x: 40 }, { duration: 0.22 });
    if (a) await a;
    el.remove();
  };
  $('.t-close', el).onclick = close;
  setTimeout(close, ms);
}
export const toastError = (err, title = 'No se pudo completar') => toast('error', title, err?.message || String(err));

// ---------------------------------------------------------------- Modales
/**
 * Abre un modal. Devuelve { el, close, body }.
 * opts: { title, sub, body (html), footer (html), size: 'sm'|'lg'|'xl', onClose, dismissable }
 */
export function openModal({ title, sub = '', body = '', footer = '', size = '', onClose, dismissable = true }) {
  const root = document.createElement('div');
  root.className = 'modal-root';
  root.innerHTML = `
    <div class="modal-backdrop"></div>
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <div style="flex:1;min-width:0"><h3>${esc(title)}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
        <button class="btn btn-ghost btn-icon btn-sm" data-close aria-label="Cerrar">${icon('x')}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  $('#modals').appendChild(root);
  icons();

  const dialog = $('.modal', root);
  const prevFocus = document.activeElement;
  animate($('.modal-backdrop', root), { opacity: [0, 1] }, { duration: 0.2 });
  animate(dialog, { opacity: [0, 1], scale: [0.95, 1], y: [16, 0] }, { duration: 0.32, ease: [0.22, 1, 0.36, 1] });

  let closing = false;
  async function close(result) {
    if (closing) return;
    closing = true;
    document.removeEventListener('keydown', onKey);
    animate($('.modal-backdrop', root), { opacity: 0 }, { duration: 0.18 });
    const a = animate(dialog, { opacity: 0, scale: 0.97, y: 10 }, { duration: 0.18 });
    if (a) await a;
    root.remove();
    if (prevFocus && prevFocus.focus) prevFocus.focus();
    if (onClose) onClose(result);
  }
  function onKey(e) {
    if (e.key === 'Escape' && dismissable && root === $('#modals').lastElementChild) close();
  }
  document.addEventListener('keydown', onKey);
  $$('[data-close]', root).forEach((b) => { b.onclick = () => close(); });
  if (dismissable) $('.modal-backdrop', root).onclick = () => close();

  setTimeout(() => {
    const first = $('[autofocus], input:not([type=hidden]):not([disabled]), select, textarea', dialog);
    if (first) first.focus();
  }, 60);

  return { el: root, body: $('.modal-body', root), close };
}

/** Confirmación. Devuelve Promise<boolean>. */
export function confirmDialog({ title, message, confirmText = 'Confirmar', tone = 'danger', iconName = 'triangle-alert' }) {
  return new Promise((resolve) => {
    let ok = false;
    const m = openModal({
      title,
      size: 'sm',
      body: `
        <div class="confirm-icon" style="background:var(--${tone}-soft);color:var(--${tone})">${icon(iconName)}</div>
        <p class="text-muted">${message}</p>`,
      footer: `<button class="btn btn-outline" data-close>Cancelar</button>
               <button class="btn btn-${tone === 'danger' ? 'danger' : 'primary'}" data-ok>${esc(confirmText)}</button>`,
      onClose: () => resolve(ok),
    });
    $('[data-ok]', m.el).onclick = () => { ok = true; m.close(); };
    setTimeout(() => $('[data-ok]', m.el)?.focus(), 80);
  });
}

/** Pide un texto obligatorio (ej. motivo). Devuelve Promise<string|null>. */
export function promptDialog({ title, message = '', label = 'Motivo', placeholder = '', confirmText = 'Aceptar', tone = 'danger', minLength = 3 }) {
  return new Promise((resolve) => {
    let value = null;
    const m = openModal({
      title,
      size: 'sm',
      body: `${message ? `<p class="text-muted" style="margin-bottom:14px">${message}</p>` : ''}
        <div class="field"><label>${esc(label)} <span class="req">*</span></label>
        <textarea class="textarea" maxlength="200" placeholder="${esc(placeholder)}" autofocus></textarea>
        <span class="error-text" hidden></span></div>`,
      footer: `<button class="btn btn-outline" data-close>Cancelar</button>
               <button class="btn btn-${tone === 'danger' ? 'danger' : 'primary'}" data-ok>${esc(confirmText)}</button>`,
      onClose: () => resolve(value),
    });
    const ta = $('textarea', m.el);
    $('[data-ok]', m.el).onclick = () => {
      if (ta.value.trim().length < minLength) {
        const e = $('.error-text', m.el);
        e.textContent = `Escribe al menos ${minLength} caracteres`;
        e.hidden = false;
        ta.classList.add('invalid');
        shake(ta);
        return;
      }
      value = ta.value.trim();
      m.close();
    };
  });
}

// ---------------------------------------------------------------- Botones / formularios
/** Ejecuta fn mostrando spinner en el botón y evitando doble clic. */
export async function withLoading(btn, fn) {
  if (!btn || btn.disabled) return undefined;
  const html = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span>${btn.dataset.loading ? esc(btn.dataset.loading) : ''}`;
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.innerHTML = html;
    icons();
  }
}

/** Lee un formulario como objeto. Checkboxes -> boolean; vacíos -> ''. */
export function formData(form) {
  const out = {};
  $$('[name]', form).forEach((el) => {
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value.trim();
  });
  return out;
}

/** Marca errores por campo (details del backend o validación local). */
export function showErrors(form, details = {}) {
  $$('.invalid', form).forEach((el) => el.classList.remove('invalid'));
  $$('.error-text[data-for]', form).forEach((el) => el.remove());
  let first = null;
  Object.entries(details || {}).forEach(([name, msg]) => {
    const input = $(`[name="${name}"]`, form);
    if (!input) return;
    input.classList.add('invalid');
    const span = document.createElement('span');
    span.className = 'error-text';
    span.dataset.for = name;
    span.textContent = msg;
    (input.closest('.field') || input.parentElement).appendChild(span);
    first = first || input;
  });
  if (first) { first.focus(); shake(first); }
}

/** Validación local declarativa: { campo: [fn(value, data) => mensaje|null] } */
export function check(data, rules) {
  const errors = {};
  Object.entries(rules).forEach(([field, fns]) => {
    for (const fn of fns) {
      const msg = fn(data[field], data);
      if (msg) { errors[field] = msg; break; }
    }
  });
  return Object.keys(errors).length ? errors : null;
}
export const req = (label) => (v) => (v === '' || v === null || v === undefined ? `${label} es obligatorio` : null);
export const minNum = (label, min = 0) => (v) => (v !== '' && (Number.isNaN(Number(v)) || Number(v) < min) ? `${label} debe ser mayor o igual a ${min}` : null);
export const isInt = (label) => (v) => (v !== '' && !Number.isInteger(Number(v)) ? `${label} debe ser un número entero` : null);

// ---------------------------------------------------------------- Tablas
/**
 * Encabezados ordenables. columns: [{ key, label, sortable, cls }]
 */
export function tableHead(columns, sort = {}) {
  return `<thead><tr>${columns.map((c) => {
    if (!c.sortable) return `<th class="${c.cls || ''}">${esc(c.label)}</th>`;
    const active = sort.key === c.key;
    const ico = active ? (sort.order === 'desc' ? 'arrow-down' : 'arrow-up') : 'arrow-up-down';
    return `<th class="sortable ${active ? 'sorted' : ''} ${c.cls || ''}" data-sort="${c.key}">${esc(c.label)}<span class="sort-ind">${icon(ico)}</span></th>`;
  }).join('')}</tr></thead>`;
}

/** Filas skeleton mientras carga. */
export function skeletonRows(cols, rows = 6) {
  return Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => '<td><div class="skeleton sk-line" style="width:80%"></div></td>').join('')}</tr>`).join('');
}

export function emptyState({ iconName = 'inbox', title = 'Sin resultados', text = '', action = '' } = {}) {
  return `<div class="empty"><div class="empty-icon">${icon(iconName)}</div><h4>${esc(title)}</h4><p>${esc(text)}</p>${action}</div>`;
}

/** Paginación. onPage(n) se llama al cambiar de página. */
export function renderPagination(container, { page, limit, total }, onPage) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(total, page * limit);
  const nums = [];
  for (let i = 1; i <= pages; i += 1) {
    if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  container.innerHTML = `
    <span>Mostrando <strong>${num(from)}–${num(to)}</strong> de <strong>${num(total)}</strong></span>
    <div class="pages">
      <button data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="Anterior">${icon('chevron-left')}</button>
      ${nums.map((n) => (n === '…' ? '<span class="text-faint">…</span>' : `<button data-p="${n}" class="${n === page ? 'active' : ''}">${n}</button>`)).join('')}
      <button data-p="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="Siguiente">${icon('chevron-right')}</button>
    </div>`;
  icons();
  $$('button[data-p]', container).forEach((b) => { b.onclick = () => onPage(Number(b.dataset.p)); });
}

// ---------------------------------------------------------------- Exportación (carga diferida de librerías)
const loaded = {};
function loadScript(src) {
  if (!loaded[src]) {
    loaded[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
      document.head.appendChild(s);
    });
  }
  return loaded[src];
}
export const loadXlsx = () => loadScript('/vendor/xlsx.js').then(() => window.XLSX);

/** Exporta hojas a .xlsx. sheets: [{ name, rows: [obj...] }] */
export async function exportExcel(filename, sheets) {
  const XLSX = await loadXlsx();
  const wb = XLSX.utils.book_new();
  sheets.forEach((s) => {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{ '': 'Sin datos' }]);
    const keys = Object.keys(s.rows[0] || {});
    ws['!cols'] = keys.map((k) => ({ wch: Math.min(45, Math.max(k.length, ...s.rows.map((r) => String(r[k] ?? '').length)) + 2) }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  });
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

/** Exporta una o varias tablas a PDF. tables: [{ title, head: [..], body: [[..]] }] */
export async function exportPdf(filename, { title, subtitle = '', tables, summary = [] }) {
  await loadScript('/vendor/jspdf.js');
  await loadScript('/vendor/jspdf-autotable.js');
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const s = state.settings || {};
  const W = doc.internal.pageSize.getWidth();

  doc.setFillColor(37, 99, 235);
  doc.rect(0, 0, W, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(s.business_name || 'Mi negocio', 40, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text([s.business_ruc ? `RUC ${s.business_ruc}` : '', s.business_address || ''].filter(Boolean).join('  ·  '), 40, 56);
  doc.setTextColor(20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, 40, 84);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(subtitle, 40, 98);
  doc.text(`Generado: ${new Date().toLocaleString('es-PE')}`, W - 40, 98, { align: 'right' });

  let y = 114;
  if (summary.length) {
    const colW = (W - 80) / summary.length;
    summary.forEach(([label, value], i) => {
      const x = 40 + i * colW;
      doc.setDrawColor(226, 232, 240);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(x + 2, y, colW - 4, 42, 4, 4, 'FD');
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(label, x + 10, y + 15);
      doc.setFontSize(12);
      doc.setTextColor(20);
      doc.setFont('helvetica', 'bold');
      doc.text(String(value), x + 10, y + 33);
      doc.setFont('helvetica', 'normal');
    });
    y += 60;
  }

  const autoTable = window.jspdf_autotable?.autoTable || window.autoTable || ((d, o) => d.autoTable(o));
  tables.forEach((t) => {
    if (t.title) {
      doc.setFontSize(11);
      doc.setTextColor(20);
      doc.setFont('helvetica', 'bold');
      doc.text(t.title, 40, y + 10);
      doc.setFont('helvetica', 'normal');
      y += 16;
    }
    autoTable(doc, {
      startY: y,
      head: [t.head],
      body: t.body,
      margin: { left: 40, right: 40 },
      styles: { fontSize: 8.5, cellPadding: 5 },
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      alternateRowStyles: { fillColor: [246, 248, 252] },
      columnStyles: t.columnStyles || {},
    });
    y = doc.lastAutoTable.finalY + 24;
  });

  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Página ${i} de ${pages}`, W - 40, doc.internal.pageSize.getHeight() - 20, { align: 'right' });
  }
  doc.save(`${filename}.pdf`);
}

// ---------------------------------------------------------------- Imágenes
/** Reduce una imagen en el navegador y devuelve un data URL JPEG/PNG liviano. */
export function resizeImage(file, max = 480, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) return reject(new Error('Selecciona una imagen JPG, PNG o WEBP'));
    if (file.size > 10 * 1024 * 1024) return reject(new Error('La imagen supera los 10 MB'));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      const png = file.type === 'image/png';
      if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL(png ? 'image/png' : 'image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

/** Descarga un Blob como archivo (fuera de iframes con sandbox funciona normalmente). */
export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
