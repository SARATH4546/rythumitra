# -*- coding: utf-8 -*-
import sys as _sys
if hasattr(_sys.stdout, 'reconfigure'): _sys.stdout.reconfigure(encoding='utf-8', errors='replace')
"""
test_disease_model.py — Test the 99.36% disease detection model against test_data/

Runs every image in test_data/ through the disease server and reports:
  - Per-class accuracy
  - Overall accuracy
  - Confidence distribution
  - Any wrong predictions

Usage:
  python test_disease_model.py
  python test_disease_model.py --top5     (show top-5 predictions per image)
  python test_disease_model.py --verbose  (show every prediction)
"""
import os, json, sys, argparse, re, requests
from pathlib import Path
from collections import defaultdict

TEST_DIR    = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_data")
SERVER_URL  = "http://127.0.0.1:5002"

def predict(image_path: str) -> dict:
    r = requests.post(f"{SERVER_URL}/predict", json={"image_path": image_path}, timeout=30)
    return r.json()

def run(verbose=False, top5=False):
    # Health check
    try:
        h = requests.get(f"{SERVER_URL}/health", timeout=5).json()
        print(f"Disease Server: ready={h['ready']} | classes={h['classes']}")
    except Exception as e:
        print(f"ERROR: Disease server not reachable at {SERVER_URL}: {e}")
        sys.exit(1)

    # Deduplicate (Windows glob is case-insensitive, .jpg and .JPG match same files)
    seen = set()
    images_dedup = []
    for p in Path(TEST_DIR).iterdir():
        if p.suffix.lower() in (".jpg", ".jpeg", ".png") and p.name.lower() not in seen:
            seen.add(p.name.lower())
            images_dedup.append(p)
    images = sorted(images_dedup)

    if not images:
        print(f"No images found in {TEST_DIR}")
        sys.exit(1)

    print(f"\nTesting {len(images)} images from {TEST_DIR}")
    print("=" * 70)

    correct = 0
    total   = 0
    class_stats = defaultdict(lambda: {"correct": 0, "total": 0, "wrong": []})
    confidence_list = []
    errors = []

    for img_path in sorted(images):
        # Filename format: ClassName__UUID.jpg
        # ClassName itself contains ___ so we find the UUID boundary
        fname = img_path.name
        m = re.match(r'^(.+?)__[0-9a-f]{8}-', fname)
        true_class = m.group(1) if m else fname.split("__")[0]

        try:
            result = predict(str(img_path))
        except Exception as e:
            errors.append((fname, str(e)))
            continue

        if not result.get("success"):
            errors.append((fname, result.get("error", "unknown error")))
            continue

        predicted_plant  = result.get("plant_raw", "")          # e.g. "Apple"
        predicted_disease= result.get("disease", "")              # e.g. "Apple scab"
        confidence       = float(result.get("confidence_score", 0)) * 100
        # Reconstruct predicted label like: Apple___Apple_scab
        disease_slug = predicted_disease.replace(" ","_")
        predicted_class  = f"{predicted_plant}___{disease_slug}" if predicted_plant else ""

        def normalize(s):
            """Normalize class names for comparison (handles spaces/underscores/parentheses)"""
            return re.sub(r'[\s_\(\),]+', '_', s).lower().strip('_')

        is_correct = normalize(predicted_class) == normalize(true_class) or \
                     normalize(true_class) in normalize(predicted_class)

        confidence_list.append(confidence)
        class_stats[true_class]["total"] += 1
        total += 1

        if is_correct:
            correct += 1
            class_stats[true_class]["correct"] += 1
            if verbose:
                print(f"  OK [{confidence:.1f}%] {true_class[:50]}")
        else:
            class_stats[true_class]["wrong"].append({
                "predicted": predicted_class,
                "confidence": confidence
            })
            print(f"  WRONG TRUE : {true_class[:55]}")
            print(f"        PRED : {predicted_class} ({confidence:.1f}%)")

    # ── Summary ──────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    accuracy = correct / total * 100 if total else 0
    avg_conf = sum(confidence_list) / len(confidence_list) if confidence_list else 0

    print(f"OVERALL ACCURACY  : {correct}/{total}  =  {accuracy:.2f}%")
    print(f"AVERAGE CONFIDENCE: {avg_conf:.1f}%")

    # Confidence distribution
    buckets = {"<70%": 0, "70-80%": 0, "80-90%": 0, "90-95%": 0, "95-99%": 0, ">99%": 0}
    for c in confidence_list:
        if c < 70:     buckets["<70%"] += 1
        elif c < 80:   buckets["70-80%"] += 1
        elif c < 90:   buckets["80-90%"] += 1
        elif c < 95:   buckets["90-95%"] += 1
        elif c < 99:   buckets["95-99%"] += 1
        else:          buckets[">99%"] += 1

    print("\nConfidence Distribution:")
    for bucket, count in buckets.items():
        bar = "█" * (count * 30 // max(len(confidence_list), 1))
        print(f"  {bucket:8s} {bar} {count}")

    # Wrong predictions
    wrong_classes = [(cls, s) for cls, s in class_stats.items() if s["wrong"]]
    if wrong_classes:
        print(f"\nWrong Predictions ({len(wrong_classes)} classes had errors):")
        for cls, s in sorted(wrong_classes, key=lambda x: -len(x[1]["wrong"])):
            print(f"  {cls[:50]}")
            for w in s["wrong"]:
                print(f"    -> Predicted: {w['predicted']} ({w['confidence']:.1f}%)")
    else:
        print("  PERFECT SCORE - No wrong predictions on test set!")

    if errors:
        print(f"\nErrors ({len(errors)}):")
        for fname, err in errors[:5]:
            print(f"  {fname}: {err}")

    print("\n" + "=" * 70)
    print(f"Test complete: {accuracy:.2f}% accuracy on {total} images")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--verbose", action="store_true", help="Print every prediction")
    ap.add_argument("--top5",    action="store_true", help="Show top-5 predictions")
    args = ap.parse_args()
    run(verbose=args.verbose, top5=args.top5)
