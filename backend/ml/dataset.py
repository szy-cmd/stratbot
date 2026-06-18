"""Load and prepare the StratBot training dataset."""
from __future__ import annotations

import os
from pathlib import Path

import pandas as pd

from ml.constants import FEATURES, TARGET

DEFAULT_DATASET = Path(r"J:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet")


def resolve_dataset_path() -> Path:
    env_path = os.environ.get("STRATBOT_DATASET")
    if env_path and Path(env_path).exists():
        return Path(env_path)
    if DEFAULT_DATASET.exists():
        return DEFAULT_DATASET
    raise FileNotFoundError(
        "Dataset not found. Set STRATBOT_DATASET or place parquet at the default path."
    )


def load_prepared_frame() -> pd.DataFrame:
    path = resolve_dataset_path()
    df = pd.read_parquet(path)
    df.columns = df.columns.str.strip()

    df[TARGET] = df["LapTimeSeconds"] - df.groupby(["year", "round"])["LapTimeSeconds"].transform("median")
    df["DriverAvgLap"] = df.groupby("Driver")["LapTimeSeconds"].transform("median")
    df["DriverDelta"] = df["LapTimeSeconds"] - df["DriverAvgLap"]
    df["FuelProxy"] = df.groupby(["year", "round"])["LapNumber"].transform("max") - df["LapNumber"]

    return df.dropna(subset=[TARGET] + FEATURES)


def train_test_split_by_year(df: pd.DataFrame, test_year: int = 2025):
    train_df = df[df["year"] < test_year].copy()
    test_df = df[df["year"] == test_year].copy()
    return (
        train_df[FEATURES],
        train_df[TARGET],
        test_df[FEATURES],
        test_df[TARGET],
    )