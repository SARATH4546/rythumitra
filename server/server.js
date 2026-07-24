require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initDb } = require('./db/database');

const app  = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const ts = new Date().toISOString().replace('T', ' ').split('.')[0];
  console.log(`[${ts}] ${req.method} ${req.path} | from: ${req.headers['x-forwarded-for'] || req.ip}`);
  if (req.method === 'POST' && req.body?.Body) {
    console.log(`  WA msg: "${req.body.Body}" | from: ${req.body.From}`);
  }
  next();
});

// ── Static: serve TTS audio files (with ngrok bypass header) ─────────────────
app.use('/audio', (req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
}, express.static(path.join(__dirname, 'audio')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/farmers',   require('./routes/farmers'));
app.use('/api/prices',    require('./routes/prices'));
app.use('/api/schemes',   require('./routes/schemes'));
app.use('/api/alerts',    require('./routes/alerts'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/ivr',       require('./routes/ivr'));
app.use('/api/whatsapp',  require('./routes/whatsapp'));   // ← single mount only
app.use('/api/twilio',    require('./routes/twilio'));
app.use('/api/disease',   require('./routes/disease'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── Auto-spawn persistent Python microservers ─────────────────────────────────
const { spawn }   = require('child_process');
const PYTHON_DIR  = path.join(__dirname, 'python');

function spawnPyServer(script, name, port) {
  const ollamaDir  = `${process.env.LOCALAPPDATA}\\Programs\\Ollama`;
  const extraPath  = `${ollamaDir};${process.env.PATH}`;
  const proc = spawn('python', [path.join(PYTHON_DIR, script)], {
    env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1', PATH: extraPath },
    cwd: path.join(__dirname, '..'),
  });
  proc.stdout.on('data', d => process.stdout.write(`[${name}] ${d}`));
  proc.stderr.on('data', d => process.stderr.write(`[${name}] ${d}`));
  proc.on('close', code => {
    if (code !== 0) {
      console.log(`[${name}] crashed (code ${code}), restarting in 5s...`);
      setTimeout(() => spawnPyServer(script, name, port), 5000);
    }
  });
  console.log(`[${name}] spawned → http://127.0.0.1:${port}`);
  return proc;
}

spawnPyServer('stt_server.py',     'STT',     5001);
spawnPyServer('disease_server.py', 'Disease', 5002);
spawnPyServer('rag_server.py',     'RAG',     5003);

// ── Auto-managed ngrok tunnel ─────────────────────────────────────────────────
const NGROK_DOMAIN = process.env.NGROK_DOMAIN || 'wobble-colt-length.ngrok-free.dev';
function startNgrok() {
  const args = NGROK_DOMAIN
    ? ['http', `--url=${NGROK_DOMAIN}`, String(PORT)]
    : ['http', String(PORT)];
  const ng = spawn('ngrok', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  ng.stdout.on('data', d => {
    const s = d.toString().trim();
    if (s) console.log(`[ngrok] ${s}`);
  });
  ng.stderr.on('data', d => {
    const s = d.toString().trim();
    if (s && !s.includes('deprecated')) console.log(`[ngrok] ${s}`);
  });
  ng.on('close', code => {
    console.log(`[ngrok] tunnel closed (code ${code}), restarting in 3s...`);
    setTimeout(startNgrok, 3000);
  });
  console.log(`[ngrok] tunnel → https://${NGROK_DOMAIN}/api/whatsapp`);
  return ng;
}
startNgrok();


// ── Boot: init DB → start listening ──────────────────────────────────────────
initDb().then(() => {
  console.log('✅ Database ready');
  app.listen(PORT, () => {
    console.log(`\n🌾 RythuMitra API  →  http://localhost:${PORT}`);
    console.log(`📊 Admin Dashboard  →  http://localhost:5173\n`);
  });
}).catch(err => { console.error('❌ DB init failed:', err); process.exit(1); });

module.exports = app;
