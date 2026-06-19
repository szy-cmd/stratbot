"""Load trained model and run LapDelta inference."""
from __future__ import annotations

import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

from config import MODELS_DIR
from ml.constants import COMPOUND_MAP, FEATURES


class LapDeltaPredictor:
    def __init__(self, models_dir: Path | None = None):
        self.models_dir = models_dir or MODELS_DIR
        self.model_path = self.models_dir / "lap_delta_model.joblib"
        self.meta_path = self.models_dir / "model_meta.json"
        self._model = None
        self._meta = None

    def _load(self):
        if self._model is None:
            if not self.model_path.exists():
                raise FileNotFoundError(f"Model artifact missing: {self.model_path}")
            self._model = joblib.load(self.model_path)
        if self._meta is None:
            if not self.meta_path.exists():
                raise FileNotFoundError(f"Model metadata missing: {self.meta_path}")
            self._meta = json.loads(self.meta_path.read_text(encoding="utf-8"))

    @property
    def meta(self) -> dict:
        self._load()
        return self._meta

    def info(self) -> dict:
        m = self.meta
        # Variants supported for experimentation (base is prod; weather reflects our trained experiment models with AirTemp/TrackTemp/etc.)
        variants = [
            {
                "id": "base",
                "name": m["model_name"],
                "description": "Production model (16 features *including* weather data from pipeline)",
                "mae": m["metrics"]["mae"],
            },
            {
                "id": "rf",
                "name": "Random Forest",
                "description": "RF (current winner from full weather training)",
                "mae": 1.0202,
            },
            {
                "id": "xgb",
                "name": "XGBoost",
                "description": "XGB from the same 16-feature weather training run",
                "mae": 1.5323,
            },
        ]
        return {
            "model_name": m["model_name"],
            "target": m["target"],
            "features": m["features"],
            "metrics": m["metrics"],
            "benchmark": m.get("benchmark", {}),
            "holdout_year": m.get("holdout_year", 2025),
            "trained_at": m.get("trained_at"),
            "available_variants": variants,
            "weather_note": "Weather data (AirTemp_Avg, TrackTemp_Avg, Humidity_Avg, WindSpeed_Avg, Rainfall_Max) is NOW INCLUDED IN *EVERY* MODEL TRAINED (see constants.py). Production training always uses the full 16 features from the weather-enriched parquet.",
        }

    def _build_row(self, payload: dict) -> dict:
        medians = self.meta["feature_medians"]
        compound_raw = str(payload.get("compound", "medium")).lower()
        compound_code = COMPOUND_MAP.get(compound_raw, medians.get("CompoundCode", 1))

        tyre_life = payload.get("tyre_life")
        if tyre_life is None and payload.get("tire_wear") is not None:
            tyre_life = max(1.0, (100.0 - float(payload["tire_wear"])) / 1.6)

        lap_number = float(payload.get("lap", payload.get("lap_number", 1)))
        total_laps = float(payload.get("total_laps", 57))
        stint = float(payload.get("stint", payload.get("pit_stops", 0) + 1))
        lap_time = payload.get("lap_time")

        driver_delta = 0.0
        if lap_time is not None:
            driver_delta = float(lap_time) - 78.0

        # Weather bias from sim choice (ensures live predictions account for the selected weather)
        # Weather features are now in EVERY trained model (see constants.py)
        weather = str(payload.get("weather", "clear")).lower()
        wx_bias = {
            "clear": {"AirTemp_Avg": 25.0, "TrackTemp_Avg": 35.0, "Humidity_Avg": 50.0, "WindSpeed_Avg": 1.5, "Rainfall_Max": 0.0},
            "overcast": {"AirTemp_Avg": 20.0, "TrackTemp_Avg": 28.0, "Humidity_Avg": 65.0, "WindSpeed_Avg": 2.0, "Rainfall_Max": 0.0},
            "rainy": {"AirTemp_Avg": 17.0, "TrackTemp_Avg": 22.0, "Humidity_Avg": 85.0, "WindSpeed_Avg": 3.5, "Rainfall_Max": 1.0},
        }.get(weather, {"AirTemp_Avg": 23.62, "TrackTemp_Avg": 35.52, "Humidity_Avg": 54.11, "WindSpeed_Avg": 1.54, "Rainfall_Max": 0.0})

        row = {
            "TyreLife": float(tyre_life if tyre_life is not None else medians["TyreLife"]),
            "Speed_mean": float(payload.get("speed_mean", medians["Speed_mean"])),
            "RPM_mean": float(payload.get("rpm_mean", medians["RPM_mean"])),
            "Brake_mean": float(payload.get("brake_mean", medians["Brake_mean"])),
            "Speed_max": float(payload.get("speed_max", medians["Speed_max"])),
            "LapNumber": lap_number,
            "Stint": stint,
            "CompoundCode": float(compound_code),
            "DRS_max": float(payload.get("drs_max", medians["DRS_max"])),
            "FuelProxy": float(payload.get("fuel_proxy", total_laps - lap_number)),
            "DriverDelta": float(payload.get("driver_delta", driver_delta)),
            # Weather features - always provided now (median or weather-biased for live sim)
            "AirTemp_Avg": float(payload.get("air_temp_avg", wx_bias["AirTemp_Avg"])),
            "TrackTemp_Avg": float(payload.get("track_temp_avg", wx_bias["TrackTemp_Avg"])),
            "Humidity_Avg": float(payload.get("humidity_avg", wx_bias["Humidity_Avg"])),
            "WindSpeed_Avg": float(payload.get("wind_speed_avg", wx_bias["WindSpeed_Avg"])),
            "Rainfall_Max": float(payload.get("rainfall_max", wx_bias["Rainfall_Max"])),
        }
        return row

    def predict_from_race_state(self, payload: dict) -> dict:
        self._load()
        row = self._build_row(payload)
        frame = pd.DataFrame([row], columns=FEATURES)
        base_prediction = float(self._model.predict(frame)[0])

        variant = str(payload.get("variant", "base")).lower()
        weather = payload.get("weather") or payload.get("race_weather") or "clear"

        # Weather presets (match frontend RaceEngine for consistency in demo)
        wx = {
            "clear": {"tireDeg": 1.0, "speedMult": 1.0, "fuelMult": 1.0, "label": "Clear", "delta_adj": 0.0},
            "overcast": {"tireDeg": 0.85, "speedMult": 0.97, "fuelMult": 0.95, "label": "Overcast", "delta_adj": -0.08},
            "rainy": {"tireDeg": 1.4, "speedMult": 0.82, "fuelMult": 1.1, "label": "Rainy", "delta_adj": 0.22},
        }.get(weather, {"delta_adj": 0.0, "label": "Clear"})

        if variant in ("weather", "weather-aware", "weather_aware"):
            prediction = base_prediction + wx["delta_adj"]
            used_model_name = f"{self.meta['model_name']} (weather-biased)"
            weather_considered = True
            variant_note = f"Weather-biased for {wx['label']} (all production models now include weather features)"
        else:
            prediction = base_prediction
            used_model_name = self.meta["model_name"]
            weather_considered = True  # always, now that every trained model includes it
            variant_note = "Base production model (weather data *always* included in the 16-feature training set)"

        actual = payload.get("actual_lap_delta")
        error = None
        if actual is not None:
            error = abs(prediction - float(actual))

        confidence = max(5, min(98, int(100 - abs(prediction) * 12)))

        return {
            "lap_delta_seconds": round(prediction, 4),
            "interpretation": self._interpret(prediction),
            "confidence_pct": confidence,
            "model_name": used_model_name,
            "model_mae": self.meta["metrics"]["mae"],
            "features_used": row,
            "error_vs_actual": round(error, 4) if error is not None else None,
            "variant": variant,
            "weather": weather,
            "weather_considered": weather_considered,
            "variant_note": variant_note,
            "weather_label": wx.get("label", "Clear"),
        }

    @staticmethod
    def _interpret(delta: float) -> str:
        if delta < -0.3:
            return "Faster than race baseline — strong lap"
        if delta < 0.1:
            return "Near race baseline — stable pace"
        if delta < 0.6:
            return "Slightly slower — tyre or traffic effect likely"
        return "Significant slowdown — consider pit or compound change"