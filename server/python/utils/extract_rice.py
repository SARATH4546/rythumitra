import zipfile, os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

zip_path  = r"d:\Minor's\csp\datasets\archive.zip"
extract_to = r"d:\Minor's\csp\datasets\rice"

print(f"Extracting 12GB Rice dataset -> {extract_to}")
print("This may take a few minutes...")

with zipfile.ZipFile(zip_path, 'r') as z:
    names = z.namelist()
    print(f"Files to extract: {len(names):,}")
    z.extractall(extract_to)

print(f"\nExtraction complete!")

# Verify
from pathlib import Path
imgs = list(Path(extract_to).rglob("*.jpg")) + list(Path(extract_to).rglob("*.JPG")) + list(Path(extract_to).rglob("*.png"))
print(f"Total images in rice folder: {len(imgs):,}")

# Show class folders
for d in sorted(Path(extract_to).rglob("*")):
    if d.is_dir():
        count = len(list(d.glob("*.jpg"))) + len(list(d.glob("*.JPG"))) + len(list(d.glob("*.png")))
        if count > 0:
            print(f"  {d.relative_to(extract_to)}: {count} images")
