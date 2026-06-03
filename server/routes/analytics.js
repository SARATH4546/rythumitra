const express = require('express');
const router = express.Router();
const { db } = require('../db/database');

// Helper: date string YYYY-MM-DD from ISO
const toDate = iso => iso ? iso.slice(0, 10) : '';
const toMonth = iso => iso ? iso.slice(0, 7) : '';
const nowMinus = days => new Date(Date.now() - days * 86400000).toISOString();
const groupBy = (arr, key) => arr.reduce((acc, x) => { const k = x[key]; acc[k] = (acc[k] || 0) + 1; return acc; }, {});

// GET /api/analytics/summary
router.get('/summary', async (req, res) => {
  try {
    const [farmers, calls, waSessions, alerts] = await Promise.all([
      db.farmers.find({}),
      db.ivr_calls.find({}),
      db.wa.find({}),
      db.alerts.find({ status: 'sent' }),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const todayCalls = calls.filter(c => toDate(c.created_at) === today).length;
    const alertsDelivered = alerts.reduce((s, a) => s + (a.delivered_count || 0), 0);
    res.json({
      totalFarmers: farmers.length,
      whatsappOpted: farmers.filter(f => f.whatsapp_opted_in).length,
      ivrOnly: farmers.filter(f => !f.whatsapp_opted_in).length,
      totalCalls: calls.length,
      todayCalls,
      totalWASessions: waSessions.length,
      alertsSent: alerts.length,
      alertsDelivered,
      recentWeek: farmers.filter(f => f.created_at >= nowMinus(7)).length,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/calls/daily  (last 30 days)
router.get('/calls/daily', async (req, res) => {
  try {
    const since = nowMinus(30);
    const calls = await db.ivr_calls.find({ created_at: { $gt: since } });
    const byDate = {};
    calls.forEach(c => {
      const d = toDate(c.created_at);
      if (!byDate[d]) byDate[d] = { date: d, calls: 0, completed: 0 };
      byDate[d].calls++;
      if (c.status === 'completed') byDate[d].completed++;
    });
    res.json(Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/whatsapp/daily  (last 30 days)
router.get('/whatsapp/daily', async (req, res) => {
  try {
    const since = nowMinus(30);
    const sessions = await db.wa.find({ created_at: { $gt: since } });
    const byDate = {};
    sessions.forEach(s => {
      const d = toDate(s.created_at);
      if (!byDate[d]) byDate[d] = { date: d, sessions: 0, total_messages: 0 };
      byDate[d].sessions++;
      byDate[d].total_messages += (s.messages_count || 1);
    });
    const rows = Object.values(byDate).map(r => ({ ...r, avg_messages: r.sessions ? (r.total_messages / r.sessions).toFixed(1) : 0 }));
    res.json(rows.sort((a, b) => a.date.localeCompare(b.date)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/farmers/growth  (last 6 months)
router.get('/farmers/growth', async (req, res) => {
  try {
    const since = nowMinus(180);
    const farmers = await db.farmers.find({ created_at: { $gt: since } });
    const byMonth = {};
    farmers.forEach(f => {
      const m = toMonth(f.created_at);
      byMonth[m] = (byMonth[m] || 0) + 1;
    });
    const rows = Object.entries(byMonth).map(([month, new_farmers]) => ({ month, new_farmers }));
    res.json(rows.sort((a, b) => a.month.localeCompare(b.month)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/districts
router.get('/districts', async (req, res) => {
  try {
    const [farmers, calls, sessions] = await Promise.all([
      db.farmers.find({}),
      db.ivr_calls.find({}),
      db.wa.find({}),
    ]);
    const map = {};
    farmers.forEach(f => {
      if (!map[f.district]) map[f.district] = { district: f.district, farmers: 0, calls: 0, sessions: 0 };
      map[f.district].farmers++;
    });
    calls.forEach(c => { if (c.district && map[c.district]) map[c.district].calls++; });
    sessions.forEach(s => { if (s.district && map[s.district]) map[s.district].sessions++; });
    res.json(Object.values(map).sort((a, b) => b.farmers - a.farmers));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/whatsapp/intents
router.get('/whatsapp/intents', async (req, res) => {
  try {
    const sessions = await db.wa.find({});
    const counts = groupBy(sessions, 'last_intent');
    const rows = Object.entries(counts).map(([intent, count]) => ({ intent, count })).sort((a, b) => b.count - a.count);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/analytics/ivr/menus
router.get('/ivr/menus', async (req, res) => {
  try {
    const calls = await db.ivr_calls.find({ menu_selections: { $exists: true } });
    const counts = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    const labels = { '1': 'Mandi Prices', '2': 'Schemes', '3': 'Weather', '4': 'Loans', '5': 'Human Agent' };
    calls.forEach(c => {
      try { JSON.parse(c.menu_selections).forEach(k => { if (counts[k] !== undefined) counts[k]++; }); }
      catch (_) {}
    });
    res.json(Object.entries(counts).map(([k, v]) => ({ menu: k, label: labels[k], count: v })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
