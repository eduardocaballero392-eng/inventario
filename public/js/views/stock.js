/**
 * Control de stock: compras (entradas), salidas, mermas, ajustes por conteo,
 * historial de movimientos (kardex general) y alertas de stock bajo / vencimiento.
 */
import { api } from '../api.js';
import { can, state } from '../state.js';
import {
  $, $$, esc, icon, icons, money, num, fmtDate, fmtTime, debounce, toast, toastError, openModal, withLoading,
  tableHead, skeletonRows, emptyState, renderPagination, animateIn, exportExcel, MOVEMENT, today, shake,
} from '../ui.js';
import { refreshLowBadge } from '../main.js';

const TYPES = {
  entrada: { title: 'Registrar compra / entrada', icon: 'package-plus', tone: 'success', help: 'Mercadería que llega del proveedor. Suma al stock.' },
  salida: { title: 'Registrar salida', icon: 'package-minus', tone: 'warning', help: 'Consumo interno, devolución al proveedor, regalos, etc. Resta del stock.' },
  merma: { title: 'Registrar merma', icon: 'trash-2', tone: 'danger', help: 'Productos vencidos, rotos o dañados. Resta del stock.' },
  ajuste: { title: 'Ajuste por conteo físico', icon: 'clipboard-check', tone: 'info', help: 'Corrige el stock según lo que contaste realmente en el almacén.' },
};

export async function render(root, params) {
  let tab = params.tab || 'movements';
  const filters = { q: '', type: '', from: '', to: '', page: 1, limit: 20 };
  let suppliers = [];

  root.innerHTML = `
    <div class="page-head">
      <div><h2>Control de stock</h2><p>Entradas, salidas y ajustes con trazabilidad completa.</p></div>
      ${can('stock.write') ? `<div class="actions">
        <button class="btn btn-success" data-new="entrada">${icon('package-plus')}Compra / entrada</button>
        <button class="btn btn-outline" data-new="salida">${icon('package-minus')}Salida</button>
        <button class="btn btn-outline" data-new="merma">${icon('trash-2')}Merma</button>
        <button class="btn btn-outline" data-new="ajuste">${icon('clipboard-check')}Ajuste</button>
      </div>` : ''}
    </div>
    <div class="card">
      <div class="tabs" id="tabs">
        <button data-tab="movements">${icon('history')}Historial de movimientos</button>
        <button data-tab="alerts">${icon('bell-ring')}Alertas <span class="badge badge-red" id="alertCount" hidden></span></button>
      </div>
      <div id="tabBody"></div>
    </div>`;
  icons();

  // ---------------------------------------------------------- historial
  function movementsTab() {
    $('#tabBody').innerHTML = `
      <div class="toolbar">
        <div class="grow input-icon">${icon('search')}<input class="input" id="q" placeholder="Buscar producto, motivo o N° de documento..." value="${esc(filters.q)}"></div>
        <select class="select" id="type"><option value="">Todos los tipos</option>${Object.entries(MOVEMENT).map(([k, v]) => `<option value="${k}" ${filters.type === k ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
        <input class="input" type="date" id="from" value="${filters.from}" title="Desde" style="min-width:140px">
        <input class="input" type="date" id="to" value="${filters.to}" title="Hasta" style="min-width:140px">
        <button class="btn btn-outline btn-icon" id="exp" title="Exportar a Excel">${icon('file-spreadsheet')}</button>
      </div>
      <div class="table-wrap"><table class="table" id="movTable"></table></div>
      <div class="pagination" id="pager"></div>`;
    icons();
    $('#q').oninput = debounce((e) => { filters.q = e.target.value.trim(); filters.page = 1; loadMovements(); }, 300);
    $('#type').onchange = (e) => { filters.type = e.target.value; filters.page = 1; loadMovements(); };
    $('#from').onchange = (e) => { filters.from = e.target.value; filters.page = 1; loadMovements(); };
    $('#to').onchange = (e) => { filters.to = e.target.value; filters.page = 1; loadMovements(); };
    $('#exp').onclick = () => withLoading($('#exp'), async () => {
      try {
        const { data } = await api.get('/stock/movements', { ...filters, page: 1, limit: 'all' });
        await exportExcel(`movimientos-stock-${today()}`, [{
          name: 'Movimientos',
          rows: data.map((m) => ({ Fecha: m.created_at, Tipo: MOVEMENT[m.type]?.label || m.type, Código: m.product_code, Producto: m.product_name, Cantidad: m.quantity, 'Stock anterior': m.stock_before, 'Stock nuevo': m.stock_after, 'Costo unit.': m.unit_cost ?? '', Motivo: m.reason || '', Referencia: m.reference || '', Proveedor: m.supplier_name || '', Usuario: m.user_name || '' })),
        }]);
      } catch (err) { toastError(err); }
    });
    loadMovements();
  }

  const cols = [
    { label: 'Fecha' }, { label: 'Producto' }, { label: 'Tipo' }, { label: 'Cantidad', cls: 'num' },
    { label: 'Stock', cls: 'num hide-sm' }, { label: 'Motivo / referencia', cls: 'hide-sm' }, { label: 'Usuario', cls: 'hide-sm' },
  ];

  async function loadMovements() {
    const table = $('#movTable');
    if (!table) return;
    table.innerHTML = tableHead(cols) + `<tbody>${skeletonRows(cols.length, 8)}</tbody>`;
    try {
      const res = await api.get('/stock/movements', filters);
      $('tbody', table).innerHTML = res.data.length ? res.data.map((m) => {
        const t = MOVEMENT[m.type] || {};
        return `<tr>
          <td>${fmtDate(m.created_at)}<div class="muted">${fmtTime(m.created_at)}</div></td>
          <td><strong>${esc(m.product_name)}</strong><div class="muted mono">${esc(m.product_code)}</div></td>
          <td><span class="badge ${t.badge || ''}">${icon(t.icon || 'circle')}${t.label || m.type}</span></td>
          <td class="num fw-7 ${m.quantity > 0 ? 'text-success' : 'text-danger'}">${m.quantity > 0 ? '+' : ''}${num(m.quantity)}</td>
          <td class="num hide-sm"><span class="muted">${num(m.stock_before)} →</span> <strong>${num(m.stock_after)}</strong></td>
          <td class="hide-sm">${esc(m.reason || '—')}${m.reference ? `<div class="muted mono">${esc(m.reference)}</div>` : ''}${m.supplier_name ? `<div class="muted">${esc(m.supplier_name)}</div>` : ''}</td>
          <td class="hide-sm muted">${esc(m.user_name || '—')}</td>
        </tr>`;
      }).join('') : `<tr><td colspan="${cols.length}">${emptyState({ iconName: 'history', title: 'No hay movimientos', text: 'Prueba cambiando los filtros.' })}</td></tr>`;
      icons();
      animateIn($$('tbody tr', table), { y: 6, stagger: 0.015, duration: 0.25 });
      renderPagination($('#pager'), res, (p) => { filters.page = p; loadMovements(); });
    } catch (err) {
      $('tbody', table).innerHTML = `<tr><td colspan="${cols.length}">${emptyState({ iconName: 'cloud-off', title: 'Error al cargar', text: err.message })}</td></tr>`;
      icons();
    }
  }

  // ---------------------------------------------------------- alertas
  async function alertsTab() {
    $('#tabBody').innerHTML = '<div class="loading-block"><span class="spinner"></span></div>';
    try {
      const a = await api.get('/stock/alerts');
      $('#tabBody').innerHTML = `
        <div class="card-body">
          <div class="grid grid-2-even">
            <div class="card">
              <div class="card-head"><div><h3>${icon('triangle-alert')} Stock bajo y agotados</h3><div class="hint">${a.low.length} producto(s) por reponer</div></div>
                ${a.low.length && can('stock.write') ? `<button class="btn btn-success btn-sm" id="restockAll">${icon('package-plus')}Reponer</button>` : ''}</div>
              ${a.low.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>Producto</th><th class="num">Stock</th><th class="num">Mín.</th><th class="hide-sm">Proveedor</th></tr></thead><tbody>
                ${a.low.map((p) => `<tr class="${p.stock <= 0 ? 'row-alert' : 'row-warn'}"><td><strong>${esc(p.name)}</strong><div class="muted">${esc(p.category_name || '')}</div></td>
                  <td class="num fw-7 ${p.stock <= 0 ? 'text-danger' : 'text-warning'}">${num(p.stock)}</td><td class="num">${num(p.min_stock)}</td><td class="hide-sm muted">${esc(p.supplier_name || '—')}</td></tr>`).join('')}
              </tbody></table></div>` : emptyState({ iconName: 'circle-check', title: 'Todo el stock está en orden' })}
            </div>
            <div class="card">
              <div class="card-head"><div><h3>${icon('calendar-clock')} Por vencer</h3><div class="hint">Vencen en los próximos ${a.expiry_days} días</div></div></div>
              ${a.expiring.length ? `<div class="table-wrap"><table class="table compact"><thead><tr><th>Producto</th><th>Vence</th><th class="num">Stock</th></tr></thead><tbody>
                ${a.expiring.map((p) => `<tr class="${p.days_left < 0 ? 'row-alert' : 'row-warn'}"><td><strong>${esc(p.name)}</strong></td>
                  <td>${fmtDate(p.expiry_date)}<div class="muted ${p.days_left < 0 ? 'text-danger' : 'text-warning'}">${p.days_left < 0 ? `Vencido hace ${Math.abs(p.days_left)} día(s)` : p.days_left === 0 ? 'Vence hoy' : `En ${p.days_left} día(s)`}</div></td>
                  <td class="num">${num(p.stock)}</td></tr>`).join('')}
              </tbody></table></div>` : emptyState({ iconName: 'calendar-check', title: 'Ningún producto por vencer' })}
            </div>
          </div>
        </div>`;
      icons();
      $('#restockAll')?.addEventListener('click', () => movementForm('entrada', a.low.map((p) => ({ id: p.id, name: p.name, code: p.code, stock: p.stock, qty: Math.max(p.min_stock * 2 - p.stock, 1) }))));
    } catch (err) {
      $('#tabBody').innerHTML = emptyState({ iconName: 'cloud-off', title: 'Error', text: err.message });
      icons();
    }
  }

  async function updateAlertCount() {
    try {
      const a = await api.get('/stock/alerts');
      const n = a.low.length + a.expiring.length;
      const b = $('#alertCount');
      if (b) { b.textContent = n; b.hidden = !n; }
    } catch { /* noop */ }
  }

  function switchTab(t) {
    tab = t;
    $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === t));
    if (t === 'alerts') alertsTab(); else movementsTab();
  }
  $$('#tabs button').forEach((b) => { b.onclick = () => switchTab(b.dataset.tab); });

  // ---------------------------------------------------------- formulario de movimiento
  /** Buscador de productos con sugerencias. onPick(producto) */
  function productPicker(input, list, onPick) {
    let results = [];
    let idx = -1;
    const draw = () => {
      list.hidden = !results.length;
      list.innerHTML = results.map((p, i) => `<button type="button" data-i="${i}" class="${i === idx ? 'active' : ''}" style="${i === idx ? 'background:var(--surface-3)' : ''}">
        <div style="flex:1;min-width:0"><strong>${esc(p.name)}</strong><div class="text-sm text-faint mono">${esc(p.code)} · stock ${num(p.stock)}</div></div></button>`).join('');
      $$('button', list).forEach((b) => { b.onmousedown = (e) => { e.preventDefault(); choose(results[Number(b.dataset.i)]); }; });
    };
    const choose = (p) => { if (!p) return; onPick(p); input.value = ''; results = []; draw(); input.focus(); };
    const searchNow = debounce(async () => {
      const q = input.value.trim();
      if (!q) { results = []; return draw(); }
      try { results = await api.get('/products/lookup', { q }); idx = results.length ? 0 : -1; draw(); } catch { /* noop */ }
    }, 200);
    input.addEventListener('input', searchNow);
    input.addEventListener('keydown', async (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(results.length - 1, idx + 1); draw(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(0, idx - 1); draw(); }
      else if (e.key === 'Enter') {
        e.preventDefault();
        if (results[idx]) return choose(results[idx]);
        const q = input.value.trim();
        if (!q) return;
        const r = await api.get('/products/lookup', { q }).catch(() => []);
        if (r.length === 1) choose(r[0]); else { results = r; idx = 0; draw(); if (!r.length) { toast('warning', 'No encontrado', q); shake(input); } }
      } else if (e.key === 'Escape') { results = []; draw(); }
    });
    input.addEventListener('blur', () => setTimeout(() => { results = []; draw(); }, 150));
  }

  async function movementForm(type, preset = []) {
    const cfg = TYPES[type];
    const multi = type === 'entrada';
    let lines = preset.map((p) => ({ ...p, cost: p.cost ?? '' }));
    if (multi && !suppliers.length) suppliers = (await api.get('/suppliers', { limit: 'all' }).catch(() => ({ data: [] }))).data;

    const m = openModal({
      title: cfg.title,
      sub: cfg.help,
      size: multi ? 'xl' : 'lg',
      body: `
        <form id="movForm" novalidate>
          ${multi ? `<div class="form-grid form-grid-3 mb">
            <div class="field"><label>Proveedor</label><select class="select" name="supplier_id"><option value="">Sin proveedor</option>${suppliers.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
            <div class="field"><label>N° de factura / guía</label><input class="input" name="reference" maxlength="60" placeholder="Ej: F001-2345"></div>
            <div class="field"><label>Observación</label><input class="input" name="reason" maxlength="200" placeholder="Opcional"></div>
          </div>` : ''}
          <div class="field mb" style="position:relative">
            <label>${multi ? 'Agregar productos' : 'Producto'}</label>
            <div class="input-icon">${icon('scan-barcode')}<input class="input" id="pSearch" placeholder="Escanea o escribe el nombre del producto..." autocomplete="off"></div>
            <div class="dropdown-menu" id="pList" hidden style="left:0;right:0;max-height:260px;overflow:auto"></div>
          </div>
          <div class="card mb"><div class="table-wrap"><table class="table compact">
            <thead><tr><th>Producto</th><th class="num">Stock actual</th>
              <th class="num">${type === 'ajuste' ? 'Stock contado' : 'Cantidad'}</th>
              ${multi ? '<th class="num">Costo unit.</th><th class="num">Subtotal</th>' : ''}
              ${type === 'ajuste' ? '<th class="num">Diferencia</th>' : ''}
              <th></th></tr></thead>
            <tbody id="lines"></tbody>
          </table></div></div>
          ${multi ? `<div class="flex justify-between items-center wrap gap-3">
            <label class="checkbox"><input type="checkbox" name="update_cost" checked> Actualizar el precio de compra de los productos con el nuevo costo</label>
            <div class="text-muted">Total de la compra: <strong id="buyTotal" style="font-size:18px;color:var(--text)">${money(0)}</strong></div>
          </div>` : `<div class="form-grid">
            <div class="field span-2"><label>Motivo / justificación <span class="req">*</span></label>
              <textarea class="textarea" name="reason" maxlength="200" placeholder="${type === 'merma' ? 'Ej: 3 botellas rotas al descargar' : type === 'ajuste' ? 'Ej: Conteo físico mensual' : 'Ej: Consumo interno'}"></textarea></div>
            <div class="field"><label>Referencia</label><input class="input" name="reference" maxlength="60" placeholder="Opcional"></div>
          </div>`}
        </form>`,
      footer: `<button class="btn btn-outline" data-close>Cancelar</button>
        <button class="btn btn-${cfg.tone === 'danger' ? 'danger' : cfg.tone === 'success' ? 'success' : 'primary'}" id="saveMov">${icon('check')}Registrar</button>`,
    });
    const form = $('#movForm', m.el);

    const drawLines = () => {
      const tbody = $('#lines', m.el);
      if (!lines.length) {
        tbody.innerHTML = `<tr><td colspan="7"><div class="empty" style="padding:24px">${icon('scan-barcode')}<p class="mt-2">Busca o escanea un producto para agregarlo</p></div></td></tr>`;
      } else {
        tbody.innerHTML = lines.map((l, i) => {
          const diff = type === 'ajuste' && l.qty !== '' ? Number(l.qty) - l.stock : null;
          return `<tr>
            <td><strong>${esc(l.name)}</strong><div class="muted mono">${esc(l.code)}</div></td>
            <td class="num">${num(l.stock)}</td>
            <td class="num"><input class="input" type="number" min="${type === 'ajuste' ? 0 : 1}" step="1" inputmode="numeric" data-qty="${i}" value="${l.qty}" style="width:100px;text-align:right;height:34px"></td>
            ${multi ? `<td class="num"><input class="input" type="number" min="0" step="0.01" inputmode="decimal" data-cost="${i}" value="${l.cost}" placeholder="0.00" style="width:110px;text-align:right;height:34px"></td>
              <td class="num fw-6">${l.cost !== '' && l.qty !== '' ? money(Number(l.cost) * Number(l.qty)) : '—'}</td>` : ''}
            ${type === 'ajuste' ? `<td class="num fw-7 ${diff > 0 ? 'text-success' : diff < 0 ? 'text-danger' : ''}">${diff === null ? '—' : `${diff > 0 ? '+' : ''}${num(diff)}`}</td>` : ''}
            <td class="actions-cell"><button type="button" class="btn btn-ghost btn-icon btn-sm" data-rm="${i}" style="color:var(--danger)">${icon('x')}</button></td>
          </tr>`;
        }).join('');
      }
      icons();
      $$('[data-qty]', m.el).forEach((inp) => { inp.onchange = () => { lines[inp.dataset.qty].qty = inp.value; drawLines(); }; });
      $$('[data-cost]', m.el).forEach((inp) => { inp.onchange = () => { lines[inp.dataset.cost].cost = inp.value; drawLines(); }; });
      $$('[data-rm]', m.el).forEach((b) => { b.onclick = () => { lines.splice(Number(b.dataset.rm), 1); drawLines(); }; });
      if (multi) $('#buyTotal', m.el).textContent = money(lines.reduce((s, l) => s + (Number(l.cost) || 0) * (Number(l.qty) || 0), 0));
      const searchBox = $('#pSearch', m.el);
      if (!multi) searchBox.closest('.field').hidden = lines.length > 0;
    };

    productPicker($('#pSearch', m.el), $('#pList', m.el), (p) => {
      const existing = lines.find((l) => l.id === p.id);
      if (existing) { if (type !== 'ajuste') existing.qty = Number(existing.qty || 0) + 1; }
      else lines.push({ id: p.id, name: p.name, code: p.code, stock: p.stock, qty: type === 'ajuste' ? p.stock : 1, cost: multi ? p.purchase_price ?? '' : '' });
      if (!multi) lines = lines.slice(-1);
      drawLines();
      const last = $$('[data-qty]', m.el).pop();
      if (last && !multi) { last.focus(); last.select(); }
    });
    drawLines();

    $('#saveMov', m.el).onclick = () => withLoading($('#saveMov', m.el), async () => {
      $$('[data-qty]', m.el).forEach((inp) => { lines[inp.dataset.qty].qty = inp.value; });
      $$('[data-cost]', m.el).forEach((inp) => { lines[inp.dataset.cost].cost = inp.value; });
      if (!lines.length) { toast('warning', 'Agrega al menos un producto'); return shake($('#pSearch', m.el)); }
      const bad = lines.find((l) => l.qty === '' || !Number.isInteger(Number(l.qty)) || Number(l.qty) < (type === 'ajuste' ? 0 : 1));
      if (bad) return toast('warning', 'Cantidad inválida', `Revisa la cantidad de ${bad.name}`);
      if (type === 'ajuste' && lines.every((l) => Number(l.qty) === l.stock)) return toast('warning', 'Sin diferencias', 'El stock contado es igual al registrado');
      if ((type === 'salida' || type === 'merma') && lines.some((l) => Number(l.qty) > l.stock) && state.settings?.allow_negative_stock !== '1') {
        return toast('warning', 'Stock insuficiente', 'La cantidad supera el stock disponible');
      }
      const reasonEl = form.elements.reason;
      if (!multi && !reasonEl.value.trim()) {
        reasonEl.classList.add('invalid');
        shake(reasonEl);
        return toast('warning', 'Indica el motivo', 'Es obligatorio para salidas, mermas y ajustes');
      }
      const body = {
        type,
        reason: reasonEl?.value.trim() || '',
        reference: form.elements.reference?.value.trim() || '',
        supplier_id: form.elements.supplier_id?.value || '',
        update_cost: form.elements.update_cost?.checked || false,
        items: lines.filter((l) => !(type === 'ajuste' && Number(l.qty) === l.stock)).map((l) => ({
          product_id: l.id,
          ...(type === 'ajuste' ? { new_stock: Number(l.qty) } : { quantity: Number(l.qty) }),
          ...(multi && l.cost !== '' ? { unit_cost: Number(l.cost) } : {}),
        })),
      };
      try {
        const r = await api.post('/stock/movements', body);
        toast('success', 'Movimiento registrado', r.message);
        m.close();
        refreshLowBadge();
        updateAlertCount();
        if (tab === 'alerts') alertsTab(); else loadMovements();
      } catch (err) { toastError(err); }
    });
  }

  $$('[data-new]', root).forEach((b) => { b.onclick = () => movementForm(b.dataset.new); });

  switchTab(tab);
  updateAlertCount();
}
