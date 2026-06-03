const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { randomUUID } = require('crypto');

router.get('/', async (req, res) => {
  try {
    const { active } = req.query;
    let query = {};
    if (active !== undefined) query.is_active = active === 'true';
    const schemes = await db.schemes.find(query).sort({ name: 1 });
    res.json(schemes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', async (req, res) => {
  try {
    const s = await db.schemes.findOne({ id: req.params.id });
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  try {
    const { name, name_telugu, department, benefit, benefit_amount, eligibility, deadline, how_to_apply } = req.body;
    if (!name || !department || !benefit) return res.status(400).json({ error: 'name, department, benefit required' });
    const id = randomUUID();
    await db.schemes.insert({ id, name, name_telugu: name_telugu || null, department, benefit, benefit_amount: benefit_amount || null, eligibility: eligibility || null, deadline: deadline || null, how_to_apply: how_to_apply || null, is_active: true, created_at: new Date().toISOString() });
    res.status(201).json({ id, message: 'Scheme created' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', async (req, res) => {
  try {
    const s = await db.schemes.findOne({ id: req.params.id });
    if (!s) return res.status(404).json({ error: 'Not found' });
    const update = {};
    const fields = ['name','name_telugu','department','benefit','benefit_amount','eligibility','deadline','how_to_apply','is_active'];
    fields.forEach(f => { if (req.body[f] !== undefined) update[f] = req.body[f]; });
    await db.schemes.update({ id: req.params.id }, { $set: update });
    res.json({ message: 'Updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    const n = await db.schemes.remove({ id: req.params.id });
    if (!n) return res.status(404).json({ error: 'Not found' });
    res.json({ message: 'Deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
