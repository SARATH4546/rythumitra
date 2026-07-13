import zipfile, os, sys, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

zip_path = r"d:\Minor's\csp\datasets\archive.zip"

print(f"Archive: {zip_path}")
print(f"Size   : {os.path.getsize(zip_path)/1e9:.2f} GB")
print("\nScanning contents...")

with zipfile.ZipFile(zip_path, 'r') as z:
    names = z.namelist()
    print(f"Total entries: {len(names):,}")

    # Find top-level and second-level folders
    level1 = set()
    level2 = set()
    ext_counts = {}
    for n in names:
        parts = n.rstrip('/').split('/')
        if parts[0]:
            level1.add(parts[0])
        if len(parts) >= 2 and parts[1]:
            level2.add(f"{parts[0]}/{parts[1]}")
        ext = os.path.splitext(n)[1].lower()
        if ext:
            ext_counts[ext] = ext_counts.get(ext, 0) + 1

    print(f"\nTop-level folders/files: {sorted(level1)[:10]}")
    print(f"\nSecond-level sample:")
    for f in sorted(level2)[:20]:
        print(f"  {f}")
    print(f"\nFile types: {dict(sorted(ext_counts.items(), key=lambda x: -x[1])[:8])}")
