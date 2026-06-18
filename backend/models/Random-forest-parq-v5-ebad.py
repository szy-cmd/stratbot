import pandas as pd
import numpy as np
import os
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error

# --- CONFIG ---
BASE_PATH = r"I:\F1\f1_cache\output"
FILE_NAME = "f1_clean_model_ready_2018_2025_FINAL.csv"
FILE_PATH = os.path.join(BASE_PATH, FILE_NAME)

# ----------------------------
# 1️⃣ Load dataset
# ----------------------------
print(f"📂 Reading file from: {FILE_PATH}")
df = pd.read_csv(FILE_PATH, low_memory=False)
print(f"📊 Dataset Shape: {df.shape}")

# Strip column names (in case CSV has extra spaces)
df.columns = df.columns.str.strip()

# ----------------------------
# 2️⃣ Create targets
# ----------------------------
# LapDelta (race-normalized)
if "LapTimeSeconds" in df.columns:
    df["LapDelta"] = df["LapTimeSeconds"] - df.groupby(["year", "round"])["LapTimeSeconds"].transform("median")
else:
    raise KeyError("LapTimeSeconds column is missing!")

# DriverDelta (driver-normalized)
df["DriverAvgLap"] = df.groupby("Driver")["LapTimeSeconds"].transform("median")
df["DriverDelta"] = df["LapTimeSeconds"] - df["DriverAvgLap"]

# FuelProxy (FIXED: Full line restored)
df["FuelProxy"] = df.groupby(["year", "round"])["LapNumber"].transform("max") - df["LapNumber"]

# ----------------------------
# 3️⃣ Define features & target
# ----------------------------
TARGET = "LapDelta"
FEATURES = [
    "TyreLife", "Speed_mean", "RPM_mean", "Brake_mean", "Speed_max",
    "LapNumber", "Stint", "CompoundCode", "DRS_max",
    "FuelProxy", "DriverDelta","AirTemp_Avg","TrackTemp_Avg","Humidity_Avg","WindSpeed_Avg","Rainfall_Max"
]

# Make sure all features exist
FEATURES = [f for f in FEATURES if f in df.columns]

# Drop rows with missing values so Random Forest doesn't crash
df = df.dropna(subset=[TARGET] + FEATURES)

X = df[FEATURES]
y = df[TARGET]

# ----------------------------
# 4️⃣ Split dataset
# ----------------------------
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# ----------------------------
# 5️⃣ Train Random Forest
# ----------------------------
print(f"🚀 Training on {len(X_train):,} rows... please wait.")
model = RandomForestRegressor(
    n_estimators=500,
    max_depth=20,
    random_state=42,
    n_jobs=-1
)

model.fit(X_train, y_train)

# ----------------------------
# 6️⃣ Predictions & Evaluation
# ----------------------------
y_pred = model.predict(X_test)

mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))

print("\n" + "="*30)
print(f"✅ MODEL PERFORMANCE")
print("-" * 30)
print(f"MAE  : {mae:.4f} seconds")
print(f"RMSE : {rmse:.4f} seconds")
print("="*30)

# ----------------------------
# 7️⃣ Feature importance
# ----------------------------
importances = pd.Series(model.feature_importances_, index=X.columns)
importances = importances.sort_values(ascending=False)
print("\n🔥 FEATURE IMPORTANCE:")
print(importances)