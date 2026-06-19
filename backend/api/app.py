"""
StratBot inference API (Flask).
Serves LapDelta predictions from the trained LightGBM model.
"""
import sys
from pathlib import Path

from flask import Flask, jsonify, request, g
from flask_cors import CORS
import time
import hashlib

BACKEND_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from ml.predictor import LapDeltaPredictor

app = Flask(__name__)
CORS(app)

# Simple in-memory users for FYP-II demo (replace with DB/Postgres in real)
USERS = {
    "student": {"password": "fyp2026", "role": "user"},
    "admin": {"password": "stratbot2026", "role": "admin"},
}

# Very simple token (for demo; use JWT in production)
SECRET = "stratbot-fyp-secret-2026"
def generate_token(username, role):
    payload = f"{username}:{role}:{int(time.time())}"
    return hashlib.sha256((payload + SECRET).encode()).hexdigest()[:32] + f":{username}:{role}"

def verify_token(token):
    if not token:
        return None
    try:
        parts = token.split(':')
        if len(parts) != 3:
            return None
        _hash, username, role = parts
        # simplistic verify
        if username in USERS:
            return {"username": username, "role": role}
    except:
        pass
    return None

@app.before_request
def load_user():
    token = request.headers.get("Authorization", "").replace("Bearer ", "")
    g.current_user = verify_token(token)

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

# FYP-II: Simple auth (SRS user auth)
@app.post("/api/auth/login")
def login():
    data = request.get_json(silent=True) or {}
    username = data.get("username")
    password = data.get("password")
    if username in USERS and USERS[username]["password"] == password:
        user = USERS[username]
        token = generate_token(username, user["role"])
        return jsonify({"token": token, "user": {"username": username, "role": user["role"]}})
    return jsonify({"error": "Invalid credentials"}), 401

@app.get("/api/auth/me")
def me():
    if g.current_user:
        return jsonify({"user": g.current_user})
    return jsonify({"error": "Not authenticated"}), 401

# FYP-II: Admin controls (dataset refresh / model retrain)
@app.post("/api/admin/retrain")
def admin_retrain():
    if not g.current_user or g.current_user.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    # In real: run in background thread or celery
    # For demo: trigger sync (may take time)
    try:
        import subprocess
        result = subprocess.run(
            [sys.executable, "-m", "ml.train_export"],
            cwd=str(BACKEND_ROOT),
            capture_output=True,
            text=True,
            timeout=300
        )
        return jsonify({
            "status": "retrain triggered",
            "stdout": result.stdout[-500:] if result.stdout else "",
            "returncode": result.returncode
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.post("/api/admin/refresh-dataset")
def admin_refresh():
    if not g.current_user or g.current_user.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    # Stub: in real would re-run pipeline scripts
    return jsonify({"status": "dataset refresh queued (stub for FYP-II)", "note": "Run pipeline scripts manually for full refresh"})

# FYP-II stubs: advanced predictors (pit windows, tyre deg) + RL agent note
@app.post("/api/predict/tyre-deg")
def predict_tyre_deg():
    payload = request.get_json(silent=True) or {}
    # Simple model stub (extend with real model)
    tyre_life = float(payload.get("tyre_life", 20))
    weather = payload.get("weather", "clear")
    deg_rate = 1.6 * (1.4 if weather == "rainy" else 1.0)
    predicted_wear = min(100, 100 - (tyre_life * deg_rate))
    return jsonify({"predicted_tyre_wear": round(predicted_wear, 1), "note": "Stub - real model would use telemetry"})

@app.post("/api/predict/pit-window")
def predict_pit_window():
    payload = request.get_json(silent=True) or {}
    current_lap = int(payload.get("lap", 20))
    total_laps = int(payload.get("total_laps", 57))
    tire_wear = float(payload.get("tire_wear", 60))
    # Simple rule-based
    optimal = current_lap + max(5, int((100 - tire_wear) / 1.6))
    return jsonify({"optimal_pit_lap": min(optimal, total_laps - 3), "note": "Stub for advanced predictor"})

@app.get("/api/strategy/rl-agent")
def rl_strategy_stub():
    # Stub for reinforcement learning strategy agent (see SDS future + papers like Heilmeier, Boettinger)
    return jsonify({
        "recommended_action": "extend stint or undercut based on ML delta",
        "confidence": 72,
        "note": "Full RL (Q-learning or policy gradient on historical + sim) would be trained on parquet slices. See referenced papers in SDS."
    })

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)