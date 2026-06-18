"""Train production LightGBM model and export artifacts."""
from __future__ import annotations

import json
from datetime import datetime, timezone

import joblib
import lightgbm as lgb
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from xgboost import XGBRegressor

from config import MODELS_DIR
from ml.constants import FEATURES, TARGET
from ml.dataset import load_prepared_frame, train_test_split_by_year


def _evaluate(model, x_test, y_test):
    preds = model.predict(x_test)
    return {
        "mae": float(mean_absolute_error(y_test, preds)),
        "rmse": float(np.sqrt(mean_squared_error(y_test, preds))),
    }


def main():
    print("Loading dataset...")
    df = load_prepared_frame()
    x_train, y_train, x_test, y_test = train_test_split_by_year(df)

    candidates = {
        "LightGBM": lgb.LGBMRegressor(
            n_estimators=500,
            learning_rate=0.05,
            max_depth=6,
            random_state=42,
            verbose=-1,
        ),
        "XGBoost": XGBRegressor(
            n_estimators=500,
            learning_rate=0.05,
            max_depth=6,
            tree_method="hist",
            random_state=42,
        ),
        "RandomForest": RandomForestRegressor(
            n_estimators=200,
            max_depth=12,
            n_jobs=-1,
            random_state=42,
        ),
    }

    benchmark = {}
    best_name = None
    best_model = None
    best_mae = float("inf")

    for name, model in candidates.items():
        print(f"Training {name}...")
        model.fit(x_train, y_train)
        metrics = _evaluate(model, x_test, y_test)
        benchmark[name] = metrics
        print(f"  MAE={metrics['mae']:.4f}s  RMSE={metrics['rmse']:.4f}s")
        if metrics["mae"] < best_mae:
            best_mae = metrics["mae"]
            best_name = name
            best_model = model

    feature_medians = {col: float(df[col].median()) for col in FEATURES}

    meta = {
        "model_name": best_name,
        "target": TARGET,
        "features": FEATURES,
        "feature_medians": feature_medians,
        "metrics": benchmark[best_name],
        "benchmark": benchmark,
        "holdout_year": 2025,
        "trained_at": datetime.now(timezone.utc).isoformat(),
        "train_rows": int(len(x_train)),
        "test_rows": int(len(x_test)),
    }

    model_path = MODELS_DIR / "lap_delta_model.joblib"
    meta_path = MODELS_DIR / "model_meta.json"

    joblib.dump(best_model, model_path)
    meta_path.write_text(json.dumps(meta, indent=2), encoding="utf-8")

    print(f"\nProduction model: {best_name}")
    print(f"MAE: {benchmark[best_name]['mae']:.4f}s")
    print(f"Saved: {model_path}")
    print(f"Meta:  {meta_path}")


if __name__ == "__main__":
    main()