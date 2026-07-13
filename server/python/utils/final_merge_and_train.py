"""
final_merge_and_train.py — One-shot script to merge ALL datasets and train
Run after PlantVillage extraction completes:
  python final_merge_and_train.py
"""
import subprocess, sys, os, json
from pathlib import Path

PYTHON = sys.executable
os.environ['PYTHONIOENCODING'] = 'utf-8'

# ─── Find the actual PlantVillage class folders ───────────────────────────────
def find_plantvillage_root(base):
    """Find the folder that contains 38 class subdirectories."""
    base = Path(base)
    for candidate in [base, base / "plantvillage dataset", base / "color",
                      base / "Plant_leave_diseases_dataset_with_augmentation",
                      base / "Plant_leave_diseases_dataset_without_augmentation"]:
        if candidate.exists():
            subdirs = [d for d in candidate.iterdir() if d.is_dir()]
            imgs = sum(1 for d in subdirs for f in d.rglob("*")
                       if f.suffix.lower() in {'.jpg','.jpeg','.png'} )
            if imgs > 10000:
                print(f"  Found PlantVillage root: {candidate} ({imgs:,} images)")
                return str(candidate)
    # fallback: return base
    return str(base)


if __name__ == "__main__":
    print("=" * 60)
    print(" RythuMitra — Final Merge + Train (ALL datasets)")
    print("=" * 60)

    pv_root = find_plantvillage_root("datasets/plantvillage")

    sources = [
        pv_root,
        "datasets/cotton/Cotton Disease/train",
        "datasets/rice/rice_leaf_diseases",
        "datasets/sugarcane",
        "datasets/maize/data",
    ]
    # Only include sources that exist
    sources = [s for s in sources if Path(s).exists()]
    print(f"\n Sources ({len(sources)}): {sources}")

    # Step 1: Merge
    print("\n[1/2] Merging all datasets...")
    merge = subprocess.run(
        [PYTHON, "server/python/merge_datasets.py", "--output", "datasets/merged",
         "--sources"] + sources,
        capture_output=False
    )
    if merge.returncode != 0:
        print("Merge failed!"); sys.exit(1)

    # Step 2: Train
    print("\n[2/2] Training MobileNetV2 on merged dataset...")
    subprocess.run([PYTHON, "server/python/train_disease_model.py",
                    "--dataset", "datasets/merged"], capture_output=False)

    print("\nDone! Restart server.js to activate the new model.")
    print("  node server/server.js")
