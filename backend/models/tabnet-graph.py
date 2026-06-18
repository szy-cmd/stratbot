import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from pytorch_tabnet.tab_model import TabNetRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
import os
import torch

# --- CONFIG ---
PARQUET_PATH = r"J:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet"
SAVE_DIR = r"J:\F1\f1_cache\parquet-output"
THEME_COLOR = '#E10600'  # F1 Racing Red

# 1. Load and Prepare Data
print("📂 Loading Data...")
df = pd.read_parquet(PARQUET_PATH)
df.columns = df.columns.str.strip()

# Engineering (Consistent with previous scripts)
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

# TabNet requires NumPy arrays
X_train = train_df[FEATURES].values
y_train = train_df[TARGET].values.reshape(-1, 1)
X_test = test_df[FEATURES].values
y_test = test_df[TARGET].values.reshape(-1, 1)

# 2. Train TabNet
print("🚀 Training TabNet (Neural Network)...")
model = TabNetRegressor(
    n_d=16, n_a=16, # Width of the decision prediction layer and attention layer
    optimizer_params=dict(lr=2e-2),
    scheduler_params={"step_size":10, "gamma":0.9},
    scheduler_fn=torch.optim.lr_scheduler.StepLR,
    mask_type='entmax' # "Sparse" attention
)

model.fit(
    X_train=X_train, y_train=y_train,
    eval_set=[(X_test, y_test)],
    eval_metric=['mae'],
    max_epochs=50,
    patience=10,
    batch_size=1024, 
    virtual_batch_size=128,
    num_workers=0,
    drop_last=False
)

preds = model.predict(X_test).flatten()
y_test_flat = y_test.flatten()

# 3. Metrics
mae = mean_absolute_error(y_test_flat, preds)
rmse = np.sqrt(mean_squared_error(y_test_flat, preds))

# ---------------------------------------------------------
# 4. THE TABNET DASHBOARD (RED & WHITE)
# ---------------------------------------------------------
plt.style.use('default')
fig = plt.figure(figsize=(20, 14))
gs = fig.add_gridspec(3, 2, height_ratios=[1.5, 1.2, 0.8])

# Panel 1: Prediction Accuracy (Scatter)
ax1 = fig.add_subplot(gs[0, 0])
ax1.scatter(y_test_flat, preds, alpha=0.2, color=THEME_COLOR, s=10)
ax1.plot([y_test_flat.min(), y_test_flat.max()], [y_test_flat.min(), y_test_flat.max()], 'k--', lw=2)
ax1.set_title(f"TabNet: Predicted vs Actual Delta\n(MAE: {mae:.4f}s)", fontsize=14, fontweight='bold')
ax1.set_xlabel("Actual Lap Delta (Seconds)")
ax1.set_ylabel("Predicted Lap Delta (Seconds)")
ax1.grid(True, linestyle=':', alpha=0.6)

# Panel 2: Error Distribution (Histogram)
ax2 = fig.add_subplot(gs[0, 1])
errors = preds - y_test_flat
ax2.hist(errors, bins=50, color=THEME_COLOR, alpha=0.7, edgecolor='black')
ax2.axvline(0, color='black', linestyle='--')
ax2.set_title("Distribution of Timing Errors", fontsize=14, fontweight='bold')
ax2.set_xlabel("Error (Seconds) - Zero is Perfect")
ax2.set_ylabel("Frequency")

# Panel 3: Feature Importance (Mask-based)
ax3 = fig.add_subplot(gs[1, :])
importance = model.feature_importances_
sorted_idx = np.argsort(importance)
ax3.barh(np.array(FEATURES)[sorted_idx], importance[sorted_idx], color=THEME_COLOR)
ax3.set_title("TabNet Attention: What is the Neural Network looking at?", fontsize=14, fontweight='bold')
ax3.set_xlabel("Feature Importance (Aggregated Masks)")

# Panel 4: The Data Table
ax4 = fig.add_subplot(gs[2, :])
ax4.axis('off')
table_data = [
    ["TABNET STATISTIC", "VALUE", "EXPLANATION"],
    ["Mean Absolute Error (MAE)", f"{mae:.4f}s", "Average timing gap per lap"],
    ["Root Mean Sq. Error (RMSE)", f"{rmse:.4f}s", "Penalty score for large misses"],
    ["Test Laps (2025)", f"{len(X_test):,}", "Number of laps predicted"],
    ["Most Important Feature", FEATURES[np.argmax(importance)], "Feature with highest attention weight"]
]

tbl = ax4.table(cellText=table_data, loc='center', cellLoc='center', colWidths=[0.25, 0.2, 0.4])
tbl.auto_set_font_size(False)
tbl.set_fontsize(13)
tbl.scale(1, 3.5)

# Formatting Table Headers
for (row, col), cell in tbl.get_celld().items():
    if row == 0:
        cell.set_facecolor('#ffebee') # Light Red header
        cell.set_text_props(weight='bold')

plt.suptitle("TABNET DEEP LEARNING ANALYSIS: 2025 VALIDATION", fontsize=22, fontweight='bold', y=0.98, color=THEME_COLOR)
plt.tight_layout(rect=[0, 0.03, 1, 0.95])

# Save
save_path = os.path.join(SAVE_DIR, "tabnet_red_dashboard.png")
plt.savefig(save_path, dpi=300)

print("\n" + "="*50)
print("             TABNET FINAL REPORT (RED)")
print("="*50)
print(f"LAP TIME ACCURACY:  {mae:.4f} seconds")
print(f"KEY TELEMETRY:      {FEATURES[np.argmax(importance)]}")
print("="*50)

plt.show()