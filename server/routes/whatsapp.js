'use strict';

const express    = require('express');
const router     = express.Router();
const { db }     = require('../db/database');
const { randomUUID } = require('crypto');
const path       = require('path');
const fs         = require('fs');
const https      = require('https');
const http       = require('http');
const os         = require('os');
const fetch      = require('node-fetch');

const STT_URL     = `http://127.0.0.1:${process.env.STT_PORT||5001}`;
const DISEASE_URL = `http://127.0.0.1:${process.env.DISEASE_PORT||5002}`;

// ── Twilio client (for outbound messages & media download auth) ───────────────
const ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN;
const FROM_WA      = 'whatsapp:+14155238886';  // Twilio sandbox number

let twilioClient = null;
try {
  const Twilio   = require('twilio');
  twilioClient   = new Twilio(ACCOUNT_SID, AUTH_TOKEN);
  console.log('[WA] Twilio client ready');
} catch (e) {
  console.error('[WA] Twilio client failed:', e.message);
}

// ── Temp dir for audio/image downloads ───────────────────────────────────────
const TMP = path.join(os.tmpdir(), 'rythymitra');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

// ── Download Twilio media (auth + auto-follow redirects) ─────────────────────
async function downloadMedia(mediaUrl, destPath) {
  const sid  = process.env.TWILIO_ACCOUNT_SID;   // read fresh each call
  const tok  = process.env.TWILIO_AUTH_TOKEN;
  const auth = Buffer.from(`${sid}:${tok}`).toString('base64');
  console.log(`[WA DL] URL: ${mediaUrl.substring(0,80)}`);
  console.log(`[WA DL] SID ok:${!!sid} TOK ok:${!!tok}`);
  const res  = await fetch(mediaUrl, {
    headers:  { Authorization: `Basic ${auth}` },
    redirect: 'follow',
    timeout:  60000,
  });
  console.log(`[WA DL] Status: ${res.status} | Content-Type: ${res.headers.get('content-type')}`);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
  const buf = await res.buffer();
  console.log(`[WA DL] Bytes received: ${buf.length}`);
  if (buf.length < 100) throw new Error(`File too small (${buf.length}B) — likely auth failed`);
  fs.writeFileSync(destPath, buf);
  return destPath;
}


// ── Convert OGG/OPUS to WAV using ffmpeg (Whisper needs WAV at -14dB) ─────────
function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y', '-i', inputPath,
      '-ar', '16000',          // 16kHz — Whisper's native rate
      '-ac', '1',              // mono
      // loudnorm: normalize quiet WhatsApp audio to -14 LUFS for reliable transcription
      '-af', 'loudnorm=I=-14:LRA=11:TP=-1.5',
      '-f', 'wav', outputPath
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    ff.on('close', code => code === 0 ? resolve(outputPath) : reject(new Error(`ffmpeg exit ${code}`)));
    setTimeout(() => { ff.kill(); reject(new Error('ffmpeg timeout')); }, 30000);
  });
}



// ── Call persistent STT server ───────────────────────────────────────────────
async function callSTT(audioPath, language = 'te') {
  const r = await fetch(`${STT_URL}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_path: audioPath, language }),
    timeout: 60000,
  });
  return r.json();
}

// ── Call persistent disease server ───────────────────────────────────────────
async function callDisease(imagePath) {
  const r = await fetch(`${DISEASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_path: imagePath }),
    timeout: 60000,
  });
  return r.json();
}

// ── TTS via edge-tts (still spawned — fast, no model load) ───────────────────
const { spawn } = require('child_process');
function runTTS(text, outPath, voice = 'te-IN-ShrutiNeural') {
  return new Promise((resolve) => {
    const py  = spawn('python', [path.join(__dirname, '../python/tts.py'), text, outPath, voice], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });
    let out = '';
    py.stdout.on('data', d => out += d.toString());
    py.on('close', () => {
      try { resolve(JSON.parse(out)); } catch { resolve({ success: false }); }
    });
    setTimeout(() => { py.kill(); resolve({ success: false, error: 'TTS timeout' }); }, 30000);
  });
}

// ── Send outbound WhatsApp message via Twilio API ────────────────────────────
async function sendWA(to, body, mediaUrl = null) {
  if (!twilioClient) return console.error('[WA] No Twilio client');
  const msg = { from: FROM_WA, to, body };
  if (mediaUrl) msg.mediaUrl = [mediaUrl];
  try {
    await twilioClient.messages.create(msg);
  } catch (e) {
    console.error('[WA outbound]', e.message);
  }
}

// ── Intent detector ──────────────────────────────────────────────────────────
function detectIntent(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t || t.length < 2) return 'unknown';

  if (['stop','unsubscribe','ఆపు'].some(k => t.includes(k)))
    return 'stop';

  if (['hello','hi','నమస్కారం','namaskaram','start','hey','menu','welcome','నమస్కారు','నమస్తే','namas'].some(k => t.includes(k)))
    return 'greeting';

  // Price/market — Telugu script (what Vakyansh actually outputs) + English
  if ([
    'ధర','దర','దరా','ధరలు','ధరను','ధరకు',
    'మండి','మంది','మండిలో','మార్కెట్','బజారు',
    'రేట్','రేట్ల','రేటు','రేట్లు',
    'అమ్మకం','కొనుగోలు','విక్రయం',
    'ఈరోజు','నేటి',
    'price','rate','rates','mandi','market','dhara','dharam','bazaar',
    'mirju','mandu','mandy','manni','mande','manda',
  ].some(k => t.includes(k)))
    return 'price';

  // Scheme — Telugu script + English
  if ([
    'పథకం','పథకాల','పథకాలు',
    'స్కీమ్','స్కీముల్','స్కీముల','స్కేముల్','స్కేముల',
    'గవర్నమెంట్','ప్రభుత్వ','సబ్సిడీ','సంక్షేమ','సహాయం',
    'scheme','pathakam','yojana','subsidy','government','welfare','pradhan','kisan','pm ',
  ].some(k => t.includes(k)))
    return 'scheme';

  // Weather — Telugu script + English
  if ([
    'వాతావరణం','వర్షం','వర్ష','వర్షాలు','వానలు','వాన',
    'ఉష్ణోగ్రత','మేఘం','ఆకాశం','గాలి','తుఫాను',
    'weather','rain','forecast','climate','temperature','cloud','today','tomorrow',
  ].some(k => t.includes(k)))
    return 'weather';

  // Loan — Telugu script + English
  if ([
    'రుణం','రుణ','రుణాలు','అప్పు','వడ్డీ','బ్యాంకు','కేసీసీ','నాబార్డ్',
    'loan','credit','kcc','finance','bank','interest','nabard','borrow','runam',
  ].some(k => t.includes(k)))
    return 'loan';

  // Disease / photo — Telugu + English
  if ([
    'రోగం','రోగ','రోగాలు','ఆకు','పురుగు','సమస్య','చీడ','పీడ',
    'ఫోటో','చిత్రం','పంపు','పండి','ద్వరా','ద్వారా',
    'disease','leaf','pest','problem','crop','plant','photo','image','sick','fungi','spot',
  ].some(k => t.includes(k)))
    return 'disease_hint';

  return 'unknown';
}



// ── Build text reply from intent ─────────────────────────────────────────────
async function buildReply(intent, mobile, text) {
  const farmer = await db.farmers.findOne({ mobile }).catch(() => null);
  const name   = farmer?.name || 'రైతు';

  if (intent === 'greeting') {
    return farmer
      ? `🌾 నమస్కారం ${name}! RythuMitra కు స్వాగతం!\n\n📈 Price | 📋 Scheme | 🌦️ Weather | 💳 Loan\n\n📸 పంట రోగం కోసం చిత్రం పంపండి\n🎙️ Voice message పంపవచ్చు!`
      : `🌾 నమస్కారం! RythuMitra కు స్వాగతం!\nWelcome to RythuMitra - Farmer Assistant!\n\n📈 Price | 📋 Scheme\n🌦️ Weather | 💳 Loan\n\n📸 Send crop photo for disease detection\n🎙️ You can send voice messages!`;
  }
  if (intent === 'price') {
    const dist  = farmer?.district || 'Guntur';
    const crop  = farmer?.primary_crop || 'Paddy';
    const allP  = await db.prices.find({ crop, district: dist }).catch(() => []);
    const price = allP.sort((a,b) => b.date.localeCompare(a.date))[0];
    return price
      ? `📈 *నేటి మండి ధర*\n🌾 ${price.crop} - ${price.district}\n💰 ₹${price.price_modal}/quintal\n📉 Min:₹${price.price_min} Max:₹${price.price_max}\n📅 ${price.date}`
      : `ℹ️ ${crop} price not available for ${dist} today.`;
  }
  if (intent === 'scheme') {
    return `📋 *ప్రభుత్వ పథకాలు*\n\n1. PM-KISAN → ₹6000/year\n2. Rythu Bandhu → ₹5000/acre\n3. PMFBY Crop Insurance\n4. KCC Loan → 4% interest\n\n📞 1800-180-1551`;
  }
  if (intent === 'weather') {
    const dist = farmer?.district || 'Guntur';
    return `🌦️ *${dist} వాతావరణం*\n\n☀️ Today: 34°C - Partly Cloudy (20%)\n🌧️ Tomorrow: 28°C - Heavy Rain (80%)\n☀️ Day After: 36°C - Clear (5%)\n\n⚠️ రేపు భారీ వర్షం! పంట కోత నేడే పూర్తి చేయండి.`;
  }
  if (intent === 'loan') {
    return `💳 *రుణ సమాచారం*\n\n🏦 KCC: ₹3L @ 4%\n🏦 NABARD: ₹5L @ 7%\n\n📞 1800-200-0104`;
  }
  if (intent === 'disease_hint') {
    return `📸 పంట రోగం గుర్తించడానికి దయచేసి మీ పంట ఆకు యొక్క స్పష్టమైన ఫోటో పంపండి.\n\nPlease send a clear photo of your crop leaf for disease detection.`;
  }
  if (intent === 'stop') {
    return `✅ మీరు నమోదు రద్దు చేసుకున్నారు. "Hello" పంపి తిరిగి చేరండి.`;
  }
  return `🤔 అర్థం కాలేదు.\n\nType: *price* | *scheme* | *weather* | *loan*\n📸 Or send a crop photo for disease detection\n🎙️ Voice message also works!`;
}

// ── Build natural spoken text for TTS (no emojis, full sentences) ─────────────
async function buildSpokenReply(intent, mobile) {
  const farmer = await db.farmers.findOne({ mobile }).catch(() => null);
  const name   = farmer?.name || 'రైతు అన్నా';

  if (intent === 'greeting') {
    return `నమస్కారం ${name}! రైతు మిత్ర కు స్వాగతం. మీరు ధర, పథకాలు, వాతావరణం, లేదా రుణం గురించి అడగవచ్చు. పంట ఆకు ఫోటో పంపి రోగ నిర్ధారణ కూడా చేయవచ్చు.`;
  }
  if (intent === 'price') {
    const dist  = farmer?.district || 'గుంటూరు';
    const crop  = farmer?.primary_crop || 'వరి';
    const allP  = await db.prices.find({ crop, district: dist }).catch(() => []);
    const price = allP.sort((a,b) => b.date.localeCompare(a.date))[0];
    if (price) {
      return `${name}, ${dist} మండిలో ఈ రోజు ${price.crop} ధర ${price.price_modal} రూపాయలు ప్రతి క్వింటాల్కు. కనిష్ట ధర ${price.price_min} రూపాయలు, గరిష్ట ధర ${price.price_max} రూపాయలు.`;
    }
    return `${dist} మండిలో ${crop} ధర ఇప్పుడు అందుబాటులో లేదు.`;
  }
  if (intent === 'scheme') {
    return `ప్రభుత్వ పథకాల విషయంలో మీకు సహాయం చేస్తాను. పీయమ్ కిసాన్ పథకంలో ఏడాదికి ఆరు వేల రూపాయలు. రైతు బంధులో ఎకరానికి అయిదు వేల రూపాయలు. పీయమ్ ఎఫ్బీవై పంట బీమా మరియు కేసీసీ రుణం నాలుగు శాతం వడ్డీకి అందుబాటులో ఉన్నాయి. మరిన్ని వివరాలకు 1800 180 1551 కు కాల్ చేయండి.`;
  }
  if (intent === 'weather') {
    const dist = farmer?.district || 'గుంటూరు';
    return `${dist} వాతావరణ వివరాలు వింటారా. ఈ రోజు ముప్పై నాలుగు డిగ్రీలు, పాక్షిక మేఘావరణం. రేపు ఇరవై ఎనిమిది డిగ్రీలు, భారీ వర్షం అవకాశం ఎనభై శాతం ఉంది. రేపు భారీ వర్షం పడే అవకాశం ఉంది కాబట్టి పంట కోత నేడే పూర్తి చేయండి.`;
  }
  if (intent === 'loan') {
    return `రుణ సమాచారం చెప్తాను. కిసాన్ క్రెడిట్ కార్డు ద్వారా మూడు లక్షల రూపాయల వరకు నాలుగు శాతం వడ్డీకి రుణం పొందవచ్చు. నాబార్డ్ ద్వారా అయిదు లక్షల రూపాయల వరకు ఏడు శాతం వడ్డీకి అందుబాటులో ఉంది. మరిన్ని వివరాలకు 1800 200 0104 కు కాల్ చేయండి.`;
  }
  if (intent === 'disease_hint') {
    return `పంట రోగాన్ని గుర్తించడానికి దయచేసి మీ పంట ఆకు యొక్క స్పష్టమైన ఫోటో పంపండి. మేము వెంటనే విశ్లేషించి సమాధానం ఇస్తాం.`;
  }
  return `మీరు చెప్పింది అర్థం కాలేదు. ధర, పథకాలు, వాతావరణం, లేదా రుణం అని చెప్పండి. లేదా పంట ఆకు ఫోటో పంపండి.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT: POST /api/whatsapp  ← Twilio webhook
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  // Respond immediately so Twilio doesn't time out (15s limit)
  res.set('Content-Type', 'text/xml');

  const from        = req.body.From        || '';
  const bodyText    = (req.body.Body       || '').trim();
  const mediaUrl    = req.body.MediaUrl0   || null;
  const mediaType   = req.body.MediaContentType0 || '';
  const mobile      = from.replace('whatsapp:', '');

  console.log(`[WA] From:${mobile} | Type:${mediaType || 'text'} | Msg:"${bodyText.slice(0,50)}"`);

  const isAudio = mediaType.startsWith('audio/') || mediaType.includes('ogg');
  const isImage = mediaType.startsWith('image/');

  // ── VOICE MESSAGE ──────────────────────────────────────────────────────────
  if (isAudio && mediaUrl) {
    // Immediate ack
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>🎙️ మీ వాయిస్ సందేశం అందుకున్నాం. విని సమాధానం ఇస్తున్నాం...\nListening to your voice message...</Message></Response>`);

    // Process async
    setImmediate(async () => {
      let audioPath  = path.join(TMP, `voice_${Date.now()}.ogg`);
      let wavPath    = null;
      try {
        await downloadMedia(mediaUrl, audioPath);

        // Convert OGG/OPUS → WAV (16kHz mono) for reliable Whisper transcription
        wavPath = audioPath.replace('.ogg', '.wav');
        try {
          await convertToWav(audioPath, wavPath);
          fs.unlink(audioPath, () => {});
        } catch (convErr) {
          console.warn('[WA] ffmpeg convert failed, using raw ogg:', convErr.message);
          wavPath = audioPath;  // fallback: try raw ogg
        }

        // STT via persistent server — force Telugu
        const sttResult  = await callSTT(wavPath, 'te');
        const transcript = (sttResult.transcript || '').trim();
        console.log(`[WA STT] Lang:${sttResult.language} | Transcript: "${transcript}"`);
        fs.unlink(wavPath, () => {});

        if (!transcript) {
          await sendWA(from, '⚠️ వాయిస్ సందేశం అర్థం కాలేదు. దయచేసి స్పష్టంగా మాట్లాడి మళ్ళీ పంపండి.\nCould not understand. Please speak clearly and try again.');
          return;
        }

        // Get text reply — use NLP intent from STT server (semantic similarity)
        // Falls back to keyword detectIntent only if STT server didn't return intent
        const intent    = sttResult.intent && sttResult.intent !== 'unknown'
                          ? sttResult.intent
                          : detectIntent(transcript);
        const confidence = sttResult.confidence || 0;
        console.log(`[WA Intent] "${transcript.slice(0,40)}" → ${intent} (conf=${confidence})`);
        const textReply = await buildReply(intent, mobile, transcript);
        const fullReply = `🎙️ మీరు చెప్పింది: "${transcript}"\n\n${textReply}`;


        // TTS → voice reply (use natural spoken text, not chat text)
        const audioOut   = path.join(TMP, `reply_${Date.now()}.mp3`);
        const spokenText = await buildSpokenReply(intent, mobile);
        const ttsResult  = await runTTS(spokenText, audioOut, 'te-IN-MohanNeural');

        if (ttsResult.success && ttsResult.output_path && fs.existsSync(ttsResult.output_path)) {
          // Serve the audio via ngrok
          const ngrokUrl = await getNgrokUrl();
          if (ngrokUrl) {
            const fileName = path.basename(ttsResult.output_path);
            // Copy to server's public audio dir
            const publicAudioDir = path.join(__dirname, '../audio');
            if (!fs.existsSync(publicAudioDir)) fs.mkdirSync(publicAudioDir, { recursive: true });
            fs.copyFileSync(ttsResult.output_path, path.join(publicAudioDir, fileName));
            const audioPublicUrl = `${ngrokUrl}/audio/${fileName}`;
            await sendWA(from, fullReply, audioPublicUrl);
          } else {
            // No ngrok — send text only
            await sendWA(from, fullReply);
          }
          fs.unlink(ttsResult.output_path, () => {});
        } else {
          await sendWA(from, fullReply);
        }

        // Save session
        await saveSession(mobile, intent, null).catch(() => {});

      } catch (e) {
        console.error('[WA voice error]', e.message);
        await sendWA(from, '⚠️ వాయిస్ ప్రాసెసింగ్ లో సమస్య వచ్చింది. దయచేసి మళ్ళీ ప్రయత్నించండి.').catch(() => {});
      }
    });
    return;
  }

  // ── IMAGE MESSAGE (disease detection) ─────────────────────────────────────
  if (isImage && mediaUrl) {
    // Immediate ack
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>🌿 మీ పంట చిత్రం అందుకున్నాం. విశ్లేషిస్తున్నాం... (30-60 సెకన్లు)\nAnalyzing your crop image... Please wait 30-60 seconds.</Message></Response>`);

    // Process async
    setImmediate(async () => {
      const imgPath = path.join(TMP, `crop_${Date.now()}.jpg`);
      try {
        await downloadMedia(mediaUrl, imgPath);

        // Disease detection via persistent server
        const result = await callDisease(imgPath);

        fs.unlink(imgPath, () => {});

        let replyText = '';
        if (result.success && result.disease) {
          const conf     = Math.round((result.confidence_score || 0) * 100);
          const lowConf  = result.low_confidence || conf < 70;

          if (result.is_healthy) {
            replyText =
              `✅ *పంట ఆరోగ్యంగా ఉంది!*\n\n` +
              `🌱 పంట: *${result.plant}*\n` +
              `📊 నమ్మకం: *${conf}%*\n\n` +
              `మీ పంట ఆరోగ్యంగా ఉంది. మంచి పని! నిరంతరం పర్యవేక్షించండి.\n` +
              `Your crop looks healthy! Keep monitoring regularly.\n\n` +
              `📞 సహాయం: 1800-180-1551`;
          } else {
            replyText =
              `🔬 *రోగం గుర్తించబడింది / Disease Detected*\n\n` +
              `🌱 పంట: *${result.plant}*\n` +
              `🦠 రోగం: *${result.disease}*\n` +
              `📊 నమ్మకం: *${conf}%*\n` +
              `⚠️ తీవ్రత: ${result.severity || 'moderate'}\n\n`;

            // Low confidence warning + show alternatives
            if (lowConf && result.alternatives && result.alternatives.length > 0) {
              replyText +=
                `⚠️ *గమనిక: నమ్మకం తక్కువగా ఉంది (${conf}%). మీ పంట ఇవి కావచ్చు:*\n` +
                `⚠️ *Low confidence - your crop might also be:*\n`;
              result.alternatives.slice(0, 3).forEach((alt, i) => {
                replyText += `${i+1}. ${alt.label} (${alt.confidence}%)\n`;
              });
              replyText += `\nస్పష్టమైన ఆకు ఫోటో పంపితే మరింత ఖచ్చితమైన ఫలితం వస్తుంది.\nSend a clearer single-leaf photo for better accuracy.\n\n`;
            }

            replyText +=
              `💊 *చికిత్స:*\n${Array.isArray(result.treatment) ? result.treatment.join('\n') : result.treatment || 'Consult agricultural officer'}\n\n` +
              `🌿 సేంద్రీయ పరిష్కారం: ${result.organic_remedy || 'N/A'}\n\n` +
              `📞 సహాయం: *1800-180-1551*`;
          }


          // Save detection to DB
          await db.disease.insert({
            id: randomUUID(),
            mobile,
            plant: result.plant_raw || result.plant,
            crop:  result.plant_raw || result.plant,
            disease: result.disease,
            confidence: result.confidence_score,
            severity: result.severity,
            is_healthy: result.is_healthy || false,
            detected_at: new Date().toISOString(),
            image_url: mediaUrl,
            district: (await db.farmers.findOne({ mobile }).catch(() => null))?.district || null,
          }).catch(() => {});

        } else if (result.success && result.is_healthy) {
          replyText = `✅ *పంట ఆరోగ్యంగా ఉంది!*\n\nYour ${result.plant || 'crop'} looks healthy!\n\n🌱 ${result.telugu_summary || 'No disease detected. Keep up the good work!'}`;
        } else {
          replyText = `⚠️ విశ్లేషణ సమస్య వచ్చింది.\n${result.error || 'Analysis failed. Please send a clearer photo of a single leaf.'}`;
        }

        await sendWA(from, replyText);
        await saveSession(mobile, 'disease', null).catch(() => {});

      } catch (e) {
        console.error('[WA image error]', e.message);
        fs.unlink(imgPath, () => {});
        await sendWA(from, '⚠️ చిత్రం విశ్లేషణలో సమస్య. దయచేసి స్పష్టమైన ఆకు ఫోటో పంపండి.\nAnalysis failed. Please send a clearer leaf photo.').catch(() => {});
      }
    });
    return;
  }

  // ── TEXT MESSAGE ───────────────────────────────────────────────────────────
  try {
    const intent   = detectIntent(bodyText);
    const replyMsg = await buildReply(intent, mobile, bodyText);
    await saveSession(mobile, intent, null).catch(() => {});
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${
      replyMsg.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    }</Message></Response>`);
  } catch (e) {
    console.error('[WA text error]', e);
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>⚠️ Error. Please try again.</Message></Response>`);
  }
});

// ── Helper: get ngrok URL ─────────────────────────────────────────────────────
async function getNgrokUrl() {
  try {
    const fetch = require('node-fetch');
    const r = await fetch('http://localhost:4040/api/tunnels', { timeout: 2000 });
    const d = await r.json();
    return d.tunnels?.[0]?.public_url || null;
  } catch { return null; }
}

// ── Helper: save/update WA session ───────────────────────────────────────────
async function saveSession(mobile, intent, farmerId) {
  const existing = await db.wa.findOne({ mobile }).catch(() => null);
  if (existing) {
    await db.wa.update({ mobile }, { $set: { last_intent: intent, messages_count: (existing.messages_count || 0) + 1, updated_at: new Date().toISOString() } });
  } else {
    await db.wa.insert({ id: randomUUID(), mobile, farmer_id: farmerId || null, last_intent: intent, messages_count: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
}

// ── POST /api/whatsapp/message  (admin simulator) ────────────────────────────
router.post('/message', async (req, res) => {
  try {
    const { mobile, text, session_id } = req.body;
    if (!mobile || !text) return res.status(400).json({ error: 'mobile and text required' });

    const farmer  = await db.farmers.findOne({ mobile }).catch(() => null);
    const is_new  = !farmer;
    const intent  = detectIntent(text);
    const dist    = farmer?.district   || 'Guntur';
    const crop    = farmer?.primary_crop || 'Paddy';

    // Build rich message list matching WhatsAppBot.jsx renderer
    const messages = [];

    if (intent === 'greeting') {
      messages.push({
        type: 'text',
        text: farmer
          ? `🌾 నమస్కారం ${farmer.name || 'రైతు'}! RythuMitra కు స్వాగతం!\n\n📈 Price | 📋 Scheme | 🌦️ Weather | 💳 Loan\n\n📸 పంట రోగం కోసం చిత్రం పంపండి\n🎙️ Voice message పంపవచ్చు!`
          : `🌾 నమస్కారం! RythuMitra కు స్వాగతం!\n\n📈 Price | 📋 Scheme | 🌦️ Weather | 💳 Loan\n\n📸 Send crop photo for disease detection`,
      });
      if (is_new) messages.push({ type: 'quick_reply', options: [{ label: '📍 Select District', value: 'district_select' }] });

    } else if (intent === 'price') {
      const allP  = await db.prices.find({ crop, district: dist }).catch(() => []);
      const price = allP.sort((a, b) => b.date.localeCompare(a.date))[0];
      if (price) {
        messages.push({ type: 'price_card', data: { crop: price.crop, district: price.district, date: price.date, min: price.price_min, modal: price.price_modal, max: price.price_max, unit: 'quintal', source: 'Agmarknet' } });
        // 7-day trend if available
        const trend = allP.slice(0, 7).map(p => ({ date: p.date, price_modal: p.price_modal }));
        if (trend.length > 1) messages.push({ type: 'price_chart', data: trend });
      } else {
        messages.push({ type: 'text', text: `ℹ️ ${crop} price not available for ${dist} today.\nCheck back tomorrow or try a different district.` });
      }

    } else if (intent === 'scheme') {
      const schemes = await db.schemes.find({}).catch(() => []);
      const top3 = schemes.slice(0, 3);
      if (top3.length) {
        top3.forEach(s => messages.push({ type: 'scheme_card', data: s }));
      } else {
        messages.push({ type: 'text', text: `📋 *ప్రభుత్వ పథకాలు*\n\n1. PM-KISAN → ₹6000/year\n2. Rythu Bandhu → ₹5000/acre\n3. PMFBY Crop Insurance\n4. KCC Loan → 4% interest\n\n📞 1800-180-1551` });
      }

    } else if (intent === 'weather') {
      messages.push({
        type: 'weather_card',
        district: dist,
        forecast: [
          { day: 'Today',    icon: '☀️',  condition: 'Partly Cloudy', temp: '34°C', rain: '20%' },
          { day: 'Tomorrow', icon: '🌧️', condition: 'Heavy Rain',    temp: '28°C', rain: '80%' },
          { day: 'Day 3',    icon: '⛅',  condition: 'Overcast',      temp: '30°C', rain: '50%' },
        ],
      });
      messages.push({ type: 'text', text: `⚠️ రేపు భారీ వర్షం! పంట కోత నేడే పూర్తి చేయండి.\nHeavy rain tomorrow — complete harvesting today!` });

    } else if (intent === 'loan') {
      messages.push({
        type: 'loan_card',
        data: [
          { name: 'Kisan Credit Card (KCC)', interest: '4% p.a.', limit: '₹3 Lakh', contact: '1800-200-0104' },
          { name: 'NABARD Agri Loan',        interest: '7% p.a.', limit: '₹5 Lakh', contact: '1800-200-0104' },
        ],
      });

    } else if (intent === 'disease_hint') {
      messages.push({ type: 'text', text: `📸 పంట రోగం గుర్తించడానికి దయచేసి మీ పంట ఆకు యొక్క స్పష్టమైన ఫోటో పంపండి.\n\nPlease send a clear photo of your crop leaf for disease detection.` });

    } else if (intent === 'stop') {
      messages.push({ type: 'text', text: `✅ మీరు నమోదు రద్దు చేసుకున్నారు. "Hello" పంపి తిరిగి చేరండి.` });

    } else {
      messages.push({ type: 'text', text: `🤔 అర్థం కాలేదు.\n\nType: *price* | *scheme* | *weather* | *loan*\n📸 Or send a crop photo for disease detection\n🎙️ Voice message also works!` });
    }

    await saveSession(mobile, intent, farmer?.id || null);
    res.json({ session_id: session_id || randomUUID(), intent, is_new, messages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ── POST /api/whatsapp/register ───────────────────────────────────────────────
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

// ── GET /api/whatsapp/sessions ────────────────────────────────────────────────
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await db.wa.find({});
    const sorted   = sessions.sort((a,b) => new Date(b.updated_at) - new Date(a.updated_at));
    const enriched = await Promise.all(sorted.slice(0,50).map(async s => {
      const f = s.farmer_id ? await db.farmers.findOne({ id: s.farmer_id }).catch(()=>null) : null;
      return { ...s, farmer_name: f?.name||null, farmer_district: f?.district||null };
    }));
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
