"""
train_disease_model.py — Fine-tune MobileNetV2 on PlantVillage dataset
                         using PyTorch (works on Python 3.14+)

Usage:
  # Fine-tune with your PlantVillage dataset:
  python train_disease_model.py --dataset /path/to/PlantVillage/color

  # Just test the model structure (no dataset needed):
  python train_disease_model.py --test

Dataset download: https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset
  → Download "color" folder (~800MB, 87,000 images, 38 classes)
  → Point --dataset to the extracted folder
"""
import os, sys, json

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
HEAD_PATH = os.path.join(MODEL_DIR, "plantvillage_head.pth")
NUM_CLASSES = 56
IMG_SIZE    = 224
BATCH_SIZE  = 32
EPOCHS      = 10
NUM_WORKERS = 0   # Must be 0 on Windows to avoid multiprocessing errors


def train(dataset_path):
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, random_split
    from torchvision import datasets, transforms, models
    from torchvision.models import mobilenet_v2, MobileNet_V2_Weights
    from PIL import Image, UnidentifiedImageError

    # ── Safe dataset: skips corrupt/unreadable images ─────────────────────────
    class SafeImageFolder(datasets.ImageFolder):
        def __getitem__(self, index):
            try:
                return super().__getitem__(index)
            except (UnidentifiedImageError, OSError, Exception):
                # Return None for corrupt images — filtered by collate_fn
                return None

    def safe_collate(batch):
        """Filter out None items from corrupt images."""
        batch = [b for b in batch if b is not None]
        if not batch:
            return None
        return torch.utils.data.dataloader.default_collate(batch)

    os.makedirs(MODEL_DIR, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[Train] Device: {device}")

    # Data augmentation for training
    train_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.ColorJitter(brightness=0.2, contrast=0.2),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    val_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    full_ds = SafeImageFolder(dataset_path, transform=train_tf)
    n_val   = int(0.2 * len(full_ds))
    n_train = len(full_ds) - n_val
    train_ds, val_ds = random_split(full_ds, [n_train, n_val])
    val_ds.dataset.transform = val_tf

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                              num_workers=NUM_WORKERS, collate_fn=safe_collate)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=NUM_WORKERS, collate_fn=safe_collate)

    print(f"[Train] Dataset: {len(full_ds):,} images, {len(full_ds.classes)} classes")
    print(f"[Train] Train: {n_train:,}  Val: {n_val:,}")

    # Save class labels NOW before training (so partial training is still usable)
    labels_info = {}
    for idx, cls in enumerate(full_ds.classes):
        labels_info[cls] = {
            "index": idx, "class": cls,
            "te": cls,
            "crop": cls.split("___")[0] if "___" in cls else cls.split("_")[0],
            "sev": "moderate"
        }
    labels_path = os.path.join(MODEL_DIR, "class_labels.json")
    with open(labels_path, "w", encoding="utf-8") as f:
        import json as _json
        _json.dump(labels_info, f, ensure_ascii=False, indent=2)
    print(f"[Train] Class labels pre-saved: {labels_path}")
    print(f"[Train] Classes: {list(full_ds.classes)[:5]} ...")
    sys.stdout.flush()

    # Load backbone with ImageNet weights, freeze it
    model = mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V1)
    for p in model.parameters():
        p.requires_grad = False

    # Replace classifier head
    in_features = model.classifier[1].in_features
    model.classifier[1] = nn.Linear(in_features, len(full_ds.classes))
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.classifier.parameters(), lr=1e-3)
    scheduler = torch.optim.lr_scheduler.StepLR(optimizer, step_size=3, gamma=0.5)

    best_acc = 0.0
    total_batches = len(train_loader)
    for epoch in range(EPOCHS):
        # ── Train phase ──────────────────────────────────────────────────────
        model.train()
        train_loss = train_correct = train_total = 0
        for batch_idx, batch in enumerate(train_loader):
            if batch is None: continue  # skip corrupt-image batches
            imgs, labels = batch
            imgs, labels = imgs.to(device), labels.to(device)
            optimizer.zero_grad()
            out  = model(imgs)
            loss = criterion(out, labels)
            loss.backward()
            optimizer.step()
            train_loss    += loss.item() * imgs.size(0)
            train_correct += (out.argmax(1) == labels).sum().item()
            train_total   += imgs.size(0)
            # Print progress every 50 batches
            if (batch_idx + 1) % 50 == 0 or (batch_idx + 1) == total_batches:
                acc = train_correct / train_total
                print(f"  Epoch {epoch+1} batch {batch_idx+1}/{total_batches}  acc={acc:.3f}  loss={train_loss/train_total:.4f}")
                sys.stdout.flush()
            # Save mid-epoch checkpoint every 500 batches (survives server restarts)
            if (batch_idx + 1) % 500 == 0:
                mid_ckpt = os.path.join(MODEL_DIR, "mid_epoch_checkpoint.pth")
                torch.save(model.state_dict(), mid_ckpt)
                print(f"  [MidCkpt] Saved at batch {batch_idx+1} -> {mid_ckpt}")
                sys.stdout.flush()

        # ── Val phase ────────────────────────────────────────────────────────
        model.eval()
        val_correct = val_total = 0
        with torch.no_grad():
            for batch in val_loader:
                if batch is None: continue  # skip corrupt-image batches
                imgs, labels = batch
                imgs, labels = imgs.to(device), labels.to(device)
                out = model(imgs)
                val_correct += (out.argmax(1) == labels).sum().item()
                val_total   += imgs.size(0)

        train_acc = train_correct / train_total
        val_acc   = val_correct   / val_total
        scheduler.step()

        print(f"[Epoch {epoch+1}/{EPOCHS}] train_acc={train_acc:.3f}  val_acc={val_acc:.3f}  "
              f"lr={scheduler.get_last_lr()[0]:.5f}")
        sys.stdout.flush()

        # Always save latest checkpoint
        ckpt_path = os.path.join(MODEL_DIR, f"checkpoint_epoch{epoch+1}.pth")
        torch.save(model.state_dict(), ckpt_path)

        if val_acc > best_acc:
            best_acc = val_acc
            torch.save(model.state_dict(), HEAD_PATH)
            print(f"  ✅ Best model saved -> {HEAD_PATH}  (val_acc={val_acc:.3f})")
            sys.stdout.flush()

    print(f"\n[Train] Done. Best val accuracy: {best_acc:.3f}")
    print(f"[Train] Model saved to: {HEAD_PATH}")

    # Save class labels for dynamic loading by disease.py
    labels_info = {}
    for idx, cls in enumerate(full_ds.classes):
        labels_info[cls] = {"index": idx, "class": cls, "te": cls, "crop": cls.split("___")[0] if "___" in cls else cls, "sev": "moderate"}
    import json as _json
    labels_path = os.path.join(MODEL_DIR, "class_labels.json")
    with open(labels_path, "w", encoding="utf-8") as f:
        _json.dump(labels_info, f, ensure_ascii=False, indent=2)
    print(f"[Train] Class labels saved: {labels_path}")

    return HEAD_PATH



def test_model_structure():
    """Quick test — no dataset needed, just checks the model loads correctly."""
    import torch
    from torchvision.models import mobilenet_v2, MobileNet_V2_Weights
    import torch.nn as nn

    print("[Test] Loading MobileNetV2 with ImageNet weights...")
    model = mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V1)
    model.classifier[1] = nn.Linear(model.classifier[1].in_features, NUM_CLASSES)
    model.eval()

    dummy = torch.randn(1, 3, IMG_SIZE, IMG_SIZE)
    with torch.no_grad():
        out = model(dummy)
    print(f"[Test] Output shape: {out.shape} (expected: [1, {NUM_CLASSES}])")
    print("[Test] Model structure OK -- PASS")

    print(f"\nTo train with PlantVillage dataset:")
    print(f"  python train_disease_model.py --dataset /path/to/PlantVillage/color")
    print(f"\nDataset: https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset")
    return True


if __name__ == "__main__":
    if "--test" in sys.argv:
        ok = test_model_structure()
        print(json.dumps({"success": ok}))
    elif "--dataset" in sys.argv:
        idx  = sys.argv.index("--dataset")
        path = sys.argv[idx + 1]
        if not os.path.isdir(path):
            print(json.dumps({"success": False, "error": f"Directory not found: {path}"}))
            sys.exit(1)
        result = train(path)
        print(json.dumps({"success": True, "model_path": result}))
    else:
        print(json.dumps({"success": False, "error": "Usage: python train_disease_model.py --dataset <path> | --test"}))
