"""
watch_and_train.py — Watches for all downloads to complete, then auto-trains.
Run this in a separate terminal window:
  python server/python/watch_and_train.py

It checks every 2 minutes. When all datasets are ready, merges + trains automatically.
"""
import os, sys, time, subprocess, json
from pathlib import Path

PYTHON = sys.executable
DATASETS = {
    "rice":       ("datasets/rice/rice_leaf_diseases",              20),
    "cotton":     ("datasets/cotton",                               200),
    "maize":      ("datasets/maize",                                200),
    "sugarcane":  ("datasets/sugarcane",                            100),
    "plantvillage":("datasets/plantvillage",                       1000),
}

def count_images(folder):
    p = Path(folder)
    if not p.exists(): return 0
    return sum(1 for f in p.rglob("*") if f.suffix.lower() in {".jpg",".jpeg",".png",".bmp"})

def unzip_if_needed(folder, zip_name):
    """Unzip if the zip file exists and not yet extracted."""
    zip_path = Path(folder) / zip_name
    if zip_path.exists() and zip_path.stat().st_size > 1000:
        print(f"  Unzipping {zip_name}...")
        try:
            import zipfile
            with zipfile.ZipFile(str(zip_path), 'r') as z:
                z.extractall(folder)
            print(f"  Unzipped OK")
            return True
        except Exception as e:
            print(f"  Unzip failed (may still be downloading): {e}")
    return False

def check_and_prepare():
    ready = {}
    for name, (folder, min_count) in DATASETS.items():
        count = count_images(folder)
        if count < min_count:
            # Try unzipping
            zips = list(Path(folder).glob("*.zip")) if Path(folder).exists() else []
            for z in zips:
                try:
                    import zipfile
                    with zipfile.ZipFile(str(z), 'r') as zf:  # Test if zip is complete
                        _ = zf.namelist()
                    unzip_if_needed(str(Path(folder).parent if folder.endswith("rice_leaf_diseases") else folder), z.name)
                    count = count_images(folder)
                except Exception:
                    pass  # Still downloading

        status = "READY" if count >= min_count else f"waiting ({count} imgs)"
        print(f"  {name:<15} {count:>6,} images  [{status}]")
        ready[name] = count >= min_count
    return ready

def run_pipeline(available_datasets):
    sources = []
    for name in available_datasets:
        folder, _ = DATASETS[name]
        if Path(folder).exists():
            sources.append(folder)

    print(f"\n>>> Merging {len(sources)} datasets...")
    merge_result = subprocess.run(
        [PYTHON, "server/python/merge_datasets.py", "--output", "datasets/merged", "--sources"] + sources
    )

    train_dataset = "datasets/merged" if merge_result.returncode == 0 else sources[0]
    print(f"\n>>> Training on {train_dataset}...")
    subprocess.run([PYTHON, "server/python/train_disease_model.py", "--dataset", train_dataset])
    print("\n Training complete! Restart server.js to use updated model.")

if __name__ == "__main__":
    print("="*60)
    print(" RythuMitra — Dataset Watch & Auto Train")
    print(" Checking every 2 minutes for completed downloads...")
    print("="*60)

    # Minimum datasets needed before we start training
    MINIMUM_READY = 2  # Start training when at least 2 datasets are ready

    while True:
        print(f"\n[{time.strftime('%H:%M:%S')}] Checking datasets...")
        ready = check_and_prepare()
        ready_names = [k for k, v in ready.items() if v]

        if len(ready_names) >= MINIMUM_READY:
            print(f"\n {len(ready_names)} datasets ready: {', '.join(ready_names)}")
            print(" Starting merge + training pipeline...")
            run_pipeline(ready_names)
            break
        else:
            remaining = MINIMUM_READY - len(ready_names)
            print(f"\n Waiting for {remaining} more dataset(s)... (checking again in 2 min)")
            time.sleep(120)
