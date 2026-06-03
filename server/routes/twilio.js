const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { randomUUID } = require('crypto');

const DISTRICTS = { guntur:'Guntur', krishna:'Krishna', kurnool:'Kurnool', 'east godavari':'East Godavari', 'west godavari':'West Godavari', visakhapatnam:'Visakhapatnam', nellore:'Nellore', prakasam:'Prakasam', chittoor:'Chittoor', kadapa:'Kadapa', anantapur:'Anantapur', srikakulam:'Srikakulam', vizianagaram:'Vizianagaram' };
const CROPS_LIST = ['paddy','cotton','chilli','groundnut','maize','tobacco','sugarcane','onion','tomato','turmeric','banana','mango','jowar','bajra','sunflower','soybean','blackgram','greengram','redgram','sesame'];

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const twiml = (...msgs) => `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${msgs.map(m => `<Message>${(m||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</Message>`).join('\n')}\n</Response>`;

const detect = t => {
  t = (t||'').toLowerCase().trim();
  if (['stop','unsubscribe'].some(k=>t.includes(k))) return 'stop';
  if (['hello','hi','namaskaram','start','hey','menu','నమస్కారం'].some(k=>t===k||t.includes(k))) return 'greeting';
  if (['ధర','price','dhara','rate','mandi','ధరలు'].some(k=>t===k||t.includes(k))) return 'price';
  if (['పథకం','scheme','yojana','pathakam','పథకాలు'].some(k=>t===k||t.includes(k))) return 'scheme';
  if (['వాతావరణం','weather','rain','forecast','వర్షం'].some(k=>t===k||t.includes(k))) return 'weather';
  if (['రుణం','loan','kcc','credit','runam','finance'].some(k=>t===k||t.includes(k))) return 'loan';
  for (const [k,v] of Object.entries(DISTRICTS)) { if (t===k||t.includes(k)) return `district_${v}`; }
  const crop = CROPS_LIST.find(c=>t===c||t.includes(c));
  if (crop) return `crop_${cap(crop)}`;
  return 'unknown';
};

// Get or create session for mobile
const getSession = async mobile => {
  let s = await db.wa.findOne({ mobile });
  if (!s) {
    const id = randomUUID();
    await db.wa.insert({ id, mobile, messages_count:0, last_intent:'greeting', reg_state:null, reg_district:null, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
    s = await db.wa.findOne({ mobile });
  }
  return s;
};

const updateSession = (mobile, fields) =>
  db.wa.update({ mobile }, { $set: { ...fields, updated_at: new Date().toISOString(), messages_count: undefined } });

router.post('/webhook', async (req, res) => {
  res.set('Content-Type', 'text/xml');
  try {
    const body   = req.body.Body || '';
    const mobile = (req.body.From || '').replace('whatsapp:+','').replace('+','');

    const intent  = detect(body);
    const farmer  = await db.farmers.findOne({ mobile });
    const session = await getSession(mobile);
    await db.wa.update({ mobile }, { $set: { messages_count: (session.messages_count||0)+1, last_intent: intent, updated_at: new Date().toISOString() } });

    // ── STOP ──────────────────────────────────────────────────────────
    if (intent === 'stop') {
      if (farmer) await db.farmers.update({ mobile }, { $set: { whatsapp_opted_in: false } });
      await db.wa.update({ mobile }, { $set: { reg_state: null, reg_district: null } });
      return res.send(twiml('మీరు RythuMitra నుండి నమోదు రద్దు చేసుకున్నారు. 🚫\n\nమళ్ళీ చేరడానికి "Hello" పంపండి.\nTo rejoin, send "Hello".'));
    }

    // ── CROP SELECTION (completing registration) ────────────────────────
    if (intent.startsWith('crop_') && session.reg_state === 'awaiting_crop' && session.reg_district) {
      const cropName = intent.replace('crop_', '');
      const district = session.reg_district;
      // Register the farmer
      const existing = await db.farmers.findOne({ mobile });
      if (!existing) {
        await db.farmers.insert({ id: randomUUID(), mobile, district, primary_crop: cropName, whatsapp_opted_in: true, channel: 'whatsapp', preferred_alert_time: 'morning', created_at: new Date().toISOString(), last_active: new Date().toISOString() });
      } else {
        await db.farmers.update({ mobile }, { $set: { district, primary_crop: cropName, whatsapp_opted_in: true } });
      }
      await db.wa.update({ mobile }, { $set: { reg_state: 'done', reg_district: null, district, crop: cropName } });

      // Fetch price right away
      const allP  = await db.prices.find({ crop: cropName, district });
      const price = allP.sort((a,b) => b.date.localeCompare(a.date))[0];
      const priceMsg = price
        ? `\n\n🌾 *${cropName} price in ${district} today:*\n💰 Modal: ₹${price.price_modal.toLocaleString('en-IN')}/quintal\n📉 Min: ₹${price.price_min.toLocaleString('en-IN')} | 📈 Max: ₹${price.price_max.toLocaleString('en-IN')}`
        : '';

      return res.send(twiml(
        `✅ *నమోదు పూర్తయింది! Registration Complete!*\n\n` +
        `📍 District: *${district}*\n🌱 Crop: *${cropName}*${priceMsg}\n\n` +
        `*Now you can send:*\n📈 *"ధర"* → Mandi price\n📋 *"పథకం"* → Govt schemes\n🌦️ *"వాతావరణం"* → Weather\n💳 *"రుణం"* → Loan info`
      ));
    }

    // ── DISTRICT SELECTION (start registration) ─────────────────────────
    if (intent.startsWith('district_')) {
      const district = intent.replace('district_', '');
      await db.wa.update({ mobile }, { $set: { reg_state: 'awaiting_crop', reg_district: district } });
      return res.send(twiml(
        `✅ *${district}* selected!\n\n` +
        `Now send your *primary crop* name:\n(మీ ప్రధాన పంట పేరు పంపండి)\n\n` +
        `*Paddy* | *Cotton* | *Chilli* | *Groundnut* | *Maize*\n*Onion* | *Tomato* | *Turmeric* | *Tobacco* | *Sugarcane*\n*Banana* | *Soybean* | *Sunflower* | *Blackgram*`
      ));
    }

    // ── GREETING ───────────────────────────────────────────────────────
    if (intent === 'greeting') {
      await db.wa.update({ mobile }, { $set: { reg_state: null, reg_district: null } });
      if (!farmer) {
        return res.send(twiml(
          `🌾 *నమస్కారం! RythuMitra కు స్వాగతం!*\nWelcome to RythuMitra — Your Farming Assistant 🙏\n\n` +
          `📍 *మీ జిల్లా పేరు పంపండి* (Send your district name):\n\n` +
          `Guntur | Krishna | Kurnool | Nellore\nEast Godavari | West Godavari | Visakhapatnam\nPrakasam | Chittoor | Kadapa | Anantapur`
        ));
      }
      return res.send(twiml(
        `🌾 *నమస్కారం ${farmer.name || 'రైతు'}! Welcome back!* 🙏\n\n` +
        `📍 *${farmer.district}* | 🌱 *${farmer.primary_crop}*\n\n` +
        `📈 *"ధర"* → Today's ${farmer.primary_crop} price\n` +
        `📋 *"పథకం"* → Government schemes\n` +
        `🌦️ *"వాతావరణం"* → Weather forecast\n` +
        `💳 *"రుణం"* → Loan & credit\n` +
        `🛑 *"stop"* → Unsubscribe`
      ));
    }

    // ── Mid-registration: crop awaited but didn't match ─────────────────
    if (session.reg_state === 'awaiting_crop') {
      return res.send(twiml(
        `Please send a valid crop name:\n\n` +
        `*Paddy* | *Cotton* | *Chilli* | *Groundnut* | *Maize*\n*Onion* | *Tomato* | *Turmeric* | *Tobacco* | *Sugarcane*\n\n` +
        `Or send *"Hello"* to restart.`
      ));
    }

    // ── PRICE ──────────────────────────────────────────────────────────
    if (intent === 'price') {
      if (!farmer) return res.send(twiml('Please register first.\n\nSend your district name to begin:\nGuntur | Krishna | Kurnool | Nellore | East Godavari'));
      const { district, primary_crop: crop } = farmer;
      const allP  = await db.prices.find({ crop, district });
      const price = allP.sort((a,b) => b.date.localeCompare(a.date))[0];
      const hist  = (await db.history.find({ crop, district })).sort((a,b) => a.date.localeCompare(b.date)).slice(-7);
      let spikeMsg = '';
      if (hist.length >= 2 && price) {
        const avg = hist.reduce((s,h) => s+h.price_modal, 0) / hist.length;
        const chg = ((price.price_modal - avg) / avg) * 100;
        if (Math.abs(chg) >= 10) spikeMsg = `\n\n${chg>0?'📈':'📉'} *${Math.abs(chg).toFixed(1)}% ${chg>0?'rise':'drop'}* vs 7-day avg (₹${Math.round(avg).toLocaleString('en-IN')})`;
      }
      if (!price) return res.send(twiml(`క్షమించండి / Sorry — ${crop} price not available for ${district} today.\n\nTry: "scheme" or "weather"`));
      return res.send(twiml(
        `🌾 *${crop} — ${district} Mandi*\n📅 ${price.date}\n\n` +
        `💰 *Modal: ₹${price.price_modal.toLocaleString('en-IN')}/quintal*\n` +
        `📉 Min: ₹${price.price_min.toLocaleString('en-IN')}\n` +
        `📈 Max: ₹${price.price_max.toLocaleString('en-IN')}\n` +
        `🔍 Source: ${price.source}${spikeMsg}\n\n` +
        `_Send "పథకం" for schemes or "వాతావరణం" for weather_`
      ));
    }

    // ── SCHEME ─────────────────────────────────────────────────────────
    if (intent === 'scheme') {
      const schemes = await db.schemes.find({ is_active: true });
      const list = schemes.map(s =>
        `📋 *${s.name}*\n💰 ${s.benefit_amount||'—'}${s.deadline?`\n⏰ Deadline: ${s.deadline}`:''}\nℹ️ ${s.benefit}`
      ).join('\n\n─────────────────\n\n');
      return res.send(twiml(`📋 *AP Government Schemes*\n\n${list}\n\n_Send "ధర" for price or "వాతావరణం" for weather_`));
    }

    // ── WEATHER ────────────────────────────────────────────────────────
    if (intent === 'weather') {
      const dist = farmer?.district || 'AP';
      return res.send(twiml(
        `🌦️ *Weather — ${dist}*\n\n` +
        `☁️ *Today:* Partly cloudy, 20% rain, 34°C\n` +
        `🌧️ *Tomorrow:* Heavy rain, 80% chance, 28°C\n` +
        `☀️ *Day After:* Clear, 5% rain, 36°C\n\n` +
        `⚠️ *Advisory:* Heavy rain tomorrow — harvest TODAY!\n_(వర్షం ముందు పంటను కోయండి!)_`
      ));
    }

    // ── LOAN ───────────────────────────────────────────────────────────
    if (intent === 'loan') {
      return res.send(twiml(
        `💳 *Loan & Credit*\n\n` +
        `🏦 *Kisan Credit Card (KCC)*\n• Interest: 4% (2% timely repayment)\n• Limit: ₹3,00,000\n• Apply: Any nationalized bank\n\n` +
        `─────────────────\n\n` +
        `🤝 *NABARD Microfinance*\n• Interest: 7% | Limit: ₹5 lakh (SHG)\n• Helpline: *1800-200-0104*\n\n` +
        `_Send "పథకం" for more schemes_`
      ));
    }

    // ── UNKNOWN ────────────────────────────────────────────────────────
    return res.send(twiml(
      `🌾 *RythuMitra*\n\nI didn't understand. Try:\n\n` +
      `📈 *"ధర"* / *"price"* → Mandi prices\n` +
      `📋 *"పథకం"* / *"scheme"* → Govt schemes\n` +
      `🌦️ *"వాతావరణం"* / *"weather"* → Weather\n` +
      `💳 *"రుణం"* / *"loan"* → Credit info\n` +
      `👋 *"Hello"* → Main menu`
    ));

  } catch (e) {
    console.error('Twilio webhook error:', e);
    return res.send(twiml('క్షమించండి / Sorry — server error. Please try again. 🙏'));
  }
});

router.get('/webhook', (req, res) => res.send('RythuMitra WhatsApp Webhook ✅'));

module.exports = router;
