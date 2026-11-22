/**
 * Historial de ventas: filtros por fecha / método / estado, detalle,
 * reimpresión de ticket, anulación (admin) y exportación a Excel o PDF.
 */
import { api } from '../api.js';
import { can, state } from '../state.js';
import {
  $, $$, esc, icon, icons, money, num, fmtDate, fmtTime, debounce, toast, toastError, openModal, promptDialog,
  withLoading, tableHead, skeletonRows, emptyState, renderPagination, animateIn, exportExcel, exportPdf, PAYMENT, today,
} from '../ui.js';
import { printTicket } from '../ticket.js';
import { refreshLowBadge } from '../main.js';

const PRESETS = [
  { key: 'today', label: 'Hoy', from: () => today(), to: () => today() },
  { key: 'yesterday', label: 'Ayer', from: () => today(-1), to: () => today(-1) },
  { key: '7', label: '7 días', from: () => today(-6), to: () => today() },
  { key: 'month', label: 'Este mes', from: () => `${today().slice(0, 8)}01`, to: () => today() },
  { key: '30', label: '30 días', from: () => today(-29), to: () => today() },
];

export async function render(root) {
  const filters = { q: '', from: today(), to: today(), payment_method: '', status: '', user_id: '', page: 1, limit: 15 };
  let preset = 'today';
  const isAdmin = state.user.role === 'admin';
  let users = [];
  if (isAdmin) users = await api.get('/users').catch(() => []);

  root.innerHTML = `
    <div class="page-head">
      <div><h2>Ventas</h2><p>${isAdmin ? 'Historial de todas las ventas del negocio.' : 'Historial de tus ventas.'}</p></div>
      <div class="actions">
        <button class="btn btn-outline" id="xlsBtn">${icon('file-spreadsheet')}Excel</button>
        <button class="btn btn-outline" id="pdfBtn">${icon('file-type')}PDF</button>
        <a href="#/pos" class="btn btn-success">${icon('scan-barcode')}Nueva venta</a>
      </div>
    </div>
    <div class="grid grid-kpi mb" id="summary"></div>
    <div class="card">
      <div class="toolbar">
        <div class="segmented" id="presets">${PRESETS.map((p) => `<button data-p="${p.key}" class="${p.key === preset ? 'active' : ''}">${p.label}</button>`).join('')}</div>
        <input class="input" type="date" id="from" value="${filters.from}" style="min-width:140px" title="Desde">
        <input class="input" type="date" id="to" value="${filters.to}" style="min-width:140px" title="Hasta">
      </div>
      <div class="toolbar">
        <div class="grow input-icon">${icon('search')}<input class="input" id="q" placeholder="Buscar por N° de ticket, cliente o documento..."></div>
        <select class="select" id="pm"><option value="">Todos los pagos</option>${Object.entries(PAYMENT).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('')}</select>
        <select class="select" id="st"><option value="">Todos los estados</option><option value="completada">Completadas</option><option value="anulada">Anuladas</option></select>
        ${isAdmin ? `<select class="select" id="usr"><option value="">Todos los usuarios</option>${users.map((u) => `<option value="${u.id}">${esc(u.full_name)}</option>`).join('')}</select>` : ''}
      </div>
      <div class="table-wrap"><table class="table" id="table"></table></div>
      <div class="pagination" id="pager"></div>
    </div>`;
  icons();

  const cols = [
    { label: 'Ticket' }, { label: 'Fecha y hora' }, { label: 'Cajero', cls: 'hide-sm' }, { label: 'Productos', cls: 'num hide-sm' },
    { label: 'Pago' }, { label: 'Estado', cls: 'hide-sm' }, { label: 'Total', cls: 'num' }, { label: '', cls: 'actions-cell' },
  ];

  async function load() {
    const table = $('#table');
    table.innerHTML = tableHead(cols) + `<tbody>${skeletonRows(cols.length, 8)}</tbody>`;
    try {
      const res = await api.get('/sales', filters);
      $('#summary').innerHTML = `
        <div class="card kpi tone-green"><div class="kpi-top"><span class="kpi-label">Total vendido</span><span class="kpi-icon">${icon('wallet')}</span></div><div class="kpi-value">${money(res.sum)}</div><div class="kpi-foot">Solo ventas completadas</div></div>
        <div class="card kpi tone-blue"><div class="kpi-top"><span class="kpi-label">N° de ventas</span><span class="kpi-icon">${icon('receipt-text')}</span></div><div class="kpi-value">${num(res.total)}</div><div class="kpi-foot">${fmtDate(filters.from)} — ${fmtDate(filters.to)}</div></div>
        <div class="card kpi tone-cyan"><div class="kpi-top"><span class="kpi-label">Ticket promedio</span><span class="kpi-icon">${icon('calculator')}</span></div><div class="kpi-value">${money(res.total ? res.sum / res.total : 0)}</div><div class="kpi-foot">Por venta</div></div>`;
      $('tbody', table).innerHTML = res.data.length ? res.data.map((s) => {
        const p = PAYMENT[s.payment_method] || {};
        return `<tr class="${s.status === 'anulada' ? 'row-alert' : ''}" style="cursor:pointer" data-id="${s.id}">
          <td><strong class="mono">${esc(s.number)}</strong>${s.customer_name ? `<div class="muted">${esc(s.customer_name)}</div>` : ''}</td>
          <td>${fmtDate(s.created_at)}<div class="muted">${fmtTime(s.created_at)}</div></td>
          <td class="hide-sm">${esc(s.user_name || '—')}</td>
          <td class="num hide-sm">${num(s.items_count)}</td>
          <td><span class="badge">${icon(p.icon || 'wallet')}${p.label || s.payment_method}</span></td>
          <td class="hide-sm">${s.status === 'anulada' ? '<span class="badge badge-red">Anulada</span>' : '<span class="badge badge-green">Completada</span>'}</td>
          <td class="num"><strong style="${s.status === 'anulada' ? 'text-decoration:line-through;color:var(--text-3)' : ''}">${money(s.total)}</strong></td>
          <td class="actions-cell"><button class="btn btn-ghost btn-icon btn-sm" title="Ver detalle">${icon('eye')}</button></td>
        </tr>`;
      }).join('') : `<tr><td colspan="${cols.length}">${emptyState({ iconName: 'receipt-text', title: 'No hay ventas en este periodo', text: 'Cambia el rango de fechas o los filtros.' })}</td></tr>`;
      icons();
      animateIn($$('tbody tr', table), { y: 6, stagger: 0.015, duration: 0.25 });
      animateIn($$('#summary .kpi'), { y: 10 });
      $$('tbody tr[data-id]', table).forEach((tr) => { tr.onclick = () => detail(Number(tr.dataset.id)); });
      renderPagination($('#pager'), res, (pg) => { filters.page = pg; load(); });
    } catch (err) {
      $('tbody', table).innerHTML = `<tr><td colspan="${cols.length}">${emptyState({ iconName: 'cloud-off', title: 'Error al cargar', text: err.message })}</td></tr>`;
      icons();
    }
  }

  async function detail(id) {
    const m = openModal({ title: 'Detalle de venta', size: 'lg', body: '<div class="loading-block"><span class="spinner"></span></div>' });
    try {
      const s = await api.get(`/sales/${id}`);
      const p = PAYMENT[s.payment_method] || {};
      const gross = s.items.reduce((a, i) => a + Number(i.subtotal), 0);
      m.body.innerHTML = `
        ${s.status === 'anulada' ? `<div class="alert alert-danger mb">${icon('ban')}<div><strong>Venta anulada</strong> por ${esc(s.cancelled_by_name || '')} el ${fmtDate(s.cancelled_at, true)}<br>Motivo: ${esc(s.cancel_reason)}</div></div>` : ''}
        <div class="dl mb">
          <div><span>Ticket</span><strong class="mono">${esc(s.number)}</strong></div>
          <div><span>Fecha</span><strong>${fmtDate(s.created_at, true)}</strong></div>
          <div><span>Cajero</span><strong>${esc(s.user_name || '—')}</strong></div>
          <div><span>Pago</span><strong>${p.label || s.payment_method}</strong></div>
          ${s.customer_name || s.customer_doc ? `<div><span>Cliente</span><strong>${esc(s.customer_name || '')} ${esc(s.customer_doc || '')}</strong></div>` : ''}
        </div>
        <div class="card"><div class="table-wrap"><table class="table compact">
          <thead><tr><th>Producto</th><th class="num">Cant.</th><th class="num">P. unit.</th><th class="num">Subtotal</th></tr></thead>
          <tbody>${s.items.map((i) => `<tr><td><strong>${esc(i.product_name)}</strong><div class="muted mono">${esc(i.product_code)}</div></td><td class="num">${num(i.quantity)}</td><td class="num">${money(i.unit_price)}</td><td class="num fw-6">${money(i.subtotal)}</td></tr>`).join('')}</tbody>
        </table></div>
        <div class="cart-summary" style="border-radius:0 0 12px 12px">
          ${Number(s.discount) ? `<div class="sum-row"><span>Subtotal</span><span>${money(gross)}</span></div><div class="sum-row"><span>Descuento</span><span>-${money(s.discount)}</span></div>` : ''}
          <div class="sum-row"><span>Op. gravada</span><span>${money(s.subtotal)}</span></div>
          <div class="sum-row"><span>${esc(state.settings?.tax_name || 'IGV')}</span><span>${money(s.tax)}</span></div>
          <div class="sum-total"><span>Total</span><strong style="font-size:22px">${money(s.total)}</strong></div>
          ${s.payment_method === 'efectivo' ? `<div class="sum-row mt-2"><span>Recibido / vuelto</span><span>${money(s.amount_received)} / ${money(s.change_given)}</span></div>` : ''}
        </div></div>`;
      const foot = document.createElement('div');
      foot.className = 'modal-foot';
      foot.innerHTML = `
        ${can('sales.cancel') && s.status === 'completada' ? `<button class="btn btn-ghost" id="cancelSale" style="color:var(--danger);margin-right:auto">${icon('ban')}Anular venta</button>` : ''}
        <button class="btn btn-outline" data-close2>Cerrar</button>
        <button class="btn btn-primary" id="reprint">${icon('printer')}Imprimir ticket</button>`;
      $('.modal', m.el).appendChild(foot);
      icons();
      $('[data-close2]', foot).onclick = () => m.close();
      $('#reprint', foot).onclick = () => printTicket(s);
      $('#cancelSale', foot)?.addEventListener('click', async () => {
        const reason = await promptDialog({
          title: `Anular venta ${s.number}`,
          message: 'El stock de los productos será devuelto al inventario. Esta acción no se puede deshacer.',
          label: 'Motivo de la anulación',
          placeholder: 'Ej: El cliente devolvió los productos',
          confirmText: 'Anular venta',
        });
        if (!reason) return;
        try {
          await api.post(`/sales/${s.id}/cancel`, { reason });
          toast('success', 'Venta anulada', 'El stock fue devuelto');
          m.close();
          load();
          refreshLowBadge();
        } catch (err) { toastError(err); }
      });
    } catch (err) {
      m.body.innerHTML = emptyState({ iconName: 'cloud-off', title: 'Error', text: err.message });
      icons();
    }
  }

  async function fetchAll() {
    return (await api.get('/sales', { ...filters, page: 1, limit: 'all' })).data;
  }

  $('#xlsBtn').onclick = () => withLoading($('#xlsBtn'), async () => {
    try {
      const data = await fetchAll();
      await exportExcel(`ventas-${filters.from}-a-${filters.to}`, [{
        name: 'Ventas',
        rows: data.map((s) => ({ Ticket: s.number, Fecha: s.created_at, Cajero: s.user_name || '', Productos: s.items_count, 'Método de pago': PAYMENT[s.payment_method]?.label, Subtotal: s.subtotal, Impuesto: s.tax, Descuento: s.discount, Total: s.total, Estado: s.status, Cliente: s.customer_name || '', Documento: s.customer_doc || '' })),
      }]);
    } catch (err) { toastError(err); }
  });

  $('#pdfBtn').onclick = () => withLoading($('#pdfBtn'), async () => {
    try {
      const data = await fetchAll();
      const ok = data.filter((s) => s.status === 'completada');
      const total = ok.reduce((a, s) => a + s.total, 0);
      await exportPdf(`ventas-${filters.from}-a-${filters.to}`, {
        title: 'Reporte de ventas',
        subtitle: `Del ${fmtDate(filters.from)} al ${fmtDate(filters.to)}`,
        summary: [['Ventas', num(ok.length)], ['Total vendido', money(total)], ['Ticket promedio', money(ok.length ? total / ok.length : 0)], ['Anuladas', num(data.length - ok.length)]],
        tables: [{
          head: ['Ticket', 'Fecha', 'Cajero', 'Pago', 'Estado', 'Total'],
          body: data.map((s) => [s.number, `${fmtDate(s.created_at)} ${fmtTime(s.created_at)}`, s.user_name || '', PAYMENT[s.payment_method]?.label, s.status, money(s.total)]),
          columnStyles: { 5: { halign: 'right' } },
        }],
      });
    } catch (err) { toastError(err); }
  });

  const setRange = () => { $('#from').value = filters.from; $('#to').value = filters.to; filters.page = 1; load(); };
  $$('#presets button').forEach((b) => {
    b.onclick = () => {
      preset = b.dataset.p;
      const p = PRESETS.find((x) => x.key === preset);
      filters.from = p.from();
      filters.to = p.to();
      $$('#presets button').forEach((x) => x.classList.toggle('active', x === b));
      setRange();
    };
  });
  const custom = () => { $$('#presets button').forEach((x) => x.classList.remove('active')); filters.page = 1; load(); };
  $('#from').onchange = (e) => { filters.from = e.target.value; custom(); };
  $('#to').onchange = (e) => { filters.to = e.target.value; custom(); };
  $('#q').oninput = debounce((e) => { filters.q = e.target.value.trim(); filters.page = 1; load(); }, 300);
  $('#pm').onchange = (e) => { filters.payment_method = e.target.value; filters.page = 1; load(); };
  $('#st').onchange = (e) => { filters.status = e.target.value; filters.page = 1; load(); };
  $('#usr')?.addEventListener('change', (e) => { filters.user_id = e.target.value; filters.page = 1; load(); });

  await load();
}
