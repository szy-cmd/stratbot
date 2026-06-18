import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from xgboost import XGBRegressor
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
import os

# --- CONFIG ---
PARQUET_PATH = r"I:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet"
SAVE_DIR = r"I:\F1\f1_cache\parquet-output"

# 1. Load Data
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

X_train, y_train = train_df[FEATURES], train_df[TARGET]
X_test, y_test = test_df[FEATURES], test_df[TARGET]

# 2. Train Models
print("🚀 Training XGBoost...")
xgb = XGBRegressor(n_estimators=500, learning_rate=0.05, max_depth=6, tree_method="hist", random_state=42)
xgb.fit(X_train, y_train)
xgb_preds = xgb.predict(X_test)

print("🌲 Training Random Forest...")
rf = RandomForestRegressor(n_estimators=100, max_depth=15, n_jobs=-1, random_state=42)
rf.fit(X_train, y_train)
rf_preds = rf.predict(X_test)

# 3. Calculate Results
xgb_mae, xgb_rmse = mean_absolute_error(y_test, xgb_preds), np.sqrt(mean_squared_error(y_test, xgb_preds))
rf_mae, rf_rmse = mean_absolute_error(y_test, rf_preds), np.sqrt(mean_squared_error(y_test, rf_preds))

# ---------------------------------------------------------
# 4. THE ULTIMATE COMPARISON DASHBOARD (WHITE BACKGROUND)
# ---------------------------------------------------------
plt.style.use('default') # Back to standard white background
fig = plt.figure(figsize=(20, 12))
gs = fig.add_gridspec(2, 2, height_ratios=[1.5, 1])

# Plot 1: XGBoost Accuracy
ax1 = fig.add_subplot(gs[0, 0])
ax1.scatter(y_test, xgb_preds, alpha=0.15, color='red', s=8)
ax1.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'k--', alpha=0.5)
ax1.set_title(f"XGBOOST Accuracy\nMAE: {xgb_mae:.4f}s", fontsize=14)
ax1.grid(True, alpha=0.3)

# Plot 2: Random Forest Accuracy
ax2 = fig.add_subplot(gs[0, 1])
ax2.scatter(y_test, rf_preds, alpha=0.15, color='green', s=8)
ax2.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'k--', alpha=0.5)
ax2.set_title(f"RANDOM FOREST Accuracy\nMAE: {rf_mae:.4f}s", fontsize=14)
ax2.grid(True, alpha=0.3)

# Plot 3: The Head-to-Head Table
ax3 = fig.add_subplot(gs[1, :])
ax3.axis('off')

winner_mae = "XGBoost" if xgb_mae < rf_mae else "Random Forest"

comp_data = [
    ["METRIC", "XGBOOST", "RANDOM FOREST", "WINNER (LOWER IS BETTER)"],
    ["MAE", f"{xgb_mae:.4f}", f"{rf_mae:.4f}", winner_mae],
    ["RMSE", f"{xgb_rmse:.4f}", f"{rf_rmse:.4f}", "---"],
    ["Test Data", "2025 Season", "2025 Season", "Out-of-Sample"],
    ["Laps Tested", f"{len(X_test):,}", f"{len(X_test):,}", "---"]
]

# Create the table with black text on white background
tbl = ax3.table(cellText=comp_data, loc='center', cellLoc='center', colWidths=[0.2, 0.2, 0.2, 0.2])
tbl.auto_set_font_size(False)
tbl.set_fontsize(14)
tbl.scale(1.2, 4)

# Set header colors for visibility
for (row, col), cell in tbl.get_celld().items():
    if row == 0:
        cell.set_facecolor('#dddddd')
        cell.set_text_props(weight='bold')

plt.suptitle("F1 Model Comparison: 2025 Season Validation", fontsize=20, fontweight='bold', y=0.98)
plt.tight_layout(rect=[0, 0.03, 1, 0.95])

# Save and Show
save_path = os.path.join(SAVE_DIR, "v6_comparison_white.png")
plt.savefig(save_path, dpi=300)

# --- TERMINAL BACKUP ---
print("\n" + "="*40)
print("       FINAL MODEL RESULTS (2025)")
print("="*40)
print(f"XGBoost MAE:       {xgb_mae:.4f}s")
print(f"Random Forest MAE: {rf_mae:.4f}s")
print("-" * 40)
print(f"WINNER: {winner_mae.upper()} is more accurate.")
print("="*40)

plt.show()