/**
 * Arranque de la aplicación: sesión, layout (sidebar + topbar), enrutador por hash y tema.
 */
import { api } from './api.js';
import { state, clearSession, ROLE_LABELS } from './state.js';
import { $, $$, esc, icon, icons, initials, toast, animateIn, animate, openModal, formData, showErrors, withLoading, toastError } from './ui.js';
import { destroyCharts } from './charts.js';
import { renderLogin } from './views/login.js';

const ALL = ['admin', 'cajero', 'almacenero'];

/** Menú y permisos por rol. */
export const ROUTES = [
  { path: 'dashboard', label: 'Panel principal', icon: 'layout-dashboard', roles: ALL, section: 'General' },
  { path: 'pos', label: 'Punto de venta', icon: 'scan-barcode', roles: ['admin', 'cajero'], section: 'General' },
  { path: 'sales', label: 'Ventas', icon: 'receipt-text', roles: ['admin', 'cajero'], section: 'General' },
  { path: 'products', label: 'Productos', icon: 'package', roles: ALL, section: 'Inventario' },
  { path: 'stock', label: 'Control de stock', icon: 'arrow-left-right', roles: ['admin', 'almacenero'], section: 'Inventario' },
  { path: 'suppliers', label: 'Proveedores', icon: 'truck', roles: ['admin', 'almacenero'], section: 'Inventario' },
  { path: 'reports', label: 'Reportes', icon: 'chart-column', roles: ['admin'], section: 'Administración' },
  { path: 'users', label: 'Usuarios', icon: 'users', roles: ['admin'], section: 'Administración' },
  { path: 'settings', label: 'Configuración', icon: 'settings', roles: ['admin'], section: 'Administración' },
];

const allowed = () => ROUTES.filter((r) => state.user && r.roles.includes(state.user.role));
let cleanup = null;
let clockTimer = null;

// ---------------------------------------------------------------- Tema
export function toggleTheme() {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem('theme', next); } catch { /* noop */ }
  window.dispatchEvent(new Event('themechange'));
}
export const themeIcon = () => (document.documentElement.getAttribute('data-theme') === 'dark' ? 'sun' : 'moon');

// ---------------------------------------------------------------- Configuración del negocio
export async function loadSettings() {
  state.settings = await api.get('/settings');
  return state.settings;
}
export function logoUrl() {
  return state.settings?.has_logo ? `/api/settings/logo?v=${Date.now() % 100000}` : null;
}

// ---------------------------------------------------------------- Layout
function renderShell() {
  const u = state.user;
  const s = state.settings || {};
  let lastSection = '';
  const nav = allowed().map((r) => {
    const head = r.section !== lastSection ? `<div class="nav-section">${r.section}</div>` : '';
    lastSection = r.section;
    return `${head}<a href="#/${r.path}" data-path="${r.path}">${icon(r.icon)}<span>${r.label}</span>${r.path === 'products' ? '<span class="nav-badge" id="lowBadge" hidden></span>' : ''}</a>`;
  }).join('');
  const logo = logoUrl();

  $('#root').innerHTML = `
  <div class="app" id="app">
    <aside class="sidebar" aria-label="Menú principal">
      <div class="sidebar-brand">
        <div class="logo-mark">${logo ? `<img src="${logo}" alt="">` : icon('package-2')}</div>
        <div style="min-width:0"><strong>${esc(s.business_name || 'Mi Bodega')}</strong><small>Inventario & Ventas</small></div>
      </div>
      <nav class="nav">${nav}</nav>
      <div class="sidebar-foot">
        <div class="user-chip">
          <div class="avatar">${esc(initials(u.full_name))}</div>
          <div class="who"><strong>${esc(u.full_name)}</strong><small>${ROLE_LABELS[u.role]}</small></div>
          <button class="btn btn-ghost btn-icon btn-sm" id="logoutBtn" title="Cerrar sesión" style="color:var(--sidebar-text)">${icon('log-out')}</button>
        </div>
      </div>
    </aside>
    <div class="sidebar-backdrop" id="backdrop"></div>
    <div class="main">
      <header class="topbar">
        <button class="btn btn-ghost btn-icon menu-toggle" id="menuBtn" aria-label="Abrir menú">${icon('menu')}</button>
        <div><div class="crumb" id="crumb"></div><h1 id="pageTitle"></h1></div>
        <div class="topbar-actions">
          <span class="clock" id="clock"></span>
          <button class="btn btn-ghost btn-icon" id="themeBtn" title="Cambiar tema">${icon(themeIcon())}</button>
          <div class="dropdown">
            <button class="btn btn-ghost btn-icon" id="userBtn" title="Mi cuenta">${icon('circle-user-round')}</button>
            <div class="dropdown-menu" id="userMenu" hidden>
              <div style="padding:8px 10px 10px"><strong>${esc(u.full_name)}</strong><div class="text-sm text-faint">@${esc(u.username)} · ${ROLE_LABELS[u.role]}</div></div>
              <hr>
              <button id="pwdBtn">${icon('key-round')}Cambiar contraseña</button>
              <button id="logoutBtn2" class="danger">${icon('log-out')}Cerrar sesión</button>
            </div>
          </div>
        </div>
      </header>
      <main class="content" id="view"></main>
    </div>
  </div>`;
  icons();
  animateIn($$('.nav a'), { y: 0, stagger: 0.03 });

  const app = $('#app');
  $('#menuBtn').onclick = () => app.classList.add('nav-open');
  $('#backdrop').onclick = () => app.classList.remove('nav-open');
  $('#themeBtn').onclick = () => {
    toggleTheme();
    $('#themeBtn').innerHTML = icon(themeIcon());
    icons();
  };
  $('#logoutBtn').onclick = logout;
  $('#logoutBtn2').onclick = logout;
  $('#pwdBtn').onclick = () => { $('#userMenu').hidden = true; changePasswordModal(); };
  $('#userBtn').onclick = (e) => {
    e.stopPropagation();
    const m = $('#userMenu');
    m.hidden = !m.hidden;
    if (!m.hidden) animate(m, { opacity: [0, 1], y: [-6, 0] }, { duration: 0.18 });
  };
  document.addEventListener('click', () => { const m = $('#userMenu'); if (m) m.hidden = true; });

  const tick = () => {
    const el = $('#clock');
    if (el) el.textContent = new Date().toLocaleString('es-PE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  tick();
  clearInterval(clockTimer);
  clockTimer = setInterval(tick, 30000);
  refreshLowBadge();
}

/** Contador de productos con stock bajo en el menú. */
export async function refreshLowBadge() {
  try {
    const r = await api.get('/products', { status: 'alert', limit: 1 });
    const b = $('#lowBadge');
    if (b) { b.textContent = r.total; b.hidden = !r.total; }
  } catch { /* silencioso */ }
}

function changePasswordModal() {
  const m = openModal({
    title: 'Cambiar contraseña',
    size: 'sm',
    body: `<form id="pwdForm" class="grid" style="gap:14px" novalidate>
      <div class="field"><label>Contraseña actual</label><input class="input" type="password" name="current_password" autocomplete="current-password"></div>
      <div class="field"><label>Nueva contraseña</label><input class="input" type="password" name="new_password" autocomplete="new-password"><span class="help">Mínimo 6 caracteres</span></div>
      <div class="field"><label>Repetir nueva contraseña</label><input class="input" type="password" name="confirm" autocomplete="new-password"></div>
    </form>`,
    footer: '<button class="btn btn-outline" data-close>Cancelar</button><button class="btn btn-primary" id="pwdSave">Guardar</button>',
  });
  const form = $('#pwdForm', m.el);
  const save = () => withLoading($('#pwdSave', m.el), async () => {
    const d = formData(form);
    const errs = {};
    if (!d.current_password) errs.current_password = 'Ingresa tu contraseña actual';
    if (d.new_password.length < 6) errs.new_password = 'Mínimo 6 caracteres';
    else if (d.new_password !== d.confirm) errs.confirm = 'Las contraseñas no coinciden';
    if (Object.keys(errs).length) return showErrors(form, errs);
    try {
      await api.post('/auth/change-password', d);
      toast('success', 'Contraseña actualizada');
      m.close();
    } catch (err) {
      if (err.details) showErrors(form, err.details); else toastError(err);
    }
  });
  $('#pwdSave', m.el).onclick = save;
  form.onsubmit = (e) => { e.preventDefault(); save(); };
}

// ---------------------------------------------------------------- Enrutador
function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  return { path: path || '', params: Object.fromEntries(new URLSearchParams(query)) };
}

export function navigate(path) {
  location.hash = `#/${path}`;
}

async function router() {
  if (!state.token || !state.user) return showLogin();
  if (!$('#app')) renderShell();

  const { path, params } = parseHash();
  const routes = allowed();
  const route = routes.find((r) => r.path === path) || (path ? null : routes[0]);
  if (!route) {
    if (path && ROUTES.some((r) => r.path === path)) toast('warning', 'Acceso restringido', 'Tu rol no tiene permiso para esa sección');
    return navigate(routes[0].path);
  }

  if (cleanup) { try { cleanup(); } catch { /* noop */ } cleanup = null; }
  destroyCharts();
  $('#app').classList.remove('nav-open');
  $$('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.path === route.path));
  $('#pageTitle').textContent = route.label;
  $('#crumb').textContent = route.section;
  document.title = `${route.label} · ${state.settings?.business_name || 'Inventario'}`;

  const view = $('#view');
  view.innerHTML = '<div class="loading-block"><span class="spinner"></span></div>';
  try {
    const mod = await import(`./views/${route.path}.js`);
    view.innerHTML = '';
    cleanup = (await mod.render(view, params)) || null;
    icons();
    animate(view, { opacity: [0, 1], y: [8, 0] }, { duration: 0.32, ease: [0.22, 1, 0.36, 1] });
  } catch (err) {
    console.error(err);
    view.innerHTML = `<div class="card"><div class="empty"><div class="empty-icon">${icon('cloud-off')}</div>
      <h4>No se pudo cargar esta sección</h4><p>${esc(err.message)}</p>
      <button class="btn btn-primary" onclick="location.reload()">${icon('refresh-cw')}Reintentar</button></div></div>`;
    icons();
  }
}

// ---------------------------------------------------------------- Sesión
async function showLogin() {
  if (cleanup) { try { cleanup(); } catch { /* noop */ } cleanup = null; }
  destroyCharts();
  let pub = {};
  try { pub = await api.get('/settings/public'); } catch { /* sin conexión: login igual */ }
  renderLogin($('#root'), pub, async () => {
    await loadSettings();
    renderShell();
    if (!parseHash().path) navigate(allowed()[0].path);
    else router();
  });
}

function logout() {
  clearSession();
  state.settings = null;
  location.hash = '';
  showLogin();
  toast('info', 'Sesión cerrada', 'Hasta pronto');
}

window.addEventListener('session-expired', (e) => {
  toast('warning', 'Sesión expirada', e.detail || 'Vuelve a ingresar');
  showLogin();
});
window.addEventListener('hashchange', router);
window.addEventListener('themechange', () => { if ($('#app')) router(); });

// ---------------------------------------------------------------- Inicio
(async function boot() {
  if (state.token) {
    try {
      const { user } = await api.get('/auth/me');
      state.user = user;
      await loadSettings();
    } catch (err) {
      if (err.status !== 401) toastError(err, 'Error de conexión');
      clearSession();
    }
  }
  router();
})();

export { renderShell };
