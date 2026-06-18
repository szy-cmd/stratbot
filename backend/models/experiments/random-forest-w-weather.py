import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
import os

# --- CONFIG ---
PARQUET_PATH = r"J:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet"
SAVE_DIR = r"J:\F1\f1_cache\parquet-output"

# 1. Load and Prepare Data
print("📂 Loading Data for Weather-Aware Random Forest...")
df = pd.read_parquet(PARQUET_PATH)
df.columns = df.columns.str.strip()

# Engineering
df["LapDelta"] = df["LapTimeSeconds"] - df.groupby(["year", "round"])["LapTimeSeconds"].transform("median")
df["DriverAvgLap"] = df.groupby("Driver")["LapTimeSeconds"].transform("median")
df["DriverDelta"] = df["LapTimeSeconds"] - df["DriverAvgLap"]
df["FuelProxy"] = df.groupby(["year", "round"])["LapNumber"].transform("max") - df["LapNumber"]

# UPDATED FEATURES LIST
FEATURES = [
    "TyreLife", "Speed_mean", "RPM_mean", "Brake_mean", "Speed_max",
    "LapNumber", "Stint", "CompoundCode", "DRS_max",
    "FuelProxy", "DriverDelta", "AirTemp_Avg", "TrackTemp_Avg", 
    "Humidity_Avg", "WindSpeed_Avg", "Rainfall_Max"
]
TARGET = "LapDelta"

# Clean data: Ensure all features exist and drop NAs
FEATURES = [f for f in FEATURES if f in df.columns]
df = df.dropna(subset=[TARGET] + FEATURES)

train_df = df[df['year'] < 2025].copy()
test_df = df[df['year'] == 2025].copy()

X_train, y_train = train_df[FEATURES], train_df[TARGET]
X_test, y_test = test_df[FEATURES], test_df[TARGET]

# 2. Train Random Forest
print(f"🌲 Training Forest with {len(FEATURES)} features on {len(X_train):,} rows...")
model = RandomForestRegressor(n_estimators=100, max_depth=None, n_jobs=-1, random_state=42)
model.fit(X_train, y_train)
preds = model.predict(X_test)

# 3. Calculate Metrics
mae = mean_absolute_error(y_test, preds)
rmse = np.sqrt(mean_squared_error(y_test, preds))

# ---------------------------------------------------------
# 4. THE RF-ONLY DASHBOARD (REVISED FOR WEATHER)
# ---------------------------------------------------------
plt.style.use('default')
fig = plt.figure(figsize=(20, 14))
gs = fig.add_gridspec(3, 2, height_ratios=[1.5, 1.2, 0.8])

# Panel 1: Prediction Accuracy (Scatter)
ax1 = fig.add_subplot(gs[0, 0])
ax1.scatter(y_test, preds, alpha=0.2, color='#E67E22', s=10) # McLaren-style Orange for visibility
ax1.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'k--', lw=2)
ax1.set_title(f"RF: Weather-Impacted Accuracy\n(MAE: {mae:.4f}s)", fontsize=14, fontweight='bold')
ax1.set_xlabel("Actual Lap Delta (Seconds)")
ax1.set_ylabel("Predicted Lap Delta (Seconds)")
ax1.grid(True, linestyle=':', alpha=0.6)

# Panel 2: Error Distribution (Histogram)
ax2 = fig.add_subplot(gs[0, 1])
errors = preds - y_test
ax2.hist(errors, bins=50, color='#E67E22', alpha=0.7, edgecolor='black')
ax2.axvline(0, color='black', linestyle='--')
ax2.set_title("Distribution of RF Timing Errors", fontsize=14, fontweight='bold')
ax2.set_xlabel("Error (Seconds)")
ax2.set_ylabel("Frequency")

# Panel 3: Feature Importance (NOW INCLUDES WEATHER)
ax3 = fig.add_subplot(gs[1, :])
importance = model.feature_importances_
sorted_idx = np.argsort(importance)
ax3.barh(np.array(FEATURES)[sorted_idx], importance[sorted_idx], color='#E67E22')
ax3.set_title("RF Brain: How Telemetry vs. Weather Impact Lap Times", fontsize=14, fontweight='bold')
ax3.set_xlabel("Importance Score")

# Panel 4: The Data Table
ax4 = fig.add_subplot(gs[2, :])
ax4.axis('off')
table_data = [
    ["RANDOM FOREST STATISTIC", "VALUE", "EXPLANATION"],
    ["MAE", f"{mae:.4f}s", "Average error per lap"],
    ["RMSE", f"{rmse:.4f}s", "Penalty for large outliers"],
    ["Feature Count", f"{len(FEATURES)}", "Includes Engine & Environment"],
    ["Top Weather Factor", "TrackTemp_Avg" if "TrackTemp_Avg" in FEATURES else "N/A", "Most influential environmental variable"]
]

tbl = ax4.table(cellText=table_data, loc='center', cellLoc='center', colWidths=[0.25, 0.2, 0.4])
tbl.auto_set_font_size(False)
tbl.set_fontsize(13)
tbl.scale(1, 3.5)

for (row, col), cell in tbl.get_celld().items():
    if row == 0:
        cell.set_facecolor('#FFF3E0') # Light orange header
        cell.set_text_props(weight='bold')

plt.suptitle("F1 RANDOM FOREST ANALYSIS: TELEMETRY + ENVIRONMENT", fontsize=22, fontweight='bold', y=0.98)
plt.tight_layout(rect=[0, 0.03, 1, 0.95])

# Save and Output
save_path = os.path.join(SAVE_DIR, "rf_weather_dashboard.png")
plt.savefig(save_path, dpi=300)

print("\n" + "="*50)
print("             WEATHER-AWARE RF FINAL REPORT")
print("="*50)
print(f"LAP TIME ACCURACY:  {mae:.4f} seconds (MAE)")
print(f"TOP FEATURE:        {FEATURES[np.argmax(importance)]}")
print(f"WEATHER VARS:       AirTemp, TrackTemp, Humidity, Wind, Rain")
print("="*50)

plt.show()