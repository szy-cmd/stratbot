# StratBot — Project Context

> Internal development reference for P80F25.  
> Last updated: 19 June 2026

## 1. What we are building

**StratBot** is a web-based F1 race strategy simulation and analysis platform. It helps users understand, predict, and simulate race outcomes using historical telemetry, tyre data, weather signals, and machine learning.

The tool is **advisory** — it does not automate real team decisions or connect to live F1 feeds in the current phase.

| Document | ID | Status |
|----------|-----|--------|
| Proposal | P80F25 | Feb 2026 |
| SRS | P80F25-SRS v1.0 | Final (26 Jan 2026) |
| SDS | P80F25-SDS v1.0 | Draft (25 Jan 2026) |

## 2. Problem statement

F1 strategists face split-second decisions under tyre wear, weather shifts, and changing race dynamics. Raw telemetry volume makes manual analysis slow and error-prone. StratBot collects historical data, engineers consistent features, trains predictors for lap-level performance (LapDelta), and exposes results through an interactive dashboard.

## 3. Scope

### In scope
- FastF1 historical data extraction (2018–2025)
- Cleaning, aggregation, Parquet export
- ML models: Random Forest, XGBoost, LightGBM, CatBoost, SVR, TabNet, TFT (experiments)
- LapDelta prediction and model comparison (MAE / RMSE)
- React dashboard for strategy simulation and visualization
- Flask API layer for inference (in progress)

### Out of scope (FYP-I / current phase)
- Official live telemetry integration
- Autonomous decision-making without human input
- Non-F1 racing formats
- Production deployment beyond demo hosting

## 4. Architecture (from SDS)

```
┌─────────────────────────────────────────────────────────┐
│  User Interface Layer     React + Tailwind dashboard    │
├─────────────────────────────────────────────────────────┤
│  Middle Tier              Flask API + simulation engine   │
│                           ML inference (LapDelta)       │
├─────────────────────────────────────────────────────────┤
│  Data Layer               Parquet datasets, model       │
│                           artifacts, FastF1 cache         │
├─────────────────────────────────────────────────────────┤
│  External Sources         FastF1 library, weather data  │
└─────────────────────────────────────────────────────────┘
```

### Planned SRS modules
| Module | Status |
|--------|--------|
| User authentication | Not started |
| Strategy simulation | Frontend mock engine done; backend hookup pending |
| AI prediction | Models trained offline; API stub in place |
| Admin (datasets, retrain, logs) | Not started |

## 5. Repository structure

```
stratbot/
├── backend/
│   ├── api/              Flask inference server (app.py)
│   ├── config.py         Shared data paths
│   ├── data/             Runtime data (gitignored except .gitkeep)
│   ├── pipeline/         Extraction & preprocessing scripts
│   ├── models/           Training & evaluation scripts
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/   UI panels (track map, timing, telemetry)
│   │   ├── engine/       RaceEngine.js — client-side simulation
│   │   ├── hooks/        Turn navigation, timing fluctuation
│   │   └── data/         mockRaceState.js — demo race data
│   └── package.json
└── docs/
    └── PROJECT_CONTEXT.md   (this file)
```

## 6. Backend pipeline scripts

| Script | Purpose |
|--------|---------|
| `download_f1_resumable_2018_2025.py` | Resumable FastF1 download, laps + telemetry CSV |
| `weather_extract.py` | Session weather features |
| `aggregation.py` | Lap-level aggregation |
| `laps_agg.py` | Lap timing rollups |
| `lap_tel_weather_agg.py` | Telemetry + weather merge |
| `csv_to_parq.py` | CSV → Parquet conversion |
| `parquet-con-clean-model.py` | Final dataset cleanup |

### Key ML scripts (models/)
| Script | Algorithm |
|--------|-----------|
| `Random-forest-parq-v5-ebad.py` | Random Forest (primary RF pipeline) |
| `xgboost-parq-v3.py` | XGBoost |
| `LGBM-graph.py` | LightGBM |
| `catboost-graph.py` | CatBoost |
| `tabnet-graph.py` | TabNet (PyTorch) |
| `experiments/TFT-weather.py` | Temporal Fusion Transformer |
| `LGM-vsRF.py` | LightGBM vs RF comparison |

**Target variable:** `lap_delta` — deviation from baseline lap performance.

**Storage format:** Parquet, partitioned by season/race where possible.

## 7. Frontend (current state)

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
| `PostRaceSummary` | End-of-race stats |

**Current limitation:** `RaceEngine.js` and `mockRaceState.js` use hardcoded mock data. Backend predictions are not wired yet.

**Demo URL:** https://stratbot-fyp.netlify.app

## 8. Integration work remaining

Priority order for connecting backend ↔ frontend:

1. **Finalize best model** — pick production artifact (likely XGBoost or RF based on MAE benchmarks)
2. **Wire `/api/predict`** — load `.pkl` / `.cbm` artifact, accept lap features, return LapDelta
3. **Replace mock data** — feed real Parquet slices or precomputed race scenarios into frontend
4. **Simulation sync** — map ML output into `RaceEngine` tyre/fuel/pace calculations
5. **Auth module** — register/login per SRS (PostgreSQL planned for FYP-II)
6. **Admin panel** — dataset refresh, model retrain triggers

## 9. Data schema (SDS reference)

### LapRecord (Parquet)
`lap_id`, `season`, `race_name`, `session_type`, `driver_code`, `lap_number`, `lap_time_sec`, `sector1/2/3_time`, `compound`, `stint`, `tyre_life`, `track_status`, `position`, `lap_delta`, `air_temp_c`, `track_temp_c`, `rain_flag`

### ModelRun
`run_id`, `model_name`, `model_version`, `dataset_version`, `metrics` (MAE, RMSE), `artifacts_path`

## 10. Environment

| Item | Location |
|------|----------|
| Python venv | `J:\FYP_Project\.venv` |
| Combined repo | `J:\FYP_Project\stratbot` |
| Legacy backend scripts | `J:\F1\f1_cache` (source, now mirrored in stratbot) |
| Legacy frontend | `J:\f1-dashboard fyp` (source, now in stratbot/frontend) |

### Run commands

```bat
:: Backend API
cd J:\FYP_Project\stratbot\backend\api
J:\FYP_Project\.venv\Scripts\python.exe app.py

:: Frontend
cd J:\FYP_Project\stratbot\frontend
npm run dev
```

## 11. Team responsibilities (SDS)

| Member | Focus |
|--------|-------|
| Zaafir Ejaz | Telemetry collection, ML pipeline |
| Ebad Ahmed | Dataset processing, feature engineering |
| Fatima Ather | Research analysis, data compilation |

## 12. Change log

Use this section to record meaningful updates when working across branches or sessions.

| Date | Change | Author |
|------|--------|--------|
| 19 Jun 2026 | Combined backend + frontend into `stratbot/` monorepo | Team |
| 19 Jun 2026 | Added Flask API stub, `config.py`, pipeline path fixes | Team |
| 19 Jun 2026 | Created this context document | Team |

---

*References: SRS P80F25-SRS, SDS P80F25-SDS, FYP Proposal (16 Feb 2026)*