const express = require('express');
const router  = express.Router();
const { db }  = require('../db/database');
const { randomUUID } = require('crypto');

// GET /api/disease/detections — list all disease detections (paginated)
router.get('/detections', async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 20;
    const crop  = req.query.crop;
    const district = req.query.district;
    const severity = req.query.severity;

    let query = {};
    if (crop)     query.crop = new RegExp(crop, 'i');
    if (district) query.district = district;
    if (severity) query.severity = severity;

    const all = await db.disease.find(query);
    const sorted = all.sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at));
    const total  = sorted.length;
    const items  = sorted.slice((page - 1) * limit, page * limit);

    res.json({ total, page, limit, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/disease/stats — disease statistics for analytics
router.get('/stats', async (req, res) => {
  try {
    const all = await db.disease.find({});

    // By crop
    const byCrop = {};
    // By disease
    const byDisease = {};
    // By district
    const byDistrict = {};
    // By severity
    const bySeverity = { healthy: 0, mild: 0, moderate: 0, severe: 0, unknown: 0 };

    for (const d of all) {
      const cropKey = d.plant || d.crop || 'Unknown';
      byCrop[cropKey]                           = (byCrop[cropKey] || 0) + 1;
      byDisease[d.disease || 'Unknown']         = (byDisease[d.disease || 'Unknown'] || 0) + 1;
      byDistrict[d.district || 'Unknown']       = (byDistrict[d.district || 'Unknown'] || 0) + 1;
      const sev = d.is_healthy ? 'healthy' : (d.severity || 'unknown');
      bySeverity[sev] = (bySeverity[sev] || 0) + 1;
    }


    // Top 5 diseases
    const topDiseases = Object.entries(byDisease)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    // Top 5 affected crops
    const topCrops = Object.entries(byCrop)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }));

    res.json({
      total: all.length,
      bySeverity,
      topDiseases,
      topCrops,
      byDistrict,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/disease/:id — single detection detail
router.get('/:id', async (req, res) => {
  try {
    const d = await db.disease.findOne({ id: req.params.id });
    if (!d) return res.status(404).json({ error: 'Not found' });
    res.json(d);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/disease/:id/verify — admin verifies/corrects AI diagnosis
router.put('/:id/verify', async (req, res) => {
  try {
    const { verified_disease, admin_notes, treatment_given } = req.body;
    await db.disease.update(
      { id: req.params.id },
      { $set: { verified_disease, admin_notes, treatment_given, verified_at: new Date().toISOString(), verified: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
