import torch, sys, os, json
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

model_path  = 'server/python/models/plantvillage_head.pth'
labels_path = 'server/python/models/class_labels.json'

# Check model
if os.path.exists(model_path):
    state = torch.load(model_path, map_location='cpu', weights_only=True)
    num_classes = state['classifier.1.weight'].shape[0]
    import time
    mtime = time.ctime(os.path.getmtime(model_path))
    print(f"Model OK: {num_classes} output classes")
    print(f"Saved at: {mtime}")
else:
    print("No model found at", model_path)

# Check labels
if os.path.exists(labels_path):
    with open(labels_path, encoding='utf-8') as f:
        d = json.load(f)
    print(f"\nClass labels: {len(d)} classes")
    for k, v in sorted(d.items(), key=lambda x: x[1]['index'])[:5]:
        print(f"  [{v['index']:>2}] {k}")
    print("  ...")
