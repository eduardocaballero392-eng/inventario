/**
 * Panel principal: KPIs, ventas por día, stock crítico, más vendidos y actividad reciente.
 */
import { api } from '../api.js';
import { state } from '../state.js';
import { $, $$, esc, icon, icons, money, num, fmtDate, relTime, shortDay, today, animateIn, countUp, emptyState, PAYMENT, toastError } from '../ui.js';
import { salesAreaChart, theme } from '../charts.js';

let days = 7;

export async function render(root) {
  const hello = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';
  const canSell = ['admin', 'cajero'].includes(state.user.role);
  root.innerHTML = `
    <div class="page-head">
      <div><h2>${hello}, ${esc(state.user.full_name.split(' ')[0])} 👋</h2><p>Este es el resumen de tu negocio hoy, ${fmtDate(today())}.</p></div>
      <div class="actions">
        ${canSell ? `<a href="#/pos" class="btn btn-success">${icon('scan-barcode')}Nueva venta</a>` : ''}
        ${state.user.role !== 'cajero' ? `<a href="#/stock" class="btn btn-outline">${icon('package-plus')}Registrar compra</a>` : ''}
      </div>
    </div>
    <div class="grid grid-kpi mb" id="kpis">${Array.from({ length: 4 }, () => '<div class="card kpi"><div class="skeleton sk-line" style="width:50%"></div><div class="skeleton" style="height:30px;width:70%;margin-top:14px"></div><div class="skeleton sk-line" style="width:40%;margin-top:12px"></div></div>').join('')}</div>
    <div id="alertsBar"></div>
    <div class="grid grid-2 mb">
      <div class="card">
        <div class="card-head">
          <div><h3>Ventas por día</h3><div class="hint" id="chartHint">Total vendido (ventas completadas)</div></div>
          <div class="segmented" id="range">
            ${[7, 30, 90].map((d) => `<button data-d="${d}" class="${d === days ? 'active' : ''}">${d} días</button>`).join('')}
          </div>
        </div>
        <div class="card-body"><div class="chart-box"><canvas id="salesChart" aria-label="Gráfico de ventas por día" role="img"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-head"><div><h3>Más vendidos</h3><div class="hint">Unidades vendidas este mes</div></div></div>
        <ul class="list" id="topList"><li class="list-item"><div class="skeleton sk-line w-full"></div></li></ul>
      </div>
    </div>

    <div class="card">
      <div class="card-head">
        <div><h3>Últimas ventas</h3></div>
        ${canSell ? `<a href="#/sales" class="btn btn-ghost btn-sm">Ver historial${icon('arrow-right')}</a>` : ''}
      </div>
      <div class="table-wrap"><table class="table compact"><tbody id="recentSales"></tbody></table></div>
    </div>`;

  const charts = {};
  async function load() {
    let data;
    try {
      data = await api.get('/dashboard', { days });
    } catch (err) {
      toastError(err, 'No se pudo cargar el panel');
      return;
    }
    // Al refrescar se reemplazan los gráficos anteriores (un canvas no admite dos gráficos)
    Object.values(charts).forEach((c) => c && c.destroy());
    renderKpis(data.kpis);
    renderAlerts(data.kpis);
    renderSalesChart(data.salesChart);
    renderTop(data.topProducts);
    renderRecent(data.recentSales);
    icons();
  }

  function renderKpis(k) {
    const diff = k.sales_yesterday ? ((k.sales_today - k.sales_yesterday) / k.sales_yesterday) * 100 : null;
    const trend = diff === null ? '' : `<span class="trend ${diff >= 0 ? 'up' : 'down'}">${icon(diff >= 0 ? 'trending-up' : 'trending-down')}${Math.abs(diff).toFixed(1)}%</span> vs. ayer`;
    const showValue = state.user.role !== 'cajero';
    const cards = [
      { tone: 'green', icon: 'wallet', label: 'Ventas de hoy', value: k.sales_today, fmt: money, foot: `${num(k.sales_today_count)} venta(s) ${trend ? '· ' + trend : ''}`, href: '#/sales' },
      { tone: 'blue', icon: 'calendar-days', label: 'Ventas del mes', value: k.sales_month, fmt: money, foot: showValue ? `Ganancia estimada <strong class="text-success">${money(k.profit_month)}</strong>` : `${num(k.sales_month_count)} ventas` },
      showValue
        ? { tone: 'cyan', icon: 'warehouse', label: 'Valor del inventario', value: k.inventory_cost, fmt: money, foot: `A precio de venta: ${money(k.inventory_retail)}` }
        : { tone: 'cyan', icon: 'package', label: 'Productos activos', value: k.total_products, fmt: num, foot: `${num(k.units)} unidades en stock` },

    ];
    $('#kpis').innerHTML = cards.map((c) => `
      <${c.href ? `a href="${c.href}"` : 'div'} class="card kpi tone-${c.tone}">
        <div class="kpi-top"><span class="kpi-label">${c.label}</span><span class="kpi-icon">${icon(c.icon)}</span></div>
        <div class="kpi-value" data-v="${c.value}">0</div>
        <div class="kpi-foot">${c.foot}</div>
      </${c.href ? 'a' : 'div'}>`).join('');
    icons();
    $$('.kpi-value', root).forEach((el, i) => countUp(el, cards[i].value, cards[i].fmt));
    animateIn($$('#kpis .kpi'), { y: 16, stagger: 0.07 });
  }

  function renderAlerts(k) {
    const parts = [];
    if (k.out_of_stock) parts.push(`<strong>${k.out_of_stock}</strong> producto(s) agotado(s)`);
    if (k.low_stock) parts.push(`<strong>${k.low_stock}</strong> con stock bajo`);
    if (k.expiring) parts.push(`<strong>${k.expiring}</strong> por vencer pronto`);
    $('#alertsBar').innerHTML = parts.length
      ? `<div class="alert alert-warning mb">${icon('bell-ring')}<div style="flex:1">Atención: ${parts.join(', ')}.</div>
         <a class="btn btn-sm btn-outline" href="#/products?status=${k.expiring && !k.low_stock && !k.out_of_stock ? 'expiring' : 'alert'}">Revisar</a></div>`
      : '';
  }

  function renderSalesChart(series) {
    const canvas = $('#salesChart');
    const total = series.reduce((s, d) => s + d.total, 0);
    $('#chartHint').innerHTML = `Total del periodo: <strong>${money(total)}</strong>`;
    charts.sales = salesAreaChart(canvas, series.map((d) => shortDay(d.date)), series.map((d) => d.total), {
      tooltipTitle: (items) => {
        const d = series[items[0].dataIndex];
        return `${fmtDate(d.date)} · ${d.count} venta(s)`;
      },
    });
  }

  function renderTop(rows) {
    $('#topList').innerHTML = rows.length
      ? rows.map((r, i) => `
        <li class="list-item">
          <span class="rank ${i === 0 ? 'r1' : ''}">${i + 1}</span>
          <div class="grow"><strong>${esc(r.name)}</strong><small>${money(r.total)} vendidos</small></div>
          <span class="badge badge-blue">${num(r.quantity)} und.</span>
        </li>`).join('')
      : `<li>${emptyState({ iconName: 'chart-bar', title: 'Aún no hay ventas este mes' })}</li>`;
    animateIn($$('#topList .list-item'), { y: 8 });
  }

  function renderRecent(rows) {
    $('#recentSales').innerHTML = rows.length
      ? rows.map((s) => {
        const p = PAYMENT[s.payment_method] || {};
        return `<tr>
          <td><strong class="mono">${esc(s.number)}</strong><div class="muted">${relTime(s.created_at)}</div></td>
          <td class="hide-sm">${esc(s.user_name || '—')}</td>
          <td class="hide-sm">${num(s.items_count)} und.</td>
          <td><span class="badge">${icon(p.icon || 'wallet')}${p.label || s.payment_method}</span></td>
          <td>${s.status === 'anulada' ? '<span class="badge badge-red">Anulada</span>' : '<span class="badge badge-green">Completada</span>'}</td>
          <td class="num"><strong>${money(s.total)}</strong></td>
        </tr>`;
      }).join('')
      : `<tr><td>${emptyState({ iconName: 'receipt-text', title: 'Todavía no hay ventas' })}</td></tr>`;
  }

  $$('#range button', root).forEach((b) => {
    b.onclick = () => {
      days = Number(b.dataset.d);
      $$('#range button', root).forEach((x) => x.classList.toggle('active', x === b));
      load();
    };
  });

  await load();
  // Refresca automáticamente cada 2 minutos
  const timer = setInterval(load, 120000);
  return () => clearInterval(timer);
}
