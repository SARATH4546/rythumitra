const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { randomUUID } = require('crypto');

const DISTRICT_MAP = { '1':'Guntur','2':'Krishna','3':'Kurnool','4':'East Godavari','5':'West Godavari','6':'Visakhapatnam','7':'Nellore' };
const CROP_MAP     = { '1':'Paddy','2':'Cotton','3':'Chilli','4':'Groundnut','5':'Maize' };

// POST /api/ivr/call — missed-call callback initiated
router.post('/call', async (req, res) => {
  try {
    const { mobile } = req.body;
    if (!mobile) return res.status(400).json({ error: 'mobile required' });
    const farmer = await db.farmers.findOne({ mobile });
    const callId = randomUUID();
    await db.ivr_calls.insert({ id: callId, farmer_id: farmer?.id || null, mobile, duration: 0, menu_selections: null, district: farmer?.district || null, crop: farmer?.primary_crop || null, status: 'active', created_at: new Date().toISOString() });

    if (farmer) {
      res.json({ call_id: callId, is_new: false, farmer_name: farmer.name, district: farmer.district, primary_crop: farmer.primary_crop,
        message: `నమస్కారం ${farmer.name || 'రైతు'}! మీ ${farmer.primary_crop} పంట యొక్క ${farmer.district} మండి ధర వినడానికి 1 నొక్కండి. పథకాల కోసం 2, వాతావరణం కోసం 3 నొక్కండి.`,
        message_en: `Welcome back! Press 1 for ${farmer.primary_crop} price in ${farmer.district}. Press 2 for schemes. Press 3 for weather.`, menu: 'main' });
    } else {
      res.json({ call_id: callId, is_new: true,
        message: 'స్వాగతం! రైతు మిత్రకు స్వాగతం. మీ జిల్లా నమోదు చేయడానికి: 1=గుంటూరు, 2=కృష్ణా, 3=కర్నూలు, 4=తూర్పు గోదావరి, 5=పశ్చిమ గోదావరి',
        message_en: 'Welcome to RythuMitra! Press your district: 1=Guntur, 2=Krishna, 3=Kurnool, 4=East Godavari, 5=West Godavari', menu: 'registration' });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ivr/dtmf — key pressed
router.post('/dtmf', async (req, res) => {
  try {
    const { call_id, key, menu, mobile, district, crop } = req.body;

    // Update call log
    if (call_id) {
      const existing = await db.ivr_calls.findOne({ id: call_id });
      const prev = existing?.menu_selections ? JSON.parse(existing.menu_selections) : [];
      prev.push(key);
      await db.ivr_calls.update({ id: call_id }, { $set: { menu_selections: JSON.stringify(prev), duration: (existing?.duration || 0) + 15 } });
    }

    if (menu === 'main') {
      if (key === '1') {
        const farmer = await db.farmers.findOne({ mobile });
        const d = district || farmer?.district || 'Guntur';
        const c = crop     || farmer?.primary_crop || 'Paddy';
        const allPrices  = await db.prices.find({ crop: c, district: d });
        const price = allPrices.sort((a, b) => b.date.localeCompare(a.date))[0];
        return res.json({ key, action: 'play_audio',
          message: price ? `${d} మండిలో నేటి ${c} ధర: కనిష్ఠం ₹${price.price_min}, గరిష్ఠం ₹${price.price_max}, సాధారణ ₹${price.price_modal} రూపాయలు క్వింటాలుకు.`
                         : `క్షమించండి, ${d} మండిలో ${c} ధర అందుబాటులో లేదు.`,
          message_en: price ? `${c} price in ${d}: Min ₹${price.price_min}, Max ₹${price.price_max}, Modal ₹${price.price_modal}/quintal.`
                            : `Sorry, price not available for ${c} in ${d}.`,
          next_menu: 'main' });
      }
      if (key === '2') {
        const schemes = await db.schemes.find({ is_active: true });
        const list = schemes.slice(0, 3).map((s, i) => `${i+1}. ${s.name}: ${s.benefit_amount}`).join('. ');
        return res.json({ key, action: 'play_audio',
          message: `మీకు అర్హమైన పథకాలు: ${list}. వివరాల కోసం సమీప వ్యవసాయ కార్యాలయాన్ని సందర్శించండి.`,
          message_en: `Eligible schemes: ${list}. Visit nearest agricultural office for details.`, next_menu: 'main' });
      }
      if (key === '3') {
        const d = district || 'Guntur';
        return res.json({ key, action: 'play_audio',
          message: `${d} జిల్లాలో వాతావరణ సూచన: రేపు మేఘావృతం, 40% వర్షం అవకాశం. రెండు రోజులు వేచి ఉండండి.`,
          message_en: `${d} weather: Tomorrow cloudy, 40% rain chance. Wait 2 days before harvesting.`, next_menu: 'main' });
      }
      if (key === '4') {
        return res.json({ key, action: 'play_audio',
          message: 'కిసాన్ క్రెడిట్ కార్డు: 4% వడ్డీతో ₹3 లక్షల వరకు పంట రుణం. సమీప బ్యాంకును సందర్శించండి. సహాయం: 1800-180-1551.',
          message_en: 'KCC: Up to ₹3 lakh at 4% interest. Visit nearest bank. Helpline: 1800-180-1551.', next_menu: 'main' });
      }
      if (key === '5') return res.json({ key, action: 'transfer', message: 'మీ కాల్‌ను సహాయ కేంద్రానికి బదిలీ చేస్తున్నాం...', message_en: 'Transferring to agent...' });
      if (key === '9') return res.json({ key, action: 'sub_flow', message: 'పున:నమోదు మెను తెరవబడుతోంది...', message_en: 'Opening re-registration...', next_menu: 'registration' });
      if (key === '0') return res.json({ key, action: 'replay_menu', message: 'ధర కోసం 1, పథకాల కోసం 2, వాతావరణం కోసం 3, రుణం కోసం 4, సహాయం కోసం 5.', message_en: 'Press 1=price, 2=schemes, 3=weather, 4=loans, 5=agent', next_menu: 'main' });
    }

    if (menu === 'registration') {
      const sel = DISTRICT_MAP[key];
      if (sel) return res.json({ key, action: 'play_audio',
        message: `${sel} ఎంచుకున్నారు. మీ ప్రధాన పంట: 1=వరి, 2=పత్తి, 3=మిర్చి, 4=వేరుశనగ, 5=మొక్కజొన్న`,
        message_en: `Selected ${sel}. Choose crop: 1=Paddy, 2=Cotton, 3=Chilli, 4=Groundnut, 5=Maize`,
        next_menu: 'crop_select', district: sel });
    }

    if (menu === 'crop_select') {
      const selCrop = CROP_MAP[key];
      if (selCrop && district && mobile) {
        const existing = await db.farmers.findOne({ mobile });
        if (!existing) {
          await db.farmers.insert({ id: randomUUID(), mobile, district, primary_crop: selCrop, channel: 'ivr', whatsapp_opted_in: false, created_at: new Date().toISOString(), last_active: new Date().toISOString() });
        }
        return res.json({ key, action: 'registration_complete', crop: selCrop,
          message: `నమోదు పూర్తయింది! ${district} జిల్లాలో ${selCrop} రైతుగా నమోదు అయ్యారు. ధర కోసం 1, పథకాల కోసం 2.`,
          message_en: `Registered as ${selCrop} farmer in ${district}. Press 1 for price, 2 for schemes.`, next_menu: 'main' });
      }
    }

    res.json({ key, action: 'invalid', message: 'చెల్లుబాటు అయ్యే కీ కాదు. మళ్ళీ ప్రయత్నించండి.', message_en: 'Invalid key, try again.', next_menu: menu });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/ivr/end
router.post('/end', async (req, res) => {
  try {
    const { call_id, duration } = req.body;
    if (call_id) await db.ivr_calls.update({ id: call_id }, { $set: { status: 'completed', duration: duration || 0 } });
    res.json({ message: 'Call ended' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/ivr/logs
router.get('/logs', async (req, res) => {
  try {
    const logs = await db.ivr_calls.find({}).sort({ created_at: -1 });
    // Enrich with farmer name
    const enriched = await Promise.all(logs.slice(0, 50).map(async l => {
      if (l.farmer_id) { const f = await db.farmers.findOne({ id: l.farmer_id }); return { ...l, farmer_name: f?.name || null }; }
      return { ...l, farmer_name: null };
    }));
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
