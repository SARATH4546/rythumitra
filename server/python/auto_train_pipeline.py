"""
auto_train_pipeline.py — Waits for all downloads, merges datasets, trains model
Run this ONCE after all kaggle downloads complete.

Usage: python server/python/auto_train_pipeline.py
"""
import os, sys, json, subprocess, time
from pathlib import Path

DATASETS_DIR = Path("datasets")
MODEL_DIR    = Path("server/python/models")
PYTHON       = sys.executable

EXPECTED_DATASETS = {
    "plantvillage": 1000,   # expect at least 1000 images
    "rice":         50,
    "cotton":       200,
    "sugarcane":    100,
    "maize":        200,
}


def count_images(folder):
    p = Path(folder)
    if not p.exists():
        return 0
    return len(list(p.rglob("*.jpg"))) + len(list(p.rglob("*.png"))) + len(list(p.rglob("*.jpeg")))


def wait_for_downloads():
    print("\n Checking downloads...")
    ready = {}
    for name, min_count in EXPECTED_DATASETS.items():
        folder = DATASETS_DIR / name
        count  = count_images(folder)
        status = "READY" if count >= min_count else "MISSING/INCOMPLETE"
        print(f"  {name:<15} {count:>6} images  [{status}]")
        ready[name] = count >= min_count
    return ready


def run(cmd, desc=""):
    print(f"\n>>> {desc or ' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=False)
    return result.returncode == 0


if __name__ == "__main__":
    print("=" * 60)
    print(" RythuMitra — Auto Train Pipeline")
    print("=" * 60)

    MODEL_DIR.mkdir(parents=True, exist_ok=True)

    ready = wait_for_downloads()
    available = [k for k, v in ready.items() if v]

    if not available:
        print("\n No datasets downloaded yet.")
        print(" Run download_datasets.py first.")
        sys.exit(1)

    print(f"\n Available datasets: {', '.join(available)}")

    # Step 1: Merge
    sources  = [str(DATASETS_DIR / name) for name in available]
    out_dir  = str(DATASETS_DIR / "merged")
    merge_ok = run(
        [PYTHON, "server/python/merge_datasets.py", "--output", out_dir] + ["--sources"] + sources,
        "Merging all datasets..."
    )

    if not merge_ok:
        print("Merge failed — training on plantvillage only")
        out_dir = str(DATASETS_DIR / "plantvillage")

    # Step 2: Train
    train_ok = run(
        [PYTHON, "server/python/train_disease_model.py", "--dataset", out_dir],
        f"Training on {out_dir}..."
    )

    if train_ok:
        model_path = MODEL_DIR / "plantvillage_head.pth"
        size_mb    = model_path.stat().st_size / 1e6 if model_path.exists() else 0
        print(f"\n Training complete!")
        print(f" Model: {model_path} ({size_mb:.1f} MB)")
        print(f"\n Restart the server to activate:")
        print(f"   node server/server.js")
        print(json.dumps({"success": True, "model": str(model_path)}))
    else:
        print(" Training failed — check logs above.")
        sys.exit(1)
