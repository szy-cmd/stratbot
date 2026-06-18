import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import lightgbm as lgb
import os
import time

# --- CONFIG ---
PARQUET_PATH = r"J:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet"
THEME_COLOR = '#00529b' 

# 1. Load and Prepare Data
print("📂 Loading Data...")
df = pd.read_parquet(PARQUET_PATH)
df.columns = df.columns.str.strip()

# Engineering
df["LapDelta"] = df["LapTimeSeconds"] - df.groupby(["year", "round"])["LapTimeSeconds"].transform("median")
df["DriverAvgLap"] = df.groupby("Driver")["LapTimeSeconds"].transform("median")
df["DriverDelta"] = df["LapTimeSeconds"] - df["DriverAvgLap"]
df["FuelProxy"] = df.groupby(["year", "round"])["LapNumber"].transform("max") - df["LapNumber"]

FEATURES = ["TyreLife", "Speed_mean", "RPM_mean", "Brake_mean", "Speed_max", 
            "LapNumber", "Stint", "CompoundCode", "DRS_max", "FuelProxy", "DriverDelta"]
TARGET = "LapDelta"

df = df.dropna(subset=[TARGET] + FEATURES)
train_df = df[df['year'] < 2025].copy()
test_df = df[df['year'] == 2025].copy()

# 2. Train Model
print("🚀 Training Strategy Model...")
model = lgb.LGBMRegressor(n_estimators=500, learning_rate=0.05, random_state=42, verbose=-1)
model.fit(train_df[FEATURES], train_df[TARGET])

# 3. Pick a Target for Simulation (e.g., Round 1, First Driver)
example_race = test_df[test_df['round'] == test_df['round'].unique()[0]].sort_values("LapNumber")
selected_driver = example_race['Driver'].unique()[0]
driver_data = example_race[example_race['Driver'] == selected_driver].copy().reset_index(drop=True)

# 4. RUN LIVE SIMULATION LOOP
print(f"\n🏎️ STARTING LIVE TRACKING FOR: {selected_driver}")
print("-" * 50)

predictions = []
actuals = []
lap_numbers = []

for i in range(len(driver_data)):
    current_lap_row = driver_data.iloc[[i]]
    current_lap_num = current_lap_row['LapNumber'].values[0]
    
    # Model predicts what the lap SHOULD be based on telemetry
    pred = model.predict(current_lap_row[FEATURES])[0]
    actual = current_lap_row[TARGET].values[0]
    
    predictions.append(pred)
    actuals.append(actual)
    lap_numbers.append(current_lap_num)
    
    # ALERTS: If actual pace is significantly slower than predicted
    diff = actual - pred
    if diff > 0.5: # Half a second threshold
        print(f"⚠️ LAP {current_lap_num}: ALERT! {selected_driver} is {diff:.3f}s slower than expected.")
    elif i % 10 == 0:
        print(f"📊 LAP {current_lap_num}: Tracking on pace. Delta: {actual:.3f}s")

# ---------------------------------------------------------
# 5. VISUALIZATION (COMPARISON GRAPH)
# ---------------------------------------------------------
plt.figure(figsize=(15, 7))

# Plot the continuous lines
plt.plot(lap_numbers, actuals, color='black', label='Actual Driver Performance', marker='o', alpha=0.4)
plt.plot(lap_numbers, predictions, color=THEME_COLOR, label='LGBM Model Prediction', lw=2, linestyle='--')

# Rolling Average (The "Trend" of the last 5 laps)
rolling_actual = pd.Series(actuals).rolling(window=5).mean()
plt.plot(lap_numbers, rolling_actual, color='red', label='Last 5 Laps Trend (Actual)', lw=2)

plt.fill_between(lap_numbers, actuals, predictions, color=THEME_COLOR, alpha=0.1, label='Model Bias')

plt.title(f"Continuous Performance Validation: {selected_driver} (2025 Season)", fontsize=15, fontweight='bold')
plt.xlabel("Lap Number")
plt.ylabel("Lap Delta (Seconds)")
plt.legend()
plt.grid(True, linestyle=':', alpha=0.6)

plt.tight_layout()
plt.show()