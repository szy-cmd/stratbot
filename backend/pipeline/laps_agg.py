import pandas as pd
import glob
import os
from tqdm import tqdm

# --- CONFIG ---
LAPS_DIR = r"I:\F1\f1_cache\output\laps"
OUTPUT_DIR = r"I:\F1\f1_cache\output"
FINAL_LAPS_MASTER = os.path.join(OUTPUT_DIR, "laps_master.csv")

# 1. Gather all lap files
laps_files = glob.glob(os.path.join(LAPS_DIR, "laps_*.csv"))
all_laps_list = []

print(f"🔍 Found {len(laps_files)} lap files to combine.")

# 2. Loop and stack
for file_path in tqdm(laps_files, desc="Combining Laps", unit="file"):
    try:
        df = pd.read_csv(file_path)
        
        # Clean column names
        df.columns = df.columns.str.strip()
        
        # Extract year and round from the filename to ensure it's accurate
        fname = os.path.basename(file_path)
        parts = fname.replace(".csv", "").split("_")
        year = int(parts[1])
        rnd = int(parts[2])
        
        # Explicitly set year and round in case they are missing in the file
        df['year'] = year
        df['round'] = rnd

        all_laps_list.append(df)

    except Exception as e:
        print(f"❌ Error in {file_path}: {e}")

# 3. Final Merge
if all_laps_list:
    laps_master_df = pd.concat(all_laps_list, ignore_index=True)
    
    # Save to your I: drive
    laps_master_df.to_csv(FINAL_LAPS_MASTER, index=False)
    
    print(f"\n✅ Done! Laps master file saved to: {FINAL_LAPS_MASTER}")
    print(f"📈 Total rows: {len(laps_master_df)}")
else:
    print("❌ No laps data found.")