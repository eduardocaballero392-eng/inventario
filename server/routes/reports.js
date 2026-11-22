/**
 * Reportes de ventas por rango de fechas: por día, producto, categoría, método de pago, cajero y hora.
 */
const express = require('express');
const { db } = require('../db');
const { dateRange, round2, daysBetween } = require('../utils/http');

const router = express.Router();

router.get('/sales', async (req, res) => {
  const { from, to, fromTs, toTs } = dateRange(req.query, 30);
  const p = { fromTs, toTs };
  const ok = "s.status = 'completada' AND s.created_at BETWEEN :fromTs AND :toTs";

  const [totals, itemsTotals, cancelled, dayRows, dayCost, byProduct, byCategory, byPayment, byUser, byHour] = await Promise.all([
    db.get(
      `SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS revenue, COALESCE(SUM(tax),0) AS tax,
              COALESCE(SUM(discount),0) AS discount, COALESCE(AVG(total),0) AS avg_ticket
       FROM sales s WHERE ${ok}`, p),
    db.get(
      `SELECT COALESCE(SUM(i.quantity),0) AS units, COALESCE(SUM(i.unit_cost * i.quantity),0) AS cost
       FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE ${ok}`, p),
    db.get("SELECT COUNT(*) AS count, COALESCE(SUM(total),0) AS total FROM sales s WHERE s.status='anulada' AND s.created_at BETWEEN :fromTs AND :toTs", p),
    db.all(`SELECT DATE_FORMAT(s.created_at, '%Y-%m-%d') AS day, COUNT(*) AS count, SUM(s.total) AS total FROM sales s WHERE ${ok} GROUP BY day`, p),
    db.all(
      `SELECT DATE_FORMAT(s.created_at, '%Y-%m-%d') AS day, SUM(i.unit_cost * i.quantity) AS cost
       FROM sale_items i JOIN sales s ON s.id = i.sale_id WHERE ${ok} GROUP BY day`, p),
    // La utilidad por producto se calcula sobre el subtotal de línea (antes del descuento global)
    db.all(
      `SELECT i.product_id, MAX(i.product_code) AS code, MAX(i.product_name) AS name, MAX(c.name) AS category,
              SUM(i.quantity) AS quantity, SUM(i.subtotal) AS total, SUM(i.subtotal - i.unit_cost * i.quantity) AS profit
       FROM sale_items i JOIN sales s ON s.id = i.sale_id
       LEFT JOIN products pr ON pr.id = i.product_id LEFT JOIN categories c ON c.id = pr.category_id
       WHERE ${ok} GROUP BY i.product_id ORDER BY total DESC`, p),
    db.all(
      `SELECT COALESCE(MAX(c.name), 'Sin categoría') AS name, SUM(i.quantity) AS quantity, SUM(i.subtotal) AS total,
              SUM(i.subtotal - i.unit_cost * i.quantity) AS profit
       FROM sale_items i JOIN sales s ON s.id = i.sale_id
       LEFT JOIN products pr ON pr.id = i.product_id LEFT JOIN categories c ON c.id = pr.category_id
       WHERE ${ok} GROUP BY c.id ORDER BY total DESC`, p),
    db.all(`SELECT payment_method AS method, COUNT(*) AS count, SUM(total) AS total FROM sales s WHERE ${ok} GROUP BY payment_method ORDER BY total DESC`, p),
    db.all(
      `SELECT COALESCE(MAX(u.full_name), '—') AS name, COUNT(*) AS count, SUM(s.total) AS total
       FROM sales s LEFT JOIN users u ON u.id = s.user_id WHERE ${ok} GROUP BY s.user_id ORDER BY total DESC`, p),
    db.all(`SELECT HOUR(s.created_at) AS hour, COUNT(*) AS count, SUM(total) AS total FROM sales s WHERE ${ok} GROUP BY hour`, p),
  ]);

  const dayMap = Object.fromEntries(dayRows.map((r) => [r.day, r]));
  const costMap = Object.fromEntries(dayCost.map((r) => [r.day, r.cost]));
  const byDay = daysBetween(from, to).map((d) => {
    const total = round2(dayMap[d]?.total || 0);
    return { date: d, count: dayMap[d]?.count || 0, total, profit: round2(total - (costMap[d] || 0)) };
  });

  const revenue = round2(totals.revenue);
  const cost = round2(itemsTotals.cost);
  const money = (rows) => rows.map((r) => ({ ...r, quantity: r.quantity !== undefined ? Number(r.quantity) : undefined, total: round2(r.total), profit: r.profit !== undefined ? round2(r.profit) : undefined }));

  res.json({
    from,
    to,
    totals: {
      count: totals.count,
      revenue,
      tax: round2(totals.tax),
      discount: round2(totals.discount),
      avg_ticket: round2(totals.avg_ticket),
      units: Number(itemsTotals.units),
      cost,
      profit: round2(revenue - cost),
      margin: revenue ? round2(((revenue - cost) / revenue) * 100) : 0,
      cancelled_count: cancelled.count,
      cancelled_total: round2(cancelled.total),
    },
    byDay,
    byProduct: money(byProduct),
    byCategory: money(byCategory),
    byPayment: money(byPayment),
    byUser: money(byUser),
    byHour: Array.from({ length: 24 }, (_, h) => {
      const r = byHour.find((x) => Number(x.hour) === h);
      return { hour: h, count: r?.count || 0, total: round2(r?.total || 0) };
    }),
  });
});

module.exports = router;
