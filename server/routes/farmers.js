const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { randomUUID } = require('crypto');

const LIMIT_DEFAULT = 20;

// GET all farmers with filters + pagination
router.get('/', async (req, res) => {
  try {
    const { district, crop, channel, search, page = 1, limit = LIMIT_DEFAULT } = req.query;
    let query = {};
    if (district) query.district = district;
    if (channel)  query.channel = channel;
    if (crop)     query.$or = [{ primary_crop: crop }, { secondary_crop: crop }];
    if (search) {
      const re = new RegExp(search, 'i');
      const sq = { $or: [{ name: re }, { mobile: re }] };
      query = Object.keys(query).length ? { $and: [query, sq] } : sq;
    }
    const all = await db.farmers.find(query).sort({ created_at: -1 });
    const total = all.length;
    const farmers = all.slice((Number(page) - 1) * Number(limit), Number(page) * Number(limit));
    res.json({ farmers, total, page: Number(page), limit: Number(limit) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET farmer stats
router.get('/stats/summary', async (req, res) => {
  try {
    const all = await db.farmers.find({});
    const total = all.length;
    const whatsapp = all.filter(f => f.whatsapp_opted_in).length;
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const recentWeek = all.filter(f => f.created_at >= sevenDaysAgo).length;

    const byDistrict = Object.entries(
      all.reduce((acc, f) => { acc[f.district] = (acc[f.district] || 0) + 1; return acc; }, {})
    ).map(([district, count]) => ({ district, count })).sort((a, b) => b.count - a.count);

    const byCrop = Object.entries(
      all.reduce((acc, f) => { acc[f.primary_crop] = (acc[f.primary_crop] || 0) + 1; return acc; }, {})
    ).map(([crop, count]) => ({ crop, count })).sort((a, b) => b.count - a.count).slice(0, 10);

    res.json({ total, whatsapp, ivr: total - whatsapp, byDistrict, byCrop, recentWeek });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET single farmer
router.get('/:id', async (req, res) => {
  try {
    const f = await db.farmers.findOne({ id: req.params.id });
    if (!f) return res.status(404).json({ error: 'Not found' });
    res.json(f);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST register farmer
router.post('/', async (req, res) => {
  try {
    const { mobile, name, district, primary_crop, secondary_crop, preferred_alert_time, whatsapp_opted_in, channel } = req.body;
    if (!mobile || !district || !primary_crop) return res.status(400).json({ error: 'mobile, district, primary_crop required' });
    const existing = await db.farmers.findOne({ mobile });
    if (existing) return res.status(409).json({ error: 'Already registered', id: existing.id });
    const id = randomUUID();
    await db.farmers.insert({ id, mobile, name: name || null, district, primary_crop, secondary_crop: secondary_crop || null, preferred_alert_time: preferred_alert_time || 'morning', whatsapp_opted_in: !!whatsapp_opted_in, channel: channel || 'ivr', created_at: new Date().toISOString(), last_active: new Date().toISOString() });
    res.status(201).json({ id, message: 'Farmer registered' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT update farmer
router.put('/:id', async (req, res) => {
  try {
    const f = await db.farmers.findOne({ id: req.params.id });
    if (!f) return res.status(404).json({ error: 'Not found' });
    const { name, district, primary_crop, secondary_crop, preferred_alert_time, whatsapp_opted_in, channel } = req.body;
    const update = {};
    if (name !== undefined) update.name = name;
    if (district !== undefined) update.district = district;
    if (primary_crop !== undefined) update.primary_crop = primary_crop;
    if (secondary_crop !== undefined) update.secondary_crop = secondary_crop;
    if (preferred_alert_time !== undefined) update.preferred_alert_time = preferred_alert_time;
    if (whatsapp_opted_in !== undefined) update.whatsapp_opted_in = !!whatsapp_opted_in;
    if (channel !== undefined) update.channel = channel;
    update.last_active = new Date().toISOString();
    await db.farmers.update({ id: req.params.id }, { $set: update });
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE farmer
router.delete('/:id', async (req, res) => {
  try {
    const n = await db.farmers.remove({ id: req.params.id });
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
