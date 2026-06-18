import pandas as pd
import numpy as np
import os
import lightgbm as lgb
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error

# --- CONFIG ---
BASE_PATH = r"J:\F1\f1_cache\output"
FILE_NAME = "f1_clean_model_ready_2018_2025_FINAL.csv"
FILE_PATH = os.path.join(BASE_PATH, FILE_NAME)

# 1. Load & Prep
df = pd.read_csv(FILE_PATH, low_memory=False)
df.columns = df.columns.str.strip()

# Engineering (same as before)
df["LapDelta"] = df["LapTimeSeconds"] - df.groupby(["year", "round"])["LapTimeSeconds"].transform("median")
df["DriverDelta"] = df["LapTimeSeconds"] - df.groupby("Driver")["LapTimeSeconds"].transform("median")
df["FuelProxy"] = df.groupby(["year", "round"])["LapNumber"].transform("max") - df["LapNumber"]

FEATURES = ["TyreLife", "Speed_mean", "RPM_mean", "Brake_mean", "Speed_max", 
            "LapNumber", "Stint", "CompoundCode", "DRS_max", "FuelProxy", "DriverDelta"]
TARGET = "LapDelta"

df = df.dropna(subset=[TARGET] + FEATURES)

# --- 2. THE FAIR SPLIT (Time-Based) ---
train_df = df[df['year'] < 2025].copy()
test_df = df[df['year'] == 2025].copy()

X_train, y_train = train_df[FEATURES], train_df[TARGET]
X_test, y_test = test_df[FEATURES], test_df[TARGET]

# --- 3. THE BATTLE ---
print(f"🚀 Training on history (2018-2024). Testing on the future (2025).")

# Model A: Random Forest
rf = RandomForestRegressor(n_estimators=100, max_depth=15, n_jobs=-1, random_state=42)
rf.fit(X_train, y_train)
rf_mae = mean_absolute_error(y_test, rf.predict(X_test))

# Model B: LightGBM
lgbm = lgb.LGBMRegressor(n_estimators=500, learning_rate=0.05, importance_type='gain')
lgbm.fit(X_train, y_train)
lgbm_mae = mean_absolute_error(y_test, lgbm.predict(X_test))

print("\n" + "="*40)
print(f"REAL-WORLD MAE (2025 SEASON)")
print("-" * 40)
print(f"Random Forest MAE : {rf_mae:.4f}s")
print(f"LightGBM MAE      : {lgbm_mae:.4f}s")
print("="*40)