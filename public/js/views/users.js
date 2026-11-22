/**
 * Usuarios y roles (solo administrador).
 */
import { api } from '../api.js';
import { state, ROLE_LABELS } from '../state.js';
import {
  $, $$, esc, icon, icons, num, fmtDate, relTime, toast, toastError, openModal, confirmDialog, withLoading,
  formData, showErrors, check, req, emptyState, animateIn, initials,
} from '../ui.js';

const ROLE_INFO = {
  admin: { badge: 'badge-blue', icon: 'shield-check', desc: 'Acceso total: reportes, usuarios, configuración, anular ventas.' },
  cajero: { badge: 'badge-green', icon: 'scan-barcode', desc: 'Punto de venta, sus propias ventas y consulta de productos.' },
  almacenero: { badge: 'badge-amber', icon: 'warehouse', desc: 'Productos, control de stock, compras y proveedores.' },
};

export async function render(root) {
  root.innerHTML = `
    <div class="page-head">
      <div><h2>Usuarios</h2><p>Personas con acceso al sistema y sus permisos.</p></div>
      <div class="actions"><button class="btn btn-primary" id="newBtn">${icon('user-plus')}Nuevo usuario</button></div>
    </div>
    <div class="grid grid-3 mb">${Object.entries(ROLE_INFO).map(([k, r]) => `
      <div class="card card-body"><div class="flex items-center gap-2 mb"><span class="badge ${r.badge}">${icon(r.icon)}${ROLE_LABELS[k]}</span></div><p class="text-sm text-muted">${r.desc}</p></div>`).join('')}</div>
    <div class="card"><div class="table-wrap"><table class="table" id="table"><tbody><tr><td><div class="loading-block"><span class="spinner"></span></div></td></tr></tbody></table></div></div>`;
  icons();

  let users = [];
  async function load() {
    try {
      users = await api.get('/users');
      $('#table').innerHTML = `
        <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th class="hide-sm">Último ingreso</th><th class="num hide-sm">Ventas</th><th class="actions-cell"></th></tr></thead>
        <tbody>${users.map((u) => `<tr style="${u.active ? '' : 'opacity:.6'}">
          <td><div class="prod-cell"><div class="avatar">${esc(initials(u.full_name))}</div><div><strong>${esc(u.full_name)}${u.id === state.user.id ? ' <span class="badge">Tú</span>' : ''}</strong><small>@${esc(u.username)}</small></div></div></td>
          <td><span class="badge ${ROLE_INFO[u.role].badge}">${icon(ROLE_INFO[u.role].icon)}${ROLE_LABELS[u.role]}</span></td>
          <td>${u.active ? '<span class="badge badge-green">Activo</span>' : '<span class="badge">Inactivo</span>'}</td>
          <td class="hide-sm">${u.last_login ? `${relTime(u.last_login)}<div class="muted">${fmtDate(u.last_login, true)}</div>` : '<span class="muted">Nunca</span>'}</td>
          <td class="num hide-sm">${num(u.sales_count)}</td>
          <td class="actions-cell">
            <button class="btn btn-ghost btn-icon btn-sm" data-edit="${u.id}" title="Editar">${icon('pencil')}</button>
            ${u.id !== state.user.id ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${u.id}" title="Eliminar" style="color:var(--danger)">${icon('trash-2')}</button>` : ''}
          </td></tr>`).join('')}</tbody>`;
      icons();
      animateIn($$('#table tbody tr'), { y: 6, stagger: 0.03 });
      $$('[data-edit]').forEach((b) => { b.onclick = () => form(users.find((u) => u.id === Number(b.dataset.edit))); });
      $$('[data-del]').forEach((b) => { b.onclick = () => remove(users.find((u) => u.id === Number(b.dataset.del))); });
    } catch (err) {
      $('#table').innerHTML = `<tbody><tr><td>${emptyState({ iconName: 'cloud-off', title: 'Error', text: err.message })}</td></tr></tbody>`;
      icons();
    }
  }

  function form(u = null) {
    const self = u && u.id === state.user.id;
    const m = openModal({
      title: u ? 'Editar usuario' : 'Nuevo usuario',
      body: `<form id="uForm" class="form-grid" novalidate>
        <div class="field span-2"><label>Nombre completo <span class="req">*</span></label><input class="input" name="full_name" maxlength="100" value="${esc(u?.full_name)}" placeholder="Ej: María López"></div>
        <div class="field"><label>Usuario <span class="req">*</span></label><input class="input" name="username" maxlength="30" value="${esc(u?.username)}" placeholder="ej: maria" autocomplete="off"><span class="help">Letras, números, punto o guion</span></div>
        <div class="field"><label>Rol <span class="req">*</span></label><select class="select" name="role" ${self ? 'disabled' : ''}>
          ${Object.keys(ROLE_INFO).map((r) => `<option value="${r}" ${u?.role === r ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`).join('')}</select></div>
        <div class="field span-2"><label>${u ? 'Nueva contraseña' : 'Contraseña <span class="req">*</span>'}</label>
          <input class="input" type="password" name="password" maxlength="100" autocomplete="new-password" placeholder="${u ? 'Déjalo vacío para no cambiarla' : 'Mínimo 6 caracteres'}"></div>
        <div class="span-2"><label class="switch"><input type="checkbox" name="active" ${!u || u.active ? 'checked' : ''} ${self ? 'disabled' : ''}><span class="track"></span><span>Usuario activo (puede iniciar sesión)</span></label></div>
        <div class="span-2 alert alert-info" id="roleDesc">${icon('info')}<div></div></div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancelar</button><button class="btn btn-primary" id="save">${icon('save')}Guardar</button>`,
    });
    const f = $('#uForm', m.el);
    const desc = () => { $('#roleDesc div', m.el).textContent = ROLE_INFO[f.role.value].desc; };
    f.role.onchange = desc;
    desc();
    const save = () => withLoading($('#save', m.el), async () => {
      const d = formData(f);
      if (self) { d.role = 'admin'; d.active = true; }
      const errors = check(d, {
        full_name: [req('El nombre')],
        username: [req('El usuario'), (v) => (!/^[a-zA-Z0-9._-]{3,30}$/.test(v) ? 'Mínimo 3 caracteres: letras, números, punto o guion' : null)],
        password: [(v) => (!u && !v ? 'La contraseña es obligatoria' : v && v.length < 6 ? 'Mínimo 6 caracteres' : null)],
      });
      if (errors) return showErrors(f, errors);
      if (u && !d.password) delete d.password;
      try {
        if (u) await api.put(`/users/${u.id}`, d); else await api.post('/users', d);
        toast('success', u ? 'Usuario actualizado' : 'Usuario creado', d.full_name);
        m.close();
        load();
      } catch (err) { if (err.details) showErrors(f, err.details); else toastError(err); }
    });
    $('#save', m.el).onclick = save;
    f.onsubmit = (e) => { e.preventDefault(); save(); };
  }

  async function remove(u) {
    if (!(await confirmDialog({ title: 'Eliminar usuario', message: `¿Eliminar a <strong>${esc(u.full_name)}</strong>? Si tiene ventas registradas solo se desactivará.`, confirmText: 'Eliminar' }))) return;
    try { const r = await api.del(`/users/${u.id}`); toast('success', r.message); load(); } catch (err) { toastError(err); }
  }

  $('#newBtn').onclick = () => form();
  await load();
}
