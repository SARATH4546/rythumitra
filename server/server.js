const express = require('express');
const cors = require('cors');
const { initDb } = require('./db/database');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/farmers',   require('./routes/farmers'));
app.use('/api/prices',    require('./routes/prices'));
app.use('/api/schemes',   require('./routes/schemes'));
app.use('/api/alerts',    require('./routes/alerts'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/ivr',       require('./routes/ivr'));
app.use('/api/whatsapp',  require('./routes/whatsapp'));
app.use('/api/twilio',    require('./routes/twilio'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Boot: init DB then start listening
initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🌾 RythuMitra API  →  http://localhost:${PORT}`);
    console.log(`📊 Admin Dashboard  →  http://localhost:5173\n`);
  });
}).catch(err => { console.error('❌ DB init failed:', err); process.exit(1); });

module.exports = app;
