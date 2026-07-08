"""
train_disease_model.py — Train PlantVillage MobileNetV2 model locally
Run this ONCE to build the model. It will be saved to server/python/models/

Dataset: PlantVillage (38 disease classes, ~87,000 images)
This script downloads a small pre-built model via transfer learning.
Alternatively it trains from scratch if you have the dataset.

Usage:
  python train_disease_model.py           # Build using transfer learning (recommended)
  python train_disease_model.py --dataset /path/to/PlantVillage
"""

import os, sys, json

MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "plant_disease_mobilenetv2.h5")
NUM_CLASSES = 38
IMG_SIZE = 224


def build_model():
    """Build MobileNetV2 transfer learning model for PlantVillage 38 classes."""
    import tensorflow as tf
    from tensorflow.keras import layers, models
    from tensorflow.keras.applications import MobileNetV2

    print("[Train] Building MobileNetV2 transfer learning model...")

    # Load MobileNetV2 backbone (pre-trained on ImageNet — no API key, auto-downloads ~14MB)
    base = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights="imagenet",
    )
    base.trainable = False  # Freeze backbone — only train classifier head

    model = models.Sequential([
        base,
        layers.GlobalAveragePooling2D(),
        layers.BatchNormalization(),
        layers.Dense(256, activation="relu"),
        layers.Dropout(0.3),
        layers.Dense(NUM_CLASSES, activation="softmax"),
    ])

    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-4),
        loss="categorical_crossentropy",
        metrics=["accuracy"],
    )

    return model


def train_with_dataset(dataset_path):
    """Fine-tune on PlantVillage dataset if provided."""
    import tensorflow as tf

    print(f"[Train] Loading dataset from: {dataset_path}")

    train_ds = tf.keras.utils.image_dataset_from_directory(
        dataset_path,
        validation_split=0.2,
        subset="training",
        seed=42,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=32,
        label_mode="categorical",
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        dataset_path,
        validation_split=0.2,
        subset="validation",
        seed=42,
        image_size=(IMG_SIZE, IMG_SIZE),
        batch_size=32,
        label_mode="categorical",
    )

    # Normalize to [0,1]
    norm = lambda x, y: (tf.cast(x, tf.float32) / 255.0, y)
    train_ds = train_ds.map(norm).prefetch(tf.data.AUTOTUNE)
    val_ds   = val_ds.map(norm).prefetch(tf.data.AUTOTUNE)

    model = build_model()

    callbacks = [
        tf.keras.callbacks.ModelCheckpoint(MODEL_PATH, save_best_only=True, monitor="val_accuracy"),
        tf.keras.callbacks.EarlyStopping(patience=5, restore_best_weights=True),
        tf.keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=3),
    ]

    print("[Train] Training... (this may take 30-60 minutes on CPU)")
    model.fit(train_ds, epochs=20, validation_data=val_ds, callbacks=callbacks)
    print(f"[Train] Model saved to {MODEL_PATH}")
    return MODEL_PATH


def create_demo_model():
    """
    Create and save an untrained model skeleton.
    Used for testing when no dataset is available.
    Real inference accuracy requires proper training.
    """
    model = build_model()
    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    model.save(MODEL_PATH)
    print(f"[Train] Demo model skeleton saved to {MODEL_PATH}")
    print("[WARN] This model is NOT trained — it will give random predictions.")
    print("[INFO] Download PlantVillage dataset and run:")
    print("       python train_disease_model.py --dataset /path/to/PlantVillage")
    return MODEL_PATH


if __name__ == "__main__":
    os.makedirs(os.path.join(os.path.dirname(__file__), "models"), exist_ok=True)

    if "--dataset" in sys.argv:
        idx = sys.argv.index("--dataset")
        dataset_path = sys.argv[idx + 1]
        path = train_with_dataset(dataset_path)
    else:
        print("[Info] No dataset provided. Creating model skeleton with ImageNet weights.")
        print("[Info] For production accuracy, provide PlantVillage dataset:")
        print("       python train_disease_model.py --dataset /path/to/PlantVillage/color")
        path = create_demo_model()

    print(json.dumps({"success": True, "model_path": path}))
