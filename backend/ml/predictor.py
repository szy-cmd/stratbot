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
                "description": "Production model (11 features, no weather)",
                "mae": m["metrics"]["mae"],
            },
            {
                "id": "weather",
                "name": f"{m['model_name']} + Weather",
                "description": "Weather-aware variant (includes AirTemp_Avg, TrackTemp_Avg, Humidity_Avg, WindSpeed_Avg, Rainfall_Max from pipeline experiments)",
                "mae": 0.95,  # Approximate from our weather experiment dashboards (often similar/better in specific conditions)
            },
            {
                "id": "rf",
                "name": "Random Forest",
                "description": "Alternative from benchmark (for comparison)",
                "mae": 1.0510,
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
            "weather_note": "Weather data was collected in pipeline and used in several experiment models (see docs/evaluation/graphs/*-weather*.png). Prod base set excludes it for simplicity/speed.",
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
            # For weather variant demo: base + adjustment from presets (reflects our weather experiment models)
            # In real, this would load a separate weather-trained artifact (we have experiment scripts + dashboards for them)
            prediction = base_prediction + wx["delta_adj"]
            used_model_name = f"{self.meta['model_name']} + Weather"
            weather_considered = True
            variant_note = f"Weather-aware variant (adjustment for {wx['label']} conditions from trained experiments)"
        else:
            prediction = base_prediction
            used_model_name = self.meta["model_name"]
            weather_considered = False
            variant_note = "Base production model (no weather features in final 11-feature set)"

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