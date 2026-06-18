import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import xgboost as xgb  # <--- New Library
from sklearn.metrics import mean_absolute_error, mean_squared_error
import os

# --- CONFIG ---
PARQUET_PATH = r"J:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet"
SAVE_DIR = r"J:\F1\f1_cache\parquet-output"

# 1. Load and Prepare Data
print("📂 Loading Data for XGBoost Analysis...")
df = pd.read_parquet(PARQUET_PATH)
df.columns = df.columns.str.strip()

# Engineering (Same as your RF logic)
df["LapDelta"] = df["LapTimeSeconds"] - df.groupby(["year", "round"])["LapTimeSeconds"].transform("median")
df["DriverAvgLap"] = df.groupby("Driver")["LapTimeSeconds"].transform("median")
df["DriverDelta"] = df["LapTimeSeconds"] - df["DriverAvgLap"]
df["FuelProxy"] = df.groupby(["year", "round"])["LapNumber"].transform("max") - df["LapNumber"]

FEATURES = [
    "TyreLife", "Speed_mean", "RPM_mean", "Brake_mean", "Speed_max",
    "LapNumber", "Stint", "CompoundCode", "DRS_max",
    "FuelProxy", "DriverDelta", "AirTemp_Avg", "TrackTemp_Avg", 
    "Humidity_Avg", "WindSpeed_Avg", "Rainfall_Max"
]
TARGET = "LapDelta"

FEATURES = [f for f in FEATURES if f in df.columns]
df = df.dropna(subset=[TARGET] + FEATURES)

train_df = df[df['year'] < 2025].copy()
test_df = df[df['year'] == 2025].copy()

X_train, y_train = train_df[FEATURES], train_df[TARGET]
X_test, y_test = test_df[FEATURES], test_df[TARGET]

# 2. Train XGBoost
# We use XGBRegressor which is the Scikit-Learn compatible API
print(f"🚀 Training XGBoost with {len(FEATURES)} features on {len(X_train):,} rows...")
model = xgb.XGBRegressor(
    n_estimators=1000,        # Higher than RF because boosting trees are "weaker"
    learning_rate=0.05,       # Controls how fast the model "learns" from errors
    max_depth=6,              # Standard for XGB (much shallower than RF)
    subsample=0.8,            # Prevents overfitting by using 80% of rows per tree
    colsample_bytree=0.8,     # Uses 80% of features per tree
    n_jobs=-1,
    random_state=42,
    objective='reg:squarederror'
)

model.fit(X_train, y_train)
preds = model.predict(X_test)

# 3. Calculate Metrics
mae = mean_absolute_error(y_test, preds)
rmse = np.sqrt(mean_squared_error(y_test, preds))

# ---------------------------------------------------------
# 4. THE XGB-ONLY DASHBOARD
# ---------------------------------------------------------
plt.style.use('default')
fig = plt.figure(figsize=(20, 14))
gs = fig.add_gridspec(3, 2, height_ratios=[1.5, 1.2, 0.8])

# Panel 1: Prediction Accuracy (XGB Red)
ax1 = fig.add_subplot(gs[0, 0])
ax1.scatter(y_test, preds, alpha=0.2, color='#D32F2F', s=10) 
ax1.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'k--', lw=2)
ax1.set_title(f"XGBoost: Weather-Aware Timing Accuracy\n(MAE: {mae:.4f}s)", fontsize=14, fontweight='bold')
ax1.set_xlabel("Actual Lap Delta (Seconds)")
ax1.set_ylabel("Predicted Lap Delta (Seconds)")
ax1.grid(True, linestyle=':', alpha=0.6)

# Panel 2: Error Distribution
ax2 = fig.add_subplot(gs[0, 1])
errors = preds - y_test
ax2.hist(errors, bins=50, color='#D32F2F', alpha=0.7, edgecolor='black')
ax2.axvline(0, color='black', linestyle='--')
ax2.set_title("Distribution of XGBoost Timing Errors", fontsize=14, fontweight='bold')
ax2.set_xlabel("Error (Seconds)")
ax2.set_ylabel("Frequency")

# Panel 3: Feature Importance (Gain-based)
ax3 = fig.add_subplot(gs[1, :])
importance = model.feature_importances_
sorted_idx = np.argsort(importance)
ax3.barh(np.array(FEATURES)[sorted_idx], importance[sorted_idx], color='#D32F2F')
ax3.set_title("XGBoost Logic: Sequential Error Correction Importance", fontsize=14, fontweight='bold')
ax3.set_xlabel("Relative Importance Score")

# Panel 4: The Data Table
ax4 = fig.add_subplot(gs[2, :])
ax4.axis('off')
table_data = [
    ["XGBOOST STATISTIC", "VALUE", "EXPLANATION"],
    ["MAE", f"{mae:.4f}s", "Mean Absolute Error (Predictive Accuracy)"],
    ["RMSE", f"{rmse:.4f}s", "Root Mean Square Error (Stability)"],
    ["Boosting Rounds", "1000", "Total sequential trees built"],
    ["Top Weather Factor", "TrackTemp_Avg" if "TrackTemp_Avg" in FEATURES else "N/A", "Impact of track condition on pace"]
]

tbl = ax4.table(cellText=table_data, loc='center', cellLoc='center', colWidths=[0.25, 0.2, 0.4])
tbl.auto_set_font_size(False)
tbl.set_fontsize(13)
tbl.scale(1, 3.5)

for (row, col), cell in tbl.get_celld().items():
    if row == 0:
        cell.set_facecolor('#FFEBEE') # Light red header
        cell.set_text_props(weight='bold')

plt.suptitle("F1 XGBOOST PERFORMANCE DASHBOARD: 2025 DATA", fontsize=22, fontweight='bold', y=0.98)
plt.tight_layout(rect=[0, 0.03, 1, 0.95])

# Save and Output
save_path = os.path.join(SAVE_DIR, "xgboost_weather_dashboard.png")
plt.savefig(save_path, dpi=300)

print("\n" + "="*50)
print("             XGBOOST F1 FINAL REPORT")
print("="*50)
print(f"LAP TIME ACCURACY:  {mae:.4f} seconds (MAE)")
print(f"TOP FEATURE:        {FEATURES[np.argmax(importance)]}")
print(f"XGB HYPERPARAMS:    n_estimators=1000, learning_rate=0.05")
print("="*50)

plt.show()