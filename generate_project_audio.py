"""
generate_project_audio.py
Generates a professional LinkedIn narration audio for RythuMitra project.
Uses edge-tts (Microsoft Neural TTS) for high-quality English voice.
"""
import asyncio, edge_tts, os, sys

SCRIPT = """
Introducing RythuMitra — the AI-powered Farmer's Friend for Andhra Pradesh.

Indian farmers face a daily struggle — no quick access to crop prices, disease alerts, or government scheme information.
RythuMitra solves this through WhatsApp and voice, technologies every farmer already uses.

Here's how it works.

A farmer sends a simple text — or even a voice message — on WhatsApp.
Our NLP engine, built with spaCy, instantly understands their intent — whether it's crop prices, weather, schemes, or loans —
and replies in Telugu with voice notes and rich cards.

And the most powerful feature? Plant disease detection.
A farmer simply sends a photo of their crop.
Our deep learning model — MobileNetV2 fine-tuned on the PlantVillage dataset —
diagnoses the disease in under two seconds, with 99.36 percent validation accuracy.
It also provides treatment recommendations and organic remedies, right on WhatsApp.

The admin dashboard gives agricultural officers full visibility —
farmer registry, mandi prices, government schemes, analytics, and real-time disease detection logs.

The stack: Node dot js, React, Python, PyTorch, Whisper STT, and Twilio —
all running locally, with no paid APIs required.

RythuMitra — empowering AP farmers with AI, one WhatsApp message at a time.
"""

OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "rythumitra_narration.mp3")
VOICE = "en-IN-NeerjaNeural"   # Indian English female voice (Microsoft Neural)
RATE  = "-5%"                   # Slightly slower — clear and professional

async def generate():
    print(f"Generating audio with voice: {VOICE}")
    print(f"Output: {OUTPUT_FILE}")
    communicate = edge_tts.Communicate(SCRIPT.strip(), VOICE, rate=RATE)
    await communicate.save(OUTPUT_FILE)
    size_kb = os.path.getsize(OUTPUT_FILE) / 1024
    print(f"Done! File size: {size_kb:.1f} KB")
    print(f"Saved to: {OUTPUT_FILE}")

if __name__ == "__main__":
    asyncio.run(generate())
