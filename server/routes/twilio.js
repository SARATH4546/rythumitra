const express = require('express');
const router = express.Router();
const { db } = require('../db/database');
const { randomUUID } = require('crypto');

const DISTRICTS = { guntur:'Guntur', krishna:'Krishna', kurnool:'Kurnool', 'east godavari':'East Godavari', 'west godavari':'West Godavari', visakhapatnam:'Visakhapatnam', nellore:'Nellore', prakasam:'Prakasam', chittoor:'Chittoor', kadapa:'Kadapa', anantapur:'Anantapur', srikakulam:'Srikakulam', vizianagaram:'Vizianagaram' };
const CROPS_LIST = ['paddy','cotton','chilli','groundnut','maize','tobacco','sugarcane','onion','tomato','turmeric','banana','mango','jowar','bajra','sunflower','soybean','blackgram','greengram','redgram','sesame'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/** Build TwiML for WhatsApp — Body + optional audio Media in ONE <Message> */
const twiml = (audioUrl, ...textMessages) => {
  const body = textMessages.filter(Boolean).join('\n\n');
  if (audioUrl) {
    return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n<Message>\n  <Body>${esc(body)}</Body>\n  <Media>${esc(audioUrl)}</Media>\n</Message>\n</Response>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n<Message><Body>${esc(body)}</Body></Message>\n</Response>`;
};

/** GitHub raw CDN — free, public, no interstitial, Twilio can fetch directly */
const GITHUB_AUDIO = 'https://raw.githubusercontent.com/SARATH4546/rythumitra/main/voice';

/** Detect intent from incoming message text */
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

/** Get/create WhatsApp session for a mobile number */
const getSession = async mobile => {
  let s = await db.wa.findOne({ mobile });
  if (!s) {
    const id = randomUUID();
    await db.wa.insert({ id, mobile, messages_count:0, last_intent:'greeting', reg_state:null, reg_district:null, created_at:new Date().toISOString(), updated_at:new Date().toISOString() });
    s = await db.wa.findOne({ mobile });
  }
  return s;
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Webhook
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  res.set('Content-Type', 'text/xml');
  try {
    const body   = req.body.Body || '';
    const mobile = (req.body.From || '').replace('whatsapp:+','').replace('+','');

    // Audio URLs — served from GitHub raw CDN (free, no interstitial, Twilio-compatible)
    const audio = file => `${GITHUB_AUDIO}/${file}.mp3`;

    const intent  = detect(body);
    const farmer  = await db.farmers.findOne({ mobile });
    const session = await getSession(mobile);
    await db.wa.update({ mobile }, { $set: { messages_count:(session.messages_count||0)+1, last_intent:intent, updated_at:new Date().toISOString() } });

    // ── STOP ─────────────────────────────────────────────────────────
    if (intent === 'stop') {
      if (farmer) await db.farmers.update({ mobile }, { $set: { whatsapp_opted_in:false } });
      await db.wa.update({ mobile }, { $set: { reg_state:null, reg_district:null } });
      return res.send(twiml(
        audio('unsubscribe'),
        'మీరు RythuMitra నుండి నమోదు రద్దు చేసుకున్నారు.\nTo rejoin, send "Hello".'
      ));
    }

    // ── CROP SELECTION — completes registration ───────────────────────
    if (intent.startsWith('crop_') && session.reg_state === 'awaiting_crop' && session.reg_district) {
      const cropName = intent.replace('crop_', '');
      const district = session.reg_district;
      const existing = await db.farmers.findOne({ mobile });
      if (!existing) {
        await db.farmers.insert({ id:randomUUID(), mobile, district, primary_crop:cropName, whatsapp_opted_in:true, channel:'whatsapp', preferred_alert_time:'morning', created_at:new Date().toISOString(), last_active:new Date().toISOString() });
      } else {
        await db.farmers.update({ mobile }, { $set:{ district, primary_crop:cropName, whatsapp_opted_in:true } });
      }
      await db.wa.update({ mobile }, { $set:{ reg_state:'done', reg_district:null, district, crop:cropName } });

      // Fetch price immediately
      const allP  = await db.prices.find({ crop:cropName, district });
      const price = allP.sort((a,b)=>b.date.localeCompare(a.date))[0];
      const priceText = price
        ? `\n\n*${cropName} price in ${district} today:*\nModal: Rs.${price.price_modal.toLocaleString('en-IN')}/quintal\nMin: Rs.${price.price_min.toLocaleString('en-IN')} | Max: Rs.${price.price_max.toLocaleString('en-IN')}`
        : '';

      return res.send(twiml(
        audio('reg_complete'),
        `*Registration Complete!*\nDistrict: *${district}* | Crop: *${cropName}*${priceText}\n\nSend:\n"ధర" for price | "పథకం" for schemes\n"వాతావరణం" for weather | "రుణం" for loan`
      ));
    }

    // ── DISTRICT SELECTION — start registration ───────────────────────
    if (intent.startsWith('district_')) {
      const district = intent.replace('district_', '');
      await db.wa.update({ mobile }, { $set:{ reg_state:'awaiting_crop', reg_district:district } });
      return res.send(twiml(
        audio('reg_district_selected'),
        `*${district}* selected!\n\nNow send your primary crop:\n\nPaddy | Cotton | Chilli | Groundnut | Maize\nOnion | Tomato | Turmeric | Tobacco | Sugarcane`
      ));
    }

    // ── GREETING ─────────────────────────────────────────────────────
    if (intent === 'greeting') {
      await db.wa.update({ mobile }, { $set:{ reg_state:null, reg_district:null } });
      if (!farmer) {
        return res.send(twiml(
          audio('greeting_new'),
          `*Namaskaram! Welcome to RythuMitra*\n\nSend your district name to register:\n\nGuntur | Krishna | Kurnool | Nellore\nEast Godavari | West Godavari | Visakhapatnam\nPrakasam | Chittoor | Kadapa | Anantapur`
        ));
      }
      return res.send(twiml(
        audio('greeting_new'),
        `*Namaskaram ${farmer.name || 'Raitu'}! Welcome back*\n\n*${farmer.district}* | *${farmer.primary_crop}*\n\n"ధర" - Price\n"పథకం" - Schemes\n"వాతావరణం" - Weather\n"రుణం" - Loan\n"stop" - Unsubscribe`
      ));

    }

    // ── Mid-registration: invalid crop input ──────────────────────────
    if (session.reg_state === 'awaiting_crop') {
      return res.send(twiml(
        audio('error_unknown'),
        `Please send a valid crop name:\n\nPaddy | Cotton | Chilli | Groundnut | Maize\nOnion | Tomato | Turmeric | Tobacco | Sugarcane\n\nOr send "Hello" to restart.`
      ));
    }

    // ── PRICE ────────────────────────────────────────────────────────
    if (intent === 'price') {
      if (!farmer) {
        return res.send(twiml(
          audio('greeting_new'),
          'Please register first.\n\nSend your district name to begin:\nGuntur | Krishna | Kurnool | Nellore | East Godavari'
        ));
      }
      const { district, primary_crop:crop } = farmer;
      const allP  = await db.prices.find({ crop, district });
      const price = allP.sort((a,b)=>b.date.localeCompare(a.date))[0];
      const hist  = (await db.history.find({ crop, district })).sort((a,b)=>a.date.localeCompare(b.date)).slice(-7);

      if (!price) {
        return res.send(twiml(
          audio('price_not_available'),
          `Sorry - ${crop} price not available for ${district} today.\n\nTry again tomorrow or send "scheme" for schemes.`
        ));
      }

      // Spike detection
      let spikeAudio = null, spikeMsg = '';
      if (hist.length >= 2) {
        const avg = hist.reduce((s,h)=>s+h.price_modal,0)/hist.length;
        const chg = ((price.price_modal - avg) / avg) * 100;
        if (chg >= 10)  { spikeAudio = audio('price_spike_up');   spikeMsg = `\n\n*${chg.toFixed(1)}% rise* vs 7-day avg (Rs.${Math.round(avg).toLocaleString('en-IN')})\nGood time to sell!`; }
        if (chg <= -10) { spikeAudio = audio('price_spike_down');  spikeMsg = `\n\n*${Math.abs(chg).toFixed(1)}% drop* vs 7-day avg (Rs.${Math.round(avg).toLocaleString('en-IN')})\nConsider waiting a few days.`; }
      }

      const audioFile = spikeAudio || audio('price_normal');
      return res.send(twiml(
        audioFile,
        `*${crop} - ${district} Mandi*\n${price.date}\n\n*Modal: Rs.${price.price_modal.toLocaleString('en-IN')}/quintal*\nMin: Rs.${price.price_min.toLocaleString('en-IN')}\nMax: Rs.${price.price_max.toLocaleString('en-IN')}\nSource: ${price.source}${spikeMsg}`
      ));
    }

    // ── SCHEME ───────────────────────────────────────────────────────
    if (intent === 'scheme') {
      const schemes = await db.schemes.find({ is_active:true });
      // Map scheme names to audio files
      const schemeAudioMap = {
        'PM-KISAN': audio('scheme_pmkisan'),
        'Rythu Bharosa': audio('scheme_ryhtubharosa'),
        'PMFBY': audio('scheme_pmfby'),
      };
      const firstScheme = schemes[0];
      const schemeAudio = firstScheme ? (schemeAudioMap[firstScheme.name] || audio('schemes_intro')) : audio('schemes_intro');

      const list = schemes.map(s =>
        `*${s.name}*\nRs.${s.benefit_amount||'—'}${s.deadline?`\nDeadline: ${s.deadline}`:''}\n${s.benefit}`
      ).join('\n\n---\n\n');

      return res.send(twiml(
        audio('schemes_intro'),
        `*AP Government Schemes*\n\n${list}\n\n_Send "ధర" for price or "వాతావరణం" for weather_`
      ));
    }

    // ── WEATHER ──────────────────────────────────────────────────────
    if (intent === 'weather') {
      const dist = farmer?.district || 'AP';
      // Use rain warning audio if heavy rain simulated
      const isHeavyRain = true; // demo: always show heavy rain warning
      return res.send(twiml(
        audio(isHeavyRain ? 'weather_rain_warning' : 'weather_normal'),
        `*Weather Forecast - ${dist}*\n\nToday: Partly cloudy, 20% rain, 34C\nTomorrow: Heavy rain, 80% chance, 28C\nDay After: Clear, 5% rain, 36C\n\n*Advisory:* Heavy rain tomorrow - complete harvesting TODAY!`
      ));
    }

    // ── LOAN ─────────────────────────────────────────────────────────
    if (intent === 'loan') {
      return res.send(twiml(
        audio('loan_kcc'),
        `*Loan & Credit Info*\n\n*Kisan Credit Card (KCC)*\n- Interest: 4% (2% if repaid on time)\n- Limit: Rs.3,00,000\n- Apply: Any nationalized bank\n\n---\n\n*NABARD Microfinance*\n- Interest: 7% | Limit: Rs.5 lakh\n- Helpline: 1800-200-0104\n\n_Send "పథకం" for more schemes_`
      ));
    }

    // ── UNKNOWN ──────────────────────────────────────────────────────
    return res.send(twiml(
      audio('error_unknown'),
      `*RythuMitra*\n\nI didn't understand. Try:\n\n"ధర" / "price" - Mandi prices\n"పథకం" / "scheme" - Govt schemes\n"వాతావరణం" / "weather" - Weather\n"రుణం" / "loan" - Credit info\n"Hello" - Main menu`
    ));

  } catch (e) {
    console.error('Twilio webhook error:', e);
    return res.send(twiml(null, 'Sorry - server error. Please try again.'));
  }
});

router.get('/webhook', (req, res) => res.send('RythuMitra WhatsApp Webhook active'));

module.exports = router;
