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

for folder in (DATA_DIR, CACHE_DIR, RAW_DIR, PROCESSED_DIR, MODELS_DIR, OUTPUT_DIR):
    folder.mkdir(parents=True, exist_ok=True)