/**
 * Reportes de ventas: por día, producto, categoría, método de pago, hora y cajero.
 * Exportación a Excel (varias hojas) y PDF.
 */
import { api } from '../api.js';
import {
  $, $$, esc, icon, icons, money, num, fmtDate, shortDay, toastError, withLoading, emptyState, animateIn, countUp,
  exportExcel, exportPdf, PAYMENT, today,
} from '../ui.js';
import { salesAreaChart, barChart, theme } from '../charts.js';

const PRESETS = [
  { key: '7', label: '7 días', from: () => today(-6) },
  { key: '30', label: '30 días', from: () => today(-29) },
  { key: 'month', label: 'Este mes', from: () => `${today().slice(0, 8)}01` },
  { key: '90', label: '90 días', from: () => today(-89) },
];

export async function render(root) {
  const range = { from: today(-29), to: today() };
  let data = null;
  let prodSort = { key: 'total', dir: -1 };
  const charts = [];

  root.innerHTML = `
    <div class="page-head">
      <div><h2>Reportes</h2><p>Analiza ventas, ganancias y productos estrella.</p></div>
      <div class="actions">
        <button class="btn btn-outline" id="xls">${icon('file-spreadsheet')}Excel</button>
        <button class="btn btn-outline" id="pdf">${icon('file-type')}PDF</button>
      </div>
    </div>
    <div class="card mb"><div class="toolbar" style="border:0">
      <div class="segmented" id="presets">${PRESETS.map((p) => `<button data-p="${p.key}" class="${p.key === '30' ? 'active' : ''}">${p.label}</button>`).join('')}</div>
      <input class="input" type="date" id="from" value="${range.from}" style="min-width:140px">
      <span class="text-faint">a</span>
      <input class="input" type="date" id="to" value="${range.to}" style="min-width:140px">
    </div></div>
    <div id="body"><div class="loading-block"><span class="spinner"></span></div></div>`;
  icons();

  async function load() {
    charts.forEach((c) => c && c.destroy());
    charts.length = 0;
    $('#body').innerHTML = '<div class="loading-block"><span class="spinner"></span></div>';
    try {
      data = await api.get('/reports/sales', range);
      draw();
    } catch (err) {
      $('#body').innerHTML = `<div class="card">${emptyState({ iconName: 'cloud-off', title: 'No se pudo generar el reporte', text: err.message })}</div>`;
      icons();
    }
  }

  function draw() {
    const t = data.totals;
    const kpis = [
      ['green', 'wallet', 'Ventas totales', t.revenue, money, `${num(t.count)} ventas`],
      ['blue', 'piggy-bank', 'Ganancia bruta', t.profit, money, `Margen ${t.margin}%`],
      ['cyan', 'receipt-text', 'Ticket promedio', t.avg_ticket, money, `${num(t.units)} unidades vendidas`],
      ['amber', 'landmark', 'Impuestos (IGV)', t.tax, money, t.discount ? `Descuentos: ${money(t.discount)}` : 'Sin descuentos'],
    ];
    $('#body').innerHTML = `
      <div class="grid grid-kpi mb">${kpis.map(([tone, ic, label, v, , foot]) => `
        <div class="card kpi tone-${tone}"><div class="kpi-top"><span class="kpi-label">${label}</span><span class="kpi-icon">${icon(ic)}</span></div>
        <div class="kpi-value">0</div><div class="kpi-foot">${foot}</div></div>`).join('')}</div>
      ${t.cancelled_count ? `<div class="alert alert-warning mb">${icon('ban')}<div>${t.cancelled_count} venta(s) anulada(s) por ${money(t.cancelled_total)} en este periodo (no se incluyen en los totales).</div></div>` : ''}
      <div class="card mb">
        <div class="card-head"><div><h3>Ventas por día</h3><div class="hint">Del ${fmtDate(data.from)} al ${fmtDate(data.to)}</div></div></div>
        <div class="card-body"><div class="chart-box"><canvas id="cDay" role="img" aria-label="Ventas por día"></canvas></div></div>
      </div>
      <div class="grid grid-2-even mb">
        <div class="card"><div class="card-head"><div><h3>Por categoría</h3><div class="hint">Total vendido</div></div></div>
          <div class="card-body">${data.byCategory.length ? '<div class="chart-box sm"><canvas id="cCat" role="img" aria-label="Ventas por categoría"></canvas></div>' : emptyState({ title: 'Sin datos' })}</div></div>
        <div class="card"><div class="card-head"><div><h3>Por método de pago</h3><div class="hint">Total cobrado</div></div></div>
          <div class="card-body">${data.byPayment.length ? '<div class="chart-box sm"><canvas id="cPay" role="img" aria-label="Ventas por método de pago"></canvas></div>' : emptyState({ title: 'Sin datos' })}</div></div>
      </div>
      <div class="grid grid-2 mb">
        <div class="card"><div class="card-head"><div><h3>Horas de mayor venta</h3><div class="hint">Total vendido por hora del día</div></div></div>
          <div class="card-body"><div class="chart-box sm"><canvas id="cHour" role="img" aria-label="Ventas por hora"></canvas></div></div></div>
        <div class="card"><div class="card-head"><div><h3>Por cajero</h3></div></div>
          <div class="table-wrap"><table class="table compact"><thead><tr><th>Usuario</th><th class="num">Ventas</th><th class="num">Total</th></tr></thead>
          <tbody>${data.byUser.map((u) => `<tr><td><strong>${esc(u.name)}</strong></td><td class="num">${num(u.count)}</td><td class="num fw-6">${money(u.total)}</td></tr>`).join('') || `<tr><td colspan="3">${emptyState({ title: 'Sin datos' })}</td></tr>`}</tbody></table></div></div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Ventas por producto</h3><div class="hint">${data.byProduct.length} producto(s) vendidos · clic en los encabezados para ordenar</div></div></div>
        <div class="table-wrap"><table class="table compact" id="prodTable"></table></div>
      </div>`;
    icons();
    $$('#body .kpi-value').forEach((el, i) => countUp(el, kpis[i][3], kpis[i][4]));
    animateIn($$('#body > .card, #body > .grid'), { y: 14, stagger: 0.06 });

    const th = theme();
    charts.push(salesAreaChart($('#cDay'), data.byDay.map((d) => shortDay(d.date)), data.byDay.map((d) => d.total), {
      tooltipTitle: (items) => {
        const d = data.byDay[items[0].dataIndex];
        return `${fmtDate(d.date)} · ${d.count} venta(s) · ganancia ${money(d.profit)}`;
      },
    }));
    if (data.byCategory.length) charts.push(barChart($('#cCat'), data.byCategory.map((c) => c.name), data.byCategory.map((c) => c.total), { horizontal: true }));
    if (data.byPayment.length) charts.push(barChart($('#cPay'), data.byPayment.map((p) => PAYMENT[p.method]?.label || p.method), data.byPayment.map((p) => p.total), { horizontal: true, color: th.success }));
    const hours = data.byHour.filter((h) => h.hour >= 6 && h.hour <= 23);
    charts.push(barChart($('#cHour'), hours.map((h) => `${h.hour}:00`), hours.map((h) => h.total), {
      tooltipTitle: (items) => `${hours[items[0].dataIndex].hour}:00 – ${hours[items[0].dataIndex].hour}:59 · ${hours[items[0].dataIndex].count} venta(s)`,
    }));
    drawProducts();
  }

  function drawProducts() {
    const cols = [['name', 'Producto'], ['category', 'Categoría'], ['quantity', 'Cantidad'], ['total', 'Total'], ['profit', 'Ganancia']];
    const rows = [...data.byProduct].sort((a, b) => {
      const va = a[prodSort.key]; const vb = b[prodSort.key];
      return (typeof va === 'string' ? String(va).localeCompare(vb) : va - vb) * prodSort.dir;
    });
    const total = data.totals.revenue || 1;
    $('#prodTable').innerHTML = `
      <thead><tr><th>#</th>${cols.map(([k, l]) => `<th class="sortable ${prodSort.key === k ? 'sorted' : ''} ${['quantity', 'total', 'profit'].includes(k) ? 'num' : ''} ${k === 'category' ? 'hide-sm' : ''}" data-k="${k}">${l}<span class="sort-ind">${icon(prodSort.key === k ? (prodSort.dir < 0 ? 'arrow-down' : 'arrow-up') : 'arrow-up-down')}</span></th>`).join('')}<th class="hide-sm">% del total</th></tr></thead>
      <tbody>${rows.length ? rows.map((p, i) => `<tr>
        <td class="muted">${i + 1}</td>
        <td><strong>${esc(p.name)}</strong><div class="muted mono">${esc(p.code)}</div></td>
        <td class="hide-sm">${esc(p.category || '—')}</td>
        <td class="num">${num(p.quantity)}</td>
        <td class="num fw-6">${money(p.total)}</td>
        <td class="num ${p.profit >= 0 ? 'text-success' : 'text-danger'}">${money(p.profit)}</td>
        <td class="hide-sm"><div class="stock-meter"><span class="text-sm tabular" style="width:42px">${((p.total / total) * 100).toFixed(1)}%</span><div class="bar" style="max-width:120px"><span style="width:${Math.max(2, (p.total / total) * 100)}%;background:var(--primary)"></span></div></div></td>
      </tr>`).join('') : `<tr><td colspan="7">${emptyState({ iconName: 'package-search', title: 'No hubo ventas en este periodo' })}</td></tr>`}</tbody>`;
    icons();
    $$('#prodTable th[data-k]').forEach((h) => {
      h.onclick = () => {
        prodSort = prodSort.key === h.dataset.k ? { key: h.dataset.k, dir: -prodSort.dir } : { key: h.dataset.k, dir: ['name', 'category'].includes(h.dataset.k) ? 1 : -1 };
        drawProducts();
      };
    });
  }

  // ---------------------------------------------------------- exportación
  $('#xls').onclick = () => withLoading($('#xls'), async () => {
    if (!data) return;
    try {
      const t = data.totals;
      await exportExcel(`reporte-ventas-${data.from}-a-${data.to}`, [
        { name: 'Resumen', rows: [
          { Concepto: 'Periodo', Valor: `${data.from} a ${data.to}` },
          { Concepto: 'N° de ventas', Valor: t.count },
          { Concepto: 'Ventas totales', Valor: t.revenue },
          { Concepto: 'Costo de lo vendido', Valor: t.cost },
          { Concepto: 'Ganancia bruta', Valor: t.profit },
          { Concepto: 'Margen %', Valor: t.margin },
          { Concepto: 'Ticket promedio', Valor: t.avg_ticket },
          { Concepto: 'Unidades vendidas', Valor: t.units },
          { Concepto: 'Impuestos', Valor: t.tax },
          { Concepto: 'Descuentos', Valor: t.discount },
          { Concepto: 'Ventas anuladas', Valor: t.cancelled_count },
        ] },
        { name: 'Por día', rows: data.byDay.map((d) => ({ Fecha: d.date, Ventas: d.count, Total: d.total, Ganancia: d.profit })) },
        { name: 'Por producto', rows: data.byProduct.map((p) => ({ Código: p.code, Producto: p.name, Categoría: p.category || '', Cantidad: p.quantity, Total: p.total, Ganancia: p.profit })) },
        { name: 'Por categoría', rows: data.byCategory.map((c) => ({ Categoría: c.name, Cantidad: c.quantity, Total: c.total, Ganancia: c.profit })) },
        { name: 'Por método de pago', rows: data.byPayment.map((p) => ({ Método: PAYMENT[p.method]?.label || p.method, Ventas: p.count, Total: p.total })) },
        { name: 'Por cajero', rows: data.byUser.map((u) => ({ Usuario: u.name, Ventas: u.count, Total: u.total })) },
      ]);
    } catch (err) { toastError(err); }
  });

  $('#pdf').onclick = () => withLoading($('#pdf'), async () => {
    if (!data) return;
    try {
      const t = data.totals;
      await exportPdf(`reporte-ventas-${data.from}-a-${data.to}`, {
        title: 'Reporte de ventas',
        subtitle: `Del ${fmtDate(data.from)} al ${fmtDate(data.to)}`,
        summary: [['Ventas', money(t.revenue)], ['Ganancia', money(t.profit)], ['Margen', `${t.margin}%`], ['N° ventas', num(t.count)]],
        tables: [
          { title: 'Ventas por día', head: ['Fecha', 'Ventas', 'Total', 'Ganancia'], body: data.byDay.filter((d) => d.count).map((d) => [fmtDate(d.date), d.count, money(d.total), money(d.profit)]), columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } } },
          { title: 'Por categoría', head: ['Categoría', 'Cantidad', 'Total', 'Ganancia'], body: data.byCategory.map((c) => [c.name, num(c.quantity), money(c.total), money(c.profit)]) },
          { title: 'Por método de pago', head: ['Método', 'Ventas', 'Total'], body: data.byPayment.map((p) => [PAYMENT[p.method]?.label || p.method, p.count, money(p.total)]) },
          { title: 'Productos más vendidos', head: ['#', 'Producto', 'Cantidad', 'Total', 'Ganancia'], body: data.byProduct.slice(0, 50).map((p, i) => [i + 1, p.name, num(p.quantity), money(p.total), money(p.profit)]) },
        ],
      });
    } catch (err) { toastError(err); }
  });

  // ---------------------------------------------------------- filtros
  $$('#presets button').forEach((b) => {
    b.onclick = () => {
      const p = PRESETS.find((x) => x.key === b.dataset.p);
      range.from = p.from();
      range.to = today();
      $('#from').value = range.from;
      $('#to').value = range.to;
      $$('#presets button').forEach((x) => x.classList.toggle('active', x === b));
      load();
    };
  });
  const custom = () => { $$('#presets button').forEach((x) => x.classList.remove('active')); load(); };
  $('#from').onchange = (e) => { range.from = e.target.value; custom(); };
  $('#to').onchange = (e) => { range.to = e.target.value; custom(); };

  await load();
  return () => charts.forEach((c) => c && c.destroy());
}
