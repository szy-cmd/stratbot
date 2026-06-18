import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from xgboost import XGBRegressor, plot_importance
from sklearn.metrics import mean_absolute_error, mean_squared_error
import os

# --- CONFIG ---
PARQUET_PATH = r"I:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet"
SAVE_DIR = r"I:\F1\f1_cache\parquet-output"

# 1. Load and Prepare Data
print("📂 Loading Data...")
df = pd.read_parquet(PARQUET_PATH)
df.columns = df.columns.str.strip()

# Engineering (Consistent with previous versions)
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

X_train, y_train = train_df[FEATURES], train_df[TARGET]
X_test, y_test = test_df[FEATURES], test_df[TARGET]

# 2. Train XGBoost
print("🚀 Training XGBoost...")
model = XGBRegressor(n_estimators=500, learning_rate=0.05, max_depth=6, tree_method="hist", random_state=42)
model.fit(X_train, y_train)
preds = model.predict(X_test)

# 3. Calculate Metrics
mae = mean_absolute_error(y_test, preds)
rmse = np.sqrt(mean_squared_error(y_test, preds))

# ---------------------------------------------------------
# 4. THE XGBOOST-ONLY DASHBOARD (WHITE BACKGROUND)
# ---------------------------------------------------------
plt.style.use('default')
fig = plt.figure(figsize=(20, 14))
gs = fig.add_gridspec(3, 2, height_ratios=[1.5, 1.2, 0.8])

# Panel 1: Prediction Accuracy (Scatter)
ax1 = fig.add_subplot(gs[0, 0])
ax1.scatter(y_test, preds, alpha=0.2, color='#ff4500', s=10)
ax1.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'k--', lw=2)
ax1.set_title(f"XGBoost: Predicted vs Actual Delta\n(MAE: {mae:.4f}s)", fontsize=14, fontweight='bold')
ax1.set_xlabel("Actual Lap Delta (Seconds)")
ax1.set_ylabel("Predicted Lap Delta (Seconds)")
ax1.grid(True, linestyle=':', alpha=0.6)

# Panel 2: Error Distribution (Histogram)
ax2 = fig.add_subplot(gs[0, 1])
errors = preds - y_test
ax2.hist(errors, bins=50, color='#ff4500', alpha=0.7, edgecolor='black')
ax2.axvline(0, color='black', linestyle='--')
ax2.set_title("Distribution of Timing Errors", fontsize=14, fontweight='bold')
ax2.set_xlabel("Error (Seconds) - Zero is Perfect")
ax2.set_ylabel("Frequency")

# Panel 3: Feature Importance (What matters most?)
ax3 = fig.add_subplot(gs[1, :])
# Get importance and sort
importance = model.feature_importances_
sorted_idx = np.argsort(importance)
ax3.barh(np.array(FEATURES)[sorted_idx], importance[sorted_idx], color='#ff4500')
ax3.set_title("Telemetry Importance: What drives Lap Times?", fontsize=14, fontweight='bold')
ax3.set_xlabel("Relative Importance Score")

# Panel 4: The Data Table
ax4 = fig.add_subplot(gs[2, :])
ax4.axis('off')
table_data = [
    ["XGBOOST STATISTIC", "VALUE", "EXPLANATION"],
    ["Mean Absolute Error (MAE)", f"{mae:.4f}s", "Average timing gap per lap"],
    ["Root Mean Sq. Error (RMSE)", f"{rmse:.4f}s", "Penalty score for large misses"],
    ["Test Laps (2025)", f"{len(X_test):,}", "Number of laps predicted"],
    ["Most Important Feature", FEATURES[np.argmax(importance)], "The #1 factor for timing prediction"]
]

tbl = ax4.table(cellText=table_data, loc='center', cellLoc='center', colWidths=[0.25, 0.2, 0.4])
tbl.auto_set_font_size(False)
tbl.set_fontsize(13)
tbl.scale(1, 3.5)

# Formatting Table Headers
for (row, col), cell in tbl.get_celld().items():
    if row == 0:
        cell.set_facecolor('#eeeeee')
        cell.set_text_props(weight='bold')

plt.suptitle("XGBOOST F1 TELEMETRY ANALYSIS: 2025 VALIDATION", fontsize=22, fontweight='bold', y=0.98)
plt.tight_layout(rect=[0, 0.03, 1, 0.95])

# Save and Output to Terminal
save_path = os.path.join(SAVE_DIR, "xgboost_master_dashboard.png")
plt.savefig(save_path, dpi=300)

print("\n" + "="*50)
print("             XGBOOST FINAL REPORT")
print("="*50)
print(f"TOTAL LAPS TESTED:  {len(X_test):,}")
print(f"LAP TIME ACCURACY:  {mae:.4f} seconds (MAE)")
print(f"STABILITY SCORE:    {rmse:.4f} (RMSE)")
print(f"KEY TELEMETRY:      {FEATURES[np.argmax(importance)]}")
print("="*50)

plt.show()