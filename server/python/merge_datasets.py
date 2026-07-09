"""
merge_datasets.py — Merge multiple crop disease datasets into one unified folder
                    for training RythuMitra disease detection model.

Usage:
  python server/python/merge_datasets.py --output datasets/merged
  python server/python/merge_datasets.py --output datasets/merged --sources datasets/plantvillage datasets/rice datasets/cotton

This script:
  1. Scans each source folder for class subfolders
  2. Normalizes class names (removes spaces, fixes case)
  3. Copies/links images into merged/ folder
  4. Creates a class_labels.json for model reference
  5. Prints dataset statistics
"""

import os, sys, shutil, json, argparse, random
from pathlib import Path
from collections import defaultdict

# ─── Crop-specific Telugu names ───────────────────────────────────────────────
TELUGU_NAMES = {
    # PlantVillage
    "Apple___Apple_scab":             {"te": "ఆపిల్ పొరల తెగులు",        "crop": "Apple",     "sev": "moderate"},
    "Apple___Black_rot":              {"te": "ఆపిల్ నల్ల కుళ్ళు",         "crop": "Apple",     "sev": "severe"},
    "Apple___Cedar_apple_rust":       {"te": "ఆపిల్ తుప్పు తెగులు",       "crop": "Apple",     "sev": "moderate"},
    "Apple___healthy":                {"te": "ఆరోగ్యకరమైన ఆపిల్",          "crop": "Apple",     "sev": "healthy"},
    "Corn___Cercospora_leaf_spot":    {"te": "మొక్కజొన్న ఆకు మచ్చ",       "crop": "Maize",     "sev": "moderate"},
    "Corn___Common_rust":             {"te": "మొక్కజొన్న తుప్పు తెగులు",  "crop": "Maize",     "sev": "moderate"},
    "Corn___Northern_Leaf_Blight":    {"te": "మొక్కజొన్న ఆకు తెగులు",    "crop": "Maize",     "sev": "severe"},
    "Corn___healthy":                 {"te": "ఆరోగ్యకరమైన మొక్కజొన్న",   "crop": "Maize",     "sev": "healthy"},
    "Potato___Early_blight":          {"te": "బంగాళాదుంప ముందు తెగులు",  "crop": "Potato",    "sev": "moderate"},
    "Potato___Late_blight":           {"te": "బంగాళాదుంప చివరి తెగులు",  "crop": "Potato",    "sev": "severe"},
    "Potato___healthy":               {"te": "ఆరోగ్యకరమైన బంగాళాదుంప",   "crop": "Potato",    "sev": "healthy"},
    "Tomato___Bacterial_spot":        {"te": "టొమాటో బ్యాక్టీరియా మచ్చ", "crop": "Tomato",    "sev": "moderate"},
    "Tomato___Early_blight":          {"te": "టొమాటో ముందు తెగులు",       "crop": "Tomato",    "sev": "moderate"},
    "Tomato___Late_blight":           {"te": "టొమాటో చివరి తెగులు",       "crop": "Tomato",    "sev": "severe"},
    "Tomato___Leaf_Mold":             {"te": "టొమాటో ఆకు బూజు",           "crop": "Tomato",    "sev": "moderate"},
    "Tomato___Septoria_leaf_spot":    {"te": "టొమాటో సెప్టోరియా మచ్చ",   "crop": "Tomato",    "sev": "moderate"},
    "Tomato___Spider_mites":          {"te": "టొమాటో సాలె పురుగు",        "crop": "Tomato",    "sev": "moderate"},
    "Tomato___Target_Spot":           {"te": "టొమాటో టార్గెట్ మచ్చ",      "crop": "Tomato",    "sev": "mild"},
    "Tomato___Yellow_Leaf_Curl_Virus":{"te": "టొమాటో పసుపు వైరస్",        "crop": "Tomato",    "sev": "severe"},
    "Tomato___mosaic_virus":          {"te": "టొమాటో మొజాయిక్ వైరస్",    "crop": "Tomato",    "sev": "severe"},
    "Tomato___healthy":               {"te": "ఆరోగ్యకరమైన టొమాటో",        "crop": "Tomato",    "sev": "healthy"},
    "Pepper___Bacterial_spot":        {"te": "మిర్చి బ్యాక్టీరియా మచ్చ", "crop": "Chilli",    "sev": "moderate"},
    "Pepper___healthy":               {"te": "ఆరోగ్యకరమైన మిర్చి",         "crop": "Chilli",    "sev": "healthy"},
    "Grape___Black_rot":              {"te": "ద్రాక్ష నల్ల కుళ్ళు",       "crop": "Grape",     "sev": "severe"},
    "Grape___Esca_Black_Measles":     {"te": "ద్రాక్ష ఎస్కా తెగులు",     "crop": "Grape",     "sev": "severe"},
    "Grape___Leaf_blight":            {"te": "ద్రాక్ష ఆకు ముడత",          "crop": "Grape",     "sev": "severe"},
    "Grape___healthy":                {"te": "ఆరోగ్యకరమైన ద్రాక్ష",       "crop": "Grape",     "sev": "healthy"},
    # Rice / Paddy
    "Rice___Blast":                   {"te": "వరి బ్లాస్ట్ తెగులు",        "crop": "Paddy",     "sev": "severe"},
    "Rice___Brown_Spot":              {"te": "వరి గోధుమ మచ్చ తెగులు",     "crop": "Paddy",     "sev": "moderate"},
    "Rice___Bacterial_Blight":        {"te": "వరి బ్యాక్టీరియా తెగులు",   "crop": "Paddy",     "sev": "severe"},
    "Rice___Tungro":                  {"te": "వరి టుంగ్రో వైరస్",          "crop": "Paddy",     "sev": "severe"},
    "Rice___Leaf_Smut":               {"te": "వరి ఆకు మసి తెగులు",        "crop": "Paddy",     "sev": "moderate"},
    "Rice___Dead_Heart":              {"te": "వరి చనిపోయిన కాండు",        "crop": "Paddy",     "sev": "severe"},
    "Rice___Hispa":                   {"te": "వరి హిస్పా పురుగు",          "crop": "Paddy",     "sev": "moderate"},
    "Rice___healthy":                 {"te": "ఆరోగ్యకరమైన వరి",            "crop": "Paddy",     "sev": "healthy"},
    # Cotton
    "Cotton___Leaf_Curl_Virus":       {"te": "పత్తి ఆకు ముడత వైరస్",     "crop": "Cotton",    "sev": "severe"},
    "Cotton___Bacterial_Blight":      {"te": "పత్తి బ్యాక్టీరియా తెగులు", "crop": "Cotton",    "sev": "severe"},
    "Cotton___Aphids":                {"te": "పత్తి పేను పురుగు",          "crop": "Cotton",    "sev": "moderate"},
    "Cotton___Army_Worm":             {"te": "పత్తి సైనిక పురుగు",        "crop": "Cotton",    "sev": "severe"},
    "Cotton___healthy":               {"te": "ఆరోగ్యకరమైన పత్తి",          "crop": "Cotton",    "sev": "healthy"},
    # Sugarcane
    "Sugarcane___Red_Rot":            {"te": "చెరకు ఎర్ర కుళ్ళు తెగులు", "crop": "Sugarcane", "sev": "severe"},
    "Sugarcane___Rust":               {"te": "చెరకు తుప్పు తెగులు",        "crop": "Sugarcane", "sev": "moderate"},
    "Sugarcane___Bacterial_Blight":   {"te": "చెరకు బ్యాక్టీరియా తెగులు","crop": "Sugarcane", "sev": "severe"},
    "Sugarcane___Yellow":             {"te": "చెరకు పసుపు తెగులు",         "crop": "Sugarcane", "sev": "moderate"},
    "Sugarcane___healthy":            {"te": "ఆరోగ్యకరమైన చెరకు",          "crop": "Sugarcane", "sev": "healthy"},
    # Groundnut
    "Groundnut___Early_Leaf_Spot":    {"te": "వేరుశనగ ముందు మచ్చ",       "crop": "Groundnut", "sev": "moderate"},
    "Groundnut___Late_Leaf_Spot":     {"te": "వేరుశనగ చివరి మచ్చ",       "crop": "Groundnut", "sev": "moderate"},
    "Groundnut___Rust":               {"te": "వేరుశనగ తుప్పు తెగులు",     "crop": "Groundnut", "sev": "moderate"},
    "Groundnut___healthy":            {"te": "ఆరోగ్యకరమైన వేరుశనగ",       "crop": "Groundnut", "sev": "healthy"},
    # Chilli (from Tamil Nadu dataset)
    "Chilli___Leaf_Curl":             {"te": "మిర్చి ఆకు ముడత",           "crop": "Chilli",    "sev": "severe"},
    "Chilli___Yellowing":             {"te": "మిర్చి పసుపు తెగులు",        "crop": "Chilli",    "sev": "moderate"},
    "Chilli___healthy":               {"te": "ఆరోగ్యకరమైన మిర్చి",         "crop": "Chilli",    "sev": "healthy"},
}

IMG_EXTS = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp'}


def normalize_class_name(folder_name):
    """Normalize different dataset naming conventions to a standard format."""
    name = folder_name.strip()
    # Common normalization rules
    replacements = {
        " ": "_", "-": "_",
        "Leaf Blight": "Leaf_Blight",
        "leaf blight": "Leaf_Blight",
        "Bacterial Blight": "Bacterial_Blight",
        "Leaf Curl": "Leaf_Curl",
        "Brown spot": "Brown_Spot",
        "brown spot": "Brown_Spot",
        "Blast disease": "Blast",
        "blast": "Blast",
    }
    for old, new in replacements.items():
        name = name.replace(old, new)
    return name


def scan_dataset(source_dir):
    """Scan a dataset directory and return {class_name: [image_paths]}."""
    source_dir = Path(source_dir)
    classes = {}
    for item in sorted(source_dir.iterdir()):
        if item.is_dir():
            images = [f for f in item.rglob("*") if f.suffix.lower() in IMG_EXTS]
            if images:
                normalized = normalize_class_name(item.name)
                if normalized not in classes:
                    classes[normalized] = []
                classes[normalized].extend(images)
    return classes


def merge_datasets(source_dirs, output_dir, max_per_class=None):
    """Merge multiple dataset directories into one output directory."""
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    all_classes = defaultdict(list)

    print(f"\n{'='*60}")
    print(f" Scanning {len(source_dirs)} source dataset(s)...")
    print(f"{'='*60}")

    for src in source_dirs:
        if not os.path.isdir(src):
            print(f"  [SKIP] Not found: {src}")
            continue
        classes = scan_dataset(src)
        print(f"\n  Source: {src}")
        print(f"  Classes: {len(classes)}  |  Total images: {sum(len(v) for v in classes.values()):,}")
        for cls, imgs in sorted(classes.items()):
            print(f"    {cls:<45} {len(imgs):>6} images")
            all_classes[cls].extend(imgs)

    print(f"\n{'='*60}")
    print(f" Merged: {len(all_classes)} unique classes")
    print(f" Total : {sum(len(v) for v in all_classes.values()):,} images")
    print(f"{'='*60}\n")

    # Copy images
    class_list = sorted(all_classes.keys())
    labels_info = {}

    for idx, cls in enumerate(class_list):
        images = all_classes[cls]
        if max_per_class:
            random.shuffle(images)
            images = images[:max_per_class]

        dest_dir = output_dir / cls
        dest_dir.mkdir(exist_ok=True)

        copied = 0
        for img_path in images:
            dest = dest_dir / img_path.name
            # Handle duplicate filenames
            if dest.exists():
                stem = img_path.stem
                ext  = img_path.suffix
                dest = dest_dir / f"{stem}_{copied}{ext}"
            shutil.copy2(img_path, dest)
            copied += 1

        tel = TELUGU_NAMES.get(cls, {})
        labels_info[cls] = {
            "index":   idx,
            "class":   cls,
            "te":      tel.get("te", cls),
            "crop":    tel.get("crop", "Unknown"),
            "sev":     tel.get("sev", "moderate"),
            "count":   copied,
        }
        print(f"  [{idx:>3}] {cls:<45} -> {copied:>5} images")

    # Save class labels JSON (used by disease.py for inference)
    labels_path = output_dir.parent / "class_labels.json"
    with open(labels_path, "w", encoding="utf-8") as f:
        json.dump(labels_info, f, ensure_ascii=False, indent=2)

    # Also save to models dir
    models_dir = Path(__file__).parent / "models"
    models_dir.mkdir(exist_ok=True)
    with open(models_dir / "class_labels.json", "w", encoding="utf-8") as f:
        json.dump(labels_info, f, ensure_ascii=False, indent=2)

    print(f"\n  Class labels saved: {labels_path}")
    print(f"  Total classes : {len(class_list)}")
    print(f"  Total images  : {sum(v['count'] for v in labels_info.values()):,}")
    print(f"\n  Ready to train:")
    print(f"  python server/python/train_disease_model.py --dataset {output_dir}")

    return str(output_dir), labels_info


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge crop disease datasets")
    parser.add_argument("--output",   required=True,      help="Output merged dataset directory")
    parser.add_argument("--sources",  nargs="+",           help="Source dataset directories (default: auto-detect)")
    parser.add_argument("--max",      type=int, default=None, help="Max images per class (for balancing)")
    args = parser.parse_args()

    # Auto-detect sources if not specified
    if not args.sources:
        base = Path("datasets")
        args.sources = [
            str(base / "plantvillage"),
            str(base / "rice"),
            str(base / "cotton"),
            str(base / "sugarcane"),
            str(base / "maize"),
            str(base / "groundnut"),
            str(base / "chilli"),
        ]
        args.sources = [s for s in args.sources if os.path.isdir(s)]
        print(f"Auto-detected sources: {args.sources}")

    if not args.sources:
        print("ERROR: No source dataset directories found.")
        print("Download datasets first (see dataset_guide.md)")
        sys.exit(1)

    out_dir, info = merge_datasets(args.sources, args.output, args.max)
    print(json.dumps({"success": True, "output": out_dir, "classes": len(info)}, ensure_ascii=False))
