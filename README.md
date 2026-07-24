# 🌾 RythuMitra — Farmer Information Platform

> **AI-powered IVR + WhatsApp bot for Andhra Pradesh farmers**  
> Real-time mandi prices · Government schemes · Weather advisories · Loan info · **Plant Disease Detection** · **RAG AI Advisor** · **Telugu Voice AI**

![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs) ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) ![Express](https://img.shields.io/badge/Express-4-000000?logo=express) ![NeDB](https://img.shields.io/badge/NeDB-pure%20JS-green) ![Twilio](https://img.shields.io/badge/Twilio-WhatsApp-F22F46?logo=twilio) ![ngrok](https://img.shields.io/badge/ngrok-Static%20Domain-1F1E37?logo=ngrok) ![PyTorch](https://img.shields.io/badge/PyTorch-MobileNetV2-EE4C2C?logo=pytorch) ![Accuracy](https://img.shields.io/badge/Disease%20Detection-99.36%25-brightgreen) ![Ollama](https://img.shields.io/badge/Ollama-Llama3.2-black?logo=ollama) ![RAG](https://img.shields.io/badge/RAG-ChromaDB-orange) ![TTS](https://img.shields.io/badge/TTS-edge--tts%20Neural-blue)

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
- [RAG AI Knowledge System](#rag-ai-knowledge-system)
- [Disease Detection (ML)](#disease-detection-ml)
- [Admin Dashboard](#admin-dashboard)
- [Seed Data](#seed-data)
- [Tech Stack](#tech-stack)
- [Changelog](#changelog)

---

## Overview

**RythuMitra** (రైతు మిత్ర — "Farmer's Friend") is a full-stack farmer information system designed for Andhra Pradesh. Farmers receive real-time mandi prices, government scheme alerts, and weather advisories via **IVR missed-call callback** and **WhatsApp bot** — no smartphone or internet required.

Farmers can also send a **photo of their crop** on WhatsApp to instantly detect plant diseases using a deep learning model with **99.36% validation accuracy**.

A **RAG (Retrieval-Augmented Generation) AI system** powered by a local Llama 3.2 model answers any agricultural question in detail — crop cultivation, disease treatment, government schemes, pesticides — in both English and **Telugu** (via Google Translate + Microsoft Neural TTS).

The platform includes an **Admin Dashboard** for agricultural officers to manage prices, schemes, alerts, and view analytics.

---

## Features

| Feature | Description |
|---------|-------------|
| 📞 **IVR Simulator** | Full DTMF keypad flow — missed call → price/scheme/weather/loan menu |
| 💬 **WhatsApp Bot** | Telugu + English intent detection, price cards, scheme cards, weather |
| 🔊 **Telugu Voice AI** | Microsoft Neural TTS (`te-IN-MohanNeural`) — natural Telugu voice replies |
| 🎤 **Speech-to-Text** | Telugu Wav2Vec2 STT — voice message transcription (local, offline) |
| 🤖 **RAG AI Advisor** | Llama 3.2 (local LLM) + ChromaDB — deep agricultural Q&A, 10-15 sentence answers |
| 🌿 **Disease Detection** | Send crop photo → instant AI diagnosis (99.36% accuracy, 38 diseases) |
| 📊 **Mandi Prices** | Real-time prices for 20 crops × 13 AP districts, spike detection (>15%) |
| 📋 **Govt Schemes** | PM-KISAN, Annadata Sukhibhava, PMFBY, KCC, YSR Insurance, NABARD |
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
│  (Real Twilio)  │                  │                                │
├─────────────────┤                  └────────┬──────────┬────────────┘
│  Admin Dashboard│ ◄──────────────►          │          │
│  (React/Vite)   │                           │          │
└─────────────────┘                           │          │
                                              ▼          ▼
                               ┌──────────────┐  ┌──────────────────┐
                               │  Disease AI  │  │  STT Server      │
                               │  :5002       │  │  Telugu Wav2Vec2 │
                               │  99.36% acc  │  │  :5001           │
                               └──────────────┘  └──────────────────┘
                                              ▼
                               ┌──────────────────────────┐
                               │  RAG Server  :5003        │
                               │  Llama 3.2 (Ollama local)│
                               │  ChromaDB vector store    │
                               │  Google Translate → తెలుగు│
                               │  edge-TTS MohanNeural    │
                               └──────────────────────────┘
                                              ▲
                               ┌──────────────┴──────────┐
                               │  ngrok Static Tunnel     │
                               │  wobble-colt-length      │
                               │  .ngrok-free.dev         │
                               └─────────────────────────┘
                                              ▲
                               ┌──────────────┴──────────┐
                               │  Real WhatsApp           │
                               │  (Twilio Sandbox)        │
                               └─────────────────────────┘

  Voice Query ──► Wav2Vec2 STT ──► RAG (Llama) ──► Google Translate ──► MohanNeural TTS ──► WhatsApp Voice
  Crop Image  ──► disease_server.py ──► MobileNetV2 ──► Disease + Treatment (Telugu)
```

---

## Project Structure

```
csp/
├── start.ps1                      ← One-click startup (all services)
├── requirements.txt               ← Python dependencies
├── voice/                         ← Telugu MP3 audio files (GitHub-hosted)
│   ├── greeting_new.mp3
│   ├── price_normal.mp3
│   └── ... (21 more)
│
├── server/                        ← Node.js + Express backend
│   ├── server.js                  ← Entry point, spawns Python services + ngrok
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
│   │   ├── whatsapp.js            ← Real Twilio WhatsApp webhook + RAG + disease
│   │   ├── disease.js             ← Disease detection API (calls Python server)
│   │   └── twilio.js              ← Legacy Twilio handler
│   └── python/                    ← Python ML/AI services
│       ├── disease_server.py      ← Disease inference HTTP server (port 5002)
│       ├── stt_server.py          ← Telugu Wav2Vec2 STT server (port 5001)
│       ├── rag_server.py          ← RAG AI server: Llama+ChromaDB+TTS (port 5003)
│       ├── rag_ingest.py          ← Knowledge base ingestion into ChromaDB
│       ├── tts.py                 ← edge-TTS wrapper (te-IN-MohanNeural)
│       ├── train_v2.py            ← 2-phase MobileNetV2 training script
│       ├── models/                ← Trained model weights (not in git)
│       │   └── class_labels.json  ← 38 PlantVillage class names
│       ├── rag_knowledge/         ← Agricultural knowledge base (markdown)
│       │   ├── crops/             ← Paddy, tomato, cotton, chilli, groundnut...
│       │   ├── diseases/          ← PlantVillage disease reference
│       │   ├── schemes/           ← PM-KISAN, PMFBY, Annadata Sukhibhava...
│       │   ├── pesticides/        ← AP pesticide guide
│       │   └── weather/           ← AP weather patterns
│       ├── rag_db/                ← ChromaDB vector store (auto-generated)
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
- [Ollama](https://ollama.com/) with `llama3.2:3b` model pulled
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

# Pull local LLM (required for RAG)
ollama pull llama3.2:3b

# Ingest knowledge base into ChromaDB (run once)
python server/python/rag_ingest.py
```

---

## One-Click Startup

The Node.js server now **automatically manages all services** including ngrok. Just run:

```powershell
# Terminal 1 — All backend services (API + STT + Disease + RAG + ngrok)
cd server
node server.js

# Terminal 2 — Admin dashboard
cd client
npm run dev
```

When `node server.js` starts, it automatically:
- Spawns **STT Server** (port 5001) — Telugu Wav2Vec2
- Spawns **Disease Server** (port 5002) — MobileNetV2
- Spawns **RAG Server** (port 5003) — Llama 3.2 + ChromaDB
- Starts **ngrok tunnel** (auto-restarts if it drops)

### Access Points

| Service | URL |
|---------|-----|
| API Server | `http://localhost:5000` |
| Admin Dashboard | `http://localhost:5173` |
| STT Server | `http://localhost:5001` |
| Disease AI | `http://localhost:5002` |
| RAG AI | `http://localhost:5003` |
| WhatsApp Webhook | `https://wobble-colt-length.ngrok-free.dev/api/whatsapp` |

> **Note:** Vite dev server listens on IPv6 (`::1`). Always use `localhost:5173` (not `127.0.0.1:5173`) in the browser.

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

### RAG AI (port 5003)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/rag/query` | Query RAG: `{ query, language, context }` → `{ answer, answer_telugu, sources, confidence }` |
| POST | `/rag/tts` | Generate Telugu audio: `{ text, filename }` → MP3 |
| GET | `/health` | RAG server health |

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

### Message Routing Logic

All messages are intelligently routed:

| Message Type | Handler | Response Time |
|---|---|---|
| `Hello` / `hi` / `start` | Instant greeting | < 2s |
| `paddy mandi price` | Instant price card | < 2s |
| `stop` / `unsubscribe` | Instant confirmation | < 2s |
| Any agricultural question | RAG AI (async) | 30-90s |
| 🎤 Voice message | STT → RAG AI → TTS voice reply | 60-120s |
| 📸 Crop photo | Disease detection AI | 30-60s |

### RAG AI Flow (for text queries)

```
User: "What type of diseases occurs to paddy crop?"
         │
         ▼
1. Immediate ack: "⏳ Searching knowledge base... (30-90 sec)"
         │
         ▼
2. Async: RAG retrieves top 7 knowledge chunks from ChromaDB
         │
         ▼
3. Llama 3.2 generates 10-15 sentence detailed answer
         │
         ▼
4. Google Translate → proper Telugu Unicode (తెలుగు)
         │
         ▼
5. Long answer auto-split into 2-4 WhatsApp messages (≤1500 chars each)
         │
         ▼
6. sendWA() sends each part with 500ms gap
```

### Voice Message Flow

```
User sends 🎤 Telugu voice note
         │
         ▼
1. Download OGG from Twilio (with auth)
         │
         ▼
2. ffmpeg: OGG → 16kHz mono WAV (with loudnorm)
         │
         ▼
3. Wav2Vec2 STT: WAV → Telugu transcript text
         │
         ▼
4. RAG AI: transcript → detailed answer (English + Telugu)
         │
         ▼
5. edge-TTS (te-IN-MohanNeural): Telugu text → MP3
         │
         ▼
6. WhatsApp: text reply + voice note audio
```

### Intent Keywords

| Intent | Telugu | English |
|--------|--------|------------|
| Price | ధర, మండి, మార్కెట్ | price, mandi, market rate |
| Greeting | నమస్కారం | hello, hi, start, menu |
| Unsubscribe | ఆపు | stop, unsubscribe |
| **Everything else** | **RAG AI** | **Any agricultural question** |

---

## Real WhatsApp Integration (Twilio + ngrok)

### Requirements
- Free [Twilio account](https://www.twilio.com/try-twilio)
- ngrok with a free static domain

### Setup Steps

**1. Start all services:**
```powershell
cd server
node server.js   # This also starts ngrok automatically
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

### Example Conversation (Real WhatsApp)
```
You:  Hello
Bot:  🌾 Welcome! RythuMitra సేవలు: [menu]

You:  What type of diseases occurs to paddy crop?
Bot:  ⏳ "What type of diseases..." processing... (30-90 sec)
      [60s later...]
Bot:  🤖 Paddy (rice) is susceptible to several major diseases...
      [Part 2] Blast disease caused by Magnaporthe oryzae...
      [Part 3] 🔤 తెలుగులో: వరి పంటలో అనేక వ్యాధులు...

You:  [sends crop photo]
Bot:  🌿 Tomato Early Blight detected (94% confidence)
      💊 Treatment: Spray Mancozeb 2.5g/L every 10 days...
      🌱 Organic: Neem oil spray...

You:  🎤 [Telugu voice: "వరి ధర ఎంత?"]
Bot:  STT: "వరి ధర ఎంత"
      🎤 [Voice reply in Telugu]
      🌾 వరి — గుంటూరు: ₹2,050/quintal
```

---

## Voice Audio System

RythuMitra uses **Microsoft Neural TTS** (`te-IN-MohanNeural`) via `edge-tts` for natural Telugu voice replies.

### Dynamic Voice Generation (RAG replies)

Every RAG AI answer is converted to speech:
1. RAG generates English answer
2. Google Translate → Telugu Unicode
3. `edge-tts` → `te-IN-MohanNeural` → MP3 audio
4. Audio served via ngrok URL
5. Sent as WhatsApp voice note

### Static Audio Files (23 total — IVR + greeting)

| File | Trigger |
|------|---------|
| `greeting_new.mp3` | New user hello / returning user hello |
| `price_normal.mp3` | Price query (normal market) |
| `price_spike_up.mp3` | Price >10% above 7-day average |
| `price_spike_down.mp3` | Price >10% below 7-day average |
| `schemes_intro.mp3` | Scheme query |
| `weather_normal.mp3` | Clear weather forecast |
| `weather_rain_warning.mp3` | Heavy rain warning |
| `loan_kcc.mp3` | KCC / NABARD loan info |
| `unsubscribe.mp3` | Stop / unsubscribe |
| `error_unknown.mp3` | Unknown intent / fallback |
| `ivr_main_menu.mp3` | IVR main menu prompt |
| ... | (12 more) |

### Regenerate Static Voice Files
```powershell
pip install edge-tts
python server/python/utils/generate_voices.py
```

---

## RAG AI Knowledge System

The RAG (Retrieval-Augmented Generation) system answers any agricultural question using a local knowledge base + local LLM — **no internet required** (except Google Translate for Telugu).

### Architecture

```
Query: "tomato disease treatment"
         │
         ▼
ChromaDB: retrieve top 7 relevant chunks
(all-MiniLM-L6-v2 embeddings, cosine similarity)
         │
         ▼
Ollama Llama 3.2 (3B, local):
  System prompt: "You are an expert agricultural advisor for AP farmers.
  Give structured, detailed advice with specific dosages..."
  Context: [7 retrieved chunks]
  → 10-15 sentence detailed answer
         │
         ▼
Google Translate (deep-translator): English → తెలుగు Unicode
         │
         ▼
edge-TTS (te-IN-MohanNeural): Telugu text → MP3
```

### Knowledge Base Contents

| Category | Files | Content |
|---|---|---|
| Crops | paddy, tomato, cotton, chilli, groundnut | Varieties, seasons, NPK, pests, harvest |
| Diseases | plantvillage_diseases.md | All 38 PlantVillage disease classes with treatment |
| Schemes | pm_kisan, pmfby, annadata_sukhibhava | Eligibility, benefits, registration, documents |
| Pesticides | ap_pesticide_guide.md | Dosages for AP pests, fungicides, herbicides |
| Weather | ap_weather_patterns.md | Seasonal patterns, advisories |

### Ingesting New Knowledge

```powershell
# Add new .md files to server/python/rag_knowledge/
# Then re-ingest:
python server/python/rag_ingest.py
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
| Govt Schemes | 6 | PM-KISAN, Annadata Sukhibhava, PMFBY, KCC, YSR Insurance, NABARD |
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
| **Tunnel** | ngrok (static domain, auto-managed) | Expose localhost for Twilio webhook |
| **WhatsApp** | Twilio Sandbox | Real WhatsApp integration (testing) |
| **LLM** | Ollama + Llama 3.2 (3B, local) | RAG AI answer generation — offline, free |
| **Vector DB** | ChromaDB | RAG document retrieval (cosine similarity) |
| **Embeddings** | all-MiniLM-L6-v2 | Sentence embeddings for RAG |
| **Translation** | deep-translator (Google Translate) | English → Telugu Unicode |
| **Voice TTS** | edge-tts `te-IN-MohanNeural` | Microsoft Neural Telugu voice synthesis |
| **Speech-to-Text** | Telugu Wav2Vec2 (HuggingFace, local) | Voice message transcription |
| **NLP** | spaCy + custom templates | Intent classification (71 templates) |
| **Disease ML** | PyTorch + MobileNetV2 | Plant disease detection (99.36% acc) |
| **Audio CDN** | GitHub Raw CDN | Free, public MP3 hosting for Twilio media |
| **Styling** | Vanilla CSS | Dark agri-themed design system |

---

## Changelog

### v3.0 — RAG AI + Neural Voice + Full Telugu Pipeline (Latest)

- ✅ **RAG AI System** — Llama 3.2 (local, via Ollama) + ChromaDB vector store answers any agricultural question with 10-15 sentence detailed, structured advice
- ✅ **Agricultural Knowledge Base** — 10+ markdown files covering crops (paddy, tomato, cotton, chilli, groundnut), diseases (38 PlantVillage classes), schemes (PM-KISAN, PMFBY, Annadata Sukhibhava), pesticides, weather
- ✅ **Telugu Neural Voice** — Switched from gTTS (robotic) to Microsoft edge-TTS `te-IN-MohanNeural` — natural, clear Telugu voice
- ✅ **Google Translate for Telugu** — Replaced Ollama romanization (which failed to produce Telugu script) with `deep-translator` (Google Translate) for proper తెలుగు Unicode output
- ✅ **Message Auto-Split** — `sendWA()` now automatically splits replies >1500 chars into multiple WhatsApp messages (Twilio's 1600-char limit was silently blocking all RAG replies)
- ✅ **ngrok Auto-Management** — ngrok is now spawned and auto-restarted inside `server.js` alongside the Python services — no manual management needed
- ✅ **Safe Process Kill** — Server restart scripts now only kill the `LISTENING` process on :5000 (not ngrok which `CONNECTS` to :5000)
- ✅ **PYTHONUTF8=1** — Added to Python subprocess environment to ensure Telugu Unicode passes through stdout pipes correctly
- ✅ **Async RAG pipeline** — Twilio webhook responds with immediate ack (< 2s) then sends full RAG answer asynchronously (no 15s timeout errors)

### v2.0 — Disease Detection + Voice AI

- ✅ **Plant Disease Detection** — MobileNetV2 retrained with 2-phase GPU strategy: **99.36% val accuracy** (up from ~85%)
- ✅ **Persistent inference server** — `disease_server.py` loads model once at startup (~1–2s per inference, was ~15s)
- ✅ **Telugu Wav2Vec2 STT** — `stt_server.py` for transcribing voice messages locally (replaced Whisper)
- ✅ **NLP intent engine** — `nlp_intent.py` using spaCy + 71 templates for accurate Telugu/English intent detection
- ✅ **Disease Detection dashboard page** — View all submitted crop images with diagnosis results
- ✅ **Disease response on WhatsApp** — Crop photo → disease card (name, severity, treatment, organic remedy)

### v1.0 — Core Platform

- ✅ **Voice notes in WhatsApp** — 23 Telugu MP3 files hosted on GitHub raw CDN
- ✅ **ngrok static tunnel** — Replaced unstable Cloudflare tunnel with permanent ngrok free domain
- ✅ **One-click startup** — `start.ps1` launches backend + frontend + ngrok in 3 windows
- ✅ **Prices edit fix** — Edit now correctly uses `PUT /api/prices/:id`
- ✅ **Alerts filter** — Status filter buttons (all/draft/sent) now functional
- ✅ **WhatsApp Bot page fix** — Fixed JavaScript crash from `const` inside `switch` cases

---

## Notes

- **No paid APIs required** — all telephony and messaging is simulated or uses free tiers. Twilio Sandbox and ngrok free plan are both free.
- **LLM is 100% local** — Ollama + Llama 3.2 runs entirely on your machine. No OpenAI API key. No internet needed for the AI model itself.
- **Google Translate** (`deep-translator`) is used only for Telugu translation — requires internet. Can be replaced with a local translation model if needed.
- **NeDB** was chosen over SQLite (`better-sqlite3`) because it's pure JavaScript — no Visual Studio Build Tools or Windows SDK required.
- **GitHub raw CDN** is used for static audio hosting because ngrok free plan shows a browser interstitial that blocks Twilio from fetching media files.
- **Two-message TwiML** — WhatsApp silently drops `<Body>` text when combined with audio `<Media>` in the same `<Message>` element. Audio and text must be sent in separate messages.
- **Model weights not in git** — `*.pth` files are excluded (large binaries). Run `train_v2.py` to train locally, or place `plantvillage_head.pth` in `server/python/models/`.
- **Ollama cold start** — First RAG query after server restart takes 2-3 minutes (GPU model loading). Subsequent queries are 30-60 seconds.
- **Vite uses IPv6** — Dev server listens on `::1`, not `127.0.0.1`. Always use `localhost:5173` in the browser.

---

## License

This project is built as a **Community Service Project (CSP)** for academic purposes.

---

<div align="center">
  <strong>🌾 RythuMitra — రైతు మిత్ర</strong><br>
  <em>Empowering AP Farmers with Technology</em>
</div>
