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

```bat
cd backend\pipeline
python download_f1_resumable_2018_2025.py
python weather_extract.py
python aggregation.py
```

Processed datasets are written to `backend/data/`. Large files are gitignored.

### API server

```bat
cd backend\api
python app.py
```

Runs on `http://127.0.0.1:5000`.

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

See `docs/PROJECT_CONTEXT.md` for scope, architecture, and current integration status.