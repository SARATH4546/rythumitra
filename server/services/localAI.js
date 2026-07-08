/**
 * localAI.js — Node.js wrapper for local Python AI services
 *
 * - STT: calls server/python/stt.py (faster-whisper, local Whisper model)
 * - TTS: calls server/python/tts.py (edge-tts, Microsoft Neural, no key)
 * - Disease: calls server/python/disease.py (TensorFlow PlantVillage model)
 * - NLP: uses 'natural' npm package (Naive Bayes classifier, local)
 */

const { spawn }  = require('child_process');
const path       = require('path');
const fs         = require('fs');
const os         = require('os');
const natural    = require('natural');

const PYTHON_DIR = path.join(__dirname, '..', 'python');
const VOICE_DIR  = path.join(__dirname, '..', '..', 'voice', 'dynamic');

// Ensure dynamic voice directory exists
fs.mkdirSync(VOICE_DIR, { recursive: true });

// ─── Python runner ─────────────────────────────────────────────────────────────
function runPython(scriptName, args = [], timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(PYTHON_DIR, scriptName);
    const proc = spawn('python', [scriptPath, ...args], { timeout: timeoutMs });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });

    proc.on('close', code => {
      if (code !== 0 && !stdout.trim()) {
        return reject(new Error(`Python ${scriptName} exited ${code}: ${stderr}`));
      }
      try {
        // Find last JSON line in stdout (scripts may print debug info)
        const lines = stdout.trim().split('\n').filter(Boolean);
        const jsonLine = lines.reverse().find(l => l.trim().startsWith('{'));
        resolve(JSON.parse(jsonLine || '{}'));
      } catch {
        reject(new Error(`Invalid JSON from ${scriptName}: ${stdout}`));
      }
    });

    proc.on('error', err => reject(new Error(`Failed to start python: ${err.message}`)));
  });
}

// ─── 1. LOCAL STT — Whisper (small model, runs on CPU) ──────────────────────
/**
 * Transcribe audio buffer (OGG/MP3) to text using local Whisper
 * @param {Buffer} audioBuffer
 * @param {string} contentType e.g. 'audio/ogg'
 * @returns {Promise<string|null>} transcript text or null on failure
 */
async function transcribeVoice(audioBuffer, contentType) {
  const ext     = contentType.includes('ogg') ? 'ogg' : contentType.includes('mp4') ? 'mp4' : 'mp3';
  const tmpFile = path.join(os.tmpdir(), `rythm_audio_${Date.now()}.${ext}`);

  try {
    fs.writeFileSync(tmpFile, audioBuffer);
    // Try Telugu first, then auto-detect
    const result = await runPython('stt.py', [tmpFile, 'auto'], 90000);
    if (result.success && result.transcript) return result.transcript.trim();
    console.error('[STT] Error:', result.error);
    return null;
  } catch (err) {
    console.error('[STT] Failed:', err.message);
    return null;
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// ─── 2. LOCAL TTS — edge-tts (Telugu Neural voice) ──────────────────────────
/**
 * Generate Telugu voice audio file from text
 * @param {string} text Telugu text to synthesize
 * @param {string} [filename] output filename (without extension)
 * @returns {Promise<string|null>} absolute path to generated MP3 file
 */
async function generateTTS(text, filename) {
  const fname   = filename || `voice_${Date.now()}`;
  const outPath = path.join(VOICE_DIR, `${fname}.mp3`);

  try {
    const result = await runPython('tts.py', [text, outPath, 'te-IN-MohanNeural'], 30000);
    if (result.success && fs.existsSync(outPath)) return outPath;
    console.error('[TTS] Error:', result.error);
    return null;
  } catch (err) {
    console.error('[TTS] Failed:', err.message);
    return null;
  }
}

// ─── 3. LOCAL DISEASE DETECTION — TensorFlow PlantVillage model ─────────────
/**
 * Detect crop disease from image buffer
 * @param {Buffer} imageBuffer
 * @param {string} contentType e.g. 'image/jpeg'
 * @param {string} [cropHint] farmer's registered crop
 * @returns {Promise<object>} diagnosis result
 */
async function detectDisease(imageBuffer, contentType, cropHint = '') {
  const ext     = contentType.includes('png') ? 'png' : 'jpg';
  const tmpFile = path.join(os.tmpdir(), `rythm_img_${Date.now()}.${ext}`);

  try {
    fs.writeFileSync(tmpFile, imageBuffer);
    const result = await runPython('disease.py', [tmpFile, cropHint], 120000);
    return result;
  } catch (err) {
    console.error('[Disease] Failed:', err.message);
    return { success: false, error: err.message };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
  }
}

// ─── 4. LOCAL NLP — Naive Bayes intent classifier (natural npm) ─────────────
let _classifier = null;

function buildClassifier() {
  const clf = new natural.BayesClassifier();

  // ── Greeting ────────────────────────────────────────────────────────────────
  ['hello','hi','hey','start','menu','help','start menu','main menu',
   'నమస్కారం','namaskaram','నమస్కార','welcome'].forEach(t => clf.addDocument(t,'greeting'));

  // ── Price ────────────────────────────────────────────────────────────────────
  ['price','prices','rate','rates','mandi','mandi price','today price',
   'what is price','crop price','market price','ధర','ధరలు','dhara','dharalu',
   'rate cheppandi','price cheppandi','mandi dhara','paddy price','cotton price',
   'chilli price','నేడు ధర','market rate'].forEach(t => clf.addDocument(t,'price'));

  // ── Scheme ───────────────────────────────────────────────────────────────────
  ['scheme','schemes','yojana','government scheme','pm kisan','pmkisan',
   'rythu bharosa','pmfby','kcc','subsidy','benefit','పథకం','పథకాలు',
   'pathakam','govt scheme','farming scheme','loan scheme','insurance',
   'government help','nidhi','సహాయం'].forEach(t => clf.addDocument(t,'scheme'));

  // ── Weather ──────────────────────────────────────────────────────────────────
  ['weather','rain','forecast','temperature','climate','clouds','storm',
   'వాతావరణం','వర్షం','vatavaranam','varsham','today weather','rain forecast',
   'will it rain','farming weather','wind'].forEach(t => clf.addDocument(t,'weather'));

  // ── Loan ─────────────────────────────────────────────────────────────────────
  ['loan','credit','kcc','kisan credit card','nabard','bank loan','finance',
   'interest rate','రుణం','runam','అప్పు','appu','borrow money',
   'crop loan','farming loan','agriculture loan'].forEach(t => clf.addDocument(t,'loan'));

  // ── Disease / pest ───────────────────────────────────────────────────────────
  ['disease','pest','insect','fungus','blight','rust','rot','spot','wilt',
   'తెగులు','tegulu','పురుగు','purugu','వ్యాధి','vyadhi','crop problem',
   'plant disease','leaves yellow','leaves falling','spots on leaves',
   'my crop is sick','crop is dying'].forEach(t => clf.addDocument(t,'disease_query'));

  // ── Stop ─────────────────────────────────────────────────────────────────────
  ['stop','unsubscribe','quit','exit','cancel','leave','opt out',
   'ఆపు','aapu','viddilipu','నమోదు రద్దు'].forEach(t => clf.addDocument(t,'stop'));

  clf.train();
  return clf;
}

/**
 * Detect intent from text using local Naive Bayes NLP
 * Falls back to keyword matching for short/single-word inputs
 * @param {string} text
 * @returns {string} intent
 */
function detectIntent(text) {
  const t = (text || '').toLowerCase().trim();
  if (!t) return 'unknown';

  // Always check stop first (safety)
  if (['stop','unsubscribe','quit','ఆపు'].some(k => t === k || t.includes(k))) return 'stop';

  // Keyword shortcuts for very short messages (single word, high certainty)
  const shortcuts = {
    greeting: ['hello','hi','hey','start','నమస్కారం','namaskaram'],
    price:    ['ధర','price','rate','mandi','dhara'],
    scheme:   ['పథకం','scheme','yojana','pathakam'],
    weather:  ['వాతావరణం','weather','rain','వర్షం'],
    loan:     ['రుణం','loan','kcc','credit','runam'],
  };
  for (const [intent, keys] of Object.entries(shortcuts)) {
    if (keys.some(k => t === k)) return intent;
  }

  // NLP classifier for longer/natural messages
  if (!_classifier) _classifier = buildClassifier();
  try {
    return _classifier.classify(t);
  } catch {
    return 'unknown';
  }
}

// ─── 5. Download Twilio media (voice/image) ─────────────────────────────────
async function downloadTwilioMedia(mediaUrl, accountSid, authToken) {
  const axios = require('axios');
  const resp  = await axios.get(mediaUrl, {
    auth: { username: accountSid, password: authToken },
    responseType: 'arraybuffer',
    timeout: 20000,
  });
  return {
    data:        Buffer.from(resp.data),
    contentType: resp.headers['content-type'] || 'application/octet-stream',
  };
}

// ─── 6. Format disease WhatsApp reply ───────────────────────────────────────
function formatDiseaseReply(d, crop) {
  if (!d || !d.success) {
    return '⚠️ చిత్రం విశ్లేషణలో సమస్య వచ్చింది.\nదయచేసి మళ్ళీ ప్రయత్నించండి లేదా స్థానిక వ్యవసాయ అధికారిని సంప్రదించండి.';
  }
  if (d.is_healthy) {
    return `✅ *మీ పంట ఆరోగ్యంగా ఉంది!*\n\nYour ${crop || d.plant || 'crop'} appears healthy — no disease detected.\n\n🌱 సమతుల్య ఎరువులు వాడండి మరియు నీటి నిర్వహణ చేయండి.`;
  }

  const sevMap = { mild: '🟡 తక్కువ', moderate: '🟠 మధ్యస్థం', severe: '🔴 తీవ్రం', unknown: '⚪ తెలియదు' };
  const sev    = sevMap[d.severity] || '⚪';
  const conf   = d.confidence_score ? ` (${Math.round(d.confidence_score * 100)}%)` : '';

  return `🔬 *వ్యాధి గుర్తింపు — Disease Detection*
🤖 _Local ML Model (PlantVillage)_

🌿 వ్యాధి: *${d.telugu_disease || d.disease}*
📊 తీవ్రత: ${sev} | నమ్మకం: ${d.confidence}${conf}

${d.telugu_summary || ''}

💊 *చికిత్స | Treatment:*
${(d.treatment || []).slice(0, 3).map((t, i) => `${i + 1}. ${t}`).join('\n')}

🌱 *సేంద్రీయ నివారణ:*
${d.organic_remedy || 'వేప నూనె స్ప్రే (5ml/litre) ప్రయత్నించండి.'}

⚠️ తీవ్రమైతే: KVK helpline 1800-180-1551`;
}

module.exports = {
  transcribeVoice,
  generateTTS,
  detectDisease,
  detectIntent,
  downloadTwilioMedia,
  formatDiseaseReply,
  VOICE_DIR,
};
