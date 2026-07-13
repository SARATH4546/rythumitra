"""
disease_server.py — Persistent disease detection HTTP server
Loads PyTorch model ONCE at startup, then handles requests quickly (~1-2s each).
GET  /health   → {status, classes, ready}
POST /predict  {image_path} → {success, plant, disease, confidence, treatment...}
"""
import sys, json, os, traceback
from http.server import HTTPServer, BaseHTTPRequestHandler

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

PORT        = int(os.environ.get("DISEASE_PORT", 5002))
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH  = os.path.join(SCRIPT_DIR, "models", "plantvillage_head.pth")
LABELS_PATH = os.path.join(SCRIPT_DIR, "models", "class_labels.json")

TREATMENTS = {
    "healthy":  ["Your crop looks healthy! Keep monitoring regularly."],
    "mild":     ["Apply neem oil spray (5ml/L water)", "Remove affected leaves", "Improve air circulation"],
    "moderate": ["Apply appropriate fungicide/pesticide", "Remove severely affected parts", "Consult agricultural officer: 1800-180-1551"],
    "severe":   ["Immediate treatment required — contact agricultural department", "Apply systemic fungicide", "Isolate affected plants"],
}
ORGANIC = {
    "mild":     "Neem oil spray or turmeric paste on affected areas",
    "moderate": "Bordeaux mixture or copper sulfate solution (1%)",
    "severe":   "Consult agricultural officer for organic treatment plan",
}

# Telugu crop name translations (PlantVillage class → Telugu + common English)
CROP_NAMES = {
    "Apple":          "యాపిల్ (Apple)",
    "Blueberry":      "బ్లూబెర్రీ (Blueberry)",
    "Cherry":         "చెర్రీ (Cherry)",
    "Cherry (including sour)": "చెర్రీ (Cherry)",
    "Corn (maize)":   "మొక్కజొన్న (Maize)",
    "Corn":           "మొక్కజొన్న (Maize)",
    "Grape":          "ద్రాక్ష (Grape)",
    "Orange":         "నారింజ (Orange)",
    "Peach":          "పీచ్ పండు (Peach)",
    "Pepper, bell":   "మిరప / కాప్సికమ్ (Capsicum)",
    "Pepper":         "మిరప (Pepper)",
    "Potato":         "బంగాళాదుంప (Potato)",
    "Raspberry":      "రాస్‌బెర్రీ (Raspberry)",
    "Soybean":        "సోయాబీన్ (Soybean)",
    "Squash":         "గుమ్మడికాయ (Squash)",
    "Strawberry":     "స్ట్రాబెర్రీ (Strawberry)",
    "Tomato":         "టమాటో (Tomato)",
    "Cotton":         "పత్తి (Cotton)",
    "Rice":           "వరి (Rice)",
    "Wheat":          "గోధుమ (Wheat)",
    "Sugarcane":      "చెరకు (Sugarcane)",
    "Groundnut":      "వేరుశనగ (Groundnut)",
    "Mango":          "మామిడి (Mango)",
    "Banana":         "అరటి (Banana)",
    "Chili":          "మిరప (Chili)",
}

def get_telugu_crop(plant_name: str) -> str:
    """Return Telugu-translated crop name, falling back to original."""
    for key, val in CROP_NAMES.items():
        if key.lower() in plant_name.lower() or plant_name.lower() in key.lower():
            return val
    return plant_name   # fallback: return original if no mapping found

# ── Load labels ──────────────────────────────────────────────────────────────
print(f"[Disease] Loading labels from {LABELS_PATH} ...", flush=True)
with open(LABELS_PATH, encoding='utf-8') as f:
    raw = json.load(f)

idx2name = {}
idx2info = {}
for name, info in raw.items():
    idx = info['index']                         # guaranteed int from training
    idx2name[idx] = name
    idx2info[idx] = info

CLASS_LABELS = [idx2name[i] for i in range(len(idx2name))]
CLASS_INFO   = [idx2info[i] for i in range(len(idx2info))]
print(f"[Disease] {len(CLASS_LABELS)} classes loaded. e.g. [{CLASS_LABELS[0]}, ..., {CLASS_LABELS[-1]}]", flush=True)

# ── Load model ───────────────────────────────────────────────────────────────
print(f"[Disease] Loading model from {MODEL_PATH} ...", flush=True)
MODEL     = None
TRANSFORM = None

try:
    import torch
    from torchvision import transforms, models

    net = models.mobilenet_v2(weights=None)
    net.classifier[1] = torch.nn.Linear(net.last_channel, len(CLASS_LABELS))
    ckpt = torch.load(MODEL_PATH, map_location='cpu', weights_only=True)
    net.load_state_dict(ckpt)
    net.eval()
    MODEL = net

    TRANSFORM = transforms.Compose([
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    print(f"[Disease] ✅ Model ready on port {PORT}", flush=True)
except Exception as e:
    print(f"[Disease] ❌ Model load error: {e}", flush=True)
    traceback.print_exc()

# ── Prediction ───────────────────────────────────────────────────────────────
def predict(image_path):
    if MODEL is None:
        return {"success": False, "error": "Model not loaded"}
    try:
        import torch
        from PIL import Image

        img  = Image.open(image_path).convert('RGB')
        t    = TRANSFORM(img).unsqueeze(0)
        with torch.no_grad():
            out   = MODEL(t)
            probs = torch.softmax(out, dim=1)[0]

        top_idx  = int(probs.argmax())
        top_conf = float(probs[top_idx])

        label    = CLASS_LABELS[top_idx]              # "Tomato___Early_blight"
        info     = CLASS_INFO[top_idx]
        parts    = label.split('___')
        plant_raw = info.get('crop', parts[0]).replace('_', ' ')
        plant    = get_telugu_crop(plant_raw)          # ← Telugu translation
        disease  = parts[1].replace('_', ' ') if len(parts) > 1 else label.replace('_', ' ')
        sev      = info.get('sev', 'moderate')

        is_healthy = 'healthy' in disease.lower()
        severity   = 'healthy' if is_healthy else sev
        low_conf   = top_conf < 0.70                  # flag uncertain predictions

        # Top-3 alternatives with Telugu crop names
        alts = []
        for i in probs.topk(4).indices.tolist()[1:]:
            alt_label   = CLASS_LABELS[i]
            alt_parts   = alt_label.split('___')
            alt_info    = CLASS_INFO[i]
            alt_plant_r = alt_info.get('crop', alt_parts[0]).replace('_', ' ')
            alt_plant   = get_telugu_crop(alt_plant_r)
            alt_disease = alt_parts[1].replace('_', ' ') if len(alt_parts) > 1 else alt_label.replace('_', ' ')
            alts.append({
                "label":      f"{alt_plant} — {alt_disease}",
                "confidence": round(float(probs[i]) * 100),
            })

        return {
            "success":          True,
            "plant":            plant,
            "plant_raw":        plant_raw,
            "disease":          disease,
            "is_healthy":       is_healthy,
            "severity":         severity,
            "confidence_score": round(top_conf, 3),
            "confidence":       f"{round(top_conf * 100)}%",
            "low_confidence":   low_conf,
            "treatment":        TREATMENTS.get(severity, TREATMENTS['moderate']),
            "organic_remedy":   ORGANIC.get(severity, ""),
            "alternatives":     alts,
            "model":            "PlantVillage-MobileNetV2",
        }

    except Exception as e:
        return {"success": False, "error": str(e), "trace": traceback.format_exc()}

# ── HTTP Server ───────────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass   # suppress access logs

    def do_GET(self):
        self._json({"status": "ok", "classes": len(CLASS_LABELS), "ready": MODEL is not None})

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body   = json.loads(self.rfile.read(length)) if length else {}
        img    = body.get('image_path', '')
        if not img or not os.path.exists(img):
            return self._json({"success": False, "error": f"File not found: {img}"})
        self._json(predict(img))

    def _json(self, data, code=200):
        b = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(b))
        self.end_headers()
        self.wfile.write(b)

if __name__ == "__main__":
    server = HTTPServer(('127.0.0.1', PORT), Handler)
    print(f"[Disease] Listening on http://127.0.0.1:{PORT}", flush=True)
    server.serve_forever()
