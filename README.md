# 🌾 RythuMitra — AI Agricultural Assistant

> **Telugu:** రైతు మిత్ర | *Farmer's Friend*

RythuMitra is an AI-powered WhatsApp bot + admin dashboard designed for Indian farmers. It provides real-time crop disease detection, market prices, weather alerts, government scheme information, and voice-based interaction — all in Telugu.

---

## 🚀 Key Features

| Feature | Details |
|---|---|
| 🤖 **WhatsApp Bot** | Twilio-powered chatbot with NLP intent detection |
| 🌿 **Disease Detection** | MobileNetV2 deep learning — **99.36% validation accuracy** |
| 🗣️ **Voice Interaction** | Telugu TTS (gTTS) + STT (Whisper) voice responses |
| 📊 **Admin Dashboard** | React dashboard with analytics, farmer records, disease logs |
| 💰 **Market Prices** | Live crop price queries |
| 🌦️ **Weather Alerts** | Real-time weather information |
| 📋 **Govt Schemes** | PM-Kisan, PMFBY, Rythu Bharosa info |
| 🔍 **NLP Intent Engine** | spaCy + keyword NLP for accurate intent classification |

---

## 🏗️ Tech Stack

### Backend
- **Node.js** + Express — WhatsApp webhook, REST API
- **Python** — ML inference server (Flask/HTTP), STT server
- **NeDB** — Lightweight embedded database
- **Twilio** — WhatsApp & Voice messaging

### Frontend
- **React** + Vite — Admin dashboard
- **Recharts** — Analytics charts

### Machine Learning
- **PyTorch** + MobileNetV2 — Plant disease detection
- **Whisper (OpenAI)** — Speech-to-text (local)
- **gTTS** — Text-to-speech (Telugu)
- **spaCy** — NLP intent classification

---

## 📁 Project Structure

```
csp/
├── client/                     # React admin dashboard (Vite)
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.jsx       # Overview stats
│       │   ├── DiseaseDetection.jsx # Disease logs + images
│       │   ├── WhatsAppBot.jsx     # Bot conversation simulator
│       │   ├── Farmers.jsx         # Farmer registry
│       │   └── Analytics.jsx       # Charts & analytics
│       └── components/
├── server/                     # Node.js backend
│   ├── server.js               # Main Express server (port 5000)
│   ├── routes/
│   │   ├── whatsapp.js         # Twilio webhook handler
│   │   ├── disease.js          # Disease detection API
│   │   ├── analytics.js        # Analytics API
│   │   └── farmers.js          # Farmer management API
│   ├── python/                 # Python ML services
│   │   ├── disease_server.py   # Disease inference HTTP server (port 5002)
│   │   ├── stt_server.py       # Speech-to-text HTTP server (port 5001)
│   │   ├── train_v2.py         # 2-phase MobileNetV2 training script
│   │   ├── disease.py          # Disease prediction logic
│   │   ├── tts.py              # Telugu text-to-speech
│   │   ├── stt.py              # Whisper STT wrapper
│   │   ├── nlp_intent.py       # spaCy NLP intent classifier
│   │   └── models/             # Trained model weights (not in git)
│   │       └── class_labels.json
│   └── db/                     # NeDB database files (auto-created)
├── test_data/                  # 114 test images (3 per class × 38 classes)
├── test_disease_model.py       # Model accuracy test script
├── requirements.txt            # Python dependencies
├── start.ps1                   # One-click startup script (Windows)
└── README.md
```

---

## 🧠 Disease Detection Model

| Metric | Value |
|---|---|
| Architecture | MobileNetV2 (ImageNet pretrained) |
| Dataset | PlantVillage (54,305 images, 38 classes) |
| Training | 2-phase: head-only → backbone unfreeze |
| Val Accuracy | **99.36%** |
| Test Accuracy | **94.74%** (114 held-out images) |
| Avg Confidence | 91.9% |
| Training Time | ~55 min on RTX 3050 (GPU) |

### Classes Supported (38)
Apple, Blueberry, Cherry, Corn (Maize), Grape, Orange, Peach, Pepper, Potato, Raspberry, Soybean, Squash, Strawberry, Tomato — each with healthy + disease variants.

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js 18+
- Python 3.12+ (for training with GPU) / Python 3.14 (for inference)
- Twilio account with WhatsApp Sandbox
- ngrok (for webhook tunneling)

### 1. Clone & Install
```bash
git clone https://github.com/SARATH4546/rythumitra.git
cd rythumitra

# Install Node dependencies
cd server && npm install
cd ../client && npm install
cd ..
```

### 2. Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Environment Variables
Create `server/.env`:
```env
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
PORT=5000
```

### 4. Download Model Weights
The trained model weights are not in git (large binary files).
```bash
# Option A: Train from scratch (requires PlantVillage dataset)
python server/python/train_v2.py --dataset /path/to/plantvillage/color

# Option B: Place pre-trained weights manually
# Copy plantvillage_head.pth → server/python/models/
```

### 5. Start All Services

**Windows (one command):**
```powershell
.\start.ps1
```

**Manual:**
```bash
# Terminal 1 — Node API server
cd server && node server.js

# Terminal 2 — Disease detection server (Python)
python server/python/disease_server.py

# Terminal 3 — STT server (Python)
python server/python/stt_server.py

# Terminal 4 — Admin dashboard
cd client && npm run dev

# Terminal 5 — ngrok tunnel
ngrok http 5000
```

---

## 🤖 WhatsApp Bot Setup

1. Go to [Twilio Console](https://console.twilio.com) → Messaging → Try it Out → Send a WhatsApp message
2. Set webhook URL: `https://YOUR_NGROK_URL/api/whatsapp`
3. Send `join <sandbox-word>` on WhatsApp to connect
4. Start chatting: "tomato disease", "wheat price", "PM-Kisan scheme"

---

## 📱 Admin Dashboard

Open `http://localhost:5173` after starting the frontend.

| Page | Description |
|---|---|
| Dashboard | Overview: farmers, detections, bot sessions |
| Disease Detection | All submitted plant images + ML results |
| WhatsApp Bot | Bot simulator + conversation logs |
| Farmers | Farmer registry with location & crop info |
| Analytics | Charts: disease trends, crop distribution |

---

## 🧪 Testing the Model

```bash
# Run accuracy test on 114 held-out test images
python test_disease_model.py

# Verbose mode (shows every prediction)
python test_disease_model.py --verbose
```

---

## 🔄 Retraining the Model

```bash
# Phase 1 only (fast, CPU-friendly, ~87-97% accuracy)
python server/python/train_v2.py \
  --dataset /path/to/PlantVillage/color \
  --phase1-epochs 5 --phase2-epochs 0

# Full 2-phase training (GPU recommended, ~99% accuracy)
python server/python/train_v2.py \
  --dataset /path/to/PlantVillage/color \
  --phase1-epochs 5 --phase2-epochs 5
```

### GPU Setup (for faster training)
```bash
# Create Python 3.12 environment (required for CUDA PyTorch)
py -3.12 -m venv train_venv
train_venv\Scripts\pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121

# Run training with GPU
train_venv\Scripts\python server/python/train_v2.py --dataset /path/to/color
```

---

## 📊 Training Progress (Reference)

| Epoch | Phase | Train Acc | Val Acc |
|---|---|---|---|
| 1 | Head-only | 89.9% | 95.88% |
| 3 | Head-only | 95.7% | 96.41% |
| 4 | Head-only | 95.6% | **97.14%** |
| 6 (P2-1) | Backbone | 96.7% | 98.16% |
| 7 (P2-2) | Backbone | 98.7% | 99.00% |
| 10 (P2-5) | Backbone | **99.9%** | **99.36%** |

---

## 📜 License

MIT License — Built for the Minor Project, Computer Science Department.

---

## 👨‍💻 Author

**Sarath** — [GitHub: SARATH4546](https://github.com/SARATH4546)

> *"Empowering farmers with AI, one WhatsApp message at a time."* 🌾
