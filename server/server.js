require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const { initDb } = require('./db/database');


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger — shows every hit so we can confirm Twilio is calling us
app.use((req, res, next) => {
  const ts = new Date().toISOString().replace('T',' ').split('.')[0];
  console.log(`[${ts}] ${req.method} ${req.path} | from: ${req.headers['x-forwarded-for'] || req.ip}`);
  if (req.method === 'POST' && req.body?.Body) {
    console.log(`  WA msg: "${req.body.Body}" | from: ${req.body.From}`);
  }
  next();
});

// Serve Telugu voice audio — add ngrok bypass header so Twilio can fetch files
app.use('/audio', (req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  next();
}, express.static(path.join(__dirname, '..', 'voice')));


app.use('/api/farmers',   require('./routes/farmers'));
app.use('/api/prices',    require('./routes/prices'));
app.use('/api/schemes',   require('./routes/schemes'));
app.use('/api/alerts',    require('./routes/alerts'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/ivr',       require('./routes/ivr'));
app.use('/api/whatsapp',  require('./routes/whatsapp'));
app.use('/api/twilio',    require('./routes/twilio'));
app.use('/api/disease',   require('./routes/disease'));


app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Boot: init DB then start listening
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🌾 RythuMitra API  →  http://localhost:${PORT}`);
    console.log(`📊 Admin Dashboard  →  http://localhost:5173\n`);
  });
}).catch(err => { console.error('❌ DB init failed:', err); process.exit(1); });

module.exports = app;
