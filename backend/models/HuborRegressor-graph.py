import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
from sklearn.linear_model import HuberRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error
import os

# --- CONFIG ---
PARQUET_PATH = r"I:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet"
SAVE_DIR = r"I:\F1\f1_cache\parquet-output"
THEME_COLOR = '#5D4037'  # Racing Brown

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

X_train_raw, y_train = train_df[FEATURES], train_df[TARGET]
X_test_raw, y_test = test_df[FEATURES], test_df[TARGET]

# 2. Scaling (Huber requires normalized data)
print("⚖️ Scaling telemetry features...")
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train_raw)
X_test = scaler.transform(X_test_raw)

# 3. Train Huber Regressor
print("🚀 Training Huber Regressor...")
model = HuberRegressor(epsilon=1.35, max_iter=1000)
model.fit(X_train, y_train)
preds = model.predict(X_test)

# 4. Metrics
mae = mean_absolute_error(y_test, preds)
rmse = np.sqrt(mean_squared_error(y_test, preds))

# ---------------------------------------------------------
# 5. THE HUBER DASHBOARD (BROWN & WHITE)
# ---------------------------------------------------------
plt.style.use('default')
fig = plt.figure(figsize=(20, 14))
gs = fig.add_gridspec(3, 2, height_ratios=[1.5, 1.2, 0.8])

# Panel 1: Prediction Accuracy (Scatter)
ax1 = fig.add_subplot(gs[0, 0])
ax1.scatter(y_test, preds, alpha=0.2, color=THEME_COLOR, s=10)
ax1.plot([y_test.min(), y_test.max()], [y_test.min(), y_test.max()], 'k--', lw=2)
ax1.set_title(f"Huber Regressor: Predicted vs Actual Delta\n(MAE: {mae:.4f}s)", fontsize=14, fontweight='bold')
ax1.set_xlabel("Actual Lap Delta (Seconds)")
ax1.set_ylabel("Predicted Lap Delta (Seconds)")
ax1.grid(True, linestyle=':', alpha=0.6)

# Panel 2: Error Distribution (Histogram)
ax2 = fig.add_subplot(gs[0, 1])
errors = preds - y_test
ax2.hist(errors, bins=50, color=THEME_COLOR, alpha=0.7, edgecolor='black')
ax2.axvline(0, color='black', linestyle='--')
ax2.set_title("Distribution of Timing Errors", fontsize=14, fontweight='bold')
ax2.set_xlabel("Error (Seconds) - Zero is Perfect")
ax2.set_ylabel("Frequency")

# Panel 3: Feature Importance (Absolute Coefficient Weights)
ax3 = fig.add_subplot(gs[1, :])
# Huber uses coefficients; we take absolute value to show impact strength
importance = np.abs(model.coef_) 
sorted_idx = np.argsort(importance)
ax3.barh(np.array(FEATURES)[sorted_idx], importance[sorted_idx], color=THEME_COLOR)
ax3.set_title("Telemetry Importance: Impact on Lap Times (Huber Coefficients)", fontsize=14, fontweight='bold')
ax3.set_xlabel("Impact Strength (Absolute Coefficient Value)")

# Panel 4: The Data Table
ax4 = fig.add_subplot(gs[2, :])
ax4.axis('off')
table_data = [
    ["HUBER STATISTIC", "VALUE", "EXPLANATION"],
    ["Mean Absolute Error (MAE)", f"{mae:.4f}s", "Average timing gap per lap"],
    ["Root Mean Sq. Error (RMSE)", f"{rmse:.4f}s", "Penalty score for large misses"],
    ["Test Laps (2025)", f"{len(X_test):,}", "Number of laps predicted"],
    ["Most Important Feature", FEATURES[np.argmax(importance)], "Highest weighted sensor input"]
]

tbl = ax4.table(cellText=table_data, loc='center', cellLoc='center', colWidths=[0.25, 0.2, 0.4])
tbl.auto_set_font_size(False)
tbl.set_fontsize(13)
tbl.scale(1, 3.5)

# Formatting Table Headers
for (row, col), cell in tbl.get_celld().items():
    if row == 0:
        cell.set_facecolor('#efebe9') # Light Brown header
        cell.set_text_props(weight='bold')

plt.suptitle("HUBER REGRESSOR F1 TELEMETRY ANALYSIS: 2025 VALIDATION", fontsize=22, fontweight='bold', y=0.98, color=THEME_COLOR)
plt.tight_layout(rect=[0, 0.03, 1, 0.95])

# Save
save_path = os.path.join(SAVE_DIR, "huber_brown_dashboard.png")
plt.savefig(save_path, dpi=300)

print("\n" + "="*50)
print("             HUBER FINAL REPORT (BROWN)")
print("="*50)
print(f"LAP TIME ACCURACY:  {mae:.4f} seconds")
print(f"KEY TELEMETRY:      {FEATURES[np.argmax(importance)]}")
print("="*50)

plt.show()