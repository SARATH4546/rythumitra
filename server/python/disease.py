"""
disease.py — Local Crop Disease Detection using Deep Learning (TensorFlow + PlantVillage)
Usage: python disease.py <image_path> [crop_hint]
Output: JSON with disease diagnosis

Model: MobileNetV2 fine-tuned on PlantVillage dataset (38 disease classes)
Model is auto-downloaded on first run (~14MB) from GitHub releases.
Runs entirely on CPU, no API key needed.
"""
import sys, json, os, traceback
import urllib.request

# ─── PlantVillage 38-class labels ────────────────────────────────────────────
CLASSES = [
    "Apple___Apple_scab",           "Apple___Black_rot",
    "Apple___Cedar_apple_rust",     "Apple___healthy",
    "Blueberry___healthy",          "Cherry_(including_sour)___Powdery_mildew",
    "Cherry_(including_sour)___healthy",
    "Corn_(maize)___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn_(maize)___Common_rust",   "Corn_(maize)___Northern_Leaf_Blight",
    "Corn_(maize)___healthy",       "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)", "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",              "Orange___Haunglongbing_(Citrus_greening)",
    "Peach___Bacterial_spot",       "Peach___healthy",
    "Pepper,_bell___Bacterial_spot","Pepper,_bell___healthy",
    "Potato___Early_blight",        "Potato___Late_blight",
    "Potato___healthy",             "Raspberry___healthy",
    "Soybean___healthy",            "Squash___Powdery_mildew",
    "Strawberry___Leaf_scorch",     "Strawberry___healthy",
    "Tomato___Bacterial_spot",      "Tomato___Early_blight",
    "Tomato___Late_blight",         "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",  "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",         "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus", "Tomato___healthy",
]

# ─── Telugu disease names and treatments ──────────────────────────────────────
TELUGU_INFO = {
    "Apple_scab":            {"te": "ఆపిల్ పొరల తెగులు",   "sev": "moderate"},
    "Black_rot":             {"te": "నల్ల కుళ్ళు తెగులు",  "sev": "severe"},
    "Cedar_apple_rust":      {"te": "తుప్పు తెగులు",         "sev": "moderate"},
    "Powdery_mildew":        {"te": "పొడి తెగులు",           "sev": "moderate"},
    "Cercospora_leaf_spot":  {"te": "సెర్కోస్పోరా మచ్చ",    "sev": "moderate"},
    "Common_rust":           {"te": "సాధారణ తుప్పు",         "sev": "moderate"},
    "Northern_Leaf_Blight":  {"te": "ఉత్తర ఆకు తెగులు",    "sev": "severe"},
    "Esca_(Black_Measles)":  {"te": "ఎస్కా తెగులు",          "sev": "severe"},
    "Leaf_blight":           {"te": "ఆకు ముడత తెగులు",      "sev": "severe"},
    "Haunglongbing":         {"te": "సిట్రస్ గ్రీనింగ్",    "sev": "severe"},
    "Bacterial_spot":        {"te": "బ్యాక్టీరియా మచ్చ తెగులు","sev":"moderate"},
    "Early_blight":          {"te": "ముందు కాలం తెగులు",    "sev": "moderate"},
    "Late_blight":           {"te": "చివరి కాలం తెగులు",    "sev": "severe"},
    "Leaf_Mold":             {"te": "ఆకు బూజు తెగులు",      "sev": "moderate"},
    "Septoria_leaf_spot":    {"te": "సెప్టోరియా మచ్చ",      "sev": "moderate"},
    "Spider_mites":          {"te": "సాలె పురుగు తెగులు",   "sev": "moderate"},
    "Target_Spot":           {"te": "టార్గెట్ మచ్చ తెగులు", "sev": "mild"},
    "Yellow_Leaf_Curl_Virus":{"te": "పసుపు ఆకు వైరస్",      "sev": "severe"},
    "mosaic_virus":          {"te": "మొజాయిక్ వైరస్",       "sev": "severe"},
    "Leaf_scorch":           {"te": "ఆకు కాలిన తెగులు",     "sev": "moderate"},
}

TREATMENTS = {
    "moderate": [
        "Mancozeb లేదా Copper Oxychloride స్ప్రే చేయండి",
        "వ్యాధిగ్రస్త ఆకులను తొలగించి నాశనం చేయండి",
        "సమతుల్య ఎరువులు వాడి మొక్క శక్తిని పెంచండి",
    ],
    "severe": [
        "వెంటనే వ్యవసాయ అధికారిని సంప్రదించండి",
        "వ్యాధిగ్రస్త మొక్కలను పొలం నుండి తొలగించండి",
        "Systemic fungicide ని సిఫార్సు చేసిన మోతాదులో వాడండి",
        "నీటి పారుదల నిర్వహణ మెరుగుపరచండి",
    ],
    "mild": [
        "Neem oil స్ప్రే (5ml/litre) చేయండి",
        "మొక్కల మధ్య దూరం పెంచండి",
        "మొక్కలకు తగినంత గాలి, వెలుతురు అందేలా చూసుకోండి",
    ],
}

ORGANIC = {
    "moderate": "వేప నూనె (5మి.లీ/లీటర్) + పసుపు పొడి (2గ్రా/లీటర్) కలిపి వారంలో 2 సార్లు స్ప్రే చేయండి.",
    "severe":   "వేగంగా వ్యవసాయ అధికారిని సంప్రదించండి. ఈలోగా రోగగ్రస్త భాగాలు తొలగించండి.",
    "mild":     "వేప నూనె స్ప్రే (5మి.లీ/లీటర్) వారానికి ఒకసారి సరిపోతుంది.",
}


def get_model_path():
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(here, "models", "plant_disease_mobilenetv2.h5")


def download_model(model_path):
    """Download pre-trained PlantVillage MobileNetV2 model on first run."""
    os.makedirs(os.path.dirname(model_path), exist_ok=True)
    # Hosted on GitHub Releases (free, no authentication)
    url = "https://github.com/SARATH4546/rythumitra/releases/download/v2.0/plant_disease_mobilenetv2.h5"
    print(f"[Disease] Downloading model (~14MB)...", file=sys.stderr)
    try:
        urllib.request.urlretrieve(url, model_path)
        print(f"[Disease] Model downloaded to {model_path}", file=sys.stderr)
        return True
    except Exception as e:
        print(f"[Disease] Download failed: {e}", file=sys.stderr)
        return False


def parse_class(class_name):
    """Parse PlantVillage class name into plant, disease, healthy."""
    parts = class_name.split("___")
    plant   = parts[0].replace("_", " ") if len(parts) > 0 else "Unknown"
    disease = parts[1].replace("_", " ") if len(parts) > 1 else "unknown"
    is_healthy = "healthy" in disease.lower()
    return plant, disease, is_healthy


def get_telugu_info(disease_key):
    """Match disease key to Telugu info dict."""
    for k, v in TELUGU_INFO.items():
        if k.lower().replace("_", "") in disease_key.lower().replace("_", "").replace(" ", ""):
            return v
    return {"te": disease_key, "sev": "moderate"}


def predict(image_path, crop_hint=""):
    try:
        import numpy as np
        from PIL import Image
        import tensorflow as tf  # noqa

        model_path = get_model_path()
        if not os.path.exists(model_path):
            if not download_model(model_path):
                return fallback_diagnosis(crop_hint)

        # Load model (cached in memory for single inference; Node.js spawns per request)
        model = tf.keras.models.load_model(model_path)

        # Preprocess image (MobileNetV2 expects 224×224 RGB, normalized)
        img = Image.open(image_path).convert("RGB").resize((224, 224))
        arr = np.array(img, dtype=np.float32) / 255.0
        arr = np.expand_dims(arr, axis=0)  # shape (1, 224, 224, 3)

        preds = model.predict(arr, verbose=0)[0]
        top_idx  = int(np.argmax(preds))
        top_conf = float(preds[top_idx])

        class_name          = CLASSES[top_idx]
        plant, disease_raw, is_healthy = parse_class(class_name)
        tel_info = get_telugu_info(disease_raw)
        severity = "healthy" if is_healthy else tel_info.get("sev", "moderate")

        # Top-3 predictions
        top3_idx = np.argsort(preds)[::-1][:3]
        alternatives = [
            {"class": CLASSES[int(i)], "confidence": round(float(preds[i]), 3)}
            for i in top3_idx[1:]
        ]

        confidence_label = "high" if top_conf > 0.7 else "medium" if top_conf > 0.4 else "low"

        return {
            "success":       True,
            "plant":         plant,
            "disease":       disease_raw if not is_healthy else "Healthy",
            "telugu_disease": "ఆరోగ్యంగా ఉంది" if is_healthy else tel_info["te"],
            "is_healthy":    is_healthy,
            "severity":      severity,
            "confidence":    confidence_label,
            "confidence_score": round(top_conf, 3),
            "treatment":     [] if is_healthy else TREATMENTS.get(severity, TREATMENTS["moderate"]),
            "organic_remedy": "" if is_healthy else ORGANIC.get(severity, ORGANIC["moderate"]),
            "telugu_summary": build_telugu_summary(plant, tel_info, is_healthy, severity),
            "alternatives":  alternatives,
            "model":         "PlantVillage-MobileNetV2-local",
        }

    except ImportError as e:
        return {"success": False, "error": f"Missing package: {e}. Run: pip install tensorflow Pillow numpy"}
    except Exception as e:
        return {"success": False, "error": str(e), "trace": traceback.format_exc()}


def build_telugu_summary(plant, tel_info, is_healthy, severity):
    if is_healthy:
        return f"మీ {plant} పంట ఆరోగ్యంగా ఉంది! ఎటువంటి వ్యాధి కనుగొనబడలేదు. ప్రస్తుత సేద్య పద్ధతులు కొనసాగించండి."
    sev_te = {"mild": "తక్కువ", "moderate": "మధ్యస్థ", "severe": "తీవ్రమైన"}.get(severity, "")
    return (
        f"మీ {plant} పంటలో {tel_info['te']} కనుగొనబడింది. "
        f"తీవ్రత: {sev_te}. "
        f"వెంటనే చికిత్స చేయకపోతే దిగుబడి తగ్గవచ్చు. "
        f"{'వ్యవసాయ అధికారిని సంప్రదించండి.' if severity == 'severe' else 'క్రింది చికిత్స పాటించండి.'}"
    )


def fallback_diagnosis(crop_hint):
    """Fallback when model not available — rule-based."""
    return {
        "success":        True,
        "plant":          crop_hint or "మీ పంట",
        "disease":        "Analysis unavailable",
        "telugu_disease": "విశ్లేషణ అందుబాటులో లేదు",
        "is_healthy":     False,
        "severity":       "unknown",
        "confidence":     "low",
        "confidence_score": 0.0,
        "treatment":      ["సమీప వ్యవసాయ అధికారిని సంప్రదించండి", "KVK helpline: 1800-180-1551"],
        "organic_remedy": "వేప నూనె స్ప్రే (5ml/litre) ప్రయత్నించండి.",
        "telugu_summary": "మోడల్ లోడ్ కాలేదు. దయచేసి setup.py రన్ చేసి మోడల్ డౌన్‌లోడ్ చేయండి.",
        "model":          "fallback",
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: python disease.py <image_path> [crop_hint]"}))
        sys.exit(1)

    image_path = sys.argv[1]
    crop_hint  = sys.argv[2] if len(sys.argv) > 2 else ""

    if not os.path.exists(image_path):
        print(json.dumps({"success": False, "error": f"File not found: {image_path}"}))
        sys.exit(1)

    result = predict(image_path, crop_hint)
    print(json.dumps(result, ensure_ascii=False))
