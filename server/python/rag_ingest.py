"""
rag_ingest.py — RythuMitra RAG Knowledge Base Ingestion
Run: python server/python/rag_ingest.py
"""
import os, sys
os.environ.setdefault('PYTHONIOENCODING', 'utf-8')
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
"""
Chunks, embeds, and stores all knowledge base documents into ChromaDB.
Run once (or re-run to refresh): python server/python/rag_ingest.py
"""
import os, sys, glob, hashlib
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
BASE_DIR   = Path(__file__).resolve().parent
KB_DIR     = BASE_DIR / "rag_knowledge"
CHROMA_DIR = BASE_DIR / "rag_db"

# ── Lazy imports (after pip install) ──────────────────────────────────────────
def main():
    try:
        import chromadb
        from chromadb.utils import embedding_functions
        from langchain_text_splitters import RecursiveCharacterTextSplitter
    except ImportError as e:
        print(f"Missing package: {e}")
        print("Run: pip install chromadb langchain-text-splitters sentence-transformers")
        sys.exit(1)

    print("=" * 60)
    print("RythuMitra RAG — Knowledge Base Ingestion")
    print("=" * 60)

    # ── ChromaDB client with local persistence ─────────────────────────────────
    print(f"\n[1] Connecting to ChromaDB at: {CHROMA_DIR}")
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))

    # ── Embedding function (local sentence-transformers) ───────────────────────
    print("[2] Loading embedding model (all-MiniLM-L6-v2)...")
    ef = embedding_functions.SentenceTransformerEmbeddingFunction(
        model_name="all-MiniLM-L6-v2"
    )

    # ── Get or create collection ───────────────────────────────────────────────
    collection_name = "rythumitra_kb"
    try:
        client.delete_collection(collection_name)
        print(f"[3] Cleared old collection: {collection_name}")
    except Exception:
        pass
    collection = client.create_collection(
        name=collection_name,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}
    )
    print(f"[3] Created fresh collection: {collection_name}")

    # ── Text splitter ──────────────────────────────────────────────────────────
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=600,
        chunk_overlap=80,
        separators=["\n## ", "\n### ", "\n\n", "\n", " "]
    )

    # ── Find all markdown files ────────────────────────────────────────────────
    md_files = sorted(glob.glob(str(KB_DIR / "**/*.md"), recursive=True))
    pdf_files = sorted(glob.glob(str(KB_DIR / "**/*.pdf"), recursive=True))
    all_files = md_files + pdf_files

    if not all_files:
        print(f"\n⚠  No files found in {KB_DIR}")
        print("   Make sure knowledge base docs are in server/python/rag_knowledge/")
        sys.exit(1)

    print(f"\n[4] Found {len(md_files)} markdown + {len(pdf_files)} PDF files")

    # ── Ingest each file ───────────────────────────────────────────────────────
    total_chunks = 0
    ids, docs, metas = [], [], []

    for fpath in all_files:
        rel = os.path.relpath(fpath, KB_DIR)
        category = Path(fpath).parent.name

        # Read file content
        content = ""
        if fpath.endswith(".md"):
            with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read().strip()
        elif fpath.endswith(".pdf"):
            try:
                from pypdf import PdfReader
                reader = PdfReader(fpath)
                content = "\n".join(p.extract_text() or "" for p in reader.pages).strip()
            except Exception as e:
                print(f"   ⚠  Could not read PDF {rel}: {e}")
                continue

        if len(content) < 50:
            print(f"   ⚠  Skipping empty file: {rel}")
            continue

        # Split into chunks
        chunks = splitter.split_text(content)
        file_hash = hashlib.md5(fpath.encode()).hexdigest()[:8]

        for i, chunk in enumerate(chunks):
            chunk_id = f"{file_hash}_{i}"
            ids.append(chunk_id)
            docs.append(chunk)
            metas.append({
                "source": rel.replace("\\", "/"),
                "category": category,
                "file": Path(fpath).name,
                "chunk": i
            })

        total_chunks += len(chunks)
        print(f"   OK  {rel}  ({len(chunks)} chunks)")

    # ── Batch upsert into ChromaDB ─────────────────────────────────────────────
    print(f"\n[5] Embedding & storing {total_chunks} chunks...")
    BATCH = 100
    for start in range(0, len(ids), BATCH):
        end = min(start + BATCH, len(ids))
        collection.upsert(
            ids=ids[start:end],
            documents=docs[start:end],
            metadatas=metas[start:end]
        )
        pct = int(end / len(ids) * 100)
        print(f"    Progress: {end}/{len(ids)} ({pct}%)", end="\r")

    print(f"\n\n{'='*60}")
    print(f"DONE! {total_chunks} chunks from {len(all_files)} files indexed.")
    print(f"   DB location: {CHROMA_DIR}")
    print(f"   Collection : {collection_name}")
    print(f"   Start RAG  : python server/python/rag_server.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
