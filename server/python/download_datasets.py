"""
download_datasets.py — One-command download of all crop disease datasets
                       using the Kaggle API (free account required)

Setup:
  1. Create free Kaggle account: https://www.kaggle.com
  2. Go to: kaggle.com → Account → API → Create New Token
  3. Place kaggle.json in: C:\\Users\\HP\\.kaggle\\kaggle.json
  4. Run: python server/python/download_datasets.py

Downloads:
  - PlantVillage (87,000 images, 38 classes)          ~800 MB
  - Paddy Doctor (10,407 rice images, 10 classes)      ~200 MB
  - Rice Leaf Diseases (3,355 images)                   ~50 MB
  - Cotton Disease (2,000+ images)                      ~40 MB
  - Sugarcane Leaf Disease (3,000 images)               ~60 MB
  - Maize/Corn Disease (4,000 images)                   ~80 MB

Total: ~1.2 GB
"""

import os, sys, subprocess, json
from pathlib import Path

DATASETS_DIR = Path("datasets")

# Each entry: (kaggle_slug, local_subfolder, description, size_estimate)
DATASETS = [
    {
        "slug":   "abdallahalidev/plantvillage-dataset",
        "folder": "plantvillage",
        "name":   "PlantVillage (38 classes, 87k images)",
        "size":   "~800 MB",
        "priority": 1,
    },
    {
        "slug":   "minhhuy2810/rice-diseases-image-dataset",
        "folder": "rice",
        "name":   "Rice Leaf Diseases (4 classes)",
        "size":   "~50 MB",
        "priority": 2,
    },
    {
        "slug":   "janmejaybhoi/cotton-disease-dataset",
        "folder": "cotton",
        "name":   "Cotton Disease (4 classes)",
        "size":   "~40 MB",
        "priority": 3,
    },
    {
        "slug":   "nirmalsankalana/sugarcane-leaf-disease-dataset",
        "folder": "sugarcane",
        "name":   "Sugarcane Leaf Disease (5 classes)",
        "size":   "~60 MB",
        "priority": 4,
    },
    {
        "slug":   "smaranjitghose/corn-or-maize-leaf-disease-dataset",
        "folder": "maize",
        "name":   "Maize/Corn Disease (4 classes)",
        "size":   "~80 MB",
        "priority": 5,
    },
    {
        "slug":   "vencerlanz09/tobacco-and-peanut-leaf-disease-dataset",
        "folder": "groundnut",
        "name":   "Groundnut/Peanut Disease (3 classes)",
        "size":   "~120 MB",
        "priority": 6,
    },
]


def check_kaggle():
    """Check if kaggle CLI is installed and configured."""
    try:
        result = subprocess.run(["kaggle", "--version"], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"[Setup] Kaggle CLI: {result.stdout.strip()}")
            return True
    except FileNotFoundError:
        pass

    print("[Setup] Installing kaggle CLI...")
    subprocess.run([sys.executable, "-m", "pip", "install", "kaggle", "-q"])

    # Check for API token
    kaggle_json = Path.home() / ".kaggle" / "kaggle.json"
    if not kaggle_json.exists():
        print("\n" + "="*60)
        print(" KAGGLE API TOKEN REQUIRED")
        print("="*60)
        print("\n 1. Create free account: https://www.kaggle.com")
        print(" 2. Go to: Account → Settings → API → Create New Token")
        print(" 3. Save the downloaded kaggle.json to:")
        print(f"    {kaggle_json}")
        print("\n Then run this script again.")
        print("="*60)
        return False
    return True


def download_dataset(slug, folder, name, size, **kwargs):
    dest = DATASETS_DIR / folder
    dest.mkdir(parents=True, exist_ok=True)

    # Skip if already downloaded
    existing = list(dest.rglob("*.jpg")) + list(dest.rglob("*.png"))
    if len(existing) > 100:
        print(f"  [SKIP] {name} — already downloaded ({len(existing):,} images found)")
        return True

    print(f"\n  Downloading: {name}")
    print(f"  Size: {size}  →  {dest}")

    result = subprocess.run(
        ["kaggle", "datasets", "download", "-d", slug, "-p", str(dest), "--unzip"],
        capture_output=False,
    )

    if result.returncode == 0:
        count = len(list(dest.rglob("*.jpg"))) + len(list(dest.rglob("*.png")))
        print(f"  Downloaded: {count:,} images")
        return True
    else:
        print(f"  [FAILED] Could not download {name}")
        print(f"  Try manually: kaggle datasets download -d {slug} -p {dest} --unzip")
        return False


def main():
    print("\n" + "="*60)
    print(" RythuMitra — Crop Disease Dataset Downloader")
    print("="*60)

    if not check_kaggle():
        return

    DATASETS_DIR.mkdir(exist_ok=True)
    results = []

    for ds in sorted(DATASETS, key=lambda x: x["priority"]):
        ok = download_dataset(**ds)
        results.append({"dataset": ds["name"], "success": ok})

    # Summary
    success = sum(1 for r in results if r["success"])
    print(f"\n{'='*60}")
    print(f" Downloaded {success}/{len(results)} datasets")
    print(f"{'='*60}")

    if success > 0:
        print("\n Next steps:")
        print(" 1. Merge all datasets:")
        print("    python server/python/merge_datasets.py --output datasets/merged")
        print("\n 2. Train the model:")
        print("    python server/python/train_disease_model.py --dataset datasets/merged")
        print("\n 3. Or train on PlantVillage first (fastest):")
        print("    python server/python/train_disease_model.py --dataset datasets/plantvillage")


if __name__ == "__main__":
    main()
