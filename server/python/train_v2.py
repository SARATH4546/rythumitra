"""
train_v2.py — Improved 2-phase training for >92% accuracy
           Phase-1 (5 epochs): frozen backbone, head-only   → fast, ~87% val_acc
           Phase-2 (5 epochs): unfreeze last 3 backbone layers → slow, target >92%

Key improvements over Phase-1:
  - Differential LR: backbone 1e-4, head 1e-3
  - Label smoothing 0.1 (reduces overconfidence)
  - Cosine annealing (smooth LR decay)
  - Gradient clipping (prevents exploding gradients in unfrozen layers)
  - Stronger augmentation (RandomErasing, larger crop variance)
  - TTA-ready val transform (center crop instead of resize)

Usage:
  python train_v2.py --dataset "D:/Minor's/csp/datasets/plantvillage/plantvillage dataset/color"
  python train_v2.py --dataset "..." --phase1-epochs 5 --phase2-epochs 8
"""
import os, sys, json, argparse

MODEL_DIR  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
HEAD_PATH  = os.path.join(MODEL_DIR, "plantvillage_head.pth")
IMG_SIZE   = 224
BATCH_SIZE = 32
NUM_WORKERS= 0   # Must be 0 on Windows


def run(dataset_path, phase1_epochs=5, phase2_epochs=5):
    import torch, torch.nn as nn
    from torch.utils.data import DataLoader, random_split
    from torchvision import datasets, transforms, models
    from torchvision.models import MobileNet_V2_Weights
    from PIL import UnidentifiedImageError

    # ── Safe dataset (skips corrupt images) ──────────────────────────────────
    class SafeImageFolder(datasets.ImageFolder):
        def __getitem__(self, index):
            try: return super().__getitem__(index)
            except: return None

    def safe_collate(batch):
        batch = [b for b in batch if b is not None]
        return torch.utils.data.dataloader.default_collate(batch) if batch else None

    os.makedirs(MODEL_DIR, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")

    # ── Transforms ────────────────────────────────────────────────────────────
    train_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(p=0.15),
        transforms.RandomRotation(25),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.25, hue=0.1),
        transforms.ToTensor(),
        transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225]),
        transforms.RandomErasing(p=0.15, scale=(0.02,0.12)),
    ])
    val_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485,0.456,0.406],[0.229,0.224,0.225]),
    ])

    full_ds  = SafeImageFolder(dataset_path, transform=train_tf)
    n_cls    = len(full_ds.classes)
    n_val    = int(0.2 * len(full_ds))
    n_train  = len(full_ds) - n_val
    train_ds, val_ds = random_split(full_ds, [n_train, n_val])
    val_ds.dataset.transform = val_tf

    train_ldr = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                           num_workers=NUM_WORKERS, collate_fn=safe_collate)
    val_ldr   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                           num_workers=NUM_WORKERS, collate_fn=safe_collate)

    print(f"Dataset : {len(full_ds):,} images | {n_cls} classes")
    print(f"Train   : {n_train:,}  |  Val: {n_val:,}")
    print(f"Classes : {full_ds.classes[:5]} ...")

    # Save class labels JSON (needed by disease_server.py)
    labels_info = {}
    for idx, cls in enumerate(full_ds.classes):
        parts = cls.split("___")
        crop_raw = parts[0].replace("_"," ").replace("(including sour)","").strip()
        labels_info[cls] = {
            "index": idx,
            "class": cls,
            "crop":  crop_raw,
            "te":    cls,
            "sev":   "moderate"
        }
    with open(os.path.join(MODEL_DIR, "class_labels.json"), "w", encoding="utf-8") as f:
        json.dump(labels_info, f, ensure_ascii=False, indent=2)
    print(f"Saved class_labels.json ({n_cls} classes)")

    # ── Build model (ImageNet backbone + fresh head) ──────────────────────────
    model = models.mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V1)
    model.classifier[1] = nn.Linear(model.last_channel, n_cls)
    model = model.to(device)

    best_acc  = 0.0
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)

    # ══════════════════════════════════════════════════════════════════════════
    # PHASE 1: Freeze backbone — train head only (fast)
    # ══════════════════════════════════════════════════════════════════════════
    if phase1_epochs > 0:
        print(f"\n{'='*65}")
        print(f"PHASE 1: Head-only training ({phase1_epochs} epochs, fast)")
        print(f"{'='*65}")

        for p in model.parameters():
            p.requires_grad = False
        for p in model.classifier.parameters():
            p.requires_grad = True

        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        print(f"Trainable: {trainable:,} params (head only)")

        opt1 = torch.optim.Adam(model.classifier.parameters(), lr=1e-3)
        sch1 = torch.optim.lr_scheduler.StepLR(opt1, step_size=2, gamma=0.5)

        for epoch in range(phase1_epochs):
            best_acc = _train_epoch(model, train_ldr, val_ldr, opt1, criterion, device,
                                    epoch, phase1_epochs, best_acc, HEAD_PATH, tag="P1")
            sch1.step()
            _save_ckpt(model, MODEL_DIR, f"v2_p1_ep{epoch+1}.pth")

    # ══════════════════════════════════════════════════════════════════════════
    # PHASE 2: Unfreeze last 3 backbone blocks — fine-tune (slower, better)
    # ══════════════════════════════════════════════════════════════════════════
    if phase2_epochs > 0:
        print(f"\n{'='*65}")
        print(f"PHASE 2: Unfreeze backbone layers 16-18 ({phase2_epochs} epochs)")
        print(f"{'='*65}")

        # Freeze all, then selectively unfreeze
        for p in model.parameters():
            p.requires_grad = False
        for i in range(16, 19):  # last 3 inverted-residual blocks
            for p in model.features[i].parameters():
                p.requires_grad = True
        for p in model.classifier.parameters():
            p.requires_grad = True

        trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
        total     = sum(p.numel() for p in model.parameters())
        print(f"Trainable: {trainable:,} / {total:,} params ({trainable/total*100:.1f}%)")
        print(f"Unfrozen : features[16], features[17], features[18] + classifier")

        backbone_params   = [p for i in range(16,19) for p in model.features[i].parameters() if p.requires_grad]
        classifier_params = list(model.classifier.parameters())

        opt2 = torch.optim.AdamW([
            {"params": backbone_params,   "lr": 1e-4, "weight_decay": 1e-4},
            {"params": classifier_params, "lr": 5e-4, "weight_decay": 1e-5},
        ])
        sch2 = torch.optim.lr_scheduler.CosineAnnealingLR(opt2, T_max=phase2_epochs, eta_min=1e-6)

        for epoch in range(phase2_epochs):
            best_acc = _train_epoch(model, train_ldr, val_ldr, opt2, criterion, device,
                                    epoch, phase2_epochs, best_acc, HEAD_PATH,
                                    tag="P2", clip_grad=True)
            sch2.step()
            _save_ckpt(model, MODEL_DIR, f"v2_p2_ep{epoch+1}.pth")

    print(f"\n{'='*65}")
    print(f"TRAINING COMPLETE")
    print(f"Best validation accuracy : {best_acc:.4f}  ({best_acc*100:.1f}%)")
    print(f"Model saved to           : {HEAD_PATH}")
    print(f"Restart disease_server.py to load new weights!")
    print(f"{'='*65}")


# ── Helpers ───────────────────────────────────────────────────────────────────
def _train_epoch(model, train_ldr, val_ldr, opt, criterion, device,
                 epoch, total_epochs, best_acc, save_path, tag="", clip_grad=False):
    import torch.nn as nn

    # Train
    model.train()
    tr_loss = tr_correct = tr_total = 0
    n_batches = len(train_ldr)

    for i, batch in enumerate(train_ldr):
        if batch is None: continue
        imgs, labels = batch
        imgs, labels = imgs.to(device), labels.to(device)
        opt.zero_grad()
        out  = model(imgs)
        loss = criterion(out, labels)
        loss.backward()
        if clip_grad:
            import torch
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        opt.step()
        tr_loss    += loss.item() * imgs.size(0)
        tr_correct += (out.argmax(1) == labels).sum().item()
        tr_total   += imgs.size(0)

        if (i+1) % 100 == 0 or (i+1) == n_batches:
            print(f"  [{tag}] Ep{epoch+1}/{total_epochs} [{i+1}/{n_batches}] "
                  f"acc={tr_correct/tr_total:.3f} loss={tr_loss/tr_total:.4f}", flush=True)

        if (i+1) % 500 == 0:
            import os
            mid = os.path.join(os.path.dirname(save_path), "v2_mid_checkpoint.pth")
            import torch
            torch.save(model.state_dict(), mid)
            print(f"  [MidCkpt] Saved at batch {i+1}", flush=True)

    # Validate
    model.eval()
    val_correct = val_total = 0
    import torch
    with torch.no_grad():
        for batch in val_ldr:
            if batch is None: continue
            imgs, labels = batch
            imgs, labels = imgs.to(device), labels.to(device)
            val_correct += (model(imgs).argmax(1) == labels).sum().item()
            val_total   += imgs.size(0)

    tr_acc  = tr_correct  / max(tr_total,  1)
    val_acc = val_correct / max(val_total, 1)

    print(f"\n  [{tag}] Epoch {epoch+1}/{total_epochs} "
          f"| train={tr_acc:.4f} ({tr_acc*100:.1f}%) "
          f"| val={val_acc:.4f} ({val_acc*100:.1f}%)", flush=True)

    if val_acc > best_acc:
        best_acc = val_acc
        torch.save(model.state_dict(), save_path)
        print(f"  *** NEW BEST: {val_acc*100:.2f}% -> saved to {save_path}", flush=True)
    return best_acc


def _save_ckpt(model, model_dir, name):
    import torch
    torch.save(model.state_dict(), os.path.join(model_dir, name))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--dataset", required=True, help="Path to PlantVillage color folder")
    ap.add_argument("--phase1-epochs", type=int, default=5)
    ap.add_argument("--phase2-epochs", type=int, default=5)
    args = ap.parse_args()

    if not os.path.isdir(args.dataset):
        print(f"ERROR: Dataset not found: {args.dataset}"); sys.exit(1)

    run(args.dataset, args.phase1_epochs, args.phase2_epochs)
