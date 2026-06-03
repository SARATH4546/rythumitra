const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { randomUUID } = require('crypto');

router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;
    const query = {};
    if (status) query.status = status;
    if (type)   query.type   = type;
    const alerts = await db.alerts.find(query).sort({ created_at: -1 });
    res.json(alerts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { type, message, message_telugu, district, crop, channel } = req.body;
    if (!type || !message) return res.status(400).json({ error: 'type and message required' });

    // Estimate recipients
    const query = {};
    if (district) query.district = district;
    if (crop)     query.$or = [{ primary_crop: crop }, { secondary_crop: crop }];
    if (channel === 'whatsapp') query.whatsapp_opted_in = true;
    const allFarmers = await db.farmers.find(query);
    const est = allFarmers.length;

    const id = randomUUID();
    await db.alerts.insert({ id, type, message, message_telugu: message_telugu || null, district: district || null, crop: crop || null, channel: channel || 'whatsapp', recipients_count: est, delivered_count: 0, status: 'draft', created_at: new Date().toISOString(), sent_at: null });
    res.status(201).json({ id, estimated_recipients: est, message: 'Alert created as draft' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/send', async (req, res) => {
  try {
    const alert = await db.alerts.findOne({ id: req.params.id });
    if (!alert) return res.status(404).json({ error: 'Not found' });
    if (alert.status === 'sent') return res.status(400).json({ error: 'Already sent' });
    const delivered = Math.floor(alert.recipients_count * (0.92 + Math.random() * 0.06));
    await db.alerts.update({ id: req.params.id }, { $set: { status: 'sent', delivered_count: delivered, sent_at: new Date().toISOString() } });
    res.json({ message: 'Alert sent', delivered, total: alert.recipients_count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await db.alerts.remove({ id: req.params.id });
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
