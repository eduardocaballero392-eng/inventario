/**
 * Gráficos con Chart.js, adaptados al tema claro/oscuro.
 * Reglas de diseño: una sola serie por gráfico (sin leyenda), barras finas con
 * esquinas redondeadas, grilla tenue y tooltip al pasar el mouse.
 */
import { money, num } from './ui.js';

const active = new Set();

function css(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function theme() {
  return {
    primary: css('--primary'),
    success: css('--success'),
    warning: css('--warning'),
    danger: css('--danger'),
    text: css('--text-2'),
    faint: css('--text-3'),
    grid: css('--border'),
    surface: css('--surface'),
    font: css('--font') || 'Inter Variable, sans-serif',
  };
}

function baseOptions(t, { valueFormat = money, horizontal = false } = {}) {
  const valueAxis = {
    beginAtZero: true,
    grid: { color: t.grid, drawTicks: false },
    border: { display: false },
    ticks: { color: t.faint, padding: 8, font: { size: 11 }, callback: (v) => valueFormat(v).replace(/\.00$/, ''), maxTicksLimit: 6 },
  };
  const catAxis = {
    grid: { display: false },
    border: { display: false },
    ticks: { color: t.faint, font: { size: 11 }, autoSkip: true, maxRotation: 0 },
  };
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    animation: { duration: 700, easing: 'easeOutQuart' },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: t.surface,
        titleColor: css('--text'),
        bodyColor: t.text,
        borderColor: t.grid,
        borderWidth: 1,
        padding: 12,
        cornerRadius: 10,
        displayColors: false,
        titleFont: { weight: '600' },
        callbacks: { label: (ctx) => ` ${valueFormat(horizontal ? ctx.parsed.x : ctx.parsed.y)}` },
      },
    },
    scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
  };
}

/** Crea un gráfico y lo registra para destruirlo al cambiar de vista. */
export function makeChart(canvas, config) {
  if (!window.Chart || !canvas) return null;
  Chart.defaults.font.family = theme().font;
  const chart = new window.Chart(canvas, config);
  active.add(chart);
  // destroy() idempotente: la vista y el enrutador pueden llamarlo ambos
  const original = chart.destroy.bind(chart);
  chart.destroy = () => {
    if (!active.has(chart)) return;
    active.delete(chart);
    original();
  };
  return chart;
}

export function destroyCharts() {
  [...active].forEach((c) => c.destroy());
}

/** Área de ventas por día (una serie). */
export function salesAreaChart(canvas, labels, values, { tooltipTitle } = {}) {
  const t = theme();
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, canvas.parentElement.clientHeight || 280);
  grad.addColorStop(0, `${t.primary}38`);
  grad.addColorStop(1, `${t.primary}00`);
  const opts = baseOptions(t);
  if (tooltipTitle) opts.plugins.tooltip.callbacks.title = tooltipTitle;
  return makeChart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data: values,
        borderColor: t.primary,
        backgroundColor: grad,
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: values.length > 31 ? 0 : 3,
        pointHoverRadius: 6,
        pointBackgroundColor: t.surface,
        pointBorderColor: t.primary,
        pointBorderWidth: 2,
      }],
    },
    options: opts,
  });
}

/** Barras (verticales u horizontales) de una sola serie. colors: color o arreglo por barra. */
export function barChart(canvas, labels, values, { horizontal = false, color, valueFormat = money, tooltipTitle } = {}) {
  const t = theme();
  const opts = baseOptions(t, { valueFormat, horizontal });
  if (tooltipTitle) opts.plugins.tooltip.callbacks.title = tooltipTitle;
  opts.interaction = { mode: 'nearest', intersect: false, axis: horizontal ? 'y' : 'x' };
  return makeChart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: color || t.primary,
        hoverBackgroundColor: color || t.primary,
        borderRadius: 4,
        borderSkipped: false,
        maxBarThickness: horizontal ? 18 : 28,
        categoryPercentage: 0.7,
      }],
    },
    options: opts,
  });
}

export const formatUnits = (v) => `${num(v)} und.`;
