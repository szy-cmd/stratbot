"""
StratBot inference API (Flask).
Serves LapDelta predictions from the trained LightGBM model.
"""
import sys
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from ml.predictor import LapDeltaPredictor

app = Flask(__name__)
CORS(app)

_predictor = None


def get_predictor() -> LapDeltaPredictor:
    global _predictor
    if _predictor is None:
        _predictor = LapDeltaPredictor()
    return _predictor


@app.get("/api/health")
def health():
    ready = (BACKEND_ROOT / "data" / "models" / "lap_delta_model.joblib").exists()
    return jsonify({"status": "ok", "service": "stratbot-api", "model_ready": ready})


@app.get("/api/model/info")
def model_info():
    try:
        return jsonify(get_predictor().info())
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc), "hint": "Run: python -m ml.train_export"}), 503


@app.get("/api/model/benchmark")
def model_benchmark():
    try:
        info = get_predictor().info()
        return jsonify({"benchmark": info.get("benchmark", {}), "winner": info["model_name"]})
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 503


@app.post("/api/predict/lap-delta")
def predict_lap_delta():
    payload = request.get_json(silent=True) or {}
    try:
        result = get_predictor().predict_from_race_state(payload)
        return jsonify(result)
    except FileNotFoundError as exc:
        return jsonify({"error": str(exc)}), 503
    except Exception as exc:
        return jsonify({"error": str(exc)}), 400


@app.post("/api/predict")
def predict_legacy():
    return predict_lap_delta()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)