import pandas as pd
import numpy as np
import os
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

# --- CONFIG ---
BASE_PATH = r"I:\F1\f1_cache\output"
FILE_NAME = "f1_clean_model_ready_2018_2025_FINAL.csv"
FILE_PATH = os.path.join(BASE_PATH, FILE_NAME)
THEME_COLOR = '#4A148C'  # Deep Purple for Random Forest

# 1️⃣ Load dataset
print(f"📂 Reading file from: {FILE_PATH}")
df = pd.read_csv(FILE_PATH, low_memory=False)
df.columns = df.columns.str.strip()

# 2️⃣ Create targets & Engineering
if "LapTimeSeconds" in df.columns:
    df["LapDelta"] = df["LapTimeSeconds"] - df.groupby(["year", "round"])["LapTimeSeconds"].transform("median")
else:
    raise KeyError("LapTimeSeconds column is missing!")

df["DriverAvgLap"] = df.groupby("Driver")["LapTimeSeconds"].transform("median")
df["DriverDelta"] = df["LapTimeSeconds"] - df["DriverAvgLap"]
df["FuelProxy"] = df.groupby(["year", "round"])["LapNumber"].transform("max") - df["LapNumber"]

# 3️⃣ Define features & target
TARGET = "LapDelta"
FEATURES = [
    "TyreLife", "Speed_mean", "RPM_mean", "Brake_mean", "Speed_max",
    "LapNumber", "Stint", "CompoundCode", "DRS_max",
    "FuelProxy", "DriverDelta"
]

df = df.dropna(subset=[TARGET] + FEATURES)

# 4️⃣ Chronological Split (No random shuffle for rolling test)
# Training on 2018-2024, Testing on 2025
train_df = df[df['year'] < 2025].copy()
test_df = df[df['year'] == 2025].copy()

X_train, y_train = train_df[FEATURES], train_df[TARGET]

# 5️⃣ Train Random Forest
print(f"🚀 Training Forest (Depth 20) on {len(X_train):,} rows...")
model = RandomForestRegressor(
    n_estimators=500,
    max_depth=20,
    random_state=42,
    n_jobs=-1
)
model.fit(X_train, y_train)

# 6️⃣ ROLLING TEST: Walk through a specific 2025 Stint
# Pick the first driver and round available in 2025 for the demo
target_round = test_df['round'].unique()[0]
target_driver = test_df[test_df['round'] == target_round]['Driver'].unique()[0]

stint_data = test_df[(test_df['round'] == target_round) & 
                     (test_df['Driver'] == target_driver)].sort_values("LapNumber").copy()

print(f"\n🏎️ LIVE ROLLING TEST: {target_driver} | Round {target_round}")
print("-" * 50)

stint_data['Predicted_Delta'] = model.predict(stint_data[FEATURES])
stint_data['Error'] = stint_data[TARGET] - stint_data['Predicted_Delta']

# Simulate Pit Wall Alerts
for idx, row in stint_data.iterrows():
    if abs(row['Error']) > 0.6:
        status = "⚠️ SLOW" if row['Error'] > 0 else "🚀 FAST"
        print(f"Lap {int(row['LapNumber'])}: {status} | Gap to Model: {row['Error']:.3f}s")

# 7️⃣ VISUALIZATION
plt.figure(figsize=(16, 8))
plt.plot(stint_data['LapNumber'], stint_data[TARGET], 'ko-', alpha=0.4, label='Actual Lap Delta')
plt.plot(stint_data['LapNumber'], stint_data['Predicted_Delta'], color=THEME_COLOR, lw=3, label='RF Prediction')

# 5-Lap Rolling Trend of the Actuals
plt.plot(stint_data['LapNumber'], stint_data[TARGET].rolling(5).mean(), color='red', label='5-Lap Pace Trend')

plt.fill_between(stint_data['LapNumber'], stint_data[TARGET], stint_data['Predicted_Delta'], 
                 color=THEME_COLOR, alpha=0.1, label='Model Bias')

plt.title(f"Rolling Data Test: Random Forest Analysis ({target_driver})", fontsize=15)
plt.xlabel("Lap Number")
plt.ylabel("Seconds (Delta to Median)")
plt.legend()
plt.grid(True, linestyle=':', alpha=0.6)
plt.show()