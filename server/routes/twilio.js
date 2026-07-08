require('dotenv').config();
const express = require('express');
const router  = require('express').Router();
const { db }  = require('../db/database');
const { randomUUID } = require('crypto');
const ai = require('../services/ai');

const DISTRICTS = { guntur:'Guntur', krishna:'Krishna', kurnool:'Kurnool', 'east godavari':'East Godavari', 'west godavari':'West Godavari', visakhapatnam:'Visakhapatnam', nellore:'Nellore', prakasam:'Prakasam', chittoor:'Chittoor', kadapa:'Kadapa', anantapur:'Anantapur', srikakulam:'Srikakulam', vizianagaram:'Vizianagaram' };
const CROPS_LIST = ['paddy','cotton','chilli','groundnut','maize','tobacco','sugarcane','onion','tomato','turmeric','banana','mango','jowar','bajra','sunflower','soybean','blackgram','greengram','redgram','sesame'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/** Build TwiML — audio as first Message, text as second Message (WhatsApp drops Body when combined with audio Media) */
const twiml = (audioUrl, ...textMessages) => {
  const body = textMessages.filter(Boolean).join('\n\n');
  const msgs = [];
  if (audioUrl) msgs.push(`<Message><Media>${esc(audioUrl)}</Media></Message>`);
  if (body)     msgs.push(`<Message><Body>${esc(body)}</Body></Message>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${msgs.join('\n')}\n</Response>`;
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
    const rawBody  = req.body.Body || '';
    const mobile   = (req.body.From || '').replace('whatsapp:+','').replace('+','');
    const numMedia = parseInt(req.body.NumMedia || '0');
    const mediaUrl = req.body.MediaUrl0 || null;
    const mediaCT  = (req.body.MediaContentType0 || '').toLowerCase();

    // Audio URLs — served from GitHub raw CDN (free, no interstitial, Twilio-compatible)
    const audio = file => `${GITHUB_AUDIO}/${file}.mp3`;

    const farmer  = await db.farmers.findOne({ mobile });
    const session = await getSession(mobile);

    // ══════════════════════════════════════════════════════════════════════════
    // VOICE MESSAGE — farmer sent a voice note (.ogg audio)
    // ══════════════════════════════════════════════════════════════════════════
    if (numMedia > 0 && (mediaCT.includes('audio') || mediaCT.includes('ogg'))) {
      console.log(`[Voice] Received audio from ${mobile}, transcribing...`);
      let transcript = null;
      let ttsUrl = null;

      try {
        const { data, contentType } = await ai.downloadTwilioMedia(
          mediaUrl,
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        transcript = await ai.transcribeVoice(data, contentType);
        console.log(`[Voice] Transcript: "${transcript}"`);
      } catch (err) {
        console.error('[Voice] Transcription failed:', err.message);
      }

      if (!transcript) {
        ttsUrl = ai.teluguTTSUrl('మీ వాయిస్ వినబడలేదు. దయచేసి మళ్ళీ ప్రయత్నించండి.');
        return res.send(twiml(
          ttsUrl || audio('error_unknown'),
          '⚠️ మీ వాయిస్ అర్థం కాలేదు.\nPlease try again or type your message.'
        ));
      }

      // Detect intent from transcript
      const voiceIntent = detect(transcript);
      await db.wa.update({ mobile }, { $set: {
        messages_count: (session.messages_count||0)+1,
        last_intent: `voice_${voiceIntent}`,
        last_transcript: transcript,
        updated_at: new Date().toISOString()
      }});

      // Generate smart AI response if Groq available
      let aiReplyText = null;
      if (ai.hasGroq()) {
        const allP = farmer ? await db.prices.find({ crop: farmer.primary_crop, district: farmer.district }) : [];
        const price = allP.sort((a,b) => b.date.localeCompare(a.date))[0];
        aiReplyText = await ai.generateAIResponse(voiceIntent, { farmer, transcript, priceData: price });
      }

      // Dynamic TTS for the AI response
      if (aiReplyText) {
        ttsUrl = ai.teluguTTSUrl(aiReplyText.substring(0, 180));
        return res.send(twiml(
          ttsUrl || audio('greeting_new'),
          `🎤 _"${transcript}"_\n\n${aiReplyText}`
        ));
      }

      // Fallback: reuse intent-based responses with transcript context
      const voiceReplyText = `🎤 _"${transcript}"_\n\nSending you info about: *${voiceIntent.replace('_',' ')}*`;
      return res.send(twiml(audio('greeting_new'), voiceReplyText));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // IMAGE MESSAGE — farmer sent a crop photo for disease detection
    // ══════════════════════════════════════════════════════════════════════════
    if (numMedia > 0 && mediaCT.includes('image')) {
      console.log(`[Disease] Received image from ${mobile}, analyzing...`);

      // Immediate acknowledgement (Twilio has 15s timeout)
      let diagnosis = null;
      try {
        const { data, contentType } = await ai.downloadTwilioMedia(
          mediaUrl,
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
        diagnosis = await ai.detectCropDisease(data, contentType, farmer?.primary_crop || '');
      } catch (err) {
        console.error('[Disease] Detection failed:', err.message);
      }

      if (!diagnosis) {
        return res.send(twiml(
          audio('error_unknown'),
          '⚠️ చిత్రం విశ్లేషణ సాధ్యపడలేదు.\nPlease send a clear photo of the affected plant part and try again.'
        ));
      }

      // Save detection to DB
      await db.disease.insert({
        id:          randomUUID(),
        mobile,
        farmer_name: farmer?.name || 'Unknown',
        district:    farmer?.district || 'Unknown',
        crop:        farmer?.primary_crop || diagnosis.crop_detected || 'Unknown',
        disease:     diagnosis.disease,
        telugu_disease: diagnosis.telugu_disease || diagnosis.disease,
        severity:    diagnosis.severity || 'unknown',
        confidence:  diagnosis.confidence || 'medium',
        is_healthy:  diagnosis.is_healthy || false,
        treatment:   diagnosis.treatment || [],
        organic_remedy: diagnosis.organic_remedy || '',
        telugu_summary: diagnosis.telugu_summary || '',
        media_url:   mediaUrl,
        detected_at: new Date().toISOString(),
        verified:    false,
      });
      await db.wa.update({ mobile }, { $set: {
        messages_count: (session.messages_count||0)+1,
        last_intent: 'image_disease',
        updated_at: new Date().toISOString()
      }});

      const replyText = ai.formatDiseaseReply(diagnosis, farmer?.primary_crop);
      // Generate Telugu TTS for the diagnosis summary
      const diagnosisAudio = diagnosis.is_healthy
        ? ai.teluguTTSUrl('మీ పంట ఆరోగ్యంగా ఉంది. చాలా బాగుంది!')
        : ai.teluguTTSUrl((diagnosis.telugu_summary || '').substring(0, 180));

      return res.send(twiml(
        diagnosisAudio || audio('error_unknown'),
        replyText
      ));
    }

    // ══════════════════════════════════════════════════════════════════════════
    // TEXT MESSAGE — regular text flow
    // ══════════════════════════════════════════════════════════════════════════
    const body  = rawBody;
    const intent = detect(body);
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
