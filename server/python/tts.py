"""
tts.py — Local Telugu TTS using edge-tts (Microsoft Neural, no API key)
Usage: python tts.py <text> <output_mp3_path> [voice]
Output: JSON {success, output_path, voice}

Telugu voices:
  te-IN-MohanNeural  — male,   natural, authoritative
  te-IN-ShrutiNeural — female, warm, friendly
"""
import sys, json, os, asyncio, traceback, re

os.environ.setdefault('PYTHONIOENCODING', 'utf-8')


def clean_for_tts(text: str) -> str:
    """Convert chat text → natural spoken Telugu for TTS."""

    # Remove markdown formatting
    text = text.replace('*', '').replace('_', '').replace('`', '').replace('#', '')

    # Remove all emojis (unicode emoji ranges)
    text = re.sub(
        r'[\U0001F300-\U0001F9FF'   # misc symbols, emoticons
        r'\U0001FA00-\U0001FA9F'
        r'\U00002600-\U000027BF'    # misc symbols
        r'\U0000FE00-\U0000FE0F'    # variation selectors
        r'\U00000000-\U0000001F'    # control chars
        r']+', '', text
    )

    # Currency: ₹2158  → "రెండు వేల నూట యాభై ఎనిమిది రూపాయలు"
    # Simple approach: ₹NUMBER → NUMBER రూపాయలు
    text = re.sub(r'₹\s*(\d[\d,]*)', lambda m: m.group(1).replace(',', '') + ' రూపాయలు', text)

    # /quintal → ప్రతి క్వింటాల్కు (with trailing space for natural pause)
    text = text.replace('/quintal', ' ప్రతి క్వింటాల్కు. ')
    text = text.replace('/kg', ' ప్రతి కిలోకు. ')
    text = text.replace('/litre', ' ప్రతి లీటర్కు. ')


    # Min: → కనిష్ట ధర, Max: → గరిష్ట ధర
    text = re.sub(r'Min\s*:\s*', 'కనిష్ట ధర ', text, flags=re.IGNORECASE)
    text = re.sub(r'Max\s*:\s*', 'గరిష్ట ధర ', text, flags=re.IGNORECASE)

    # Dates: 2026-06-03 → skip or just say the month
    text = re.sub(r'\d{4}-\d{2}-\d{2}', '', text)

    # Bullet/dash lines → natural pause with comma
    text = re.sub(r'\n[-•]\s*', ', ', text)

    # Multiple newlines → single pause
    text = re.sub(r'\n+', '. ', text)

    # Clean up multiple spaces/dots
    text = re.sub(r'[.]{2,}', '.', text)
    text = re.sub(r'\s{2,}', ' ', text)

    return text.strip('. ,')


async def synthesize(text: str, output_path: str, voice: str = "te-IN-MohanNeural"):
    try:
        import edge_tts

        spoken = clean_for_tts(text)
        if not spoken:
            return {"success": False, "error": "Empty text after cleaning"}

        communicate = edge_tts.Communicate(spoken, voice)
        await communicate.save(output_path)

        return {
            "success":     True,
            "output_path": output_path,
            "voice":       voice,
            "spoken_text": spoken[:120],   # for debug
            "text_length": len(spoken),
        }

    except ImportError:
        return {"success": False, "error": "edge-tts not installed. Run: pip install edge-tts"}
    except Exception as e:
        return {"success": False, "error": str(e), "trace": traceback.format_exc()}


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: python tts.py <text> <output_path> [voice]"}))
        sys.exit(1)

    text        = sys.argv[1]
    output_path = sys.argv[2]
    voice       = sys.argv[3] if len(sys.argv) > 3 else "te-IN-MohanNeural"

    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)
    result = asyncio.run(synthesize(text, output_path, voice))
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print(json.dumps(result, ensure_ascii=False))
