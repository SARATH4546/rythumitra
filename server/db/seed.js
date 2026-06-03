const { randomUUID } = require('crypto');

const DISTRICTS = ['Guntur','Krishna','Kurnool','East Godavari','West Godavari','Visakhapatnam','Srikakulam','Vizianagaram','Prakasam','Nellore','Chittoor','Kadapa','Anantapur'];
const CROPS = ['Paddy','Cotton','Chilli','Groundnut','Maize','Tobacco','Sugarcane','Onion','Tomato','Turmeric','Banana','Mango','Jowar','Bajra','Sunflower','Soybean','Blackgram','Greengram','Redgram','Sesame'];
const NAMES = ['Raju Reddy','Lakshmi Devi','Venkat Rao','Sunita Kumari','Krishna Murthy','Savitri Bai','Narayana Swamy','Padma Latha','Srinivas Rao','Anitha Devi','Ramaiah','Bhavani','Suresh Kumar','Meena Kumari','Prakash Rao','Saradha','Govinda Rao','Kamala Devi','Seshaiah','Vijaya Lakshmi','Hanumaiah','Parvati','Balaji Rao','Sumathi','Nageswara Rao','Radhamma','Tirumala Rao','Vasantha','Chandra Sekhar','Santha Kumari'];

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = n => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split('T')[0]; };
const nowISO = () => new Date().toISOString();
const daysAgoISO = n => new Date(Date.now() - n * 86400000).toISOString();

const BASE_PRICES = {
  Paddy:2000, Cotton:6500, Chilli:12000, Groundnut:5500, Maize:2200,
  Tobacco:18000, Sugarcane:350, Onion:2000, Tomato:1800, Turmeric:8000,
  Banana:1500, Mango:4000, Jowar:2100, Bajra:2300, Sunflower:5200,
  Soybean:4500, Blackgram:6000, Greengram:7000, Redgram:6500, Sesame:10000
};

async function seed(db) {
  console.log('🌱 Seeding database…');

  // ── Farmers ──────────────────────────────────────────────────────
  const farmers = [];
  for (let i = 0; i < 120; i++) {
    const dBack = rand(0, 180);
    farmers.push({
      id: randomUUID(),
      mobile: `91${rand(7000000000, 9999999999)}`,
      name: pick(NAMES),
      district: pick(DISTRICTS),
      primary_crop: pick(CROPS),
      secondary_crop: Math.random() > 0.6 ? pick(CROPS) : null,
      preferred_alert_time: pick(['morning','evening']),
      whatsapp_opted_in: Math.random() > 0.4,
      channel: pick(['ivr','whatsapp','both']),
      created_at: daysAgoISO(dBack),
      last_active: daysAgoISO(rand(0, 7))
    });
  }
  await db.farmers.insert(farmers);

  // ── Mandi Prices + History ────────────────────────────────────────
  const prices = [], history = [];
  CROPS.forEach(crop => {
    DISTRICTS.slice(0, 7).forEach(district => {
      const base = BASE_PRICES[crop] || 3000;
      for (let day = 6; day >= 0; day--) {
        const variance = base * 0.12;
        const modal = base + rand(-variance, variance);
        const min = Math.round(modal * 0.92);
        const max = Math.round(modal * 1.08);
        const date = daysAgo(day);
        history.push({ id: randomUUID(), crop, district, price_modal: Math.round(modal), date });
        if (day === 0) {
          prices.push({ id: randomUUID(), crop, district, price_min: min, price_max: max, price_modal: Math.round(modal), unit: 'quintal', source: 'agmarknet', date, updated_at: nowISO() });
        }
      }
    });
  });
  await db.prices.insert(prices);
  await db.history.insert(history);

  // ── Schemes ───────────────────────────────────────────────────────
  await db.schemes.insert([
    { id: randomUUID(), name:'PM-KISAN', name_telugu:'పీఎమ్-కిసాన్', department:'Central — Agriculture Ministry', benefit:'₹6,000/year direct income support in 3 installments', benefit_amount:'₹6,000/year', eligibility:'All small and marginal farmers with cultivable land', deadline:'2024-12-31', how_to_apply:'Visit nearest CSC or pm-kisan.gov.in with Aadhaar + land record', is_active:true, created_at:nowISO() },
    { id: randomUUID(), name:'Rythu Bharosa (AP)', name_telugu:'రైతు భరోసా', department:'AP State Government', benefit:'₹13,500/year direct income support to AP farmers', benefit_amount:'₹13,500/year', eligibility:'All farmers with land in Andhra Pradesh', deadline:'2024-10-31', how_to_apply:'Register at Village Secretariat with Aadhaar + pattadar passbook', is_active:true, created_at:nowISO() },
    { id: randomUUID(), name:'PMFBY — Crop Insurance', name_telugu:'పీఎమ్ఎఫ్‌బివై', department:'Central — Agriculture Ministry', benefit:'Crop insurance against natural calamity, pest, and disease', benefit_amount:'Up to ₹2 lakh per acre', eligibility:'All farmers growing notified crops; mandatory for KCC holders', deadline:'2024-07-31', how_to_apply:'Apply via pmfby.gov.in or nearest bank/CSC before sowing season', is_active:true, created_at:nowISO() },
    { id: randomUUID(), name:'Kisan Credit Card (KCC)', name_telugu:'కిసాన్ క్రెడిట్ కార్డ్', department:'NABARD / Banks', benefit:'Short-term crop loans at 4% interest (2% for timely repayment)', benefit_amount:'Up to ₹3 lakh', eligibility:'Farmers, sharecroppers, tenant farmers with land records', deadline:null, how_to_apply:'Apply at any nationalized bank or cooperative bank with land documents', is_active:true, created_at:nowISO() },
    { id: randomUUID(), name:'YSR Free Crop Insurance', name_telugu:'వైఎస్ఆర్ ఉచిత పంట బీమా', department:'AP State Government', benefit:'Premium-free crop insurance; AP government pays farmer premium share', benefit_amount:'Full crop value coverage', eligibility:'All AP farmers enrolled in PMFBY', deadline:'2024-07-31', how_to_apply:'Automatically applied for PMFBY enrollees in AP; no separate application needed', is_active:true, created_at:nowISO() },
    { id: randomUUID(), name:'NABARD Microfinance', name_telugu:'నాబార్డ్ మైక్రోఫైనాన్స్', department:'NABARD', benefit:'Group loans for marginal farmers via Self Help Groups (SHGs)', benefit_amount:'₹1 lakh–₹5 lakh per group', eligibility:'Marginal farmers, landless agricultural labourers in SHGs', deadline:null, how_to_apply:'Join or form a SHG and contact nearest NABARD office or Regional Rural Bank', is_active:true, created_at:nowISO() },
  ]);

  // ── IVR Call Logs ─────────────────────────────────────────────────
  const calls = [];
  const statuses = ['completed','completed','completed','dropped','no_answer'];
  for (let i = 0; i < 350; i++) {
    const dBack = rand(0, 30), hBack = rand(0, 23);
    calls.push({
      id: randomUUID(), farmer_id: null,
      mobile: `91${rand(7000000000, 9999999999)}`,
      duration: rand(30, 180),
      menu_selections: JSON.stringify(pick([['1'],['2'],['3'],['1','2'],['4'],['1','3'],['2','3']])),
      district: pick(DISTRICTS.slice(0, 5)),
      crop: pick(CROPS.slice(0, 10)),
      status: pick(statuses),
      created_at: new Date(Date.now() - dBack * 86400000 - hBack * 3600000).toISOString()
    });
  }
  await db.ivr_calls.insert(calls);

  // ── WhatsApp Sessions ─────────────────────────────────────────────
  const sessions = [];
  for (let i = 0; i < 200; i++) {
    const created = daysAgoISO(rand(0, 30));
    sessions.push({
      id: randomUUID(), farmer_id: null,
      mobile: `91${rand(7000000000, 9999999999)}`,
      messages_count: rand(1, 12),
      last_intent: pick(['price','scheme','weather','loan','registration']),
      district: pick(DISTRICTS.slice(0, 5)),
      crop: pick(CROPS.slice(0, 10)),
      created_at: created, updated_at: created
    });
  }
  await db.wa.insert(sessions);

  // ── Alerts ────────────────────────────────────────────────────────
  await db.alerts.insert([
    { id:randomUUID(), type:'price_spike', message:'Chilli prices rose 18% in Guntur mandi today. Current rate: ₹14,200/quintal.', message_telugu:'గుంటూరు మండిలో మిర్చి ధర ఈరోజు 18% పెరిగింది. ప్రస్తుత ధర: ₹14,200/క్వింటాల్.', district:'Guntur', crop:'Chilli', channel:'whatsapp', recipients_count:3400, delivered_count:3180, status:'sent', created_at:daysAgoISO(2.5), sent_at:daysAgoISO(2) },
    { id:randomUUID(), type:'scheme_deadline', message:'PMFBY enrollment deadline is in 7 days. Enroll now to protect your crop.', message_telugu:'పీఎమ్ఎఫ్‌బివై నమోదు గడువు 7 రోజులలో ముగుస్తుంది.', district:null, crop:'Paddy', channel:'both', recipients_count:8200, delivered_count:7900, status:'sent', created_at:daysAgoISO(5.5), sent_at:daysAgoISO(5) },
    { id:randomUUID(), type:'weather', message:'Heavy rainfall expected in Krishna district in next 24 hours. Harvest before it rains.', message_telugu:'కృష్ణా జిల్లాలో రేపు భారీ వర్షపాతం అంచనా. వర్షానికి ముందు పంటను కోయండి.', district:'Krishna', crop:null, channel:'sms', recipients_count:5600, delivered_count:5400, status:'sent', created_at:daysAgoISO(1.5), sent_at:daysAgoISO(1) },
    { id:randomUUID(), type:'price_spike', message:'Tomato prices dropped 20% in West Godavari mandi. Consider holding stock.', message_telugu:'పశ్చిమ గోదావరి మండిలో టమాటా ధర 20% తగ్గింది.', district:'West Godavari', crop:'Tomato', channel:'whatsapp', recipients_count:1200, delivered_count:1100, status:'sent', created_at:daysAgoISO(3.5), sent_at:daysAgoISO(3) },
    { id:randomUUID(), type:'broadcast', message:'Rythu Bharosa next installment releasing on 15th. Check your bank account.', message_telugu:'రైతు భరోసా తదుపరి వాయిదా 15వ తేదీన విడుదలవుతుంది.', district:null, crop:null, channel:'both', recipients_count:0, delivered_count:0, status:'draft', created_at:nowISO(), sent_at:null },
  ]);

  console.log('✅ Seed complete: 120 farmers | prices | 6 schemes | 350 IVR calls | 200 WA sessions | 5 alerts');
}

module.exports = { seed };
