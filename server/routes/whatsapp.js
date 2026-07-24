'use strict';

const express    = require('express');
const router     = express.Router();
const { db }     = require('../db/database');
const { randomUUID } = require('crypto');
const path       = require('path');
const fs         = require('fs');
const os         = require('os');
const fetch      = require('node-fetch');
const { spawn }  = require('child_process');

// ── Service URLs ──────────────────────────────────────────────────────────────
const STT_URL     = `http://127.0.0.1:${process.env.STT_PORT  || 5001}`;
const DISEASE_URL = `http://127.0.0.1:${process.env.DISEASE_PORT || 5002}`;
const RAG_URL     = 'http://127.0.0.1:5003';

// ── Twilio ────────────────────────────────────────────────────────────────────
const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN;
const FROM_WA     = 'whatsapp:+14155238886';

let twilioClient = null;
try {
  const Twilio = require('twilio');
  twilioClient = new Twilio(ACCOUNT_SID, AUTH_TOKEN);
  console.log('[WA] Twilio client ready');
} catch (e) { console.error('[WA] Twilio client failed:', e.message); }

// ── Temp dir ──────────────────────────────────────────────────────────────────
const TMP = path.join(os.tmpdir(), 'rythymitra');
if (!fs.existsSync(TMP)) fs.mkdirSync(TMP, { recursive: true });

// ═════════════════════════════════════════════════════════════════════════════
//  HELPERS
// ═════════════════════════════════════════════════════════════════════════════

// ── Download Twilio media ─────────────────────────────────────────────────────
async function downloadMedia(mediaUrl, destPath) {
  const auth = Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64');
  console.log(`[WA DL] ${mediaUrl.slice(0, 80)}`);
  const res = await fetch(mediaUrl, { headers: { Authorization: `Basic ${auth}` }, redirect: 'follow', timeout: 60000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.buffer();
  if (buf.length < 100) throw new Error(`Too small (${buf.length}B) — auth failed?`);
  fs.writeFileSync(destPath, buf);
  return destPath;
}

// ── OGG → WAV (16kHz mono) for STT ───────────────────────────────────────────
function convertToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', [
      '-y', '-i', inputPath,
      '-ar', '16000', '-ac', '1',
      '-af', 'loudnorm=I=-14:LRA=11:TP=-1.5',
      '-f', 'wav', outputPath
    ], { stdio: ['ignore', 'pipe', 'pipe'] });
    ff.on('close', code => code === 0 ? resolve(outputPath) : reject(new Error(`ffmpeg exit ${code}`)));
    setTimeout(() => { ff.kill(); reject(new Error('ffmpeg timeout')); }, 30000);
  });
}

// ── STT: Telugu speech → text ─────────────────────────────────────────────────
async function callSTT(audioPath) {
  const r = await fetch(`${STT_URL}/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_path: audioPath, language: 'te' }),
    timeout: 60000,
  });
  return r.json();
}

// ── Disease AI: image → prediction ───────────────────────────────────────────
async function callDisease(imagePath) {
  const r = await fetch(`${DISEASE_URL}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_path: imagePath }),
    timeout: 60000,
  });
  return r.json();
}

// ── RAG: query → { textReply, teluguReply, sources, confidence } ──────────────
async function callRAG(query, mobile) {
  try {
    const farmer = await db.farmers.findOne({ mobile }).catch(() => null);
    const ctrl   = new AbortController();
    const timer  = setTimeout(() => ctrl.abort(), 120000);   // 120s for Ollama cold start

    const resp = await fetch(`${RAG_URL}/rag/query`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        language: 'te',
        context: {
          farmer_name: farmer?.name         || '',
          farmer_crop: farmer?.primary_crop || '',
          district:    farmer?.district     || '',
        },
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (!resp.ok) return null;
    const data = await resp.json();
    if (!data.answer || data.answer.length < 10) return null;

    return {
      textReply:   data.answer,
      teluguReply: data.answer_telugu || '',
      sources:     data.sources       || [],
      confidence:  data.confidence    || 0,
    };
  } catch (e) {
    console.log('[RAG] error:', e.message);
    return null;
  }
}

// ── gTTS: Telugu text → MP3 audio file via RAG server ─────────────────────────
async function generateTeluguAudio(teluguText, filename) {
  try {
    const r = await fetch(`${RAG_URL}/rag/tts`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: teluguText, lang: 'te', filename }),
      timeout: 30000,
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d.success ? d : null;
  } catch (e) {
    console.log('[gTTS] error:', e.message);
    return null;
  }
}

// ── edge-TTS: Telugu text → MP3 via Microsoft Neural Voice ───────────────────
function edgeTTS(text, outPath, voice = 'te-IN-MohanNeural') {
  return new Promise(resolve => {
    const py = spawn('python', [path.join(__dirname, '../python/tts.py'), text, outPath, voice], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let out = '';
    py.stdout.on('data', d => out += d.toString());
    py.on('close', () => { try { resolve(JSON.parse(out)); } catch { resolve({ success: false }); } });
    setTimeout(() => { py.kill(); resolve({ success: false }); }, 30000);
  });
}

// ── Get ngrok public URL ──────────────────────────────────────────────────────
async function getNgrokUrl() {
  try {
    const r = await fetch('http://localhost:4040/api/tunnels', { timeout: 2000 });
    const d = await r.json();
    return d.tunnels?.[0]?.public_url || null;
  } catch { return null; }
}

// ── Serve audio: copy to public dir + return URL ──────────────────────────────
async function makeAudioUrl(filePath, filename) {
  const ngrokUrl = await getNgrokUrl();
  if (!ngrokUrl || !filePath || !fs.existsSync(filePath)) return null;
  const publicDir = path.join(__dirname, '../audio');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
  const dest = path.join(publicDir, filename);
  fs.copyFileSync(filePath, dest);
  return `${ngrokUrl}/audio/${filename}`;
}

// ── Send outbound WhatsApp via Twilio API (auto-splits >1500 chars) ─────────────
async function sendWA(to, body, mediaUrl = null) {
  if (!twilioClient) return console.error('[WA] No Twilio client');
  const MAX = 1500;

  // Split long body into chunks at paragraph/sentence boundaries
  const chunks = [];
  if (!body || body.length === 0) {
    chunks.push('...');
  } else if (body.length <= MAX) {
    chunks.push(body);
  } else {
    // Split at paragraph breaks first, then at sentences
    const paragraphs = body.split(/\n\n+/);
    let current = '';
    for (const para of paragraphs) {
      if ((current + '\n\n' + para).length <= MAX) {
        current = current ? current + '\n\n' + para : para;
      } else {
        if (current) chunks.push(current.trim());
        // If single paragraph > MAX, split at sentences
        if (para.length > MAX) {
          const sentences = para.split(/(?<=[.!?])\s+/);
          current = '';
          for (const s of sentences) {
            if ((current + ' ' + s).length <= MAX) {
              current = current ? current + ' ' + s : s;
            } else {
              if (current) chunks.push(current.trim());
              current = s.slice(0, MAX);
            }
          }
        } else {
          current = para;
        }
      }
    }
    if (current) chunks.push(current.trim());
  }

  try {
    for (let i = 0; i < chunks.length; i++) {
      const msg = { from: FROM_WA, to, body: chunks[i] };
      // Only attach media to the LAST chunk
      if (mediaUrl && i === chunks.length - 1) msg.mediaUrl = [mediaUrl];
      await twilioClient.messages.create(msg);
      if (chunks.length > 1) await new Promise(r => setTimeout(r, 500)); // 500ms gap
    }
    console.log(`[WA sent] ${chunks.length} part(s) to ${to}`);
  } catch (e) {
    console.error('[WA outbound]', e.message);
  }
}

// ── Save/update WA session ────────────────────────────────────────────────────
async function saveSession(mobile, intent, farmerId) {
  const existing = await db.wa.findOne({ mobile }).catch(() => null);
  if (existing) {
    await db.wa.update({ mobile }, { $set: { last_intent: intent, messages_count: (existing.messages_count || 0) + 1, updated_at: new Date().toISOString() } });
  } else {
    await db.wa.insert({ id: randomUUID(), mobile, farmer_id: farmerId || null, last_intent: intent, messages_count: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
}

// ═════════════════════════════════════════════════════════════════════════════
//  INTENT DETECTION  (minimal — only for instant-reply cases)
//  Everything else → RAG which handles all domain knowledge
// ═════════════════════════════════════════════════════════════════════════════
function detectIntent(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return 'unknown';

  // STOP
  if (['stop', 'unsubscribe', 'ఆపు'].some(k => t.includes(k)))
    return 'stop';

  // GREETING — only pure greetings, not mixed with a question
  const greetWords = ['hello', 'hi', 'నమస్కారం', 'namaskaram', 'start', 'నమస్తే', 'menu'];
  if (greetWords.some(k => t === k || t.startsWith(k + ' ') || t.startsWith(k + '\n')) && t.length < 30)
    return 'greeting';

  // PRICE — strict: must mention mandi/market or ధర explicitly
  if (['ధర', 'మండి', 'మార్కెట్', 'mandi', 'mandi price', 'market rate', 'today price', 'price today', 'crop price'].some(k => t.includes(k)))
    return 'price';

  // PHOTO UPLOAD REQUEST — explicit request to send photo for disease detection
  if (['send photo', 'upload photo', 'send image', 'ఫోటో పంపు', 'photo pampandi', 'photo send'].some(k => t.includes(k)))
    return 'disease_hint';

  // EVERYTHING ELSE → RAG (scheme, weather, loan, disease info, pesticide, crop tips...)
  return 'unknown';
}

// ═════════════════════════════════════════════════════════════════════════════
//  INSTANT REPLIES (no AI needed)
// ═════════════════════════════════════════════════════════════════════════════
async function buildInstantReply(intent, mobile) {
  const farmer = await db.farmers.findOne({ mobile }).catch(() => null);
  const name   = farmer?.name || '';

  if (intent === 'stop')
    return '✅ మీరు నమోదు రద్దు చేసుకున్నారు.\n"Hello" పంపి తిరిగి చేరండి.';

  if (intent === 'greeting') {
    const greet = name ? `🌾 నమస్కారం ${name}!` : '🌾 నమస్కారం! RythuMitra కు స్వాగతం!';
    return `${greet}\n\nమీరు ఈ విషయాల గురించి అడగవచ్చు:\n\n🌾 పంట సలహా & సేద్యం\n🦠 పంట రోగాలు & చికిత్స\n💊 పురుగుల మందులు & డోసు\n📋 ప్రభుత్వ పథకాలు (PM-KISAN, PMFBY)\n💧 నీటిపారుదల & వ్యవసాయ చిట్కాలు\n💳 రుణాలు & సబ్సిడీలు\n\n📸 పంట ఆకు ఫోటో పంపి రోగ నిర్ధారణ చేయండి\n🎙️ తెలుగులో వాయిస్ మెసేజ్ పంపవచ్చు!\n\nమీ ప్రశ్న తెలుగులో లేదా ఆంగ్లంలో అడగండి 👆`;
  }

  if (intent === 'price') {
    const dist = farmer?.district    || 'Guntur';
    const crop = farmer?.primary_crop || 'Paddy';
    const allP = await db.prices.find({ crop, district: dist }).catch(() => []);
    const price = allP.sort((a, b) => b.date.localeCompare(a.date))[0];
    return price
      ? `📈 *నేటి మండి ధర*\n\n🌾 పంట: ${price.crop}\n📍 జిల్లా: ${price.district}\n💰 మోడల్ ధర: ₹${price.price_modal}/quintal\n📉 కనిష్ట: ₹${price.price_min} | 📈 గరిష్ట: ₹${price.price_max}\n📅 తేదీ: ${price.date}\n\n_Source: Agmarknet_`
      : `ℹ️ ${crop} ధర ${dist} లో నేడు అందుబాటులో లేదు.\nరేపు మళ్ళీ ప్రయత్నించండి.`;
  }

  if (intent === 'disease_hint')
    return '📸 పంట రోగం గుర్తించడానికి మీ పంట ఆకు యొక్క స్పష్టమైన ఫోటో పంపండి.\n\nPlease send a clear photo of a single crop leaf for disease detection.';

  return null; // not an instant intent
}

// ─────────────────────────────────────────────────────────────────────────────
//  ROOT: POST /api/whatsapp  ← Twilio Webhook
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  res.set('Content-Type', 'text/xml');

  const from      = req.body.From  || '';
  const bodyText  = (req.body.Body || '').trim();
  const mediaUrl  = req.body.MediaUrl0 || null;
  const mediaType = req.body.MediaContentType0 || '';
  const mobile    = from.replace('whatsapp:', '');

  const isAudio = mediaType.startsWith('audio/') || mediaType.includes('ogg');
  const isImage = mediaType.startsWith('image/');

  console.log(`[WA] From:${mobile} | ${isAudio ? 'VOICE' : isImage ? 'IMAGE' : 'TEXT'} | "${bodyText.slice(0, 50)}"`);

  // ══════════════════════════════════════════════════════════════════════════
  //  VOICE MESSAGE → STT → RAG → Telugu text + gTTS voice reply
  // ══════════════════════════════════════════════════════════════════════════
  if (isAudio && mediaUrl) {
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>🎙️ మీ వాయిస్ సందేశం అందుకున్నాం!\n\n🔄 తెలుగు స్పీచ్ గుర్తిస్తున్నాం...\nSTT → RAG → తెలుగు సమాధానం + వాయిస్ రిప్లై వస్తుంది (30-90 సెకన్లు)</Message></Response>`);

    setImmediate(async () => {
      const audioPath = path.join(TMP, `voice_${Date.now()}.ogg`);
      let wavPath = null;
      try {
        await downloadMedia(mediaUrl, audioPath);

        // Convert to WAV for STT
        wavPath = audioPath.replace('.ogg', '.wav');
        try {
          await convertToWav(audioPath, wavPath);
          fs.unlink(audioPath, () => {});
        } catch {
          wavPath = audioPath;
        }

        // ── STT: speech → Telugu text ──────────────────────────────────────
        const sttResult  = await callSTT(wavPath);
        const transcript = (sttResult.transcript || '').trim();
        fs.unlink(wavPath, () => {});
        console.log(`[WA STT] Transcript: "${transcript}"`);

        if (!transcript) {
          await sendWA(from, '⚠️ వాయిస్ అర్థం కాలేదు. దయచేసి స్పష్టంగా తెలుగులో మాట్లాడి మళ్ళీ పంపండి.');
          return;
        }

        // ── Check if instant-reply intent ─────────────────────────────────
        const intent      = detectIntent(transcript);
        const instantReply = await buildInstantReply(intent, mobile);

        if (instantReply) {
          // Known intent (greeting/price/etc) — use edge-TTS for voice
          const audioOut   = path.join(TMP, `reply_${Date.now()}.mp3`);
          const ttsResult  = await edgeTTS(instantReply.replace(/[*_~`]/g, ''), audioOut);
          const fname      = path.basename(audioOut);
          const audioUrl   = ttsResult.success ? await makeAudioUrl(audioOut, fname) : null;
          if (ttsResult.success && audioOut) fs.unlink(audioOut, () => {});

          const msg = `🎙️ మీరు చెప్పింది: "${transcript}"\n\n${instantReply}`;
          await sendWA(from, msg, audioUrl || undefined);
          await saveSession(mobile, intent, null);
          return;
        }

        // ── RAG: all domain questions (disease, scheme, loan, weather, crop) ─
        console.log(`[WA] Voice → RAG query: "${transcript}"`);
        const ragResult = await callRAG(transcript, mobile);

        let textReply   = '';
        let teluguReply = '';

        if (ragResult) {
          textReply   = ragResult.textReply;
          teluguReply = ragResult.teluguReply;
          const src   = ragResult.sources?.length ? `\n\n📚 ${ragResult.sources[0]}` : '';
          textReply   = `🧠 *RythuMitra AI*\n\n${textReply}${src}`;
        } else {
          textReply   = '🤔 ఈ విషయంలో సమాచారం దొరకలేదు. వ్యవసాయ అధికారిని 1800-180-1551 కు కాల్ చేయండి.';
          teluguReply = 'సమాచారం దొరకలేదు. వ్యవసాయ అధికారిని సంప్రదించండి.';
        }

        // ── edge-TTS: Microsoft Neural Telugu voice (high quality) ────────
        let audioPublicUrl = null;
        const spokenTelugu = (teluguReply || textReply)
          .replace(/[*_~`📚🧠🔤🎙️]/g, '')   // strip markdown & emojis for clean TTS
          .trim();

        if (spokenTelugu) {
          const audioOut  = path.join(TMP, `rag_voice_${Date.now()}.mp3`);
          const ttsResult = await edgeTTS(spokenTelugu, audioOut, 'te-IN-MohanNeural');
          if (ttsResult.success && fs.existsSync(audioOut)) {
            const fname = path.basename(audioOut);
            audioPublicUrl = await makeAudioUrl(audioOut, fname);
            if (audioPublicUrl) {
              console.log(`[WA TTS] Neural voice ready: ${audioPublicUrl}`);
            }
            fs.unlink(audioOut, () => {});
          }
        }

        // ── Send reply: transcript + English answer + Telugu text + voice ──
        const fullMsg = `🎙️ మీరు చెప్పింది:\n"${transcript}"\n\n${textReply}`
                      + (teluguReply ? `\n\n🔤 తెలుగులో:\n${teluguReply}` : '');
        await sendWA(from, fullMsg, audioPublicUrl || undefined);
        await saveSession(mobile, 'rag', null);


      } catch (e) {
        console.error('[WA voice error]', e.message);
        await sendWA(from, '⚠️ వాయిస్ ప్రాసెసింగ్ లో సమస్య. దయచేసి మళ్ళీ పంపండి.').catch(() => {});
      }
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  IMAGE → Disease AI → Treatment + RAG enhancement
  // ══════════════════════════════════════════════════════════════════════════
  if (isImage && mediaUrl) {
    res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>🌿 మీ పంట చిత్రం అందుకున్నాం!\n\n🔬 AI విశ్లేషణ జరుగుతుంది... (30-60 సెకన్లు)\nAnalyzing your crop image with AI...</Message></Response>`);

    setImmediate(async () => {
      const imgPath = path.join(TMP, `crop_${Date.now()}.jpg`);
      try {
        await downloadMedia(mediaUrl, imgPath);
        const result = await callDisease(imgPath);
        fs.unlink(imgPath, () => {});

        let replyText = '';

        if (result.success && result.disease) {
          const conf    = Math.round((result.confidence_score || 0) * 100);
          const lowConf = result.low_confidence || conf < 70;

          if (result.is_healthy) {
            replyText =
              `✅ *పంట ఆరోగ్యంగా ఉంది!*\n\n` +
              `🌱 పంట: *${result.plant}*\n` +
              `📊 నమ్మకం: *${conf}%*\n\n` +
              `మీ పంట ఆరోగ్యంగా ఉంది. నిరంతరం పర్యవేక్షించండి.\n` +
              `📞 సహాయం: 1800-180-1551`;
          } else {
            replyText =
              `🔬 *రోగం గుర్తించబడింది!*\n\n` +
              `🌱 పంట: *${result.plant}*\n` +
              `🦠 రోగం: *${result.disease}*\n` +
              `📊 నమ్మకం: *${conf}%*\n` +
              `⚠️ తీవ్రత: ${result.severity || 'మధ్యస్థం'}\n\n`;

            if (lowConf && result.alternatives?.length) {
              replyText += `⚠️ నమ్మకం తక్కువ (${conf}%). ఇవి కూడా కావచ్చు:\n`;
              result.alternatives.slice(0, 3).forEach((alt, i) => {
                replyText += `${i + 1}. ${alt.label} (${alt.confidence}%)\n`;
              });
              replyText += `\nస్పష్టమైన ఆకు ఫోటో పంపితే మరింత ఖచ్చితమైన ఫలితం వస్తుంది.\n\n`;
            }

            replyText +=
              `💊 *చికిత్స:*\n${Array.isArray(result.treatment) ? result.treatment.join('\n') : result.treatment || 'వ్యవసాయ అధికారిని సంప్రదించండి'}\n\n` +
              `🌿 సేంద్రీయ పరిష్కారం: ${result.organic_remedy || 'N/A'}\n\n` +
              `📞 సహాయం: *1800-180-1551*`;
          }

          // Save to DB
          await db.disease.insert({
            id: randomUUID(), mobile,
            plant: result.plant_raw || result.plant,
            crop: result.plant_raw || result.plant,
            disease: result.disease,
            confidence: result.confidence_score,
            severity: result.severity,
            is_healthy: result.is_healthy || false,
            detected_at: new Date().toISOString(),
            image_url: mediaUrl,
            district: (await db.farmers.findOne({ mobile }).catch(() => null))?.district || null,
          }).catch(() => {});

        } else {
          replyText = `⚠️ విశ్లేషణ సమస్య.\n${result.error || 'స్పష్టమైన ఆకు ఫోటో పంపండి.'}`;
        }

        await sendWA(from, replyText);
        await saveSession(mobile, 'disease', null);

      } catch (e) {
        console.error('[WA image error]', e.message);
        fs.unlink(imgPath, () => {});
        await sendWA(from, '⚠️ చిత్రం విశ్లేషణలో సమస్య. స్పష్టమైన ఆకు ఫోటో పంపండి.').catch(() => {});
      }
    });
    return;
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TEXT MESSAGE
  // ══════════════════════════════════════════════════════════════════════════
  if (!bodyText) {
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>🌾 RythuMitra కు స్వాగతం! "hello" పంపండి.</Message></Response>`);
  }

  const intent       = detectIntent(bodyText);
  const instantReply = await buildInstantReply(intent, mobile).catch(() => null);

  if (instantReply) {
    // Instant reply (greeting/price/stop/disease_hint) — respond in XML directly
    await saveSession(mobile, intent, null);
    return res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>${
      instantReply.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    }</Message></Response>`);
  }

  // RAG query — send immediate ack then process async (avoids Twilio 15s timeout)
  res.send(`<?xml version="1.0" encoding="UTF-8"?><Response><Message>🤔 "${bodyText.slice(0,40)}" గురించి వెతుకుతున్నాం...\n\n🧠 RythuMitra AI సమాధానం వస్తుంది (30-90 సెకన్లు)\nSearching knowledge base...</Message></Response>`);

  setImmediate(async () => {
    try {
      console.log(`[WA] Text → RAG: "${bodyText}"`);
      const ragResult = await callRAG(bodyText, mobile);

      let reply = '';
      if (ragResult) {
        const src = ragResult.sources?.length ? `\n\n📚 _${ragResult.sources[0]}_` : '';
        reply = `🧠 *RythuMitra AI*\n\n${ragResult.textReply}${src}`;
        if (ragResult.teluguReply) reply += `\n\n🔤 తెలుగులో:\n${ragResult.teluguReply}`;
      } else {
        reply = '🤔 ఈ విషయంలో సమాచారం దొరకలేదు.\n\nవ్యవసాయ అధికారిని కాల్ చేయండి: *1800-180-1551*\n\nలేదా మీ ప్రశ్నను వేరే విధంగా అడగండి.';
      }

      await sendWA(from, reply);
      await saveSession(mobile, 'rag', null);
    } catch (e) {
      console.error('[WA text RAG error]', e.message);
      await sendWA(from, '⚠️ సమస్య వచ్చింది. దయచేసి మళ్ళీ ప్రయత్నించండి.').catch(() => {});
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
//  ADMIN API ENDPOINTS (used by dashboard)
// ═════════════════════════════════════════════════════════════════════════════

// POST /api/whatsapp/message — admin simulator
router.post('/message', async (req, res) => {
  try {
    const { mobile, text, session_id } = req.body;
    if (!mobile || !text) return res.status(400).json({ error: 'mobile and text required' });

    const farmer  = await db.farmers.findOne({ mobile }).catch(() => null);
    const is_new  = !farmer;
    const intent  = detectIntent(text);
    const dist    = farmer?.district    || 'Guntur';
    const crop    = farmer?.primary_crop || 'Paddy';
    const messages = [];

    if (intent === 'greeting') {
      messages.push({
        type: 'text',
        text: farmer
          ? `🌾 నమస్కారం ${farmer.name}! RythuMitra కు స్వాగతం!\n\nమీ ప్రశ్న అడగండి - పంట రోగాలు, పథకాలు, ధర, రుణాలు, సేద్యం సలహా!`
          : `🌾 నమస్కారం! RythuMitra కు స్వాగతం!\n\n📸 పంట ఆకు ఫోటో పంపి రోగ నిర్ధారణ చేయండి\n🎙️ తెలుగు వాయిస్ మెసేజ్ పంపవచ్చు\n💬 ఏ విషయమైనా అడగండి!`,
      });
    } else if (intent === 'price') {
      const allP  = await db.prices.find({ crop, district: dist }).catch(() => []);
      const price = allP.sort((a, b) => b.date.localeCompare(a.date))[0];
      if (price) {
        messages.push({ type: 'price_card', data: { crop: price.crop, district: price.district, date: price.date, min: price.price_min, modal: price.price_modal, max: price.price_max, unit: 'quintal', source: 'Agmarknet' } });
        const trend = allP.slice(0, 7).map(p => ({ date: p.date, price_modal: p.price_modal }));
        if (trend.length > 1) messages.push({ type: 'price_chart', data: trend });
      } else {
        messages.push({ type: 'text', text: `ℹ️ ${crop} price not available for ${dist} today.` });
      }
    } else if (intent === 'disease_hint') {
      messages.push({ type: 'text', text: '📸 పంట ఆకు ఫోటో పంపండి - AI రోగ నిర్ధారణ చేస్తుంది!' });
    } else if (intent === 'stop') {
      messages.push({ type: 'text', text: '✅ నమోదు రద్దు చేసుకున్నారు. "Hello" పంపి తిరిగి చేరండి.' });
    } else {
      // RAG answer for all knowledge questions
      const ragResult = await callRAG(text, mobile);
      if (ragResult) {
        const src = ragResult.sources?.length ? `\n\n📚 _${ragResult.sources[0]}_` : '';
        messages.push({ type: 'text', text: `🧠 *RythuMitra AI*\n\n${ragResult.textReply}${src}` });
      } else {
        messages.push({ type: 'text', text: '🤔 అర్థం కాలేదు. పంట రోగాలు, పథకాలు, ధర గురించి అడగండి.' });
      }
    }

    await saveSession(mobile, intent === 'unknown' ? 'rag' : intent, farmer?.id || null);
    res.json({ session_id: session_id || randomUUID(), intent, is_new, messages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/whatsapp/register
router.post('/register', async (req, res) => {
  try {
    const { mobile, district, primary_crop, secondary_crop, preferred_alert_time } = req.body;
    if (!mobile || !district || !primary_crop) return res.status(400).json({ error: 'mobile, district, primary_crop required' });
    const existing = await db.farmers.findOne({ mobile });
    if (existing) {
      await db.farmers.update({ mobile }, { $set: { district, primary_crop, secondary_crop: secondary_crop || null, preferred_alert_time: preferred_alert_time || 'morning', whatsapp_opted_in: true, last_active: new Date().toISOString() } });
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
    const sessions = await db.wa.find({});
    const sorted   = sessions.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
    const enriched = await Promise.all(sorted.slice(0, 50).map(async s => {
      const f = s.farmer_id ? await db.farmers.findOne({ id: s.farmer_id }).catch(() => null) : null;
      return { ...s, farmer_name: f?.name || null, farmer_district: f?.district || null };
    }));
    res.json(enriched);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
