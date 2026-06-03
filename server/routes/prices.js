const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { randomUUID } = require('crypto');

// GET prices with filters
router.get('/', async (req, res) => {
  try {
    const { district, crop, date } = req.query;
    const query = {};
    if (district) query.district = district;
    if (crop)     query.crop = crop;

    let all = await db.prices.find(query).sort({ crop: 1, district: 1 });

    if (!date) {
      // Get only latest date entries per crop+district
      const latestDate = all.reduce((max, p) => p.date > max ? p.date : max, '');
      all = all.filter(p => p.date === latestDate);
    } else {
      all = all.filter(p => p.date === date);
    }
    res.json(all);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET price history for chart
router.get('/history', async (req, res) => {
  try {
    const { crop, district, days = 7 } = req.query;
    if (!crop || !district) return res.status(400).json({ error: 'crop and district required' });
    const all = await db.history.find({ crop, district }).sort({ date: 1 });
    res.json(all.slice(-Number(days)));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET top modal prices across districts per crop
router.get('/top', async (req, res) => {
  try {
    const all = await db.prices.find({});
    const latestDate = all.reduce((max, p) => p.date > max ? p.date : max, '');
    const today = all.filter(p => p.date === latestDate);
    const grouped = {};
    today.forEach(p => {
      if (!grouped[p.crop] || p.price_modal > grouped[p.crop].price_modal) grouped[p.crop] = p;
    });
    res.json(Object.values(grouped));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET price spike detection (>15% vs 7-day avg)
router.get('/spikes', async (req, res) => {
  try {
    const allPrices  = await db.prices.find({});
    const latestDate = allPrices.reduce((max, p) => p.date > max ? p.date : max, '');
    const today      = allPrices.filter(p => p.date === latestDate);
    const allHistory = await db.history.find({});

    const spikes = [];
    today.forEach(t => {
      const hist = allHistory.filter(h => h.crop === t.crop && h.district === t.district).slice(-7);
      if (hist.length < 2) return;
      const avg = hist.reduce((s, h) => s + h.price_modal, 0) / hist.length;
      const changePct = ((t.price_modal - avg) / avg) * 100;
      if (Math.abs(changePct) >= 15) {
        spikes.push({ ...t, avg_7day: Math.round(avg), change_pct: Math.round(changePct * 10) / 10 });
      }
    });
    res.json(spikes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST add/override price
router.post('/', async (req, res) => {
  try {
    const { crop, district, price_min, price_max, price_modal, unit, source } = req.body;
    if (!crop || !district || !price_modal) return res.status(400).json({ error: 'crop, district, price_modal required' });
    const today = new Date().toISOString().split('T')[0];
    const existing = await db.prices.findOne({ crop, district, date: today });
    const modal = Number(price_modal);

    if (existing) {
      await db.prices.update({ id: existing.id }, { $set: { price_min: price_min || Math.round(modal * 0.92), price_max: price_max || Math.round(modal * 1.08), price_modal: modal, source: source || 'manual', updated_at: new Date().toISOString() } });
      res.json({ message: 'Price updated', id: existing.id });
    } else {
      const id = randomUUID();
      await db.prices.insert({ id, crop, district, price_min: price_min || Math.round(modal * 0.92), price_max: price_max || Math.round(modal * 1.08), price_modal: modal, unit: unit || 'quintal', source: source || 'manual', date: today, updated_at: new Date().toISOString() });
      await db.history.insert({ id: randomUUID(), crop, district, price_modal: modal, date: today });
      res.status(201).json({ message: 'Price added', id });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE price
router.delete('/:id', async (req, res) => {
  try {
    const n = await db.prices.remove({ id: req.params.id });
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET distinct crops and districts
router.get('/meta/options', async (req, res) => {
  try {
    const all = await db.prices.find({});
    const crops     = [...new Set(all.map(p => p.crop))].sort();
    const districts = [...new Set(all.map(p => p.district))].sort();
    res.json({ crops, districts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
