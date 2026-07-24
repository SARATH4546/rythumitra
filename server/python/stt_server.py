"""
stt_server.py — Telugu STT + NLP Intent Classifier
POST /transcribe  {audio_path, language}  →  {success, transcript, intent, confidence, language}
GET  /health      → {status, model, ready}
"""
import sys, json, os, traceback, warnings, re
from http.server import HTTPServer, BaseHTTPRequestHandler

warnings.filterwarnings("ignore")
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

PORT = int(os.environ.get("STT_PORT", 5001))

# ─── 1. Load Telugu Wav2Vec2 STT model ────────────────────────────────────────
MODEL_TYPE = None
MODEL      = None
PROCESSOR  = None

try:
    import torch, soundfile as sf
    from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

    TELUGU_MODEL_ID = "Harveenchadha/vakyansh-wav2vec2-telugu-tem-100"
    print(f"[STT] Loading Telugu Wav2Vec2 ({TELUGU_MODEL_ID})...", flush=True)
    PROCESSOR = Wav2Vec2Processor.from_pretrained(TELUGU_MODEL_ID)
    MODEL     = Wav2Vec2ForCTC.from_pretrained(TELUGU_MODEL_ID)
    MODEL.eval()
    MODEL_TYPE = "vakyansh-te"
    print(f"[STT] ✅ Telugu Wav2Vec2 ready (port {PORT})", flush=True)

except Exception as e:
    print(f"[STT] ⚠️ Wav2Vec2 failed ({e}), trying Whisper medium...", flush=True)
    try:
        from faster_whisper import WhisperModel
        MODEL      = WhisperModel("medium", device="cpu", compute_type="int8")
        MODEL_TYPE = "whisper-medium"
        PROCESSOR  = None
        print(f"[STT] ✅ Whisper medium fallback ready (port {PORT})", flush=True)
    except Exception as e2:
        print(f"[STT] ❌ All STT models failed: {e2}", flush=True)


# ─── 2. Load Multilingual NLP Intent Classifier ───────────────────────────────
NLP_MODEL            = None
NLP_EMBEDDINGS       = None
NLP_LABELS           = []

# Rich Telugu example sentences per intent for semantic matching
NLP_TEMPLATES = {
    'price': [
        "ఈరోజు మండి ధర చెప్పు",
        "మార్కెట్ రేటు ఏంటి",
        "వరి ధర ఎంత",
        "పత్తి మండిలో ధర",
        "మార్కెట్ ధరలు చెప్పు",
        "ఈరోజు మండి రేట్లు",
        "కూరగాయల ధర ఎంత",
        "ధాన్యం ధర చెప్పు",
        "ధర తెలుసుకోవాలి",
        "రేట్ ఎంత ఉంది",
        "మండిలో నేడు ధర",
        "పంట ధర చెప్పండి",
        "ఈరోజు మార్కెట్ రేట్ల లాగా ఉన్నాయి",
        "market price today",
        "what is the price",
    ],
    'weather': [
        "వాతావరణం ఎలా ఉంది",
        "వర్షం వస్తుందా",
        "వాతావరణ విశేషాలు చెప్పు",
        "రేపు వర్షం ఉంటుందా",
        "ఈరోజు వాతావరణం",
        "వాన పడుతుందా",
        "వాతావరణ సమాచారం చెప్పు",
        "ఉష్ణోగ్రత ఎంత",
        "వర్షపాతం ఎంత",
        "వాతావరణ విశేషాలే",
        "రేపు వాతావరణం ఎలా ఉంటుంది",
        "weather today",
        "rain forecast",
        "will it rain tomorrow",
    ],
    'scheme': [
        "ప్రభుత్వ పథకాలు చెప్పు",
        "రైతులకు స్కీమ్ ఏమి ఉంది",
        "పీఎం కిసాన్ పథకం గురించి",
        "రైతు బంధు పథకం",
        "సబ్సిడీ పథకాలు",
        "ఏ స్కీమ్ నాకు వర్తిస్తుంది",
        "గవర్నమెంట్ సహాయం చెప్పు",
        "యోజన పథకాలు",
        "ఆర్థిక సహాయం",
        "సంక్షేమ పథకాలు",
        "ఏ స్కీమ్ లో నాకు వర్తిస్తాలి",
        "government scheme for farmers",
        "PM KISAN scheme",
    ],
    'loan': [
        "రుణం ఎలా తీసుకోవాలి",
        "బ్యాంకు అప్పు చెప్పు",
        "కేసీసీ రుణం గురించి",
        "వ్యవసాయ రుణం",
        "నాబార్డ్ రుణం",
        "రుణ సమాచారం చెప్పు",
        "వడ్డీ రేటు ఎంత",
        "పంట రుణం తీసుకోవాలి",
        "loan for farming",
        "bank credit information",
    ],
    'disease_hint': [
        # User saying THEIR crop is sick / asking to detect from photo
        "పంటకు రోగం వచ్చింది",
        "పంట ఆకు పచ్చగా లేదు",
        "చీడపురుగులు ఉన్నాయి",
        "పంట ఎండిపోతుంది",
        "ఆకులు పసుపు రంగులోకి మారాయి",
        "ఫోటో పంపి రోగం చెప్పు",
        "my crop has disease please check",
        "send photo for disease detection",
        "plant leaves turning yellow",
        "crop is dying help me",
    ],
    'greeting': [
        "నమస్కారం",
        "హలో",
        "హాయ్",
        "నమస్తే",
        "మీరు ఎవరు",
        "ఏమి చేయగలరు",
        "hello",
        "hi there",
        "start",
    ],
}

try:
    from sentence_transformers import SentenceTransformer, util as st_util
    import torch as _torch

    print("[STT] Loading multilingual NLP model...", flush=True)
    NLP_MODEL = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

    # Pre-compute all template embeddings
    _examples = []
    for intent, sentences in NLP_TEMPLATES.items():
        for s in sentences:
            _examples.append(s)
            NLP_LABELS.append(intent)

    NLP_EMBEDDINGS = NLP_MODEL.encode(_examples, convert_to_tensor=True)
    print(f"[STT] ✅ NLP intent classifier ready ({len(_examples)} templates)", flush=True)

except Exception as e:
    print(f"[STT] ⚠️ NLP intent model failed ({e}) — using keyword fallback", flush=True)


# ─── 3. NLP intent classification ─────────────────────────────────────────────
def nlp_classify(text: str, threshold: float = 0.65):
    """Return (intent, confidence) using semantic similarity.
    Threshold raised to 0.65 to prevent weak/false intent matches.
    Anything below threshold goes to 'unknown' → RAG handles it.
    """
    if NLP_MODEL is None or NLP_EMBEDDINGS is None:
        return keyword_classify(text), 0.0

    try:
        import torch
        from sentence_transformers import util as st_util

        q_emb  = NLP_MODEL.encode(text, convert_to_tensor=True)
        scores = st_util.cos_sim(q_emb, NLP_EMBEDDINGS)[0]
        best_idx   = int(torch.argmax(scores))
        best_score = float(scores[best_idx])

        # Require strong confidence; weak matches go to RAG
        intent = NLP_LABELS[best_idx] if best_score >= threshold else 'unknown'
        return intent, round(best_score, 3)
    except Exception:
        return keyword_classify(text), 0.0


def keyword_classify(text: str) -> str:
    """Fast keyword fallback — still includes Telugu script terms."""
    t = (text or '').lower()
    if any(k in t for k in ['ధర','మండి','మార్కెట్','రేట్','price','rate','mandi','market','ఈరోజు','నేటి']):
        return 'price'
    if any(k in t for k in ['వాతావరణ','వర్షం','వాన','weather','rain','forecast']):
        return 'weather'
    if any(k in t for k in ['పథకం','పథకాల','స్కీమ్','స్కేముల','గవర్నమెంట్','ప్రభుత్వ','scheme','yojana']):
        return 'scheme'
    if any(k in t for k in ['రుణం','అప్పు','బ్యాంకు','వడ్డీ','loan','credit','kcc']):
        return 'loan'
    if any(k in t for k in ['రోగం','ఆకు','ఫోటో','పురుగు','disease','photo','pest']):
        return 'disease_hint'
    if any(k in t for k in ['నమస్కారం','hello','hi','start','నమస్తే']):
        return 'greeting'
    return 'unknown'


# ─── 4. Transcription functions ───────────────────────────────────────────────
def transcribe_wav2vec2(audio_path):
    import soundfile as sf, torch, numpy as np
    audio, sample_rate = sf.read(audio_path)
    if sample_rate != 16000:
        ratio   = 16000 / sample_rate
        new_len = int(len(audio) * ratio)
        audio   = np.interp(np.linspace(0, len(audio)-1, new_len), np.arange(len(audio)), audio)
    if hasattr(audio, 'ndim') and audio.ndim > 1:
        audio = audio.mean(axis=1)
    inputs = PROCESSOR(audio, sampling_rate=16000, return_tensors="pt", padding=True)
    with torch.no_grad():
        logits = MODEL(**inputs).logits
    predicted_ids = torch.argmax(logits, dim=-1)
    transcript    = PROCESSOR.batch_decode(predicted_ids)[0]
    transcript    = re.sub(r'<s>', '', transcript).strip()
    return transcript


def transcribe_whisper(audio_path):
    PROMPT = "ధర, మార్కెట్, రేటు, మండి, వాతావరణం, వర్షం, పంట రోగం, రుణం, పథకం, నమస్కారం"
    segs, info = MODEL.transcribe(
        audio_path, language="te", initial_prompt=PROMPT,
        beam_size=5, best_of=5, temperature=[0.0, 0.2],
        vad_filter=False, condition_on_previous_text=False, without_timestamps=True,
    )
    return " ".join(s.text.strip() for s in segs).strip(), info.language


# ─── 5. HTTP Handler ──────────────────────────────────────────────────────────
class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args): pass

    def do_GET(self):
        self._json({
            "status": "ok",
            "model":  MODEL_TYPE,
            "nlp":    NLP_MODEL is not None,
            "ready":  MODEL is not None,
        })

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        body   = json.loads(self.rfile.read(length)) if length else {}
        audio  = body.get('audio_path', '')

        if not audio or not os.path.exists(audio):
            return self._json({"success": False, "error": f"File not found: {audio}"})
        if MODEL is None:
            return self._json({"success": False, "error": "No STT model loaded"})

        try:
            # 1. Transcribe
            if MODEL_TYPE == "vakyansh-te":
                transcript = transcribe_wav2vec2(audio)
                lang = "te"
            else:
                transcript, lang = transcribe_whisper(audio)

            # 2. NLP intent classification
            intent, confidence = nlp_classify(transcript)

            result = {
                "success":    True,
                "transcript": transcript,
                "intent":     intent,
                "confidence": confidence,
                "language":   lang,
                "model":      MODEL_TYPE,
            }
            self._json(result)

            try:
                print(f"[STT] {MODEL_TYPE} | {repr(transcript[:50])} → intent={intent} ({confidence})", flush=True)
            except Exception:
                pass

        except Exception as e:
            print(f"[STT] Error: {e}", flush=True)
            self._json({"success": False, "error": str(e), "trace": traceback.format_exc()})

    def _json(self, data, code=200):
        b = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', len(b))
        self.end_headers()
        self.wfile.write(b)


if __name__ == "__main__":
    server = HTTPServer(('127.0.0.1', PORT), Handler)
    print(f"[STT] Listening on http://127.0.0.1:{PORT}", flush=True)
    server.serve_forever()
