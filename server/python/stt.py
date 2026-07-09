"""
stt.py — Local Speech-to-Text using faster-whisper (runs on CPU, no API key)
Usage: python stt.py <audio_file_path> [language]
Output: JSON {transcript, language, duration}
"""
import sys, json, os, traceback

# Fix Windows console encoding for Telugu/Unicode output
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def transcribe(audio_path, language="te"):
    try:
        from faster_whisper import WhisperModel

        # Load small model (152MB, auto-downloads once to ~/.cache/huggingface/)
        # "small" is a good balance of speed and Telugu accuracy
        model_size = os.environ.get("WHISPER_MODEL", "small")
        model = WhisperModel(model_size, device="cpu", compute_type="int8")

        segments, info = model.transcribe(
            audio_path,
            language=language if language != "auto" else None,
            beam_size=5,
            vad_filter=True,           # Skip silent parts
            vad_parameters={"min_silence_duration_ms": 500},
        )

        transcript = " ".join(seg.text.strip() for seg in segments).strip()
        return {
            "success": True,
            "transcript": transcript,
            "language": info.language,
            "language_probability": round(info.language_probability, 3),
        }

    except ImportError:
        return {"success": False, "error": "faster-whisper not installed. Run: pip install faster-whisper"}
    except Exception as e:
        return {"success": False, "error": str(e), "trace": traceback.format_exc()}


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: python stt.py <audio_file> [language]"}))
        sys.exit(1)

    audio_file = sys.argv[1]
    lang       = sys.argv[2] if len(sys.argv) > 2 else "auto"

    if not os.path.exists(audio_file):
        print(json.dumps({"success": False, "error": f"File not found: {audio_file}"}))
        sys.exit(1)

    result = transcribe(audio_file, lang)
    print(json.dumps(result, ensure_ascii=False))
