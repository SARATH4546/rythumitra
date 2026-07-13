import zipfile, os, sys

zip_path = r"d:\Minor's\csp\datasets\archive (1).zip"
extract_to = r"d:\Minor's\csp\datasets\plantvillage"

print(f"Archive: {zip_path}")
print(f"Size: {os.path.getsize(zip_path)/1e6:.0f} MB")

try:
    with zipfile.ZipFile(zip_path, 'r') as z:
        names = z.namelist()
        # Show structure
        folders = set()
        for n in names:
            parts = n.split('/')
            if len(parts) >= 2:
                folders.add(parts[0] + '/' + parts[1] if len(parts) > 2 else parts[0])
        print(f"\nTotal files  : {len(names):,}")
        print(f"Sample folders:")
        for f in sorted(folders)[:15]:
            print(f"  {f}")
        print("  ...")
        print(f"\nExtracting to: {extract_to}")
        z.extractall(extract_to)
        print("Extraction complete!")
except Exception as e:
    print(f"Error: {e}")
