import pandas as pd
import os

# --- CONFIG ---
BASE_PATH = r"I:\F1\f1_cache\output"
LAPS_MASTER = os.path.join(BASE_PATH, "laps_master.csv")
TELE_MASTER = os.path.join(BASE_PATH, "telemetry_aggregated_master.csv")
WEATHER_FILE = os.path.join(BASE_PATH, r"weather\f1_weather_2018_2025.csv")
FINAL_UNIFIED_FILE = os.path.join(BASE_PATH, "f1_unified_data_2018_2025.csv")

print("🔗 Starting Final Merge...")

# 1. Load the data
laps_df = pd.read_csv(LAPS_MASTER)
tele_df = pd.read_csv(TELE_MASTER)
weather_df = pd.read_csv(WEATHER_FILE)

# 2. Cleanup Data Types (Crucial for a successful merge)
# Ensuring these are integers prevents "no match" errors
laps_df['year'] = laps_df['year'].astype(int)
laps_df['round'] = laps_df['round'].astype(int)
laps_df['LapNumber'] = laps_df['LapNumber'].astype(float).astype(int)

tele_df['year'] = tele_df['year'].astype(int)
tele_df['round'] = tele_df['round'].astype(int)
tele_df['LapNumber'] = tele_df['LapNumber'].astype(int)

# 3. Merge Laps and Telemetry
# We use 'left' to keep all lap records
print("Merging Telemetry...")
master_df = pd.merge(
    laps_df, 
    tele_df, 
    on=['year', 'round', 'Driver', 'LapNumber'], 
    how='left'
)

# 4. Merge with Weather
print("Merging Weather...")
master_df = pd.merge(
    master_df, 
    weather_df, 
    on=['year', 'round'], 
    how='left'
)

# 5. Final Cleanup
# If any telemetry was missing for a lap, fill with 0
# We drop the 'event' column from weather if 'raceName' already exists
if 'event' in master_df.columns:
    master_df.drop(columns=['event'], inplace=True)

# 6. Save the Masterpiece
master_df.to_csv(FINAL_UNIFIED_FILE, index=False)

print(f"\n✅ SUCCESS! Your unified dataset is ready.")
print(f"📍 Location: {FINAL_UNIFIED_FILE}")
print(f"📊 Final Dataset Shape: {master_df.shape}")