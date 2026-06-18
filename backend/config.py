"""Shared path configuration for StratBot backend scripts."""
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_ROOT.parent
DATA_DIR = BACKEND_ROOT / "data"
CACHE_DIR = DATA_DIR / "fastf1_cache"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
MODELS_DIR = DATA_DIR / "models"
OUTPUT_DIR = DATA_DIR / "output"

# Primary training dataset (override with STRATBOT_DATASET env var)
DATASET_PATH = Path(r"J:\F1\f1_cache\parquet-output\f1_model_ready_2018_2025.parquet")

for folder in (DATA_DIR, CACHE_DIR, RAW_DIR, PROCESSED_DIR, MODELS_DIR, OUTPUT_DIR):
    folder.mkdir(parents=True, exist_ok=True)