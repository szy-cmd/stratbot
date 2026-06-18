"""Shared path configuration for StratBot backend scripts.

All primary data lives on the J: drive (project restriction). Use .env (from .env.example)
or STRATBOT_DATASET env var to override the parquet dataset location.
"""
from pathlib import Path
import os

# Optional .env support (python-dotenv is in the shared venv)
try:
    from dotenv import load_dotenv
    load_dotenv(dotenv_path=Path(__file__).parent / ".env")
except ImportError:
    pass  # .env loading optional; fall back to defaults / explicit env vars

BACKEND_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_ROOT.parent
DATA_DIR = BACKEND_ROOT / "data"
CACHE_DIR = DATA_DIR / "fastf1_cache"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
MODELS_DIR = DATA_DIR / "models"
OUTPUT_DIR = DATA_DIR / "output"

# Primary training dataset (J: drive). Override with STRATBOT_DATASET env var or .env file.
_default_dataset = r"J:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet"
DATASET_PATH = Path(os.environ.get("STRATBOT_DATASET", _default_dataset))

for folder in (DATA_DIR, CACHE_DIR, RAW_DIR, PROCESSED_DIR, MODELS_DIR, OUTPUT_DIR):
    folder.mkdir(parents=True, exist_ok=True)