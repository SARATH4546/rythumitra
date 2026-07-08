"""
tts.py — Local Telugu TTS using edge-tts (Microsoft Neural, no API key)
Usage: python tts.py <text> <output_mp3_path> [voice]
Output: JSON {success, output_path, voice}

Telugu voice: te-IN-MohanNeural (male) or te-IN-ShrutiNeural (female)
No API key needed. edge-tts makes anonymous calls to Microsoft TTS.
"""
import sys, json, os, asyncio, traceback


async def synthesize(text, output_path, voice="te-IN-MohanNeural"):
    try:
        import edge_tts

        # Sanitize text: remove markdown formatting
        clean = text.replace("*", "").replace("_", "").replace("`", "").replace("#", "")

        communicate = edge_tts.Communicate(clean, voice)
        await communicate.save(output_path)

        return {
            "success": True,
            "output_path": output_path,
            "voice": voice,
            "text_length": len(clean),
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

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path) if os.path.dirname(output_path) else ".", exist_ok=True)

    result = asyncio.run(synthesize(text, output_path, voice))
    print(json.dumps(result, ensure_ascii=False))
