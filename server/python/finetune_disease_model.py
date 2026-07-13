"""
finetune_disease_model.py — Phase-2 fine-tuning: unfreeze last 3 MobileNetV2 backbone layers
                            for higher accuracy (target: >92% val_acc)

Strategy vs Phase-1 (head-only):
  - Phase-1 trained ONLY the classifier head (71K params) for 10 epochs → ~85-89% val_acc
  - Phase-2 unfreezes features[16], features[17], features[18] + classifier
    → 4x more trainable params, learns better feature representations
  - Differential LR: backbone layers at 1e-4, classifier head at 1e-3
  - Cosine annealing scheduler for smooth convergence
  - Starts from best existing checkpoint (plantvillage_head.pth = epoch-5 best)
  - Label smoothing (0.1) to reduce overconfidence
  - Mixed augmentations: RandomErasing, CutMix-ready transforms

Usage:
  python finetune_disease_model.py --dataset D:/path/to/PlantVillage/color
  python finetune_disease_model.py --dataset D:/path/to/PlantVillage/color --epochs 15

Download dataset:
  https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset
  → Download "color" folder (~800MB, 54,305 images, 38+ classes)
"""
import os, sys, json, argparse

MODEL_DIR   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
HEAD_PATH   = os.path.join(MODEL_DIR, "plantvillage_head.pth")
FINE_PATH   = os.path.join(MODEL_DIR, "plantvillage_finetuned.pth")

IMG_SIZE    = 224
BATCH_SIZE  = 32
NUM_WORKERS = 0   # Must be 0 on Windows
UNFREEZE_FROM = 16   # unfreeze features[16], [17], [18]

def finetune(dataset_path, epochs=10):
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, random_split
    from torchvision import datasets, transforms, models
    from torchvision.models import MobileNet_V2_Weights
    from PIL import Image, UnidentifiedImageError

    # ── Safe dataset ──────────────────────────────────────────────────────────
    class SafeImageFolder(datasets.ImageFolder):
        def __getitem__(self, index):
            try:    return super().__getitem__(index)
            except: return None

    def safe_collate(batch):
        batch = [b for b in batch if b is not None]
        return torch.utils.data.dataloader.default_collate(batch) if batch else None

    os.makedirs(MODEL_DIR, exist_ok=True)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[FineTune] Device: {device}")

    # ── Stronger augmentations for fine-tuning phase ──────────────────────────
    train_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE + 32, IMG_SIZE + 32)),
        transforms.RandomCrop(IMG_SIZE),
        transforms.RandomHorizontalFlip(),
        transforms.RandomVerticalFlip(p=0.2),
        transforms.RandomRotation(20),
        transforms.ColorJitter(brightness=0.3, contrast=0.3, saturation=0.2, hue=0.1),
        transforms.RandomGrayscale(p=0.05),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
        transforms.RandomErasing(p=0.15, scale=(0.02, 0.1)),
    ])
    val_tf = transforms.Compose([
        transforms.Resize((IMG_SIZE, IMG_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])

    full_ds  = SafeImageFolder(dataset_path, transform=train_tf)
    n_classes = len(full_ds.classes)
    n_val    = int(0.2 * len(full_ds))
    n_train  = len(full_ds) - n_val
    train_ds, val_ds = random_split(full_ds, [n_train, n_val])
    val_ds.dataset.transform = val_tf

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True,
                              num_workers=NUM_WORKERS, collate_fn=safe_collate)
    val_loader   = DataLoader(val_ds,   batch_size=BATCH_SIZE, shuffle=False,
                              num_workers=NUM_WORKERS, collate_fn=safe_collate)

    print(f"[FineTune] Dataset: {len(full_ds):,} images | {n_classes} classes")
    print(f"[FineTune] Train: {n_train:,}  Val: {n_val:,}")

    # ── Load model ────────────────────────────────────────────────────────────
    model = models.mobilenet_v2(weights=None)
    model.classifier[1] = nn.Linear(model.last_channel, n_classes)

    if os.path.exists(HEAD_PATH):
        ckpt = torch.load(HEAD_PATH, map_location="cpu", weights_only=True)
        model.load_state_dict(ckpt)
        print(f"[FineTune] Loaded best Phase-1 weights: {HEAD_PATH}")
    else:
        # Fall back to ImageNet weights + random head
        model = models.mobilenet_v2(weights=MobileNet_V2_Weights.IMAGENET1K_V1)
        model.classifier[1] = nn.Linear(model.last_channel, n_classes)
        print("[FineTune] No Phase-1 checkpoint found, starting from ImageNet weights")

    # ── Selective unfreezing: freeze everything, then unfreeze last 3 blocks ──
    for p in model.parameters():
        p.requires_grad = False

    # Unfreeze features[16], [17], [18] (last 3 inverted-residual blocks)
    for i in range(UNFREEZE_FROM, 19):
        for p in model.features[i].parameters():
            p.requires_grad = True

    # Always unfreeze classifier
    for p in model.classifier.parameters():
        p.requires_grad = True

    model = model.to(device)

    # Count trainable params
    total_params   = sum(p.numel() for p in model.parameters())
    trained_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[FineTune] Total params: {total_params:,} | Trainable: {trained_params:,} ({trained_params/total_params*100:.1f}%)")
    print(f"[FineTune] Unfrozen: features[{UNFREEZE_FROM}-18] + classifier")

    # ── Differential learning rates ──────────────────────────────────────────
    backbone_params    = [p for i in range(UNFREEZE_FROM, 19) for p in model.features[i].parameters() if p.requires_grad]
    classifier_params  = list(model.classifier.parameters())

    optimizer = torch.optim.AdamW([
        {"params": backbone_params,   "lr": 1e-4, "weight_decay": 1e-4},
        {"params": classifier_params, "lr": 5e-4, "weight_decay": 1e-5},
    ])

    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-6)
    # Label smoothing reduces overconfidence → better generalization
    criterion = nn.CrossEntropyLoss(label_smoothing=0.1)

    best_acc = 0.0
    total_batches = len(train_loader)

    print(f"\n[FineTune] Starting fine-tuning for {epochs} epochs...")
    print("=" * 65)
    sys.stdout.flush()

    for epoch in range(epochs):
        # ── Train ─────────────────────────────────────────────────────────────
        model.train()
        train_loss = train_correct = train_total = 0

        for batch_idx, batch in enumerate(train_loader):
            if batch is None: continue
            imgs, labels = batch
            imgs, labels = imgs.to(device), labels.to(device)

            optimizer.zero_grad()
            out  = model(imgs)
            loss = criterion(out, labels)
            loss.backward()
            # Gradient clipping — prevents exploding gradients with unfrozen backbone
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
            optimizer.step()

            train_loss    += loss.item() * imgs.size(0)
            train_correct += (out.argmax(1) == labels).sum().item()
            train_total   += imgs.size(0)

            if (batch_idx + 1) % 100 == 0 or (batch_idx + 1) == total_batches:
                acc = train_correct / train_total
                lr_bb  = optimizer.param_groups[0]["lr"]
                lr_cls = optimizer.param_groups[1]["lr"]
                print(f"  Ep{epoch+1} [{batch_idx+1}/{total_batches}] "
                      f"acc={acc:.3f}  loss={train_loss/train_total:.4f}  "
                      f"lr_backbone={lr_bb:.2e}  lr_head={lr_cls:.2e}")
                sys.stdout.flush()

            # Mid-epoch checkpoint every 500 batches
            if (batch_idx + 1) % 500 == 0:
                mid = os.path.join(MODEL_DIR, "finetune_mid_checkpoint.pth")
                torch.save(model.state_dict(), mid)
                print(f"  [MidCkpt] Saved at batch {batch_idx+1}")
                sys.stdout.flush()

        # ── Validate ──────────────────────────────────────────────────────────
        model.eval()
        val_correct = val_total = 0
        with torch.no_grad():
            for batch in val_loader:
                if batch is None: continue
                imgs, labels = batch
                imgs, labels = imgs.to(device), labels.to(device)
                out = model(imgs)
                val_correct += (out.argmax(1) == labels).sum().item()
                val_total   += imgs.size(0)

        train_acc = train_correct / max(train_total, 1)
        val_acc   = val_correct   / max(val_total,   1)
        scheduler.step()

        print(f"\n{'='*65}")
        print(f"  Epoch {epoch+1}/{epochs}  |  train_acc={train_acc:.4f} ({train_acc*100:.1f}%)"
              f"  val_acc={val_acc:.4f} ({val_acc*100:.1f}%)")

        # Save epoch checkpoint
        ep_ckpt = os.path.join(MODEL_DIR, f"finetune_epoch{epoch+1}.pth")
        torch.save(model.state_dict(), ep_ckpt)

        if val_acc > best_acc:
            best_acc = val_acc
            # Overwrite the main model used by disease_server.py
            torch.save(model.state_dict(), HEAD_PATH)
            torch.save(model.state_dict(), FINE_PATH)
            print(f"  *** NEW BEST: val_acc={val_acc:.4f} ({val_acc*100:.1f}%) → saved to {HEAD_PATH}")
        else:
            print(f"  Best so far: {best_acc:.4f} ({best_acc*100:.1f}%)")

        print(f"{'='*65}\n")
        sys.stdout.flush()

    print(f"\n[FineTune] DONE!")
    print(f"[FineTune] Best validation accuracy: {best_acc:.4f} ({best_acc*100:.1f}%)")
    print(f"[FineTune] Model saved to: {HEAD_PATH}")
    print(f"[FineTune] Restart disease_server.py to load new weights.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Phase-2 fine-tuning: unfreeze MobileNetV2 backbone")
    parser.add_argument("--dataset", required=True,
                        help="Path to PlantVillage 'color' folder (e.g. D:/data/PlantVillage/color)")
    parser.add_argument("--epochs", type=int, default=10,
                        help="Number of fine-tuning epochs (default: 10)")
    parser.add_argument("--unfreeze-from", type=int, default=16,
                        help="Unfreeze MobileNetV2 features from this index (default: 16 = last 3 blocks)")
    args = parser.parse_args()
    UNFREEZE_FROM = args.unfreeze_from

    if not os.path.isdir(args.dataset):
        print(f"ERROR: Dataset path not found: {args.dataset}")
        print("Download from: https://www.kaggle.com/datasets/abdallahalidev/plantvillage-dataset")
        sys.exit(1)

    finetune(args.dataset, epochs=args.epochs)
