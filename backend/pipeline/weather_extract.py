import fastf1
import pandas as pd
import os
import sys
from tqdm import tqdm
import time

# --- CONFIG ---
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import CACHE_DIR, OUTPUT_DIR

# 1. Paths and Cache Setup
cache_dir = str(CACHE_DIR)
output_dir = str(OUTPUT_DIR)
weather_subdir = os.path.join(output_dir, "weather")
os.makedirs(weather_subdir, exist_ok=True)
output_file = os.path.join(weather_subdir, "f1_weather_2018_2025.csv")

if os.path.exists(cache_dir):
    fastf1.Cache.enable_cache(cache_dir)
    print(f"✅ Cache linked: {cache_dir}")
else:
    print(f"⚠️ Warning: Cache folder not found at {cache_dir}")

if not os.path.exists(output_dir):
    os.makedirs(output_dir)

weather_rows = []
years = range(2018, 2026)

# 2. Main Extraction Loop
print("🚀 Starting Weather Extraction...")

# Nested loop: Outer for years, Inner for rounds
for year in years:
    try:
        schedule = fastf1.get_event_schedule(year)
        # Filter out testing/non-race events (RoundNumber > 0)
        races = schedule[schedule["RoundNumber"] > 0]
        
        # tqdm progress bar for the races within each year
        for _, row in tqdm(races.iterrows(), total=len(races), desc=f"Processing {year}", unit="race"):
            try:
                rnd = int(row["RoundNumber"])
                session = fastf1.get_session(year, rnd, "R")
                
                # Load only weather to keep it light and fast
                session.load(weather=True, telemetry=False, laps=False, messages=False)
                w = session.weather_data

                if not w.empty:
                    weather_rows.append({
                        "year": year,
                        "event": row["EventName"],
                        "round": rnd,
                        "AirTemp_Avg": round(w["AirTemp"].mean(), 2),
                        "TrackTemp_Avg": round(w["TrackTemp"].mean(), 2),
                        "Humidity_Avg": round(w["Humidity"].mean(), 2),
                        "WindSpeed_Avg": round(w["WindSpeed"].mean(), 2),
                        "Rainfall_Max": w["Rainfall"].any()
                    })
            except Exception:
                # Typically skips races that haven't occurred yet or have no data
                continue
                
    except Exception as e:
        print(f"Error fetching schedule for {year}: {e}")

# 3. Save Data
if weather_rows:
    weather_df = pd.DataFrame(weather_rows)
    weather_df.to_csv(output_file, index=False)
    print(f"\n✅ Done! Data for {len(weather_rows)} races saved to:")
    print(f"📍 {output_file}")
else:
    print("\n❌ No data collected.")