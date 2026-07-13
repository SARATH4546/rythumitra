"""
nlp_intent.py - NLP-based Telugu Intent Classifier
Uses multilingual sentence transformers (paraphrase-multilingual-MiniLM-L12-v2)
to classify Telugu speech into intents via semantic similarity.

No keyword matching — understands meaning regardless of word form or suffix.
"""

import sys, json, os
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')

# ── Intent templates — diverse Telugu examples per intent ─────────────────────
TEMPLATES = {
    'price': [
        "ఈరోజు మండి ధర చెప్పు",
        "మార్కెట్ రేటు ఏంటి",
        "వరి ధర ఎంత",
        "పత్తి మండిలో ధర చెప్పు",
        "మార్కెట్ ధరలు",
        "ఈరోజు మండి రేట్లు",
        "కూరగాయల ధర",
        "ధాన్యం ధర ఎంత",
        "ధర తెలుసుకోవాలి",
        "రేట్ ఎంత ఉంది",
        "మండిలో నేడు ధర",
        "ఈ వారం ధర",
        "పంట ధర చెప్పండి",
        "market price today",
    ],
    'weather': [
        "వాతావరణం ఎలా ఉంది",
        "వర్షం వస్తుందా",
        "వాతావరణ విశేషాలు చెప్పు",
        "రేపు వర్షం ఉంటుందా",
        "ఈరోజు వాతావరణం",
        "వాన పడుతుందా",
        "వాతావరణ సమాచారం",
        "ఉష్ణోగ్రత ఎంత",
        "గాలి వేగం ఎంత",
        "వర్షపాతం ఎంత",
        "weather today",
        "rain forecast",
    ],
    'scheme': [
        "ప్రభుత్వ పథకాలు చెప్పు",
        "రైతులకు స్కీమ్ ఏమి ఉంది",
        "పీఎం కిసాన్ పథకం గురించి చెప్పు",
        "రైతు బంధు స్కీమ్",
        "సబ్సిడీ పథకాలు",
        "సంక్షేమ పథకాలు",
        "ఏ స్కీమ్ నాకు వర్తిస్తుంది",
        "గవర్నమెంట్ సహాయం",
        "యోజన పథకాలు",
        "ఆర్థిక సహాయం",
        "government scheme",
        "farmer scheme",
    ],
    'loan': [
        "రుణం ఎలా తీసుకోవాలి",
        "బ్యాంకు అప్పు చెప్పు",
        "కేసీసీ రుణం గురించి",
        "వ్యవసాయ రుణం",
        "నాబార్డ్ రుణం",
        "రుణ సమాచారం",
        "వడ్డీ రేటు ఎంత",
        "పంట రుణం తీసుకోవాలి",
        "loan information",
        "credit card kisan",
    ],
    'disease': [
        "పంట ఆకు పచ్చగా లేదు",
        "పంటకు రోగం వచ్చింది",
        "చీడపురుగులు ఉన్నాయి",
        "పంట ఎండిపోతుంది",
        "ఆకులు పసుపు రంగులోకి మారాయి",
        "పంటకు సమస్య ఉంది",
        "మొక్కలు చనిపోతున్నాయి",
        "crop disease problem",
        "plant sick yellow leaves",
    ],
    'greeting': [
        "నమస్కారం",
        "హలో",
        "హాయ్",
        "నమస్తే",
        "start",
        "menu చెప్పు",
        "help కావాలి",
        "hello",
        "hi there",
    ],
}

# ── Build flat list of (text, intent) pairs ───────────────────────────────────
EXAMPLES = []
LABELS   = []
for intent, sentences in TEMPLATES.items():
    for s in sentences:
        EXAMPLES.append(s)
        LABELS.append(intent)


def load_model():
    from sentence_transformers import SentenceTransformer
    # Multilingual model — works for Telugu, Hindi, English, 50+ languages
    model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    return model


def classify(text: str, model, template_embeddings, threshold: float = 0.30):
    """Return (intent, confidence) for given Telugu text."""
    from sentence_transformers import util
    import torch

    q_emb = model.encode(text, convert_to_tensor=True)
    scores = util.cos_sim(q_emb, template_embeddings)[0]
    best_idx   = int(torch.argmax(scores))
    best_score = float(scores[best_idx])

    if best_score < threshold:
        return 'unknown', best_score

    return LABELS[best_idx], best_score


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Usage: python nlp_intent.py <text>'}))
        sys.exit(1)

    text = sys.argv[1]

    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

    print('[NLP] Loading multilingual model...', file=sys.stderr, flush=True)
    model = load_model()

    import torch
    from sentence_transformers import SentenceTransformer
    template_embeddings = model.encode(EXAMPLES, convert_to_tensor=True)
    print('[NLP] Model ready.', file=sys.stderr, flush=True)

    intent, confidence = classify(text, model, template_embeddings)
    print(json.dumps({
        'text':       text,
        'intent':     intent,
        'confidence': round(confidence, 3),
    }, ensure_ascii=False))
