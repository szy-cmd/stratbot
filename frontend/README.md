# StratBot Dashboard

React + Tailwind frontend for the StratBot FYP (P80F25). Turn-based strategy simulation + **live ML LapDelta predictions** from the backend (LightGBM).

The ML insights panel is additive (polls the Flask API during races) and does not alter the core mock simulation engine.

## Features

- **Turn-based simulation**: Lap-based decision points (TURNS) with 2–4 strategic branches, outcomes, and probabilities
- **SVG track map** (TrackMap + CarMarkers): Animated cars, turn navigation on simplified circuits (Bahrain, Monaco etc.)
- **Live timing leaderboard**: Positions + fluctuating gaps for “live” feel
- **TelemetryCharts**: Speed, tyre, fuel etc. (Recharts)
- **StrategyEnginePanel**: Branch probabilities, confidence, risk
- **ModelInsightsPanel** (new): Live production ML (LightGBM LapDelta + full benchmark table). Polls `/api/predict/lap-delta` every ~8s. Shows interpretation + confidence. Backend must be running.
- **PostRaceSummary**, RaceFeed, PreRaceSetup (weather/race type/laps), BootSequence
- Dark F1 broadcast-style theme (Tailwind + custom F1 colors), smooth transitions, phases: BOOT → SETUP → RACING → POST_RACE
- Full backend integration: Vite proxy to Flask :5000 for live predictions during simulation

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

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
