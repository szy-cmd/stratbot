# StratBot Dashboard

React + Tailwind frontend for the StratBot FYP (P80F25). Turn-based strategy simulation with mock race data; backend API integration in progress.

## Features

- **Turn-based simulation**: Lap-based decision points with 2–4 strategic branches and probabilities
- **SVG track map**: Animated car markers on a simplified circuit
- **Live timing leaderboard**: Fake timing with small fluctuations for a “live” feel
- **Strategy Engine panel**: Confidence %, mini bar chart of branch probabilities, confidence meter, risk level
- Dark F1 broadcast-style theme, smooth transitions

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

- `src/data/mockRaceState.js` — Hardcoded turns, drivers, leaderboard
- `src/hooks/useSimulation.js` — Turn state and branch selection
- `src/hooks/useLiveTimingFluctuation.js` — Fake live timing updates
- `src/components/` — TurnPanel, TrackMap, LiveTimingLeaderboard, StrategyEnginePanel, TurnNavigation
