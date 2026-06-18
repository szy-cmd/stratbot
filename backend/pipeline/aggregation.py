import pandas as pd
import glob
import os
import sys
from tqdm import tqdm

# --- CONFIG (use shared backend config for local runs; override for historical J:\F1 output) ---
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import OUTPUT_DIR

TELE_DIR = os.path.join(OUTPUT_DIR, "telemetry")
# We save a temporary "checkpoint" file so we don't lose progress
FINAL_TELE_AGG = os.path.join(OUTPUT_DIR, "telemetry_aggregated_master.csv")

telemetry_files = glob.glob(os.path.join(TELE_DIR, "telemetry_*.csv"))
all_processed_chunks = []

print(f"🔍 Found {len(telemetry_files)} telemetry files.")

for file_path in tqdm(telemetry_files, desc="Aggregating Telemetry"):
    try:
        # Load the massive file
        df = pd.read_csv(file_path)
        
        # Extract metadata from filename (for later merging)
        # filename format: telemetry_2018_01.csv
        fname = os.path.basename(file_path)
        parts = fname.replace(".csv", "").split("_")
        year = int(parts[1])
        rnd = int(parts[2])

        # Core Aggregation Logic
        # This turns thousands of rows into 1 row per driver per lap
        agg = df.groupby(['Driver', 'LapNumber']).agg({
            'Speed': ['mean', 'max'],
            'RPM': 'mean',
            'Throttle': 'mean',
            'Brake': 'mean', # This gives the % of the lap spent braking
            'DRS': 'max',    # 1 if used at all during the lap
            'nGear': 'max'
        }).reset_index()

        # Rename columns to be flat (e.g., Speed_mean)
        agg.columns = [f"{c[0]}_{c[1]}".strip("_") for c in agg.columns.values]
        
        # Attach the year and round so we know which race this belongs to
        agg['year'] = year
        agg['round'] = rnd

        all_processed_chunks.append(agg)
        
        # OPTIONAL: Save every 50 files to a temporary CSV to prevent total data loss
        if len(all_processed_chunks) % 50 == 0:
            temp_df = pd.concat(all_processed_chunks, ignore_index=True)
            temp_df.to_csv(FINAL_TELE_AGG, index=False)

    except Exception as e:
        print(f"\n❌ Error in {file_path}: {e}")
        continue

# --- FINAL SAVE ---
if all_processed_chunks:
    final_tele_df = pd.concat(all_processed_chunks, ignore_index=True)
    final_tele_df.to_csv(FINAL_TELE_AGG, index=False)
    print(f"\n✅ Done! Aggregated telemetry saved to: {FINAL_TELE_AGG}")
    print(f"Total rows: {len(final_tele_df)}")