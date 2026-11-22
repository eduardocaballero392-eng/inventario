/**
 * Panel principal: KPIs, gráfico de ventas, stock crítico y actividad reciente.
 * Las consultas son independientes y se ejecutan en paralelo.
 */
const express = require('express');
const { db, getSettings } = require('../db');
const { localDate, round2, daysBetween } = require('../utils/http');
const { LOW_STOCK_SQL } = require('../utils/stock');

const router = express.Router();

router.get('/', async (req, res) => {
  const days = [7, 30, 90].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
  const today = localDate(0);
  const yesterday = localDate(-1);
  const monthStart = `${today.slice(0, 7)}-01`;
  const from = localDate(-(days - 1));
  const expiryDays = Number((await getSettings()).expiry_alert_days) || 30;

  const salesBetween = (a, b) =>
    db.get("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total FROM sales WHERE status = 'completada' AND created_at BETWEEN ? AND ?", [a, b]);

  const [inv, todaySales, yesterdaySales, monthSales, monthProfit, chartRows, topProducts, criticalStock, recentSales, recentMovements] = await Promise.all([
    db.get(
      `SELECT COUNT(*) AS total_products,
              COALESCE(SUM(CASE WHEN stock > 0 THEN stock * purchase_price END), 0) AS cost_value,
              COALESCE(SUM(CASE WHEN stock > 0 THEN stock * sale_price END), 0) AS retail_value,
              COALESCE(SUM(CASE WHEN stock > 0 THEN stock END), 0) AS units,
              COALESCE(SUM(CASE WHEN stock <= min_stock AND stock > 0 THEN 1 ELSE 0 END), 0) AS low_stock,
              COALESCE(SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END), 0) AS out_of_stock,
              COALESCE(SUM(CASE WHEN expiry_date IS NOT NULL AND expiry_date <= DATE_ADD(CURDATE(), INTERVAL ? DAY) THEN 1 ELSE 0 END), 0) AS expiring
       FROM products WHERE active = 1`,
      [expiryDays]
    ),
    salesBetween(`${today} 00:00:00`, `${today} 23:59:59`),
    salesBetween(`${yesterday} 00:00:00`, `${yesterday} 23:59:59`),
    salesBetween(`${monthStart} 00:00:00`, `${today} 23:59:59`),
    db.get(
      `SELECT COALESCE(SUM(i.subtotal - i.unit_cost * i.quantity), 0) AS profit
       FROM sale_items i JOIN sales s ON s.id = i.sale_id
       WHERE s.status = 'completada' AND s.created_at BETWEEN ? AND ?`,
      [`${monthStart} 00:00:00`, `${today} 23:59:59`]
    ),
    db.all(
      `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS count, SUM(total) AS total
       FROM sales WHERE status = 'completada' AND created_at >= ? GROUP BY day`,
      [`${from} 00:00:00`]
    ),
    db.all(
      `SELECT i.product_id, MAX(i.product_name) AS name, SUM(i.quantity) AS quantity, SUM(i.subtotal) AS total
       FROM sale_items i JOIN sales s ON s.id = i.sale_id
       WHERE s.status = 'completada' AND s.created_at >= ?
       GROUP BY i.product_id ORDER BY quantity DESC LIMIT 5`,
      [`${monthStart} 00:00:00`]
    ),
    db.all(
      `SELECT p.id, p.name, p.presentation, p.stock, p.min_stock
       FROM products p WHERE p.active = 1 AND ${LOW_STOCK_SQL}
       ORDER BY (p.stock / GREATEST(p.min_stock, 1)) ASC LIMIT 8`
    ),
    db.all(
      `SELECT s.id, s.number, s.total, s.payment_method, s.status, s.created_at, u.full_name AS user_name,
              (SELECT SUM(quantity) FROM sale_items WHERE sale_id = s.id) AS items_count
       FROM sales s LEFT JOIN users u ON u.id = s.user_id ORDER BY s.created_at DESC, s.id DESC LIMIT 6`
    ),
    db.all(
      `SELECT m.id, m.type, m.quantity, m.created_at, m.reason, p.name AS product_name, u.full_name AS user_name
       FROM stock_movements m JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.user_id
       WHERE m.type <> 'venta' ORDER BY m.created_at DESC, m.id DESC LIMIT 6`
    ),
  ]);

  // Serie diaria con días sin ventas rellenados en cero
  const byDay = Object.fromEntries(chartRows.map((r) => [r.day, r]));
  const salesChart = daysBetween(from, today).map((d) => ({ date: d, total: round2(byDay[d]?.total || 0), count: byDay[d]?.count || 0 }));

  res.json({
    kpis: {
      total_products: inv.total_products,
      units: Number(inv.units),
      low_stock: Number(inv.low_stock),
      out_of_stock: Number(inv.out_of_stock),
      expiring: Number(inv.expiring),
      inventory_cost: round2(inv.cost_value),
      inventory_retail: round2(inv.retail_value),
      sales_today: round2(todaySales.total),
      sales_today_count: todaySales.count,
      sales_yesterday: round2(yesterdaySales.total),
      sales_month: round2(monthSales.total),
      sales_month_count: monthSales.count,
      profit_month: round2(monthProfit.profit),
    },
    salesChart,
    topProducts: topProducts.map((r) => ({ ...r, quantity: Number(r.quantity), total: round2(r.total) })),
    criticalStock,
    recentSales,
    recentMovements,
  });
});

module.exports = router;
