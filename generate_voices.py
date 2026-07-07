"""
RythuMitra — Telugu Voice Generator (edge-tts)
================================================
Uses Microsoft Edge Neural TTS (free, no API key, Python 3.14 compatible)
Voice: te-IN-MohanNeural (male) — closest to a natural Telugu male voice

Run:
    pip install edge-tts
    python generate_voices.py
"""

import asyncio
import os
import sys
import subprocess
from pathlib import Path

# ── CONFIG ────────────────────────────────────────────────────────────────────
VOICE_DIR  = Path(__file__).parent / "voice"
VOICE_NAME = "te-IN-MohanNeural"          # Telugu Male  (change to te-IN-ShrutiNeural for female)
FFMPEG_BIN = (
    r"C:\Users\HP\Downloads\ffmpeg-2026-07-02-git-95a888b9ca-essentials_build"
    r"\ffmpeg-2026-07-02-git-95a888b9ca-essentials_build\bin\ffmpeg.exe"
)

# ── ALL 23 BOT MESSAGES ───────────────────────────────────────────────────────
MESSAGES = {

    # ─── Greeting ─────────────────────────────────────────────────────────────
    "greeting_new": (
        "నమస్కారం! రైతు మిత్రకు స్వాగతం. "
        "నేను మీకు మండీ ధరలు, ప్రభుత్వ పథకాలు మరియు వాతావరణ సమాచారం అందించగలను. "
        "మీ జిల్లా పేరు పంపండి, నమోదు ప్రారంభిద్దాం."
    ),
    "greeting_returning_{name}": (
        "నమస్కారం! మళ్ళీ రైతు మిత్రకు స్వాగతం. "
        "మీ పంట ధర తెలుసుకోవాలంటే, ధర అని పంపండి. "
        "పథకాల కోసం పథకం అని, వాతావరణం కోసం వాతావరణం అని పంపండి."
    ),

    # ─── Registration ─────────────────────────────────────────────────────────
    "reg_district_selected": (
        "మీరు జిల్లాను ఎంచుకున్నారు. "
        "ఇప్పుడు మీ ప్రధాన పంట పేరు పంపండి. "
        "ఉదాహరణకు వరి, పత్తి, మిర్చి, వేరుశనగ లేదా మొక్కజొన్న."
    ),
    "reg_complete": (
        "అభినందనలు! మీ నమోదు విజయవంతంగా పూర్తయింది. "
        "ఇప్పటి నుండి మీకు మండీ ధరలు, వాతావరణ హెచ్చరికలు "
        "మరియు ప్రభుత్వ పథకాల సమాచారం అందుతుంది."
    ),

    # ─── Price ────────────────────────────────────────────────────────────────
    "price_normal": (
        "మండీలో నేటి పంట ధర సమాచారం. "
        "కనిష్ఠ ధర పదిహేను వందల రూపాయలు, "
        "గరిష్ఠ ధర రెండు వేల రూపాయలు, "
        "సాధారణ ధర పదిహేడు వందల రూపాయలు క్వింటాలుకు. "
        "మరిన్ని వివరాలకు మీ సమీప మండీ కార్యాలయాన్ని సంప్రదించండి."
    ),
    "price_spike_up": (
        "శ్రద్ధగా వినండి! మీ పంట ధర గత వారంతో పోల్చితే పది శాతం పెరిగింది. "
        "ఇది మంచి అవకాశం. "
        "ఇప్పుడు అమ్మడానికి అనుకూలమైన సమయం."
    ),
    "price_spike_down": (
        "జాగ్రత్త! మీ పంట ధర గత వారంతో పోల్చితే పది శాతం తగ్గింది. "
        "కొద్దిరోజులు వేచి ఉండటం లాభదాయకంగా ఉంటుంది. "
        "మండీ పరిస్థితులను గమనిస్తూ ఉండండి."
    ),
    "price_not_available": (
        "క్షమించండి. మీ జిల్లాలో నేడు మీ పంట ధర అందుబాటులో లేదు. "
        "దయచేసి రేపు మళ్ళీ ప్రయత్నించండి, "
        "లేదా సమీప మండీ కార్యాలయాన్ని సంప్రదించండి."
    ),

    # ─── Schemes ──────────────────────────────────────────────────────────────
    "schemes_intro": (
        "మీకు అర్హమైన ప్రభుత్వ పథకాల జాబితా ఇది. "
        "ప్రతి పథకం వివరాలు శ్రద్ధగా వినండి "
        "మరియు అర్హులైతే వెంటనే దరఖాస్తు చేయండి."
    ),
    "scheme_pmkisan": (
        "పి.ఎం కిసాన్ సమ్మాన్ నిధి పథకం. "
        "ఈ పథకం ద్వారా ప్రతి సంవత్సరం ఆరు వేల రూపాయలు "
        "మూడు విడతలలో మీ బ్యాంకు ఖాతాకు నేరుగా జమ అవుతాయి. "
        "దరఖాస్తు చేయడానికి సమీప వ్యవసాయ కార్యాలయాన్ని సంప్రదించండి."
    ),
    "scheme_ryhtubharosa": (
        "వై.ఎస్.ఆర్ రైతు భరోసా పథకం. "
        "ఈ పథకం ద్వారా రైతులకు ప్రతి సంవత్సరం "
        "పదమూడు వేల ఐదు వందల రూపాయలు అందుతాయి. "
        "మీ గ్రామ సచివాలయంలో అర్హత తెలుసుకోండి."
    ),
    "scheme_pmfby": (
        "ప్రధానమంత్రి ఫసల్ బీమా యోజన, పంట బీమా పథకం. "
        "ప్రకృతి వైపరీత్యాల వల్ల పంట నష్టపోతే "
        "మీకు పూర్తి నష్టపరిహారం అందుతుంది. "
        "దరఖాస్తు గడువు సమీపిస్తున్నది, వెంటనే నమోదు చేసుకోండి."
    ),

    # ─── Weather ──────────────────────────────────────────────────────────────
    "weather_normal": (
        "మీ జిల్లా వాతావరణ సూచన. "
        "నేడు పాక్షికంగా మేఘావృతంగా ఉంటుంది, వర్షం అవకాశం ఇరవై శాతం, ఉష్ణోగ్రత ముప్పై నాలుగు డిగ్రీలు. "
        "రేపు మేఘావృతంగా ఉండవచ్చు, వర్షం అవకాశం నలభై శాతం, ఉష్ణోగ్రత ముప్పై డిగ్రీలు. "
        "ఆ తర్వాత రోజు ఆకాశం స్వచ్ఛంగా ఉంటుంది."
    ),
    "weather_rain_warning": (
        "జాగ్రత్త హెచ్చరిక! మీ జిల్లాలో రేపు భారీ వర్షం అంచనా. "
        "వర్షం అవకాశం ఎనభై శాతం ఉంది. "
        "వీలైతే ఈ రోజే పంట కోత పనులు పూర్తి చేయండి. "
        "కోసిన పంటను వెంటనే సురక్షిత స్థలంలో నిల్వ చేయండి."
    ),

    # ─── Loan ─────────────────────────────────────────────────────────────────
    "loan_kcc": (
        "కిసాన్ క్రెడిట్ కార్డు పథకం. "
        "కేవలం నాలుగు శాతం వడ్డీతో మూడు లక్షల రూపాయల వరకు పంట రుణం పొందవచ్చు. "
        "సమయానికి చెల్లిస్తే వడ్డీ రెండు శాతానికి తగ్గుతుంది. "
        "మీ ఆధార్ కార్డు మరియు భూమి పత్రాలు తీసుకుని "
        "సమీప జాతీయ బ్యాంకులో దరఖాస్తు చేయండి."
    ),
    "loan_nabard": (
        "నాబార్డ్ సూక్ష్మ రుణ పథకం. "
        "స్వయం సహాయక గ్రూపు సభ్యులకు ఐదు లక్షల రూపాయల వరకు రుణం అందుతుంది. "
        "వడ్డీ రేటు కేవలం ఏడు శాతం మాత్రమే. "
        "ఎక్కువ సమాచారానికి టోల్ ఫ్రీ నంబరు 1800 200 0104 కి కాల్ చేయండి."
    ),

    # ─── Stop / Error ─────────────────────────────────────────────────────────
    "unsubscribe": (
        "మీరు రైతు మిత్ర సేవల నుండి నమోదు రద్దు చేసుకున్నారు. "
        "మళ్ళీ సేవలు పొందాలంటే హలో అని పంపండి. "
        "మీ సేవలో భాగమైనందుకు ధన్యవాదాలు."
    ),
    "error_unknown": (
        "క్షమించండి, మీరు పంపిన సందేశం అర్థం కాలేదు. "
        "మండీ ధర కోసం ధర అని పంపండి. "
        "పథకాల కోసం పథకం అని పంపండి. "
        "వాతావరణ సమాచారానికి వాతావరణం అని పంపండి. "
        "సహాయం కోసం హలో అని పంపండి."
    ),

    # ─── IVR Menus ────────────────────────────────────────────────────────────
    "ivr_main_menu": (
        "రైతు మిత్రకు స్వాగతం. "
        "మండీ ధర తెలుసుకోవడానికి ఒకటి నొక్కండి. "
        "ప్రభుత్వ పథకాల సమాచారానికి రెండు నొక్కండి. "
        "వాతావరణ సూచన కోసం మూడు నొక్కండి. "
        "రుణ సమాచారానికి నాలుగు నొక్కండి. "
        "సహాయ కేంద్రానికి మాట్లాడటానికి ఐదు నొక్కండి."
    ),
    "ivr_welcome_returning": (
        "నమస్కారం! మళ్ళీ రైతు మిత్రకు స్వాగతం. "
        "మీ పంట ధర వినడానికి ఒకటి నొక్కండి. "
        "పథకాల కోసం రెండు, వాతావరణం కోసం మూడు నొక్కండి."
    ),
    "ivr_reg_welcome": (
        "రైతు మిత్రకు స్వాగతం! మీరు కొత్త వినియోగదారు. "
        "మీ జిల్లా ఎంచుకోండి. "
        "గుంటూరు కోసం ఒకటి, కృష్ణా కోసం రెండు, "
        "కర్నూలు కోసం మూడు, తూర్పు గోదావరి కోసం నాలుగు, "
        "పశ్చిమ గోదావరి కోసం ఐదు నొక్కండి."
    ),

    # ─── Broadcast Alerts ─────────────────────────────────────────────────────
    "alert_price": (
        "రైతు మిత్ర ధర హెచ్చరిక! "
        "మీ జిల్లా మండీలో మీ పంట ధరలో గణనీయమైన మార్పు వచ్చింది. "
        "వివరాలు తెలుసుకోవడానికి ధర అని పంపండి."
    ),
    "alert_scheme_deadline": (
        "ముఖ్యమైన గుర్తు! "
        "ప్రభుత్వ పథకం దరఖాస్తుకు చివరి తేదీ సమీపిస్తున్నది. "
        "ఇంకా దరఖాస్తు చేయని రైతులు వెంటనే "
        "సమీప వ్యవసాయ కార్యాలయాన్ని సంప్రదించండి."
    ),
}


async def generate_one(edge_tts_mod, name: str, text: str, out_mp3: Path):
    """Generate a single mp3 using edge-tts."""
    tmp_wav = out_mp3.with_suffix(".tmp.wav")
    communicate = edge_tts_mod.Communicate(text, VOICE_NAME, rate="-5%", pitch="-2Hz")
    await communicate.save(str(tmp_wav))

    # Convert to mp3 using ffmpeg
    result = subprocess.run(
        [FFMPEG_BIN, "-i", str(tmp_wav), "-codec:a", "libmp3lame",
         "-b:a", "128k", "-y", str(out_mp3)],
        capture_output=True, text=True
    )
    tmp_wav.unlink(missing_ok=True)
    if result.returncode != 0:
        raise RuntimeError(result.stderr[-300:])


async def generate_all():
    try:
        import edge_tts
    except ImportError:
        print("\n[ERROR] edge-tts not installed.")
        print("    Run:  pip install edge-tts")
        sys.exit(1)

    VOICE_DIR.mkdir(parents=True, exist_ok=True)
    total   = len(MESSAGES)
    success = 0

    print(f"\n  Voice  : {VOICE_NAME}")
    print(f"  Output : {VOICE_DIR}")
    print(f"  Files  : {total}\n")
    print("-" * 55)

    for i, (name, text) in enumerate(MESSAGES.items(), 1):
        out = VOICE_DIR / f"{name}.mp3"
        print(f"[{i:02d}/{total}]  {name}")
        try:
            await generate_one(edge_tts, name, text, out)
            size_kb = out.stat().st_size // 1024
            print(f"         OK  ->  {out.name}  ({size_kb} KB)\n")
            success += 1
        except Exception as e:
            print(f"         FAILED: {e}\n")

    print("-" * 55)
    print(f"\n  Done! {success}/{total} files generated successfully!")
    print(f"  Folder: {VOICE_DIR}\n")


def main():
    print("\n" + "=" * 55)
    print("  RythuMitra -- Telugu Voice Generator")
    print("  Microsoft Neural TTS (edge-tts) | te-IN")
    print("=" * 55)

    # Check ffmpeg exists
    if not Path(FFMPEG_BIN).exists():
        print(f"\n[ERROR] ffmpeg not found at:\n   {FFMPEG_BIN}")
        sys.exit(1)
    print(f"\n[OK] ffmpeg found")

    # Check edge-tts installed
    try:
        import edge_tts
        print(f"[OK] edge-tts found")
    except ImportError:
        print("\n[INFO] Installing edge-tts...")
        os.system(f"{sys.executable} -m pip install edge-tts")

    asyncio.run(generate_all())


if __name__ == "__main__":
    main()

