# 🌾 RythuMitra — Farmer Information Platform

> **AI-powered IVR + WhatsApp bot for Andhra Pradesh farmers**  
> Real-time mandi prices · Government schemes · Weather advisories · Loan info · **Plant Disease Detection**

![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs) ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) ![Express](https://img.shields.io/badge/Express-4-000000?logo=express) ![NeDB](https://img.shields.io/badge/NeDB-pure%20JS-green) ![Twilio](https://img.shields.io/badge/Twilio-WhatsApp-F22F46?logo=twilio) ![ngrok](https://img.shields.io/badge/ngrok-Static%20Domain-1F1E37?logo=ngrok) ![PyTorch](https://img.shields.io/badge/PyTorch-MobileNetV2-EE4C2C?logo=pytorch) ![Accuracy](https://img.shields.io/badge/Disease%20Detection-99.36%25-brightgreen)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [One-Click Startup](#one-click-startup)
- [API Reference](#api-reference)
- [IVR Simulator](#ivr-simulator)
- [WhatsApp Bot](#whatsapp-bot)
- [Real WhatsApp Integration](#real-whatsapp-integration-twilio--ngrok)
- [Voice Audio System](#voice-audio-system)
- [Disease Detection (ML)](#disease-detection-ml)
- [Admin Dashboard](#admin-dashboard)
- [Seed Data](#seed-data)
- [Tech Stack](#tech-stack)
- [Changelog](#changelog)

---

## Overview

**RythuMitra** (రైతు మిత్ర — "Farmer's Friend") is a full-stack farmer information system designed for Andhra Pradesh. Farmers receive real-time mandi prices, government scheme alerts, and weather advisories via **IVR missed-call callback** and **WhatsApp bot** — no smartphone or internet required.

Farmers can also send a **photo of their crop** on WhatsApp to instantly detect plant diseases using a deep learning model with **99.36% validation accuracy**.

The platform includes an **Admin Dashboard** for agricultural officers to manage prices, schemes, alerts, and view analytics.

---

## Features

| Feature | Description |
|---------|-------------|
| 📞 **IVR Simulator** | Full DTMF keypad flow — missed call → price/scheme/weather/loan menu |
| 💬 **WhatsApp Bot** | Telugu + English intent detection, price cards, scheme cards, weather |
| 🔊 **Telugu Voice Notes** | 23 synthesized Telugu MP3 audio files sent as WhatsApp voice notes |
| 🌿 **Disease Detection** | Send crop photo → instant AI diagnosis (99.36% accuracy, 38 diseases) |
| 📊 **Mandi Prices** | Real-time prices for 20 crops × 13 AP districts, spike detection (>15%) |
| 📋 **Govt Schemes** | PM-KISAN, Rythu Bharosa, PMFBY, KCC, YSR Insurance, NABARD |
| 📢 **Alert Broadcasts** | Target by district + crop + status filter, WhatsApp/SMS delivery tracking |
| 📈 **Analytics** | IVR call logs, WhatsApp intents, farmer growth, district leaderboard |
| 👨‍🌾 **Farmer Registry** | 120+ farmers, CRUD, filter by district/crop/channel |

---

## Architecture

```
┌─────────────────┐     DTMF/API     ┌────────────────────────────────┐
│  IVR Simulator  │ ───────────────► │                                │
│  (React UI)     │                  │  Express.js API (Port 5000)    │
├─────────────────┤     REST/JSON    │                                │
│  WhatsApp Bot   │ ◄──────────────► │  NeDB (pure JS file-based DB)  │
│  Simulator      │                  │                                │
├─────────────────┤                  └────────┬──────────┬────────────┘
│  Admin Dashboard│ ◄──────────────►          │          │
│  (React/Vite)   │                           │          │
└─────────────────┘                           │          │
                                              ▼          ▼
                                   ┌──────────────┐  ┌──────────────┐
                                   │  Disease     │  │  STT Server  │
                                   │  Server :5002│  │  (Whisper)   │
                                   │  99.36% acc  │  │  :5001       │
                                   └──────────────┘  └──────────────┘
                                              ▲
                                   ┌──────────┴──────────┐
                                   │  ngrok Static Tunnel │
                                   │  wobble-colt-length  │
                                   │  .ngrok-free.dev     │
                                   └─────────────────────┘
                                              ▲
                                   ┌──────────┴──────────┐
                                   │  Real WhatsApp       │
                                   │  (Twilio Sandbox)    │
                                   └─────────────────────┘

  Voice Audio ──► GitHub Raw CDN ──► Twilio ──► WhatsApp Voice Note
  (MP3 files)     (free, public, no interstitial)

  Crop Image ──► disease_server.py ──► MobileNetV2 ──► Disease + Treatment
```

---

## Project Structure

```
csp/
├── start.ps1                      ← One-click startup (all services)
├── test_disease_model.py          ← Model accuracy test (114 images, 38 classes)
├── requirements.txt               ← Python dependencies
├── voice/                         ← 23 Telugu MP3 audio files (GitHub-hosted)
│   ├── greeting_new.mp3
│   ├── price_normal.mp3
│   ├── price_spike_up.mp3
│   ├── price_spike_down.mp3
│   ├── schemes_intro.mp3
│   ├── weather_normal.mp3
│   ├── weather_rain_warning.mp3
│   ├── loan_kcc.mp3
│   ├── unsubscribe.mp3
│   └── ... (14 more)
│
├── server/                        ← Node.js + Express backend
│   ├── server.js                  ← Entry point, route mounts, audio CDN headers
│   ├── package.json
│   ├── db/
│   │   ├── database.js            ← NeDB datastore setup + auto-seed
│   │   ├── seed.js                ← Realistic mock data generator
│   │   └── *.db                   ← Auto-generated on first run
│   ├── routes/
│   │   ├── farmers.js             ← CRUD + pagination + search
│   │   ├── prices.js              ← Prices + spike detection + history
│   │   ├── schemes.js             ← Govt schemes CRUD
│   │   ├── alerts.js              ← Draft → send broadcast flow
│   │   ├── analytics.js           ← Aggregated metrics
│   │   ├── ivr.js                 ← IVR call simulation engine
│   │   ├── whatsapp.js            ← Real Twilio WhatsApp webhook + disease detection
│   │   ├── disease.js             ← Disease detection API (calls Python server)
│   │   └── twilio.js              ← Legacy Twilio handler
│   └── python/                    ← Python ML services
│       ├── disease_server.py      ← Disease inference HTTP server (port 5002)
│       ├── stt_server.py          ← Whisper STT HTTP server (port 5001)
│       ├── train_v2.py            ← 2-phase MobileNetV2 training script
│       ├── disease.py             ← Disease prediction logic
│       ├── tts.py                 ← Telugu text-to-speech (gTTS)
│       ├── stt.py                 ← Whisper STT wrapper
│       ├── nlp_intent.py          ← spaCy NLP intent classifier
│       ├── models/                ← Trained model weights (not in git — train locally)
│       │   └── class_labels.json  ← 38 PlantVillage class names
│       └── utils/                 ← Dataset utilities and helper scripts
│
└── client/                        ← React + Vite frontend
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── App.jsx                ← Router + layout
        ├── index.css              ← Dark theme design system
        ├── components/
        │   ├── Sidebar.jsx
        │   ├── Header.jsx
        │   └── Toast.jsx
        └── pages/
            ├── Dashboard.jsx      ← KPI cards + 5 recharts
            ├── Farmers.jsx        ← Farmer table + add/edit modal
            ├── Prices.jsx         ← Mandi prices + spike alerts
            ├── Schemes.jsx        ← Scheme cards + toggle
            ├── Alerts.jsx         ← Compose + send + status filter + delivery rate
            ├── Analytics.jsx      ← 4-tab analytics view
            ├── DiseaseDetection.jsx ← Disease logs, images, ML results
            ├── IVRSimulator.jsx   ← Phone keypad UI
            └── WhatsAppBot.jsx    ← Chat UI with rich cards + voice notes
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher
- Python 3.12+ (for ML services)
- [ngrok](https://ngrok.com/) (for real WhatsApp integration)

### Installation

```powershell
# Clone the repository
git clone https://github.com/SARATH4546/rythumitra.git
cd rythumitra

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ..\client
npm install

# Install Python dependencies
cd ..
pip install -r requirements.txt
```

---

## One-Click Startup

Run everything (backend + frontend + ngrok tunnel) with a single command:

```powershell
cd "d:\Minor's\csp"
.\start.ps1
```

This opens three terminal windows automatically:
- **Backend API** → `http://localhost:5000`
- **Frontend Dashboard** → `http://localhost:5173`
- **ngrok Tunnel** → `https://wobble-colt-length.ngrok-free.dev`

The Node.js server automatically spawns the **Disease Detection Server** (port 5002) and **STT Server** (port 5001) as child processes.

### Manual Startup (5 terminals)

**Terminal 1 — Backend:**
```powershell
cd server
node server.js
```

**Terminal 2 — Frontend:**
```powershell
cd client
npm run dev
```

**Terminal 3 — ngrok tunnel:**
```powershell
ngrok http --url=wobble-colt-length.ngrok-free.dev 5000
```

**Terminal 4 — Disease Server (optional, auto-spawned by Node):**
```powershell
python server/python/disease_server.py
```

**Terminal 5 — STT Server (optional, auto-spawned by Node):**
```powershell
python server/python/stt_server.py
```

---

## API Reference

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Server health check |

### Farmers
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/farmers` | List farmers (pagination, search, filter) |
| POST | `/api/farmers` | Register new farmer |
| GET | `/api/farmers/:id` | Get farmer by ID |
| PUT | `/api/farmers/:id` | Update farmer |
| DELETE | `/api/farmers/:id` | Delete farmer |

#### Query Params — GET /api/farmers
```
?page=1&limit=15&search=raju&district=Guntur&crop=Chilli&channel=whatsapp
```

### Mandi Prices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prices` | All prices (filterable by district/crop) |
| POST | `/api/prices` | Add new price entry |
| PUT | `/api/prices/:id` | Update existing price entry |
| DELETE | `/api/prices/:id` | Delete price entry |
| GET | `/api/prices/spikes` | Prices with >15% change vs 7-day avg |
| GET | `/api/prices/history` | 7-day price history |

### Schemes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schemes` | All schemes |
| POST | `/api/schemes` | Create scheme |
| PUT | `/api/schemes/:id` | Update / toggle active |
| DELETE | `/api/schemes/:id` | Delete scheme |

### Disease Detection
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/disease/detect` | Detect disease from image URL or file path |
| GET | `/api/disease/history` | All past detections from DB |
| GET | `/api/disease/stats` | Disease frequency stats |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/summary` | KPI summary counts |
| GET | `/api/analytics/sessions` | WhatsApp session trends |
| GET | `/api/analytics/intents` | Intent distribution |

---

## IVR Simulator

The IVR Simulator mimics a toll-free missed-call callback system:

```
Farmer dials toll-free number → Missed call
         │
         ▼
Bot calls back with Telugu IVR menu
  [1] Mandi Prices
  [2] Government Schemes
  [3] Weather Advisory
  [4] Loan Information
         │
         ▼
Farmer presses DTMF key → Response in Telugu voice
```

The dashboard includes a full phone keypad UI with live call transcript and Telugu audio labels.

---

## WhatsApp Bot

### Intent Keywords

| Intent | Telugu | English |
|--------|--------|---------|
| Price | ధర, మార్కెట్ | price, market, rate |
| Scheme | పథకం | scheme, yojana, pm kisan |
| Weather | వాతావరణం, వర్షం | weather, rain, forecast |
| Disease | వ్యాధి, రోగం | disease, pest, infection |
| Loan | రుణం | loan, kcc, credit |
| Greeting | నమస్కారం | hello, hi, start, menu |
| Unsubscribe | ఆపు | stop, unsubscribe |

### Response Types (Dashboard Simulator)
- `text` — Plain text with Telugu translation
- `voice_note` — Simulated audio waveform UI
- `price_card` — Min/Modal/Max price card with source
- `scheme_card` — Scheme name, benefit, deadline
- `weather_card` — 3-day forecast cards
- `loan_card` — KCC + NABARD loan details
- `disease_card` — Disease name, severity, treatment, organic remedy
- `price_chart` — 7-day price trend mini bar chart
- `quick_reply` — Tap-to-reply option buttons

---

## Real WhatsApp Integration (Twilio + ngrok)

### Requirements
- Free [Twilio account](https://www.twilio.com/try-twilio)
- ngrok with a free static domain

### Setup Steps

**1. Start all services:**
```powershell
.\start.ps1
```

**2. Join Twilio WhatsApp Sandbox:**
- Go to: [Twilio Console → Messaging → Try it out → Send a WhatsApp message](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
- Save `+1 (415) 523-8886` as a contact
- Send `join <your-sandbox-code>` to that number on WhatsApp

**3. Set Webhook URL in Twilio Sandbox Settings:**
```
When a message comes in: https://wobble-colt-length.ngrok-free.dev/api/whatsapp
Method: POST
```

**4. Chat!** Send `Hello` on WhatsApp to get started.

### Registration Flow (Real WhatsApp)
```
You:  Hello
Bot:  🔊 [Voice Note] + Welcome! Send your district name...

You:  Guntur
Bot:  🔊 [Voice Note] + Guntur selected! Now send your crop name...

You:  Paddy
Bot:  🔊 [Voice Note] + ✅ Registered! + Today's Paddy price in Guntur

You:  ధర
Bot:  🔊 [Voice Note] + 🌾 Paddy — Guntur: ₹2,050/quintal (Min/Max)

You:  పథకం
Bot:  🔊 [Voice Note] + 📋 PM-KISAN, Rythu Bharosa scheme details

You:  వాతావరణం
Bot:  🔊 [Voice Note] + 🌦️ 3-day weather forecast for Guntur

You:  [sends crop photo]
Bot:  🌿 Disease: Tomato Late Blight (92% confidence)
      💊 Treatment: Apply systemic fungicide...
```

---

## Voice Audio System

RythuMitra uses synthesized Telugu voice notes generated with Microsoft's `edge-tts` neural TTS engine.

### Audio Files (23 total)

| File | Trigger |
|------|---------|
| `greeting_new.mp3` | New user hello / returning user hello |
| `reg_district_selected.mp3` | District chosen during registration |
| `reg_complete.mp3` | Registration complete |
| `price_normal.mp3` | Price query (normal market) |
| `price_spike_up.mp3` | Price >10% above 7-day average |
| `price_spike_down.mp3` | Price >10% below 7-day average |
| `price_not_available.mp3` | No price data found |
| `schemes_intro.mp3` | Scheme query |
| `scheme_pmkisan.mp3` | PM-KISAN scheme |
| `scheme_pmfby.mp3` | PMFBY scheme |
| `scheme_ryhtubharosa.mp3` | Rythu Bharosa scheme |
| `weather_normal.mp3` | Clear weather forecast |
| `weather_rain_warning.mp3` | Heavy rain warning |
| `loan_kcc.mp3` | KCC / NABARD loan info |
| `loan_nabard.mp3` | NABARD loan info |
| `unsubscribe.mp3` | Stop / unsubscribe |
| `error_unknown.mp3` | Unknown intent / fallback |
| `alert_price.mp3` | Price spike broadcast alert |
| `alert_scheme_deadline.mp3` | Scheme deadline alert |
| `ivr_main_menu.mp3` | IVR main menu prompt |
| `ivr_reg_welcome.mp3` | IVR registration welcome |
| `ivr_welcome_returning.mp3` | IVR returning farmer welcome |

### How Audio Delivery Works

```
Bot receives "hello" on WhatsApp
         │
         ▼
twilio.js constructs TWO TwiML <Message> elements:
  1. <Message><Media>https://raw.githubusercontent.com/.../greeting_new.mp3</Media></Message>
  2. <Message><Body>Namaskaram! Welcome to RythuMitra...</Body></Message>
         │
         ▼
Twilio fetches MP3 from GitHub raw CDN (free, public, no interstitial)
         │
         ▼
WhatsApp delivers: voice note + text message
```

> **Why GitHub CDN?** ngrok free plan shows a browser interstitial page that blocks Twilio from fetching audio files. GitHub raw URLs are always directly accessible.

### Regenerate Voice Files
```powershell
pip install edge-tts
python server/python/utils/generate_voices.py
```

---

## Disease Detection (ML)

Farmers can send a photo of their crop on WhatsApp. The bot replies with the disease name, severity, treatment, and organic remedy — in Telugu.

### Model Details

| Metric | Value |
|--------|-------|
| Architecture | MobileNetV2 (ImageNet pretrained) |
| Dataset | PlantVillage (54,305 images, 38 classes) |
| Training strategy | 2-phase: head-only (5 epochs) → backbone unfreeze (5 epochs) |
| **Validation accuracy** | **99.36%** |
| **Test accuracy** | **94.74%** (114 held-out images, 38 classes) |
| Average confidence | 91.9% |
| Training time | ~55 min on RTX 3050 GPU |
| Inference time | ~1–2 seconds per image |

### Training Progress

| Epoch | Phase | Train Acc | Val Acc |
|-------|-------|-----------|---------|
| 1 | Head-only | 89.9% | 95.88% |
| 3 | Head-only | 95.7% | 96.41% |
| 4 | Head-only | 95.6% | **97.14%** |
| 6 (P2-1) | Backbone | 96.7% | 98.16% |
| 7 (P2-2) | Backbone | 98.7% | 99.00% |
| 10 (P2-5) | Backbone | **99.9%** | **99.36%** |

### Supported Crops & Diseases (38 classes)
Apple, Blueberry, Cherry, Corn/Maize, Grape, Orange, Peach, Bell Pepper, Potato, Raspberry, Soybean, Squash, Strawberry, Tomato — each with healthy + disease variants.

### Training the Model

```powershell
# Create GPU-enabled Python environment (Python 3.12 required for CUDA)
py -3.12 -m venv train_venv
train_venv\Scripts\pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Run 2-phase training
train_venv\Scripts\python server/python/train_v2.py `
  --dataset "D:\path\to\PlantVillage\color" `
  --phase1-epochs 5 `
  --phase2-epochs 5
```

### Testing the Model

```powershell
# Run accuracy test on 114 held-out test images
python test_disease_model.py

# Verbose mode (shows every prediction)
python test_disease_model.py --verbose
```

---

## Admin Dashboard

| Page | Features |
|------|----------|
| **Overview** | 6 KPI cards, area chart (calls), bar chart (WA sessions), pie chart (districts) |
| **Farmers** | Searchable table, filter by district/crop/channel, add/edit/delete modal |
| **Mandi Prices** | Today's prices, ⚡ spike alerts (>15%), add/edit (PUT) / delete entries |
| **Schemes** | Card view, activate/deactivate toggle, CRUD with deadline tracking |
| **Alerts** | Compose with district+crop targeting, **status filter** (all/draft/sent), draft → send, delivery rate |
| **Analytics** | 4 tabs: IVR logs, WA intents (pie), farmer growth (bar), district leaderboard |
| **Disease Detection** | All submitted crop images + ML diagnosis, confidence, severity, treatment |
| **IVR Simulator** | Full phone keypad, live call transcript, Telugu audio labels |
| **WhatsApp Bot** | Real chat UI, price/scheme/weather/loan/disease rich cards, voice note playback |

---

## Seed Data

On first run, the database is auto-populated with:

| Collection | Records | Details |
|------------|---------|---------|
| Farmers | 120 | Spread across 13 AP districts, 20 crops |
| Mandi Prices | 140 | 20 crops × 7 districts, today's prices |
| Price History | 980 | 7 days × 20 crops × 7 districts |
| IVR Call Logs | 350 | Last 30 days, realistic distribution |
| WhatsApp Sessions | 200 | Last 30 days, 5 intent types |
| Govt Schemes | 6 | PM-KISAN, Rythu Bharosa, PMFBY, KCC, YSR Insurance, NABARD |
| Alerts | 5 | 4 sent with delivery stats, 1 draft |

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Node.js + Express.js | REST API server |
| **Database** | NeDB (pure JavaScript) | Embedded file-based DB, no compilation needed |
| **Frontend** | React 18 + Vite 5 | Admin dashboard SPA |
| **Charts** | Recharts | Analytics visualizations |
| **Icons** | Lucide React | UI icons |
| **HTTP Client** | Axios | Frontend API calls |
| **Routing** | React Router v6 | SPA routing |
| **Tunnel** | ngrok (static domain) | Expose localhost for Twilio webhook |
| **WhatsApp** | Twilio Sandbox | Real WhatsApp integration (testing) |
| **Voice TTS** | gTTS + edge-tts | Telugu neural voice synthesis |
| **Speech-to-Text** | OpenAI Whisper (local) | Voice message transcription |
| **NLP** | spaCy | Intent classification |
| **Disease ML** | PyTorch + MobileNetV2 | Plant disease detection (99.36% acc) |
| **Audio CDN** | GitHub Raw CDN | Free, public MP3 hosting for Twilio media |
| **Styling** | Vanilla CSS | Dark agri-themed design system |

---

## Changelog

### v2.0 — Disease Detection + Voice AI (Latest)
- ✅ **Plant Disease Detection** — MobileNetV2 retrained with 2-phase GPU strategy: **99.36% val accuracy** (up from ~85%)
- ✅ **Persistent inference server** — `disease_server.py` loads model once at startup (~1–2s per inference, was ~15s)
- ✅ **Whisper STT server** — `stt_server.py` for transcribing voice messages locally
- ✅ **NLP intent engine** — `nlp_intent.py` using spaCy for accurate Telugu/English intent detection
- ✅ **Disease Detection dashboard page** — View all submitted crop images with diagnosis results
- ✅ **Disease response on WhatsApp** — Crop photo → disease card (name, severity, treatment, organic remedy)
- ✅ **Project organized** — Utility scripts moved to `server/python/utils/`, test images in `test_data/`

### v1.0 — Core Platform
- ✅ **Voice notes in WhatsApp** — 23 Telugu MP3 files hosted on GitHub raw CDN; Twilio can fetch without interstitial
- ✅ **Audio + Text delivery fix** — Audio and text sent as separate `<Message>` elements (WhatsApp drops body when combined with audio media)
- ✅ **ngrok static tunnel** — Replaced unstable Cloudflare tunnel with permanent ngrok free domain
- ✅ **One-click startup** — `start.ps1` launches backend + frontend + ngrok in 3 windows
- ✅ **Prices edit fix** — Edit now correctly uses `PUT /api/prices/:id` (was always POST, causing duplicates)
- ✅ **Alerts filter** — Status filter buttons (all/draft/sent) now functional
- ✅ **WhatsApp Bot page fix** — Fixed JavaScript crash from `const` inside `switch` cases
- ✅ **Audio URL fix** — Relative `/audio/` path used in dashboard simulator (was hardcoded to localhost)

---

## Notes

- **No paid APIs required** — all telephony and messaging is simulated or uses free tiers. Twilio Sandbox and ngrok free plan are both free.
- **NeDB** was chosen over SQLite (`better-sqlite3`) because it's pure JavaScript — no Visual Studio Build Tools or Windows SDK required for compilation.
- **GitHub raw CDN** is used for audio hosting because ngrok free plan shows a browser interstitial that blocks Twilio from fetching media files.
- **Two-message TwiML** — WhatsApp silently drops `<Body>` text when combined with audio `<Media>` in the same `<Message>` element. Audio and text must be sent in separate messages.
- **Model weights not in git** — `*.pth` files are excluded (large binaries). Run `train_v2.py` to train locally, or place `plantvillage_head.pth` in `server/python/models/`.
- **GPU training** — Python 3.14 lacks CUDA wheel support. Use the `train_venv` (Python 3.12 + PyTorch CUDA 12.1) for GPU-accelerated training.

---

## License

This project is built as a **Community Service Project (CSP)** for academic purposes.

---

<div align="center">
  <strong>🌾 RythuMitra — రైతు మిత్ర</strong><br>
  <em>Empowering AP Farmers with Technology</em>
</div>
