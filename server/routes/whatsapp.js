const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { randomUUID } = require('crypto');

const detect = text => {
  const t = text.toLowerCase().trim();
  if (['stop','unsubscribe','ఆపు'].some(k => t.includes(k)))       return 'stop';
  if (['hello','hi','నమస్కారం','namaskaram','start','hey'].some(k => t === k || t.includes(k))) return 'greeting';
  if (['ధర','price','dhara','rate','ధరలు','mandi'].some(k => t.includes(k))) return 'price';
  if (['పథకం','scheme','pathakam','yojana','పథకాలు'].some(k => t.includes(k))) return 'scheme';
  if (['వాతావరణం','weather','rain','వర్షం','forecast'].some(k => t.includes(k))) return 'weather';
  if (['రుణం','loan','runam','credit','kcc','finance'].some(k => t.includes(k))) return 'loan';
  return 'unknown';
};

// POST /api/whatsapp/message
router.post('/message', async (req, res) => {
  try {
    const { mobile, text, session_id } = req.body;
    if (!mobile || !text) return res.status(400).json({ error: 'mobile and text required' });

    const intent = detect(text);
    const farmer = await db.farmers.findOne({ mobile });

    // Upsert session
    let session = session_id ? await db.wa.findOne({ id: session_id }) : await db.wa.findOne({ mobile });
    if (!session) {
      const sid = randomUUID();
      await db.wa.insert({ id: sid, farmer_id: farmer?.id || null, mobile, messages_count: 1, last_intent: intent, district: farmer?.district || null, crop: farmer?.primary_crop || null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      session = await db.wa.findOne({ id: sid });
    } else {
      await db.wa.update({ id: session.id }, { $set: { messages_count: session.messages_count + 1, last_intent: intent, updated_at: new Date().toISOString() } });
    }

    if (intent === 'stop') {
      if (farmer) await db.farmers.update({ mobile }, { $set: { whatsapp_opted_in: false } });
      return res.json({ session_id: session.id, intent, messages: [
        { type:'voice_note', audio_file:'unsubscribe', audio_label:'నమోదు రద్దు నిర్ధారణ' },
        { type:'text', text:'మీరు RythuMitra నుండి నమోదు రద్దు చేసుకున్నారు.\nMళ్ళీ చేరడానికి "Hello" పంపండి.', text_en:'You have been unsubscribed. Send "Hello" to rejoin.' }
      ]});
    }

    if (intent === 'greeting') {
      if (!farmer) return res.json({ session_id: session.id, intent, is_new: true, messages: [
        { type:'voice_note', audio_file:'greeting_new', audio_label:'రైతు మిత్ర స్వాగత సందేశం' },
        { type:'text', text:'🌾 నమస్కారం! రైతు మిత్రకు స్వాగతం!\n\nమీ జిల్లా ఎంచుకోండి:', text_en:'🌾 Welcome to RythuMitra!\n\nPlease select your district:' },
        { type:'quick_reply', options:[{label:'📍 Guntur',value:'district_Guntur'},{label:'📍 Krishna',value:'district_Krishna'},{label:'📍 Kurnool',value:'district_Kurnool'},{label:'📍 East Godavari',value:'district_East Godavari'},{label:'📍 West Godavari',value:'district_West Godavari'}] }
      ]});
      return res.json({ session_id: session.id, intent, messages: [
        { type:'text', text:`🌾 నమస్కారం ${farmer.name || 'రైతు'}!\n\nనేను మీకు ఏమి సహాయం చేయగలను?`, text_en:`🌾 Welcome back ${farmer.name || 'Farmer'}! How can I help?` },
        { type:'voice_note', audio_file:'greeting_returning_{name}', audio_label:`నమస్కారం ${farmer.name || 'రైతు'}! Welcome back` },
        { type:'quick_reply', options:[{label:'📈 ధర (Price)',value:'price'},{label:'📋 పథకాలు (Schemes)',value:'scheme'},{label:'🌦️ వాతావరణం (Weather)',value:'weather'},{label:'💳 రుణం (Loan)',value:'loan'}] }
      ]});
    }

    if (intent === 'price') {
      const dist  = farmer?.district || 'Guntur';
      const crop  = farmer?.primary_crop || 'Paddy';
      const allP  = await db.prices.find({ crop, district: dist });
      const price = allP.sort((a, b) => b.date.localeCompare(a.date))[0];
      const hist  = (await db.history.find({ crop, district: dist })).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
      return res.json({ session_id: session.id, intent, messages: [
        { type:'voice_note', audio_file: price ? 'price_normal' : 'price_not_available', audio_label: price ? `${dist} మండిలో నేటి ${crop} ధర - ${price?.price_modal} రూపాయలు` : `${crop} ధర అందుబాటులో లేదు` },
        price ? { type:'price_card', data:{ crop:price.crop, district:price.district, modal:price.price_modal, min:price.price_min, max:price.price_max, unit:price.unit, date:price.date, source:price.source } }
              : { type:'text', text:`Sorry, no price data for ${crop} in ${dist} today.`, text_en:'' },
        hist.length > 1 ? { type:'price_chart', data:hist, crop, district:dist } : null,
        { type:'quick_reply', options:[{label:'🔄 వేరే పంట',value:'price_other'},{label:'📋 పథకాలు',value:'scheme'},{label:'🏠 Menu',value:'menu'}] }
      ].filter(Boolean) });
    }

    if (intent === 'scheme') {
      const schemes = await db.schemes.find({ is_active: true });
      return res.json({ session_id: session.id, intent, messages: [
        { type:'voice_note', audio_file:'schemes_intro', audio_label:'ప్రభుత్వ పథకాల సమాచారం' },
        { type:'text', text:'📋 మీకు అర్హమైన ప్రభుత్వ పథకాలు:', text_en:'📋 Government schemes you may be eligible for:' },
        ...schemes.map(s => ({ type:'scheme_card', data:{ id:s.id, name:s.name, name_telugu:s.name_telugu, benefit:s.benefit, amount:s.benefit_amount, deadline:s.deadline, apply:s.how_to_apply } })),
        { type:'quick_reply', options:[{label:'📈 ధర',value:'price'},{label:'🌦️ వాతావరణం',value:'weather'},{label:'🏠 Menu',value:'menu'}] }
      ]});
    }

    if (intent === 'weather') {
      const dist = farmer?.district || 'Guntur';
      return res.json({ session_id: session.id, intent, messages: [
        { type:'voice_note', audio_file:'weather_rain_warning', audio_label:`${dist} జిల్లా వాతావరణ సూచన - రేపు భారీ వర్షం అంచనా` },
        { type:'weather_card', district:dist, forecast:[
          { day:'Today',     icon:'⛅', condition:'Partly Cloudy', temp:'34°C', rain:'20%' },
          { day:'Tomorrow',  icon:'🌧️', condition:'Heavy Rain',    temp:'28°C', rain:'80%' },
          { day:'Day After', icon:'☀️', condition:'Clear Skies',   temp:'36°C', rain:'5%'  }
        ]},
        { type:'text', text:'⚠️ హెచ్చరిక: రేపు భారీ వర్షం అంచనా. పంట కోత పనులు నేడే పూర్తి చేయండి.', text_en:'⚠️ Heavy rain expected tomorrow. Complete harvesting today.' },
        { type:'quick_reply', options:[{label:'📈 ధర',value:'price'},{label:'📋 పథకాలు',value:'scheme'},{label:'🏠 Menu',value:'menu'}] }
      ]});
    }

    if (intent === 'loan') {
      return res.json({ session_id: session.id, intent, messages: [
        { type:'voice_note', audio_file:'loan_kcc', audio_label:'కిసాన్ క్రెడిట్ కార్డు మరియు నాబార్డ్ రుణ సమాచారం' },
        { type:'loan_card', data:[
          { name:'Kisan Credit Card (KCC)', interest:'4%', limit:'₹3,00,000', docs:'Land record, Aadhaar, Passport photo', contact:'Nearest nationalized bank' },
          { name:'NABARD Microfinance',     interest:'7%', limit:'₹5,00,000 (SHG)', docs:'SHG membership, Aadhaar', contact:'1800-200-0104' }
        ]},
        { type:'quick_reply', options:[{label:'📋 పథకాలు',value:'scheme'},{label:'📈 ధర',value:'price'},{label:'🏠 Menu',value:'menu'}] }
      ]});
    }

    // unknown
    return res.json({ session_id: session.id, intent:'unknown', messages: [
      { type:'text', text:'🤔 నేను అర్థం చేసుకోలేదు. దయచేసి ఒక ఎంపిక ఎంచుకోండి:', text_en:"🤔 I didn't understand. Please choose:" },
      { type:'quick_reply', options:[{label:'📈 ధర (Price)',value:'price'},{label:'📋 పథకాలు',value:'scheme'},{label:'🌦️ వాతావరణం',value:'weather'},{label:'💳 రుణం',value:'loan'}] }
    ]});
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/whatsapp/register
router.post('/register', async (req, res) => {
  try {
    const { mobile, district, primary_crop, secondary_crop, preferred_alert_time } = req.body;
    if (!mobile || !district || !primary_crop) return res.status(400).json({ error: 'mobile, district, primary_crop required' });
    const existing = await db.farmers.findOne({ mobile });
    if (existing) {
      await db.farmers.update({ mobile }, { $set: { district, primary_crop, secondary_crop: secondary_crop || null, preferred_alert_time: preferred_alert_time || 'morning', whatsapp_opted_in: true, channel: 'whatsapp', last_active: new Date().toISOString() } });
      return res.json({ id: existing.id, is_new: false, message: 'Profile updated' });
    }
    const id = randomUUID();
    await db.farmers.insert({ id, mobile, district, primary_crop, secondary_crop: secondary_crop || null, preferred_alert_time: preferred_alert_time || 'morning', whatsapp_opted_in: true, channel: 'whatsapp', created_at: new Date().toISOString(), last_active: new Date().toISOString() });
    res.status(201).json({ id, is_new: true, message: 'Registration complete' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/whatsapp/sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await db.wa.find({}).sort({ updated_at: -1 });
    const enriched = await Promise.all(sessions.slice(0, 50).map(async s => {
      const f = s.farmer_id ? await db.farmers.findOne({ id: s.farmer_id }) : null;
      return { ...s, farmer_name: f?.name || null, farmer_district: f?.district || null };
    }));
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
