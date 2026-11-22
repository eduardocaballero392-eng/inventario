/**
 * Proveedores: CRUD, productos asociados y últimas compras.
 */
import { api } from '../api.js';
import { can } from '../state.js';
import {
  $, $$, esc, icon, icons, money, num, fmtDate, debounce, toast, toastError, openModal, confirmDialog, withLoading,
  formData, showErrors, check, req, tableHead, skeletonRows, emptyState, renderPagination, animateIn, initials,
} from '../ui.js';
import { navigate } from '../main.js';

export async function render(root) {
  const filters = { q: '', page: 1, limit: 15 };

  root.innerHTML = `
    <div class="page-head">
      <div><h2>Proveedores</h2><p>Distribuidores y empresas que te abastecen.</p></div>
      ${can('suppliers.write') ? `<div class="actions"><button class="btn btn-primary" id="newBtn">${icon('plus')}Nuevo proveedor</button></div>` : ''}
    </div>
    <div class="card">
      <div class="toolbar"><div class="grow input-icon">${icon('search')}<input class="input" id="q" placeholder="Buscar por razón social, RUC, contacto o teléfono..."></div></div>
      <div class="table-wrap"><table class="table" id="table"></table></div>
      <div class="pagination" id="pager"></div>
    </div>`;
  icons();

  const cols = [{ label: 'Proveedor' }, { label: 'RUC' }, { label: 'Contacto', cls: 'hide-sm' }, { label: 'Productos', cls: 'num' }, { label: 'Última compra', cls: 'hide-sm' }, { label: '', cls: 'actions-cell' }];

  async function load() {
    const table = $('#table');
    table.innerHTML = tableHead(cols) + `<tbody>${skeletonRows(cols.length)}</tbody>`;
    try {
      const res = await api.get('/suppliers', filters);
      $('tbody', table).innerHTML = res.data.length ? res.data.map((s) => `
        <tr>
          <td><div class="prod-cell"><div class="avatar" style="background:linear-gradient(135deg,#0891b2,#2563eb)">${esc(initials(s.name))}</div>
            <div><strong>${esc(s.name)}</strong>${s.address ? `<small>${esc(s.address)}</small>` : ''}</div></div></td>
          <td class="mono">${esc(s.ruc || '—')}</td>
          <td class="hide-sm">${esc(s.contact || '—')}${s.phone ? `<div class="muted">${icon('phone')} ${esc(s.phone)}</div>` : ''}${s.email ? `<div class="muted">${esc(s.email)}</div>` : ''}</td>
          <td class="num"><span class="badge badge-blue">${num(s.product_count)}</span></td>
          <td class="hide-sm">${s.last_purchase ? fmtDate(s.last_purchase) : '<span class="muted">—</span>'}</td>
          <td class="actions-cell">
            <button class="btn btn-ghost btn-icon btn-sm" data-view="${s.id}" title="Ver detalle">${icon('eye')}</button>
            ${can('suppliers.write') ? `<button class="btn btn-ghost btn-icon btn-sm" data-edit="${s.id}" title="Editar">${icon('pencil')}</button>` : ''}
            ${can('suppliers.delete') ? `<button class="btn btn-ghost btn-icon btn-sm" data-del="${s.id}" title="Eliminar" style="color:var(--danger)">${icon('trash-2')}</button>` : ''}
          </td>
        </tr>`).join('') : `<tr><td colspan="${cols.length}">${emptyState({ iconName: 'truck', title: filters.q ? 'Sin resultados' : 'Aún no hay proveedores', text: filters.q ? '' : 'Registra a tus distribuidores para asociarlos a tus productos y compras.', action: !filters.q && can('suppliers.write') ? `<button class="btn btn-primary" data-new>${icon('plus')}Agregar proveedor</button>` : '' })}</td></tr>`;
      icons();
      animateIn($$('tbody tr', table), { y: 6, stagger: 0.02, duration: 0.3 });
      const find = (id) => res.data.find((x) => x.id === Number(id));
      $$('[data-edit]', table).forEach((b) => { b.onclick = () => form(find(b.dataset.edit)); });
      $$('[data-view]', table).forEach((b) => { b.onclick = () => detail(Number(b.dataset.view)); });
      $$('[data-del]', table).forEach((b) => { b.onclick = () => remove(find(b.dataset.del)); });
      $$('[data-new]', table).forEach((b) => { b.onclick = () => form(); });
      renderPagination($('#pager'), res, (p) => { filters.page = p; load(); });
    } catch (err) {
      $('tbody', table).innerHTML = `<tr><td colspan="${cols.length}">${emptyState({ iconName: 'cloud-off', title: 'Error', text: err.message })}</td></tr>`;
      icons();
    }
  }

  function form(s = null) {
    const m = openModal({
      title: s ? 'Editar proveedor' : 'Nuevo proveedor',
      size: 'lg',
      body: `<form id="sForm" class="form-grid" novalidate>
        <div class="field span-2"><label>Razón social <span class="req">*</span></label><input class="input" name="name" maxlength="120" value="${esc(s?.name)}" placeholder="Ej: Distribuidora Andina S.A.C."></div>
        <div class="field"><label>RUC</label><input class="input" name="ruc" maxlength="11" inputmode="numeric" value="${esc(s?.ruc)}" placeholder="11 dígitos"></div>
        <div class="field"><label>Teléfono</label><input class="input" name="phone" maxlength="30" value="${esc(s?.phone)}" placeholder="Ej: 987 654 321"></div>
        <div class="field"><label>Persona de contacto</label><input class="input" name="contact" maxlength="120" value="${esc(s?.contact)}"></div>
        <div class="field"><label>Correo</label><input class="input" type="email" name="email" maxlength="120" value="${esc(s?.email)}" placeholder="ventas@empresa.pe"></div>
        <div class="field span-2"><label>Dirección</label><input class="input" name="address" maxlength="200" value="${esc(s?.address)}"></div>
        <div class="field span-2"><label>Notas</label><textarea class="textarea" name="notes" maxlength="500" placeholder="Días de visita, condiciones de pago, etc.">${esc(s?.notes)}</textarea></div>
      </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancelar</button><button class="btn btn-primary" id="save">${icon('save')}Guardar</button>`,
    });
    const f = $('#sForm', m.el);
    f.ruc.oninput = () => { f.ruc.value = f.ruc.value.replace(/\D/g, ''); };
    const save = () => withLoading($('#save', m.el), async () => {
      const d = formData(f);
      const errors = check(d, {
        name: [req('La razón social')],
        ruc: [(v) => (v && !/^\d{11}$/.test(v) ? 'El RUC debe tener 11 dígitos' : null)],
        email: [(v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? 'Correo inválido' : null)],
      });
      if (errors) return showErrors(f, errors);
      try {
        if (s) await api.put(`/suppliers/${s.id}`, d); else await api.post('/suppliers', d);
        toast('success', s ? 'Proveedor actualizado' : 'Proveedor creado', d.name);
        m.close();
        load();
      } catch (err) { if (err.details) showErrors(f, err.details); else toastError(err); }
    });
    $('#save', m.el).onclick = save;
    f.onsubmit = (e) => { e.preventDefault(); save(); };
  }

  async function detail(id) {
    const m = openModal({ title: 'Proveedor', size: 'lg', body: '<div class="loading-block"><span class="spinner"></span></div>' });
    try {
      const s = await api.get(`/suppliers/${id}`);
      m.body.innerHTML = `
        <h3 style="font-size:18px">${esc(s.name)}</h3>
        <div class="dl mt-3 mb">
          <div><span>RUC</span><strong class="mono">${esc(s.ruc || '—')}</strong></div>
          <div><span>Teléfono</span><strong>${esc(s.phone || '—')}</strong></div>
          <div><span>Contacto</span><strong>${esc(s.contact || '—')}</strong></div>
          <div><span>Correo</span><strong>${esc(s.email || '—')}</strong></div>
          <div><span>Dirección</span><strong>${esc(s.address || '—')}</strong></div>
        </div>
        ${s.notes ? `<div class="alert alert-info mb">${icon('sticky-note')}<div>${esc(s.notes)}</div></div>` : ''}
        <div class="flex justify-between items-center mb"><h4>Productos que suministra (${s.products.length})</h4>
          ${s.products.length ? `<button class="btn btn-ghost btn-sm" id="seeProducts">Ver en productos ${icon('arrow-right')}</button>` : ''}</div>
        <div class="card mb"><div class="table-wrap"><table class="table compact">
          <thead><tr><th>Producto</th><th class="num">Costo</th><th class="num">Stock</th></tr></thead>
          <tbody>${s.products.map((p) => `<tr class="${p.stock <= p.min_stock ? 'row-warn' : ''}"><td><strong>${esc(p.name)}</strong><div class="muted">${esc(p.category_name || '')}</div></td><td class="num">${money(p.purchase_price)}</td><td class="num ${p.stock <= p.min_stock ? 'text-warning fw-7' : ''}">${num(p.stock)}</td></tr>`).join('') || `<tr><td colspan="3">${emptyState({ iconName: 'package', title: 'Sin productos asociados' })}</td></tr>`}</tbody>
        </table></div></div>
        <h4 class="mb">Últimas compras</h4>
        <div class="card"><div class="table-wrap"><table class="table compact">
          <thead><tr><th>Fecha</th><th>Producto</th><th class="num">Cant.</th><th class="num">Costo</th><th class="hide-sm">Documento</th></tr></thead>
          <tbody>${s.purchases.map((p) => `<tr><td>${fmtDate(p.created_at)}</td><td>${esc(p.product_name)}</td><td class="num">${num(p.quantity)}</td><td class="num">${p.unit_cost != null ? money(p.unit_cost) : '—'}</td><td class="hide-sm mono">${esc(p.reference || '—')}</td></tr>`).join('') || `<tr><td colspan="5">${emptyState({ iconName: 'receipt', title: 'Sin compras registradas' })}</td></tr>`}</tbody>
        </table></div></div>`;
      icons();
      $('#seeProducts', m.el)?.addEventListener('click', () => { m.close(); navigate(`products?supplier_id=${s.id}`); });
    } catch (err) { m.body.innerHTML = emptyState({ iconName: 'cloud-off', title: 'Error', text: err.message }); icons(); }
  }

  async function remove(s) {
    if (!(await confirmDialog({ title: 'Eliminar proveedor', message: `¿Eliminar a <strong>${esc(s.name)}</strong>? Sus productos quedarán sin proveedor asignado; el historial de compras se conserva.`, confirmText: 'Eliminar' }))) return;
    try { await api.del(`/suppliers/${s.id}`); toast('success', 'Proveedor eliminado'); load(); } catch (err) { toastError(err); }
  }

  $('#q').oninput = debounce((e) => { filters.q = e.target.value.trim(); filters.page = 1; load(); }, 300);
  $('#newBtn')?.addEventListener('click', () => form());
  await load();
}
