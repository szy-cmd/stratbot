"""
StratBot inference API (Flask).
Serves lap-time predictions from trained model artifacts in backend/data/models.
"""
from pathlib import Path

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

MODELS_DIR = Path(__file__).resolve().parent.parent / "data" / "models"


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "service": "stratbot-api"})


@app.get("/api/models")
def list_models():
    if not MODELS_DIR.exists():
        return jsonify({"models": []})

    artifacts = sorted(
        p.name for p in MODELS_DIR.iterdir()
        if p.suffix in {".pkl", ".joblib", ".json", ".cbm", ".ubj"}
    )
    return jsonify({"models": artifacts})


@app.post("/api/predict")
def predict():
    payload = request.get_json(silent=True) or {}
    features = payload.get("features")

    if not features:
        return jsonify({"error": "features array required"}), 400

    # Model loading wired in once training artifacts are finalized.
    return jsonify({
        "prediction": None,
        "metric": "lap_delta",
        "message": "Connect a trained model artifact to enable live inference.",
        "feature_count": len(features),
    })


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)