/**
 * RythuMitra v2 — AI Services (all free tier)
 * - Groq Whisper : voice → text (Telugu/Hindi/English)
 * - Groq Llama   : smart Telugu response generation
 * - Gemini Vision: crop disease detection from photos
 * - Google TTS   : any text → public audio URL (Telugu)
 */

require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const googleTTS = require('google-tts-api');

// ─── Groq client ─────────────────────────────────────────────────────────────
let groq = null;
function getGroq() {
  if (!groq && process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here') {
    const Groq = require('groq-sdk');
    groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  }
  return groq;
}

// ─── Gemini client ────────────────────────────────────────────────────────────
let gemini = null;
function getGemini() {
  if (!gemini && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'your_gemini_api_key_here') {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    gemini = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
  }
  return gemini;
}

// ─── 1. Download Twilio media (voice/image) ───────────────────────────────────
async function downloadTwilioMedia(mediaUrl, accountSid, authToken) {
  const resp = await axios.get(mediaUrl, {
    auth: { username: accountSid, password: authToken },
    responseType: 'arraybuffer',
    timeout: 15000,
  });
  return { data: Buffer.from(resp.data), contentType: resp.headers['content-type'] || '' };
}

// ─── 2. Voice → Text (Groq Whisper, free) ─────────────────────────────────────
async function transcribeVoice(audioBuffer, contentType) {
  const client = getGroq();
  if (!client) return null;

  // Save to a temp file (Groq SDK needs a file path or stream)
  const ext   = contentType.includes('ogg') ? 'ogg' : 'mp3';
  const tmpPath = path.join(__dirname, '..', `tmp_voice_${Date.now()}.${ext}`);
  fs.writeFileSync(tmpPath, audioBuffer);

  try {
    const transcription = await client.audio.transcriptions.create({
      file:     fs.createReadStream(tmpPath),
      model:    'whisper-large-v3',
      language: 'te',   // Telugu; Whisper auto-detects if wrong
      response_format: 'text',
    });
    return typeof transcription === 'string' ? transcription.trim() : transcription?.text?.trim() || null;
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

// ─── 3. Crop disease detection (Gemini Vision, free) ─────────────────────────
async function detectCropDisease(imageBuffer, contentType, cropHint = '') {
  const model = getGemini();
  if (!model) {
    return {
      disease: 'Unknown',
      telugu: 'AI విశ్లేషణ అందుబాటులో లేదు. దయచేసి సమీప KVK లేదా వ్యవసాయ అధికారిని సంప్రదించండి.',
      english: 'AI analysis unavailable. Please contact your local KVK or agriculture officer.',
      severity: 'unknown', treatment: [], prevention: [],
    };
  }

  const mimeType = contentType.split(';')[0].trim() || 'image/jpeg';
  const base64   = imageBuffer.toString('base64');

  const prompt = `You are an expert agricultural plant pathologist specializing in Indian crops.

Analyze this crop image${cropHint ? ` (crop: ${cropHint})` : ''} and provide a detailed diagnosis.

Return a JSON object with exactly these fields:
{
  "disease": "Disease name in English",
  "telugu_disease": "Disease name in Telugu",
  "confidence": "high/medium/low",
  "severity": "mild/moderate/severe",
  "symptoms": ["symptom 1", "symptom 2"],
  "telugu_summary": "2-3 sentence summary in Telugu script explaining the disease",
  "treatment": ["treatment step 1", "treatment step 2", "treatment step 3"],
  "telugu_treatment": "Treatment instructions in Telugu (2-3 sentences)",
  "prevention": ["prevention 1", "prevention 2"],
  "organic_remedy": "One organic/home remedy in Telugu",
  "when_to_consult": "When to contact agriculture officer",
  "is_healthy": false
}

If the plant is healthy, set is_healthy to true and disease to "Healthy Plant".
If the image is not a plant/crop, set disease to "Not a crop image".
RESPOND WITH ONLY THE JSON, NO MARKDOWN.`;

  try {
    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data: base64 } },
    ]);
    const text = result.response.text().trim().replace(/^```json\n?/, '').replace(/\n?```$/, '');
    return JSON.parse(text);
  } catch (err) {
    console.error('[Gemini] Disease detection error:', err.message);
    return {
      disease: 'Analysis failed',
      telugu_summary: 'చిత్రం విశ్లేషణలో సమస్య వచ్చింది. దయచేసి మళ్ళీ ప్రయత్నించండి.',
      treatment: [], prevention: [], severity: 'unknown', confidence: 'low', is_healthy: false,
    };
  }
}

// ─── 4. AI response generation (Groq Llama, free) ────────────────────────────
async function generateAIResponse(intent, context) {
  const client = getGroq();
  if (!client) return null;

  const { farmer, transcript, priceData, weatherData, schemesData } = context;

  const systemPrompt = `You are RythuMitra (రైతు మిత్ర), a friendly WhatsApp farming assistant for Andhra Pradesh farmers. 
You respond in Telugu (తెలుగు) naturally and warmly. Keep responses under 200 words.
Be specific with data when available. Use emojis sparingly.`;

  let userPrompt = '';
  if (intent === 'price' && priceData) {
    userPrompt = `Farmer ${farmer?.name || 'రైతు'} from ${farmer?.district || 'AP'} asked about ${farmer?.primary_crop || 'their crop'} price in Telugu (transcript: "${transcript}"). 
Price data: Modal ₹${priceData.price_modal}, Min ₹${priceData.price_min}, Max ₹${priceData.price_max}/quintal at ${priceData.district} mandi.
Give a helpful, conversational Telugu response about this price data.`;
  } else if (intent === 'weather') {
    userPrompt = `Farmer from ${farmer?.district || 'AP'} asked about weather in Telugu (transcript: "${transcript}"). 
Give a helpful Telugu response about farming weather considerations for ${new Date().toLocaleDateString('en-IN', {month:'long'})} season in AP.`;
  } else {
    userPrompt = `Farmer said: "${transcript}". Intent: ${intent}. Farmer details: ${farmer?.district || 'AP'} district, ${farmer?.primary_crop || 'crops'}.
Generate a helpful, warm Telugu WhatsApp reply (under 150 words).`;
  }

  try {
    const completion = await client.chat.completions.create({
      model:       'llama-3.1-70b-versatile',
      messages:    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
      max_tokens:  300,
      temperature: 0.7,
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('[Groq] LLM error:', err.message);
    return null;
  }
}

// ─── 5. Dynamic Telugu TTS → public URL ──────────────────────────────────────
function teluguTTSUrl(text, maxLen = 180) {
  try {
    // Truncate to avoid URL length limits
    const clean = (text || '').replace(/[*_~`]/g, '').substring(0, maxLen);
    // google-tts-api returns a direct Google TTS audio URL (no hosting needed!)
    const url = googleTTS.getAudioUrl(clean, { lang: 'te', slow: false, host: 'https://translate.google.com' });
    return url;
  } catch {
    return null;
  }
}

// For longer text (> 180 chars) — split into multiple URLs
function teluguTTSUrls(text) {
  try {
    const clean = (text || '').replace(/[*_~`]/g, '');
    return googleTTS.getAllAudioUrls(clean, { lang: 'te', slow: false, host: 'https://translate.google.com', splitPunct: ',.?' });
  } catch {
    return [];
  }
}

// ─── 6. Format disease reply for WhatsApp ─────────────────────────────────────
function formatDiseaseReply(d, crop) {
  if (d.is_healthy) {
    return `✅ *మీ పంట ఆరోగ్యంగా ఉంది!*\nYour ${crop || 'crop'} appears healthy. Keep up the good work!\n\nసమతుల్య ఎరువులు వాడండి మరియు నీటి నిర్వహణ చేయండి.`;
  }
  if (d.disease === 'Not a crop image') {
    return `⚠️ పంట చిత్రం గుర్తించలేదు.\nPlease send a clear photo of the affected plant leaves/stem/fruit.`;
  }
  const severity = { mild: '🟡 తక్కువ', moderate: '🟠 మధ్యస్థం', severe: '🔴 తీవ్రం' }[d.severity] || '⚪ తెలియదు';

  return `🔬 *వ్యాధి గుర్తింపు — Disease Detection*

🌿 వ్యాధి: *${d.telugu_disease || d.disease}*
📊 తీవ్రత: ${severity} (${d.confidence || 'medium'} confidence)

${d.telugu_summary || ''}

💊 *చికిత్స | Treatment:*
${(d.treatment || []).slice(0,3).map((t,i) => `${i+1}. ${t}`).join('\n')}

🌱 *సేంద్రీయ నివారణ:*
${d.organic_remedy || 'స్థానిక వ్యవసాయ అధికారిని సంప్రదించండి.'}

⚠️ ${d.when_to_consult || 'వ్యాధి తీవ్రమైతే KVK లేదా వ్యవసాయ అధికారిని సంప్రదించండి.'}`;
}

module.exports = {
  downloadTwilioMedia,
  transcribeVoice,
  detectCropDisease,
  generateAIResponse,
  teluguTTSUrl,
  teluguTTSUrls,
  formatDiseaseReply,
  hasGroq: () => !!getGroq(),
  hasGemini: () => !!getGemini(),
};
