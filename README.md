# StratBot (P80F25)

AI-assisted Formula 1 race strategy simulation — DHA Suffa University FYP.

**Team:** Ebad Ahmed, Fatima Ather Rajput, Zaafir Ejaz  
**Supervisor:** Dr. Huma Jamshed

## Repository layout

```
stratbot/
├── backend/          Python data pipeline, ML models, Flask API
├── frontend/         React + Tailwind strategy dashboard
└── docs/             Project notes and development reference
```

## Prerequisites

- Python 3.10+
- Node.js 18+
- Shared venv at `J:\FYP_Project\.venv` (or create a local venv in `backend/`)

## Backend setup

```bat
cd backend
pip install -r requirements.txt
```

### Data pipeline

The full pipeline (as used to produce the final dataset + images in J:\F1\f1_cache\parquet-output) chains:

```bat
cd backend\pipeline
python download_f1_resumable_2018_2025.py
python weather_extract.py
python laps_agg.py
python aggregation.py
python lap_tel_weather_agg.py
# (manual or custom clean step -> f1_clean...FINAL.csv)
python parquet-con-clean-model.py   # produces the f1_model_ready_2018_2025.parquet
python csv_to_parq.py               # optional: per-race parquet slices
```

Scripts now share `config.py` (local backend/data/output) or point to the canonical J:\F1 work location for the parquet-output folder (final dataset + all eval PNGs). Large files gitignored.

Then train:
```bat
cd backend
python -m ml.train_export
```

### Train production model

```bat
cd backend
python -m ml.train_export
```

LightGBM is the production model (MAE 0.9683s on 2025 holdout).

### API server

```bat
cd backend\api
python app.py
```

Runs on `http://127.0.0.1:5000`. Endpoints: `/api/health`, `/api/model/info`, `/api/predict/lap-delta`.

## Frontend setup

```bat
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`.

## Live demo

Frontend prototype: https://stratbot-fyp.netlify.app

## Documentation

- `docs/PROJECT_CONTEXT.md` — scope, architecture, integration status
- `docs/TESTING.md` — model evaluation, MAE benchmarks, graph gallery
- `docs/evaluation/graphs/` — comparison dashboard PNGs (XGBoost, LightGBM, RF, CatBoost, etc.)