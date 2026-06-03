# 🌾 RythuMitra — Farmer Information Platform

> **AI-powered IVR + WhatsApp bot for Andhra Pradesh farmers**  
> Real-time mandi prices · Government schemes · Weather advisories · Loan info

![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs) ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) ![Express](https://img.shields.io/badge/Express-4-000000?logo=express) ![NeDB](https://img.shields.io/badge/NeDB-pure%20JS-green) ![Twilio](https://img.shields.io/badge/Twilio-WhatsApp-F22F46?logo=twilio) ![Cloudflare](https://img.shields.io/badge/Cloudflare-Tunnel-F38020?logo=cloudflare)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [API Reference](#api-reference)
- [IVR Simulator](#ivr-simulator)
- [WhatsApp Bot](#whatsapp-bot)
- [Real WhatsApp Integration](#real-whatsapp-integration-twilio)
- [Admin Dashboard](#admin-dashboard)
- [Seed Data](#seed-data)
- [Tech Stack](#tech-stack)

---

## Overview

**RythuMitra** (రైతు మిత్ర — "Farmer's Friend") is a full-stack farmer information system designed for Andhra Pradesh. Farmers receive real-time mandi prices, government scheme alerts, and weather advisories via **IVR missed-call callback** and **WhatsApp bot** — no smartphone or internet required.

The platform includes an **Admin Dashboard** for agricultural officers to manage prices, schemes, alerts, and view analytics.

---

## Features

| Feature | Description |
|---------|-------------|
| 📞 **IVR Simulator** | Full DTMF keypad flow — missed call → price/scheme/weather/loan menu |
| 💬 **WhatsApp Bot** | Telugu + English intent detection, price cards, scheme cards, weather |
| 📊 **Mandi Prices** | Real-time prices for 20 crops × 13 AP districts, spike detection (>15%) |
| 📋 **Govt Schemes** | PM-KISAN, Rythu Bharosa, PMFBY, KCC, YSR Insurance, NABARD |
| 📢 **Alert Broadcasts** | Target by district + crop, WhatsApp/SMS delivery tracking |
| 📈 **Analytics** | IVR call logs, WhatsApp intents, farmer growth, district leaderboard |
| 👨‍🌾 **Farmer Registry** | 120+ farmers, CRUD, filter by district/crop/channel |

---

## Architecture

```
┌─────────────────┐     DTMF/API     ┌────────────────────┐
│  IVR Simulator  │ ───────────────► │                    │
│  (React UI)     │                  │  Express.js API    │
├─────────────────┤     REST/JSON    │  (Port 5000)       │
│  WhatsApp Bot   │ ◄──────────────► │                    │
│  Simulator      │                  │  NeDB (pure JS)    │
├─────────────────┤                  │  file-based DB     │
│  Admin Dashboard│ ◄──────────────► │                    │
│  (React/Vite)   │                  └────────────────────┘
└─────────────────┘                           ▲
                                              │ Twilio Webhook
                                   ┌──────────┴──────────┐
                                   │  Cloudflare Tunnel   │
                                   │  (Public HTTPS URL)  │
                                   └─────────────────────┘
                                              ▲
                                   ┌──────────┴──────────┐
                                   │  Real WhatsApp       │
                                   │  (Twilio Sandbox)    │
                                   └─────────────────────┘
```

---

## Project Structure

```
d:\Minor's\csp\
├── server/                        ← Node.js + Express backend
│   ├── server.js                  ← Entry point, route mounts
│   ├── package.json
│   ├── db/
│   │   ├── database.js            ← NeDB datastore setup + auto-seed
│   │   ├── seed.js                ← Realistic mock data generator
│   │   ├── farmers.db             ← Auto-generated on first run
│   │   ├── prices.db
│   │   ├── schemes.db
│   │   ├── alerts.db
│   │   ├── ivr_calls.db
│   │   ├── wa.db
│   │   └── history.db
│   └── routes/
│       ├── farmers.js             ← CRUD + pagination + search
│       ├── prices.js              ← Prices + spike detection + history
│       ├── schemes.js             ← Govt schemes CRUD
│       ├── alerts.js              ← Draft → send broadcast flow
│       ├── analytics.js           ← Aggregated metrics
│       ├── ivr.js                 ← IVR call simulation engine
│       ├── whatsapp.js            ← WhatsApp bot (dashboard simulator)
│       └── twilio.js              ← Real WhatsApp via Twilio webhook
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
            ├── Alerts.jsx         ← Compose + send + delivery rate
            ├── Analytics.jsx      ← 4-tab analytics view
            ├── IVRSimulator.jsx   ← Phone keypad UI
            └── WhatsAppBot.jsx    ← Chat UI with rich cards
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm v9 or higher

### Installation

```powershell
# Clone or navigate to project
cd "d:\Minor's\csp"

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ..\client
npm install
```

### Running the App

Open **two terminal windows**:

**Terminal 1 — Backend API:**
```powershell
cd "d:\Minor's\csp\server"
node server.js
```
> API running at **http://localhost:5000**  
> Database auto-seeds with 120 farmers, prices, 6 schemes, 350 IVR calls on first run.

**Terminal 2 — Frontend:**
```powershell
cd "d:\Minor's\csp\client"
npm run dev
```
> Dashboard at **http://localhost:5173**

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
| GET | `/api/farmers/stats/summary` | Farmer statistics |

#### Query Params — GET /api/farmers
```
?page=1&limit=15&search=raju&district=Guntur&crop=Chilli&channel=whatsapp
```

### Mandi Prices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/prices` | All prices (filterable) |
| POST | `/api/prices` | Add / override price |
| DELETE | `/api/prices/:id` | Delete price entry |
| GET | `/api/prices/spikes` | Prices with >15% change vs 7-day avg |
| GET | `/api/prices/history?crop=Chilli&district=Guntur` | 7-day history |

### Schemes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/schemes` | All schemes |
| POST | `/api/schemes` | Create scheme |
| PUT | `/api/schemes/:id` | Update / toggle active |
| DELETE | `/api/schemes/:id` | Delete scheme |

### Alerts
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/alerts` | All alerts |
| POST | `/api/alerts` | Create draft alert |
| POST | `/api/alerts/:id/send` | Send draft alert |
| DELETE | `/api/alerts/:id` | Delete alert |

### Analytics
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/analytics/summary` | Platform KPIs |
| GET | `/api/analytics/calls/daily` | IVR call volume (30d) |
| GET | `/api/analytics/whatsapp/daily` | WA session volume (30d) |
| GET | `/api/analytics/farmers/growth` | Monthly registration (6m) |
| GET | `/api/analytics/districts` | District leaderboard |
| GET | `/api/analytics/whatsapp/intents` | Intent breakdown |
| GET | `/api/analytics/ivr/menus` | IVR menu selection stats |

### IVR Simulation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ivr/call` | Start simulated call |
| POST | `/api/ivr/dtmf` | Send DTMF key press |
| POST | `/api/ivr/end` | End call |
| GET | `/api/ivr/logs` | Recent call logs |

### WhatsApp Bot
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/whatsapp/message` | Send message to bot |
| POST | `/api/whatsapp/register` | Register farmer via WA |
| GET | `/api/whatsapp/sessions` | Recent WA sessions |

### Twilio Webhook
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/twilio/webhook` | Twilio WhatsApp webhook |
| GET | `/api/twilio/webhook` | Health check for Twilio |

---

## IVR Simulator

The IVR simulator replicates the farmer's experience when they give a **missed call** to the RythuMitra toll-free number.

**Menu Flow:**
```
[Missed Call Received]
       │
       ▼
  [Main Menu]
  ┌─ 1 → Today's mandi price (auto-fetches for farmer's crop+district)
  ├─ 2 → Government schemes list
  ├─ 3 → Weather forecast for district
  ├─ 4 → Loan & credit info (KCC, NABARD)
  ├─ 5 → Transfer to human agent
  ├─ 9 → Re-registration menu
  └─ 0 → Repeat menu
  
  [Registration Menu — for new farmers]
  ┌─ 1–7 → Select district
  └─ [Crop Menu] 1–5 → Select crop → Auto-registered
```

---

## WhatsApp Bot

### Intent Detection Keywords

| Intent | Telugu | English |
|--------|--------|---------|
| Price | ధర, ధరలు | price, rate, mandi |
| Schemes | పథకం, పథకాలు | scheme, yojana |
| Weather | వాతావరణం, వర్షం | weather, rain, forecast |
| Loan | రుణం | loan, kcc, credit |
| Greeting | నమస్కారం | hello, hi, start, menu |
| Unsubscribe | ఆపు | stop, unsubscribe |

### Response Types (Dashboard Simulator)
- `text` — Plain text message with Telugu translation
- `voice_note` — Simulated audio waveform UI
- `price_card` — Min/Modal/Max price card with source
- `scheme_card` — Scheme name, benefit, deadline
- `weather_card` — 3-day forecast cards
- `loan_card` — KCC + NABARD loan details
- `price_chart` — 7-day price trend mini bar chart
- `quick_reply` — Tap-to-reply option buttons

---

## Real WhatsApp Integration (Twilio)

### Requirements
- Free [Twilio account](https://www.twilio.com/try-twilio) (no credit card)
- Public URL via Cloudflare Tunnel

### Setup Steps

**1. Start Cloudflare Tunnel:**
```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://localhost:5000
```
Note the generated URL (e.g. `https://xxxx.trycloudflare.com`)

**2. Join Twilio WhatsApp Sandbox:**
- Go to: Twilio Console → Messaging → Try it out → Send a WhatsApp message
- Save `+1 (415) 523-8886` as a contact
- Send `join <your-sandbox-code>` to that number on WhatsApp

**3. Set Webhook URL in Twilio:**
```
When a message comes in: https://xxxx.trycloudflare.com/api/twilio/webhook
Method: POST
```

**4. Chat!** Send `Hello` to get started.

### Registration Flow (Real WhatsApp)
```
You: Hello
Bot: Welcome! Send your district name...

You: Guntur
Bot: Guntur selected! Now send your crop name...

You: Paddy
Bot: ✅ Registered! + Today's Paddy price in Guntur

You: ధర
Bot: 🌾 Paddy — Guntur Mandi: ₹2,050/quintal
```

---

## Admin Dashboard

| Page | Features |
|------|----------|
| **Overview** | 6 KPI cards, area chart (calls), bar chart (WA sessions), pie chart (districts), leaderboard |
| **Farmers** | Searchable table, filter by district/crop/channel, add/edit/delete modal |
| **Mandi Prices** | Today's prices, ⚡ spike alerts (>15%), manual override with source tagging |
| **Schemes** | Card view, activate/deactivate toggle, CRUD with deadline tracking |
| **Alerts** | Compose with targeting (district + crop + channel), draft → send, delivery rate bar |
| **Analytics** | 4 tabs: IVR logs, WA intents (pie), farmer growth (bar), district leaderboard |
| **IVR Simulator** | Full phone keypad, live call transcript, Telugu audio labels |
| **WhatsApp Bot** | Real chat UI, price/scheme/weather/loan cards, quick replies |

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
| **Tunnel** | Cloudflare Tunnel | Expose localhost to internet |
| **WhatsApp** | Twilio Sandbox | Real WhatsApp integration (testing) |
| **Styling** | Vanilla CSS | Dark agri-themed design system |

---

## Notes

- **No paid APIs required** — all telephony and messaging is simulated. Twilio Sandbox is free.
- **NeDB** was chosen over SQLite (`better-sqlite3`) because it's pure JavaScript — no Visual Studio Build Tools or Windows SDK required for compilation.
- **Cloudflare Tunnel** is used instead of ngrok/localtunnel because it has no password-gating that would block Twilio webhook requests.
- Telugu text in responses is for display/demo purposes — in production, this would be passed to a TTS engine.

---

## License

This project is built as a **Computer Science Project (CSP)** for academic purposes.

---

<div align="center">
  <strong>🌾 RythuMitra — రైతు మిత్ర</strong><br>
  <em>Empowering AP Farmers with Technology</em>
</div>
