# StratBot — Project Context

> Internal development reference for P80F25.  
> Last updated: 19 June 2026 (path sync & pipeline alignment with parquet-output work artifacts)

## 1. What we are building

**StratBot** is a web-based F1 race strategy simulation and analysis platform. It helps users understand, predict, and simulate race outcomes using historical telemetry, tyre data, weather signals, and machine learning.

The tool is **advisory** — it does not automate real team decisions or connect to live F1 feeds in the current phase.

| Document | ID | Status |
|----------|-----|--------|
| Proposal | P80F25 | Feb 2026 |
| SRS | P80F25-SRS v1.0 | Final (26 Jan 2026) |
| SDS | P80F25-SDS v1.0 | Draft (25 Jan 2026) |

**GitHub:** https://github.com/szy-cmd/stratbot

## 2. Problem statement

F1 strategists face split-second decisions under tyre wear, weather shifts, and changing race dynamics. Raw telemetry volume makes manual analysis slow and error-prone. StratBot collects historical data, engineers consistent features, trains predictors for lap-level performance (LapDelta), and exposes results through an interactive dashboard.

## 3. Scope

### In scope
- FastF1 historical data extraction (2018–2025)
- Cleaning, aggregation, Parquet export
- ML models: Random Forest, XGBoost, LightGBM, CatBoost, SVR, TabNet, TFT (experiments)
- LapDelta prediction and model comparison (MAE / RMSE)
- React dashboard for strategy simulation and visualization
- Flask API layer for live inference

### Out of scope (FYP-I / current phase)
- Official live telemetry integration
- Autonomous decision-making without human input
- Non-F1 racing formats
- Production deployment beyond demo hosting

## 4. Architecture (from SDS)

```
┌─────────────────────────────────────────────────────────┐
│  User Interface Layer     React + Tailwind dashboard    │
│                           + ModelInsightsPanel (live ML) │
├─────────────────────────────────────────────────────────┤
│  Middle Tier              Flask API + simulation engine   │
│                           LightGBM LapDelta inference     │
├─────────────────────────────────────────────────────────┤
│  Data Layer               Parquet datasets, model       │
│                           artifacts, FastF1 cache         │
├─────────────────────────────────────────────────────────┤
│  External Sources         FastF1 library, weather data  │
└─────────────────────────────────────────────────────────┘
```

### SRS modules
| Module | Status |
|--------|--------|
| User authentication | Not started |
| Strategy simulation | Frontend mock engine done; ML panel reads live state |
| AI prediction | **LightGBM production model + Flask API live** |
| Admin (datasets, retrain, logs) | Not started |

## 5. Repository structure

```
stratbot/
├── backend/
│   ├── api/              Flask inference server (app.py)
│   ├── ml/               Training, dataset prep, predictor
│   │   ├── train_export.py   Train + benchmark all models
│   │   ├── predictor.py      LapDelta inference from race state
│   │   ├── dataset.py        Parquet loader
│   │   └── constants.py      Feature list + compound map
│   ├── config.py         Shared data paths
│   ├── data/
│   │   └── models/       lap_delta_model.joblib, model_meta.json
│   ├── pipeline/         Extraction & preprocessing scripts
│   ├── models/           Legacy training & evaluation scripts
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   UI panels + ModelInsightsPanel (new)
│   │   ├── services/     stratbotApi.js — API client
│   │   ├── hooks/        useStratBotModel.js — live predictions
│   │   ├── engine/       RaceEngine.js — client-side simulation
│   │   └── data/         mockRaceState.js — demo race data
│   └── vite.config.js    Proxies /api → Flask :5000
└── docs/
    ├── PROJECT_CONTEXT.md   (this file)
    ├── TESTING.md           Model evaluation & API test results
    └── evaluation/graphs/   MAE comparison dashboards (18 PNGs)
```

## 6. Production ML model

**Winner: LightGBM** — selected by lowest MAE on 2025 holdout (train < 2025, test = 2025).

| Model | MAE (s) | RMSE (s) |
|-------|---------|----------|
| **LightGBM** ★ | **0.9683** | 1.6260 |
| XGBoost | 1.0187 | 1.7294 |
| Random Forest | 1.0510 | 1.8620 |

- **Target:** `LapDelta` (lap time minus race median for that round)
- **Dataset:** `J:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet`
- **Features:** TyreLife, Speed_mean, RPM_mean, Brake_mean, Speed_max, LapNumber, Stint, CompoundCode, DRS_max, FuelProxy, DriverDelta
- **Artifacts:** `backend/data/models/lap_delta_model.joblib` + `model_meta.json`
- **Retrain:** `python -m ml.train_export` from `backend/`

> Model binary is gitignored. Clone fresh → run `train_export` once to generate artifacts locally.

## 7. Backend API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health` | GET | Service status + model_ready flag |
| `/api/model/info` | GET | Model name, MAE, features, benchmark |
| `/api/model/benchmark` | GET | All model MAE/RMSE comparison |
| `/api/predict/lap-delta` | POST | Predict LapDelta from race state JSON |

**Example predict payload:**
```json
{
  "lap": 15,
  "tire_wear": 72,
  "lap_time": 79.2,
  "pit_stops": 0,
  "compound": "medium",
  "total_laps": 57
}
```

## 8. Backend pipeline scripts

| Script | Purpose |
|--------|---------|
| `download_f1_resumable_2018_2025.py` | Resumable FastF1 download, laps + telemetry CSV (uses config) |
| `weather_extract.py` | Session weather features (now writes to weather/ subdir) |
| `laps_agg.py` | Lap timing rollups to laps_master.csv |
| `aggregation.py` | Telemetry aggregation (Speed_mean etc) to telemetry_aggregated_master.csv |
| `lap_tel_weather_agg.py` | Merge laps + tel + weather → unified |
| `parquet-con-clean-model.py` | Clean unified CSV → f1_model_ready_2018_2025.parquet (in J:\F1 parquet-output) |
| `csv_to_parq.py` | Bulk CSV → per-race Parquet (laps_parquet / telemetry_parquet under parquet-output) |

### Legacy ML scripts (models/)
| Script | Algorithm |
|--------|-----------|
| `Random-forest-parq-v5-ebad.py` | Random Forest |
| `xgboost-parq-v3.py` | XGBoost |
| `LGBM-graph.py` | LightGBM |
| `catboost-graph.py` | CatBoost |
| `tabnet-graph.py` | TabNet (PyTorch) |
| `experiments/TFT-weather.py` | Temporal Fusion Transformer |
| `LGM-vsRF.py` | LightGBM vs RF comparison |

## 9. Frontend (current state)

React + Vite + Tailwind. App phases: `BOOT → SETUP → RACING → POST_RACE`.

| Component | Role |
|-----------|------|
| `BootSequence` | Loading intro |
| `PreRaceSetup` | Weather, race type, lap count |
| `TurnPanel` | Strategy branch decisions at key laps |
| `TrackMap` | SVG circuit with car markers |
| `LiveTimingLeaderboard` | Positions, gaps, intervals |
| `TelemetryCharts` | Speed / tyre / fuel charts (Recharts) |
| `StrategyEnginePanel` | Branch probabilities and confidence |
| `ModelInsightsPanel` | **Live ML benchmark + LapDelta predictions** |
| `PostRaceSummary` | End-of-race stats |

### Frontend ↔ backend integration
- `useStratBotModel` hook polls `/api/predict/lap-delta` every 8s during racing
- Maps tracked driver state (lap, tire wear, lap time, pit stops) → API payload
- `ModelInsightsPanel` added **below** StrategyEnginePanel — existing simulation untouched
- Vite dev proxy: `/api` → `http://127.0.0.1:5000`
- Race simulation (`RaceEngine.js`, `mockRaceState.js`) still uses mock data; ML panel is additive

**Local dev:** http://127.0.0.1:5173/  
**Netlify demo:** https://stratbot-fyp.netlify.app (mock only until API deployed)

## 10. Integration work remaining (FYP-II progress)

1. ~~Finalize best model~~ — **Done (now with weather in all models)**
2. ~~Wire `/api/predict`~~ — **Done**
3. ~~Frontend ML panel~~ — **Done: ModelInsightsPanel**
4. **Replace mock race data / Simulation sync** — **In progress**: `useMLDeltas` + `dataMode` in PreRaceSetup + RaceEngine. Live ML deltas now influence pace/tyre/fuel. Historical Parquet slices stubbed (full load from backend next).
5. **Auth module** — **Done (demo)**: Login in PreRaceSetup (student/admin), token auth in API, /api/auth/* . Saved strategies stub in PostRace.
6. **Admin panel** — **Done (demo)**: Admin-only retrain/refresh endpoints + buttons in UI (if admin login).
7. **Deploy API** — **Partial**: Added backend/Dockerfile + deploy notes in README. (Netlify frontend + Render/Heroku for Flask).
8. **Advanced predictors + RL** — **Stubs**: /api/predict/tyre-deg , /pit-window , /strategy/rl-agent . Full RL (on parquet) per SDS papers planned.

## 11. Data schema (SDS reference)

### LapRecord (Parquet)
`lap_id`, `season`, `race_name`, `session_type`, `driver_code`, `lap_number`, `lap_time_sec`, `sector1/2/3_time`, `compound`, `stint`, `tyre_life`, `track_status`, `position`, `lap_delta`, `air_temp_c`, `track_temp_c`, `rain_flag`

### ModelRun
`run_id`, `model_name`, `model_version`, `dataset_version`, `metrics` (MAE, RMSE), `artifacts_path`

## 12. Environment

| Item | Location |
|------|----------|
| Python venv | `J:\FYP_Project\.venv` |
| Combined repo | `J:\FYP_Project\stratbot` |
| Training dataset | `J:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet` |
| Legacy backend | `J:\F1\f1_cache` |
| Legacy frontend | `J:\f1-dashboard fyp` |

### Run commands

```bat
:: 1. Train model (first time or after dataset update)
cd J:\FYP_Project\stratbot\backend
J:\FYP_Project\.venv\Scripts\python.exe -m ml.train_export

:: 2. Backend API
cd J:\FYP_Project\stratbot\backend\api
J:\FYP_Project\.venv\Scripts\python.exe app.py

:: 3. Frontend (npm install once first)
cd J:\FYP_Project\stratbot\frontend
npm install
npm run dev
```

Open http://127.0.0.1:5173/ → Boot → Setup → Start Race → see ML panel.

## 13. Team responsibilities (SDS)

| Member | Focus |
|--------|-------|
| Zaafir Ejaz | Telemetry collection, ML pipeline |
| Ebad Ahmed | Dataset processing, feature engineering |
| Fatima Ather Rajput | Research analysis, data compilation |

## 14. Change log

| Date | Change | Author |
|------|--------|--------|
| 19 Jun 2026 | Synced pipeline + legacy experiment scripts to J:\F1 paths (parquet-output folder); refactored aggs to share config.py | Team |
| 19 Jun 2026 | Updated docs to reflect full work in J:\F1\f1_cache\parquet-output (dataset + images); re-read SRS/SDS for alignment | Team |
| 19 Jun 2026 | Combined backend + frontend into `stratbot/` monorepo | Team |
| 19 Jun 2026 | Added Flask API stub, `config.py`, pipeline path fixes | Team |
| 19 Jun 2026 | Created this context document | Team |
| 19 Jun 2026 | Pushed initial repo to github.com/szy-cmd/stratbot | Team |
| 19 Jun 2026 | Benchmarked LightGBM / XGBoost / RF — LightGBM wins (MAE 0.9683s) | Team |
| 19 Jun 2026 | Added `backend/ml/` training + inference pipeline | Team |
| 19 Jun 2026 | Flask API live: `/api/model/info`, `/api/predict/lap-delta` | Team |
| 19 Jun 2026 | Added `ModelInsightsPanel` + `useStratBotModel` (non-breaking) | Team |
| 19 Jun 2026 | Vite proxy configured; local full-stack dev working | Team |
| 19 Jun 2026 | Added `docs/TESTING.md` + 18 evaluation graphs from parquet-output | Team |

## 15. Testing & evaluation docs

Full model testing write-up: **`docs/TESTING.md`**

Includes train/test protocol (2025 holdout), MAE/RMSE benchmark table, API integration test results, and graph gallery from `docs/evaluation/graphs/` (XGBoost, LightGBM, RF, CatBoost, TabNet, Huber, weather variants, v6 comparison charts).

---

*References: SRS P80F25-SRS, SDS P80F25-SDS, FYP Proposal (16 Feb 2026)*