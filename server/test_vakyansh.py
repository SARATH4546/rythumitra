
"""Direct test of Vakyansh Telugu Wav2Vec2 model"""
import soundfile as sf
import torch
import numpy as np
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor

MODEL_ID = "Harveenchadha/vakyansh-wav2vec2-telugu-tem-100"
print("Loading model...")
processor = Wav2Vec2Processor.from_pretrained(MODEL_ID)
model = Wav2Vec2ForCTC.from_pretrained(MODEL_ID)
model.eval()
print("Model loaded")

# Test with the normalized audio
wav_path = "test_audio_norm.wav"
audio, sr = sf.read(wav_path)
print(f"Audio: shape={audio.shape} sr={sr} min={audio.min():.3f} max={audio.max():.3f}")

# Ensure float32
audio = audio.astype(np.float32)

inputs = processor(audio, sampling_rate=16000, return_tensors="pt", padding=True)
print(f"Input shape: {inputs.input_values.shape}")

with torch.no_grad():
    logits = model(**inputs).logits

print(f"Logits shape: {logits.shape}")
predicted_ids = torch.argmax(logits, dim=-1)
print(f"Predicted IDs (first 20): {predicted_ids[0][:20].tolist()}")

# Decode
transcript = processor.decode(predicted_ids[0])
print(f"Transcript: '{transcript}'")

# Also show what tokens were predicted
tokens = [processor.tokenizer.convert_ids_to_tokens([i.item()])[0] for i in predicted_ids[0][:30]]
print(f"Tokens: {tokens}")

# Try batch decode
transcripts = processor.batch_decode(predicted_ids)
print(f"Batch decode: {transcripts}")
