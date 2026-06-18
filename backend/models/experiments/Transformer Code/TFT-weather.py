import os
import pandas as pd
import numpy as np
import torch
import lightning.pytorch as pl
from pytorch_forecasting import TimeSeriesDataSet, TemporalFusionTransformer, MAE
from pytorch_forecasting.data.encoders import GroupNormalizer
from pytorch_forecasting.metrics import RMSE
import matplotlib.pyplot as plt

# --- 1. SYSTEM OPTIMIZATION (GTX 1080) ---
torch.set_float32_matmul_precision('medium')

# --- 2. LOAD DATA ---
PARQUET_PATH = r"I:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet"
df = pd.read_parquet(PARQUET_PATH)

# Feature Engineering
df["LapDelta"] = df["LapTimeSeconds"] - df.groupby(["year", "round"])["LapTimeSeconds"].transform("median")
df["series_id"] = df["year"].astype(str) + "_" + df["round"].astype(str) + "_" + df["Driver"]
df["time_idx"] = df.groupby("series_id").cumcount()

STATIC_CATS = ["Driver", "CompoundCode"]
TIME_VARYING_REALS = ["TyreLife", "Speed_mean", "TrackTemp_Avg", "Rainfall_Max"]

df[STATIC_CATS] = df[STATIC_CATS].astype(str)
df = df.dropna(subset=["LapDelta"] + TIME_VARYING_REALS)

# --- 3. DATASET SETUP (FIXED PARAMETERS) ---
max_prediction_length = 1
max_encoder_length = 10 

training = TimeSeriesDataSet(
    df[df['year'] < 2025],
    time_idx="time_idx",
    target="LapDelta",
    group_ids=["series_id"],
    min_encoder_length=max_encoder_length // 2,
    max_encoder_length=max_encoder_length,
    min_prediction_length=1,
    max_prediction_length=max_prediction_length,
    static_categoricals=STATIC_CATS,
    time_varying_known_reals=["time_idx"],
    time_varying_unknown_reals=TIME_VARYING_REALS + ["LapDelta"],
    target_normalizer=GroupNormalizer(groups=["series_id"], method="standard"),
    add_relative_time_idx=True,
    add_target_scales=True,
    allow_missing_timesteps=True  # Essential for F1 DNFs/Gaps
)

batch_size = 32
train_dataloader = training.to_dataloader(train=True, batch_size=batch_size, num_workers=0)

# --- 4. INITIALIZE TFT ---
tft = TemporalFusionTransformer.from_dataset(
    training,
    learning_rate=0.03,
    hidden_size=16, # Optimized for 8GB VRAM
    attention_head_size=4,
    dropout=0.1,
    hidden_continuous_size=8,
    loss=MAE(),
    log_interval=10
)

# --- 5. TRAINING ---
trainer = pl.Trainer(
    max_epochs=2,
    accelerator="gpu",
    devices=1,
    precision=32 # 1080 is faster/stable at 32-bit
)

print("\n>>> Starting F1 Transformer Training...")
trainer.fit(tft, train_dataloader)

# --- 6. DASHBOARD & INTERPRETATION ---
# Predict and prepare for plotting
raw_predictions = tft.predict(train_dataloader, mode="raw", return_x=True)
interpretation = tft.interpret_output(raw_predictions.output, reduction="sum")

# Plot feature importance
tft.plot_interpretation(interpretation)
plt.title("F1 Feature Importance (TFT)")
plt.show()

print("\n" + "="*50)
print("     F1 TRANSFORMER READY")
print("="*50)