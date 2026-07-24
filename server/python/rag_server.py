"""
rag_server.py — RythuMitra RAG HTTP Server (port 5003)
Uses Ollama (llama3.2:3b) running locally — no internet, no limits, no API key.
FastAPI server: receives farmer queries, retrieves relevant knowledge chunks,
generates answers using local LLM, returns answers in English.
"""
import os, sys, re
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONUTF8"] = "1"

from pathlib import Path
from dotenv import load_dotenv

# Load .env from server/
load_dotenv(Path(__file__).resolve().parents[1] / ".env")

# ── Config ─────────────────────────────────────────────────────────────────────
CHROMA_DIR      = Path(__file__).resolve().parent / "rag_db"
COLLECTION_NAME = "rythumitra_kb"
PORT            = 5003
TOP_K           = 7   # retrieve 7 chunks for richer context

# Ollama settings — runs locally, no key needed
OLLAMA_HOST     = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL    = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

# ── FastAPI app ────────────────────────────────────────────────────────────────
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn, requests as req_lib

app = FastAPI(title="RythuMitra RAG Server", version="2.0")
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"]
)

# ── Globals ────────────────────────────────────────────────────────────────────
collection   = None
ollama_ready = False

# ── Schemas ────────────────────────────────────────────────────────────────────
class QueryRequest(BaseModel):
    query:    str
    language: str  = "en"
    context:  dict = {}

class QueryResponse(BaseModel):
    answer:         str
    answer_telugu:  str       = ""   # Telugu translation of answer
    sources:        list[str] = []
    confidence:     float     = 0.0
    chunks_used:    int       = 0
    llm:            str       = "ollama"

class TTSRequest(BaseModel):
    text:     str
    lang:     str = "te"   # te = Telugu
    filename: str = ""

# ── Startup ────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def startup():
    global collection, ollama_ready

    # Load ChromaDB
    print(f"[RAG] Connecting to ChromaDB at {CHROMA_DIR}...")
    import chromadb
    from chromadb.utils import embedding_functions
    db_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )
    try:
        collection = db_client.get_collection(name=COLLECTION_NAME, embedding_function=ef)
        print(f"[RAG] Collection loaded — {collection.count()} chunks")
    except Exception as e:
        print(f"[RAG] WARNING: Collection not found: {e}")
        print("[RAG] Run: python server/python/rag_ingest.py")

    # Check Ollama
    print(f"[RAG] Checking Ollama at {OLLAMA_HOST}...")
    try:
        r = req_lib.get(f"{OLLAMA_HOST}/api/tags", timeout=5)
        models = [m["name"] for m in r.json().get("models", [])]
        if any(OLLAMA_MODEL in m for m in models):
            ollama_ready = True
            print(f"[RAG] Ollama ready — model: {OLLAMA_MODEL}")
        else:
            print(f"[RAG] WARNING: Model '{OLLAMA_MODEL}' not found in Ollama.")
            print(f"[RAG] Available: {models}")
            print(f"[RAG] Run: ollama pull {OLLAMA_MODEL}")
    except Exception as e:
        print(f"[RAG] WARNING: Ollama not reachable: {e}")
        print(f"[RAG] Make sure Ollama is running.")

    print(f"[RAG] Server ready on http://127.0.0.1:{PORT}")

# ── Health ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health():
    chunks = collection.count() if collection else 0
    return {
        "status":     "ok",
        "chunks":     chunks,
        "ollama":     ollama_ready,
        "model":      OLLAMA_MODEL,
        "collection": COLLECTION_NAME
    }

# ── Smart fallback when Ollama is loading ──────────────────────────────────────
def _smart_chunk_answer(chunks: list[str], query: str) -> str:
    query_words = set(re.findall(r'\b\w{4,}\b', query.lower()))
    best, seen  = [], set()

    for chunk in chunks[:3]:
        clean = re.sub(r'^#{1,4}\s+', '', chunk, flags=re.MULTILINE)
        clean = re.sub(r'\|.*?\|', '', clean)
        clean = re.sub(r'-{3,}', '', clean).strip()
        for sent in re.split(r'(?<=[.!?])\s+', clean):
            sent = sent.strip()
            if len(sent) < 30 or sent in seen:
                continue
            seen.add(sent)
            score = len(set(re.findall(r'\b\w{4,}\b', sent.lower())) & query_words)
            best.append((score, sent))

    best.sort(key=lambda x: -x[0])
    sents = [s for _, s in best[:5]]
    if not sents:
        return chunks[0][:500] if chunks else "No information found."
    ans = " ".join(sents)
    return ans[:600].rsplit(' ', 1)[0] + "..." if len(ans) > 600 else ans

# ── Call Ollama ────────────────────────────────────────────────────────────────
def _ollama_generate(prompt: str) -> str:
    payload = {
        "model":  OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.3,
            "num_predict": 800,
            "top_p":       0.9,
            "top_k":       40,
            "stop":        ["\n\nFarmer", "\n\nQuestion", "Human:", "User:"]
        }
    }
    r = req_lib.post(
        f"{OLLAMA_HOST}/api/generate",
        json=payload,
        timeout=120
    )
    r.raise_for_status()
    return r.json().get("response", "").strip()

# ── Translate English answer to Telugu using Google Translate (deep-translator) ──
def _translate_to_telugu(english_text: str) -> str:
    """
    Translate English agricultural answer to Telugu Unicode script.
    Uses deep-translator (Google Translate backend) — free, no API key needed.
    Ollama 3b cannot generate Telugu Unicode script (only romanized text).
    """
    try:
        from deep_translator import GoogleTranslator

        # Split long text into chunks (Google Translate limit: 5000 chars)
        MAX_CHUNK = 4500
        if len(english_text) <= MAX_CHUNK:
            result = GoogleTranslator(source='en', target='te').translate(english_text)
        else:
            # Split by sentences and translate in chunks
            sentences = english_text.split('. ')
            chunks, current = [], ''
            for s in sentences:
                if len(current) + len(s) < MAX_CHUNK:
                    current += s + '. '
                else:
                    chunks.append(current.strip())
                    current = s + '. '
            if current:
                chunks.append(current.strip())
            translated_chunks = [GoogleTranslator(source='en', target='te').translate(c) for c in chunks]
            result = ' '.join(translated_chunks)

        # Validate: must contain Telugu Unicode characters (0C00–0C7F)
        telugu_count = sum(1 for c in result if '\u0c00' <= c <= '\u0c7f')
        if telugu_count > 5:
            print(f"[RAG] Telugu translation: {len(result)} chars, {telugu_count} Telugu chars")
            return result
        print(f"[RAG] Translation had no Telugu script ({telugu_count} chars) — skipping")
        return ""
    except Exception as e:
        print(f"[RAG] Telugu translation error: {e}")
        return ""

# ── TTS endpoint — generate Telugu audio using gTTS ───────────────────────────
@app.post("/rag/tts")
async def generate_tts(req: TTSRequest):
    """Generate Telugu audio from text using gTTS. Returns audio file path."""
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="text cannot be empty")
    try:
        from gtts import gTTS
        import tempfile, uuid
        audio_dir  = Path(__file__).resolve().parents[1] / "audio"
        audio_dir.mkdir(exist_ok=True)
        fname      = req.filename or f"rag_tts_{uuid.uuid4().hex[:8]}.mp3"
        audio_path = str(audio_dir / fname)
        tts = gTTS(text=req.text, lang=req.lang, slow=False)
        tts.save(audio_path)
        print(f"[RAG TTS] Generated {fname} ({len(req.text)} chars)")
        return {"success": True, "path": audio_path, "filename": fname}
    except Exception as e:
        print(f"[RAG TTS] Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Main RAG endpoint ──────────────────────────────────────────────────────────
@app.post("/rag/query", response_model=QueryResponse)
async def rag_query(req: QueryRequest):
    query = req.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="query cannot be empty")

    # Step 1 — Retrieve relevant chunks
    chunks_text, sources, confidence = [], [], 0.0

    if collection and collection.count() > 0:
        try:
            enriched = query
            if req.context.get("farmer_crop"):
                enriched = f"{req.context['farmer_crop']} crop: {query}"
            if req.context.get("district"):
                enriched += f" in {req.context['district']} Andhra Pradesh"

            results = collection.query(
                query_texts=[enriched],
                n_results=min(TOP_K, collection.count()),
                include=["documents", "metadatas", "distances"]
            )
            if results["documents"] and results["documents"][0]:
                chunks_text = results["documents"][0]
                metas       = results["metadatas"][0]
                distances   = results["distances"][0]
                if distances:
                    confidence = round(max(0.0, 1.0 - sum(distances)/len(distances)/2.0), 2)
                sources = list({m.get("source", "unknown") for m in metas})
        except Exception as e:
            print(f"[RAG] Retrieval error: {e}")

    # Step 2 — Generate answer with Ollama
    answer = ""
    llm_used = "fallback"

    if ollama_ready and chunks_text:
        context_text = "\n\n---\n\n".join(chunks_text[:TOP_K])

        farmer_ctx = ""
        parts = []
        if req.context.get("farmer_crop"):
            parts.append(f"Crop: {req.context['farmer_crop']}")
        if req.context.get("district"):
            parts.append(f"District: {req.context['district']}, Andhra Pradesh")
        if req.context.get("farmer_name"):
            parts.append(f"Farmer: {req.context['farmer_name']}")
        if parts:
            farmer_ctx = "Farmer details: " + ", ".join(parts) + "\n\n"

        prompt = f"""You are RythuMitra, an expert agricultural advisor for Andhra Pradesh (AP) farmers. Answer in clear, practical English.

{farmer_ctx}KNOWLEDGE BASE:
{context_text}

FARMER'S QUESTION: {query}

INSTRUCTIONS:
- Give a COMPLETE and DETAILED answer (10-15 sentences)
- Structure your answer clearly:
  1. Directly answer the question first
  2. List specific step-by-step actions the farmer should take
  3. Include exact dosages, quantities, or measurements where relevant (e.g. 2.5 g/L, 120 kg/ha)
  4. Mention the best timing or season for the action
  5. List any precautions or warnings
  6. End with: "For more help, call 1800-180-1551"
- Use ONLY information from the KNOWLEDGE BASE above
- If the answer is not in the knowledge base, say: "Please contact your local KVK or agriculture officer at 1800-180-1551."
- Do NOT make up any facts, numbers, or chemical names
- Write in a friendly, helpful tone — like an experienced farmer advisor

ANSWER:"""

        try:
            answer   = _ollama_generate(prompt)
            llm_used = f"ollama/{OLLAMA_MODEL}"
            print(f"[RAG] Ollama answered ({len(answer)} chars)")
        except Exception as e:
            print(f"[RAG] Ollama error: {e}")
            answer = _smart_chunk_answer(chunks_text, query)

    elif chunks_text:
        answer = _smart_chunk_answer(chunks_text, query)
    else:
        answer = "No relevant information found. Please contact your local KVK or agriculture officer at 1800-180-1551."

    # Step 3 — Translate to Telugu
    telugu_answer = ""
    if answer and ollama_ready:
        telugu_answer = _translate_to_telugu(answer)
        if telugu_answer:
            print(f"[RAG] Telugu translation ready ({len(telugu_answer)} chars)")

    return QueryResponse(
        answer=answer,
        answer_telugu=telugu_answer,
        sources=sources,
        confidence=confidence,
        chunks_used=len(chunks_text),
        llm=llm_used
    )

# ── List categories ────────────────────────────────────────────────────────────
@app.get("/rag/categories")
def list_categories():
    if not collection:
        return {"categories": [], "total_chunks": 0}
    results = collection.get(include=["metadatas"])
    cats    = list({m.get("category", "?") for m in results["metadatas"]})
    return {"categories": sorted(cats), "total_chunks": collection.count()}

# ── Quick test ─────────────────────────────────────────────────────────────────
@app.get("/rag/test")
async def test_rag():
    return await rag_query(QueryRequest(
        query="How do I treat tomato late blight?",
        context={"farmer_crop": "Tomato", "district": "Guntur"}
    ))

# ── Entry ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print(f"[RAG] Starting RythuMitra RAG server on port {PORT}...")
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
