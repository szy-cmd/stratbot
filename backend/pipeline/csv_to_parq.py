import os
import glob
import time
import sys
import pandas as pd
from tqdm import tqdm

# --- CONFIG (use shared backend config for CSV source in local data/output; parquet slices kept in historical J:\ location) ---
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import OUTPUT_DIR

# ============================
# INPUT (CSV - READ ONLY)
# ============================
CSV_LAPS_DIR = os.path.join(OUTPUT_DIR, "laps")
CSV_TEL_DIR = os.path.join(OUTPUT_DIR, "telemetry")

# ============================
# OUTPUT (PARQUET) - the partitioned parquet-output with images etc is at J: (historical work location)
# ============================
PARQUET_BASE_DIR = r"J:\F1\f1_cache\parquet-output"
PARQUET_LAPS_DIR = os.path.join(PARQUET_BASE_DIR, "laps_parquet")
PARQUET_TEL_DIR = os.path.join(PARQUET_BASE_DIR, "telemetry_parquet")

# ============================
# CREATE OUTPUT FOLDERS
# ============================
os.makedirs(PARQUET_LAPS_DIR, exist_ok=True)
os.makedirs(PARQUET_TEL_DIR, exist_ok=True)

def convert_csv_to_parquet(file_list, output_dir, desc):
    """Helper function to keep code DRY (Don't Repeat Yourself)"""
    print(f"\n🚀 Starting {desc} conversion...")
    
    # Use engine='pyarrow' for better performance with large F1 datasets
    for csv_path in tqdm(file_list, desc=desc, unit="file"):
        filename = os.path.basename(csv_path)
        parquet_path = os.path.join(output_dir, filename.replace(".csv", ".parquet"))

        if os.path.exists(parquet_path):
            continue

        try:
            start = time.time()
            df = pd.read_csv(csv_path, low_memory=False) # low_memory=False helps with mixed types in F1 data
            df.to_parquet(parquet_path, index=False, engine='pyarrow')
            elapsed = time.time() - start
            
            # Use tqdm.write so the progress bar doesn't glitch
            tqdm.write(f"  ⏱️ {filename} → {elapsed:.1f}s")
        except Exception as e:
            tqdm.write(f"  ❌ Error converting {filename}: {e}")

# ============================
# EXECUTION
# ============================
lap_csv_files = glob.glob(os.path.join(CSV_LAPS_DIR, "*.csv"))
tel_csv_files = glob.glob(os.path.join(CSV_TEL_DIR, "*.csv"))

convert_csv_to_parquet(lap_csv_files, PARQUET_LAPS_DIR, "Laps")
convert_csv_to_parquet(tel_csv_files, PARQUET_TEL_DIR, "Telemetry")

print("\n✅ ALL CSV → PARQUET CONVERSION COMPLETE")