import pandas as pd
import os
import sys

# --- CONFIG ---
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import OUTPUT_DIR as LOCAL_OUTPUT

# --- PATHS (historical clean csv lives in J: output alongside local OUTPUT; final parq in parquet-output) ---
# For full local repro, place/generate f1_clean...FINAL.csv under data/output or override INPUT
INPUT_FILE = r"J:\F1\f1_cache\output\f1_clean_model_ready_2018_2025_FINAL.csv"
PARQUET_OUTPUT_DIR = r"J:\F1\f1_cache\parquet-output"
OUTPUT_FILE = os.path.join(PARQUET_OUTPUT_DIR, "f1_model_ready_2018_2025.parquet")

# 1. Create directory if it doesn't exist
if not os.path.exists(PARQUET_OUTPUT_DIR):
    os.makedirs(PARQUET_OUTPUT_DIR)
    print(f"📁 Created folder: {PARQUET_OUTPUT_DIR}")

# 2. Load CSV
print("⏳ Reading CSV (this might take a moment due to file size)...")
df = pd.read_csv(INPUT_FILE, low_memory=False)

# 3. Quick Data Cleaning
# Stripping column names is vital before saving to Parquet
df.columns = df.columns.str.strip()

# 4. Save to Parquet
print("📦 Converting to Parquet...")
# engine='pyarrow' is the fastest for large F1 datasets
df.to_parquet(OUTPUT_FILE, engine='pyarrow', index=False)

# 5. Compare Sizes
csv_size = os.path.getsize(INPUT_FILE) / (1024 * 1024)
pq_size = os.path.getsize(OUTPUT_FILE) / (1024 * 1024)

print(f"\n✅ Conversion Complete!")
print(f"📄 CSV Size: {csv_size:.2f} MB")
print(f"💎 Parquet Size: {pq_size:.2f} MB")
print(f"🚀 Compression Ratio: {csv_size/pq_size:.1f}x smaller")