/**
 * Pantalla de inicio de sesión: panel de marca animado + formulario.
 */
import { api } from '../api.js';
import { setSession } from '../state.js';
import { $, $$, esc, icon, icons, animate, animateIn, shake } from '../ui.js';

// Íconos que flotan en el panel izquierdo: [ícono, left%, top%, tamaño px, rotación°]
const FLOATERS = [
  ['cup-soda', 70, 12, 86, -8],
  ['beer', 82, 42, 74, 10],
  ['glass-water', 62, 68, 64, -6],
  ['shopping-basket', 12, 72, 70, 8],
  ['barcode', 86, 78, 56, -12],
  ['receipt-text', 46, 84, 52, 6],
  ['package', 54, 30, 50, 12],
];

export function renderLogin(root, pub = {}, onSuccess) {
  const business = pub.business_name || 'Mi Bodega';
  const logo = pub.has_logo ? `<img src="/api/settings/logo" alt="">` : icon('package-2');
  const savedUser = (() => { try { return localStorage.getItem('lastUser') || ''; } catch { return ''; } })();
  const dark = document.documentElement.getAttribute('data-theme') === 'dark';

  root.innerHTML = `
  <div class="login">
    <section class="login-hero" aria-hidden="true">
      <div class="float-layer">
        ${FLOATERS.map(([ic, l, t, s]) => `<div class="float-item" style="left:${l}%;top:${t}%;width:${s}px;height:${s}px">${icon(ic)}</div>`).join('')}
      </div>
      <div class="login-brand"><div class="logo-mark">${logo}</div><strong>${esc(business)}</strong></div>
      <div class="login-hero-copy">
        <h1>Controla tu negocio <span>en tiempo real</span></h1>
        <p>Inventario, ventas y caja en un solo lugar. Sabe qué se vende, qué falta y cuánto ganas cada día.</p>
        <div class="login-features">
          <span>${icon('scan-barcode')}Venta rápida con código de barras</span>
          <span>${icon('bell-ring')}Alertas de stock bajo</span>
          <span>${icon('chart-line')}Reportes y ganancias</span>
          <span>${icon('smartphone')}Yape y Plin</span>
        </div>
      </div>
      <div class="login-foot">© ${new Date().getFullYear()} · Sistema de Inventario y Punto de Venta</div>
    </section>

    <section class="login-panel">
      <button class="btn btn-ghost btn-icon login-theme" id="loginTheme" title="Cambiar tema" aria-label="Cambiar tema">${icon(dark ? 'sun' : 'moon')}</button>
      <div class="login-card">
        <div class="logo-mark lg" data-in>${logo}</div>
        <h2 data-in>¡Bienvenido de nuevo!</h2>
        <p class="sub" data-in>Ingresa tus credenciales para acceder a <strong>${esc(business)}</strong></p>

        <div class="login-error" id="loginError" hidden>${icon('circle-alert')}<span></span></div>

        <form id="loginForm" novalidate>
          <div class="field" data-in>
            <label for="username">Usuario</label>
            <div class="input-icon">${icon('user-round')}
              <input class="input" id="username" name="username" autocomplete="username" placeholder="Tu usuario" value="${esc(savedUser)}" maxlength="50" required>
            </div>
          </div>
          <div class="field" data-in>
            <label for="password">Contraseña</label>
            <div class="input-icon has-action">${icon('lock-keyhole')}
              <input class="input" id="password" name="password" type="password" autocomplete="current-password" placeholder="Tu contraseña" maxlength="100" required>
              <button type="button" class="btn btn-ghost btn-icon btn-sm input-action" id="togglePwd" aria-label="Mostrar contraseña">${icon('eye')}</button>
            </div>
            <div class="caps-hint" id="capsHint" hidden>${icon('arrow-big-up')}Bloq Mayús está activado</div>
          </div>
          <div class="login-row" data-in>
            <label class="checkbox"><input type="checkbox" id="remember" ${savedUser ? 'checked' : ''}> Recordar usuario</label>
          </div>
          <button class="btn btn-primary" type="submit" id="loginBtn" data-in>${icon('log-in')}Ingresar</button>
        </form>
        <p class="login-copy" data-in>¿Olvidaste tu contraseña? Pide al administrador que la restablezca.</p>
      </div>
    </section>
  </div>`;
  icons();

  // ---- Animaciones de entrada
  animateIn($$('[data-in]', root), { y: 18, stagger: 0.06, delay: 0.05 });
  animate($('.login-hero-copy', root), { opacity: [0, 1], x: [-24, 0] }, { duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] });
  $$('.float-item', root).forEach((el, i) => {
    const rot = FLOATERS[i][4];
    animate(el, { opacity: [0, 1], scale: [0.6, 1] }, { duration: 0.6, delay: 0.25 + i * 0.08, ease: [0.22, 1, 0.36, 1] });
    // Flotación suave e infinita, cada ícono con su propio ritmo
    animate(el, { y: [0, -14, 0], rotate: [rot, rot + 6, rot] }, { duration: 5 + (i % 3) * 1.4, repeat: Infinity, ease: 'easeInOut', delay: i * 0.3 });
  });

  const form = $('#loginForm', root);
  const user = $('#username', root);
  const pwd = $('#password', root);
  const btn = $('#loginBtn', root);
  const errBox = $('#loginError', root);
  (savedUser ? pwd : user).focus();

  $('#loginTheme', root).onclick = () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch { /* noop */ }
    $('#loginTheme', root).innerHTML = icon(next === 'dark' ? 'sun' : 'moon');
    icons();
  };

  $('#togglePwd', root).onclick = () => {
    const show = pwd.type === 'password';
    pwd.type = show ? 'text' : 'password';
    $('#togglePwd', root).innerHTML = icon(show ? 'eye-off' : 'eye');
    icons();
    pwd.focus();
  };

  pwd.addEventListener('keyup', (e) => {
    $('#capsHint', root).hidden = !(e.getModifierState && e.getModifierState('CapsLock'));
  });

  function showError(msg) {
    $('span', errBox).textContent = msg;
    if (errBox.hidden) {
      errBox.hidden = false;
      animate(errBox, { opacity: [0, 1], y: [-8, 0] }, { duration: 0.25 });
    }
    shake($('.login-card', root));
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errBox.hidden = true;
    [user, pwd].forEach((i) => i.classList.remove('invalid'));
    if (!user.value.trim()) { user.classList.add('invalid'); return showError('Ingresa tu usuario'); }
    if (!pwd.value) { pwd.classList.add('invalid'); return showError('Ingresa tu contraseña'); }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>Verificando...';
    try {
      const { token, user: u } = await api.post('/auth/login', { username: user.value.trim(), password: pwd.value });
      try {
        if ($('#remember', root).checked) localStorage.setItem('lastUser', user.value.trim());
        else localStorage.removeItem('lastUser');
      } catch { /* noop */ }
      setSession(token, u);
      btn.innerHTML = `${icon('check')}¡Bienvenido!`;
      icons();
      const out = animate($('.login', root), { opacity: [1, 0], scale: [1, 0.985] }, { duration: 0.3 });
      if (out) await out;
      await onSuccess();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `${icon('log-in')}Ingresar`;
      icons();
      if (err.status === 401) pwd.classList.add('invalid');
      pwd.select();
      showError(err.message);
    }
  });
}
