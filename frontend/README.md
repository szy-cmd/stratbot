# StratBot Dashboard

React + Tailwind frontend for the StratBot FYP (P80F25). Turn-based strategy simulation + **live ML LapDelta predictions** from the backend (LightGBM).

The ML insights panel is additive (polls the Flask API during races) and does not alter the core mock simulation engine.

## Features

- **Turn-based simulation**: Lap-based decision points (TURNS) with 2–4 strategic branches, outcomes, and probabilities. Configure weather, race length, starting compound, and AI model variant (base LGBM, weather-aware from our experiments, RF) in setup for real experimentation.
- **SVG track map** (TrackMap + CarMarkers): Animated cars, turn navigation on simplified circuits (Bahrain, Monaco etc.)
- **Live timing leaderboard**: Positions + fluctuating gaps for “live” feel
- **TelemetryCharts**: Speed, tyre, fuel etc. (Recharts)
- **StrategyEnginePanel**: Branch probabilities, confidence, risk
- **ModelInsightsPanel** (new): Live ML with selectable variant (base vs weather-aware using our trained experiment models that include weather data from pipeline). Polls `/api/predict/lap-delta`. Shows variant, weather considered, live delta + interpretation + confidence. Predictions persisted for post-race model comparison tables (actual vs predicted, variant used). Backend must be running for full experiment mode.
- **PostRaceSummary** (enhanced): Final classification, telemetry graphs, strategy log + full ML Model Results section with captured predictions table, variant/weather used, benchmark reminder, and comparison to our trained models (including weather experiments).
- Dark F1 broadcast-style theme (Tailwind + custom F1 colors), smooth transitions, phases: BOOT → SETUP → RACING → POST_RACE
- Full backend integration: Vite proxy to Flask :5000 for live predictions during simulation

## Run (Recommended)

The easiest way is to use the project launcher from the parent `stratbot` folder:

```bat
stratbot\start-stratbot.bat
```

The launcher has been improved with debug pauses and checks so the window no longer just flashes open and closes. It starts both the backend API and the frontend dev server for you.

**If the bat still closes too fast**, run it like this from an open terminal:
```
cmd /k "J:\FYP_Project\stratbot\start-stratbot.bat"
```

### Manual

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. (Make sure the backend is already running on :5000 for live ML features.)

## Build

```bash
npm run build
npm run preview
```

## Project structure

- `src/engine/RaceEngine.js`, `useSimulation.js`, `mockRaceState.js` — Core sim state + turns
- `src/hooks/useStratBotModel.js` — Live ML polling + state
- `src/services/stratbotApi.js` — Thin client for /api/*
- `src/components/` — ModelInsightsPanel, StrategyEnginePanel, TelemetryCharts, TrackMap, LiveTimingLeaderboard, PreRaceSetup, PostRaceSummary, etc. + track/ subcomponents
- Vite + Tailwind; proxies API in dev

## Integration notes

- ML panel is **non-breaking / additive** — the original simulation + strategy engine continue to use mock data.
- To see live predictions: start backend API first, then `npm run dev`. The panel shows "API online", benchmark, and per-lap LapDelta + interpretation during races.
- Production model details in root README + `backend/data/models/model_meta.json`.
