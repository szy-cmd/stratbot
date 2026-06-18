"""
download_f1_resumable_2018_2025.py

Resumable FastF1 downloader/exporter (2018–2025) with robust telemetry handling.
Fixes crashes when position data is unavailable by falling back to car-only data.

Outputs:
  - output/laps/laps_<year>_<round>.csv
  - output/telemetry/telemetry_<year>_<round>.csv   (full telemetry where possible, else car-only)
  - output/progress.json   (records completed rounds)

Run:
  python .\download_f1_resumable_2018_2025.py
"""

import os
import json
import warnings

import fastf1
import pandas as pd
import numpy as np
from tqdm import tqdm


# ======================================================
# PATH SETUP
# ======================================================
import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from config import CACHE_DIR, OUTPUT_DIR

LAPS_DIR = os.path.join(OUTPUT_DIR, "laps")
TEL_DIR = os.path.join(OUTPUT_DIR, "telemetry")
PROGRESS_FILE = os.path.join(OUTPUT_DIR, "progress.json")
ERROR_LOG = os.path.join(OUTPUT_DIR, "errors.log")

for d in [CACHE_DIR, OUTPUT_DIR, LAPS_DIR, TEL_DIR]:
    os.makedirs(d, exist_ok=True)

fastf1.Cache.enable_cache(CACHE_DIR)

# Optional: reduce noisy warnings
warnings.filterwarnings("ignore", category=UserWarning)


# ======================================================
# RESUME / PROGRESS
# ======================================================
def load_progress() -> dict:
    if os.path.exists(PROGRESS_FILE):
        try:
            with open(PROGRESS_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def save_progress(progress: dict) -> None:
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, indent=2)


progress = load_progress()


def mark_done(year: int, rnd: int) -> None:
    y = str(year)
    progress.setdefault(y, [])
    if rnd not in progress[y]:
        progress[y].append(rnd)
        progress[y] = sorted(progress[y])
    save_progress(progress)


def already_done(year: int, rnd: int) -> bool:
    return int(rnd) in progress.get(str(year), [])


def log_error(msg: str) -> None:
    print(msg)
    with open(ERROR_LOG, "a", encoding="utf-8") as f:
        f.write(msg + "\n")


# ======================================================
# HELPERS
# ======================================================
def safe_seconds(series: pd.Series) -> pd.Series:
    """Convert timedelta series to seconds safely (NaT -> NaN)."""
    try:
        return series.dt.total_seconds()
    except Exception:
        return pd.Series([np.nan] * len(series), index=series.index)


def get_rounds_for_year(year: int) -> list[int]:
    """
    Return a list of race round numbers for the year.
    We try to use EventFormat filtering if available; otherwise just all rounds.
    """
    schedule = fastf1.get_event_schedule(year)

    # Prefer conventional race weekends when the column exists
    if "EventFormat" in schedule.columns and "RoundNumber" in schedule.columns:
        conventional = schedule[schedule["EventFormat"] == "conventional"]["RoundNumber"].dropna()
        if len(conventional) > 0:
            return [int(x) for x in conventional.tolist()]

    # Fallback: all round numbers
    if "RoundNumber" in schedule.columns:
        rounds = schedule["RoundNumber"].dropna().tolist()
        return [int(x) for x in rounds]

    # Extreme fallback
    return []


# ======================================================
# EXTRACTION
# ======================================================
def extract_race(year: int, round_num: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    """
    Extract laps + telemetry for a race session.

    Telemetry strategy:
      - Try full lap.get_telemetry() (car + position merged)
      - If it fails (often because position data unavailable), fall back to lap.get_car_data()
      - Never crash the whole run due to one lap/driver
    """
    session = fastf1.get_session(year, round_num, "R")
    # telemetry=True here triggers loading car data; position data may still be missing sometimes.
    session.load(telemetry=True, weather=True)

    event_name = None
    try:
        event_name = session.event["EventName"]
    except Exception:
        event_name = f"Round {round_num}"

    laps = session.laps.copy()

    # Add identifiers
    laps["year"] = year
    laps["round"] = round_num
    laps["raceName"] = event_name

    # Convert timing columns to seconds (safe)
    if "LapTime" in laps.columns:
        laps["LapTimeSeconds"] = safe_seconds(laps["LapTime"])
    else:
        laps["LapTimeSeconds"] = np.nan

    for sec_col, out_col in [
        ("Sector1Time", "Sector1TimeSeconds"),
        ("Sector2Time", "Sector2TimeSeconds"),
        ("Sector3Time", "Sector3TimeSeconds"),
    ]:
        if sec_col in laps.columns:
            laps[out_col] = safe_seconds(laps[sec_col])
        else:
            laps[out_col] = np.nan

    # Build lap_info with only columns that exist (FastF1 can vary)
    wanted_cols = [
        "year", "round", "raceName", "Driver", "LapNumber", "Stint",
        "LapTimeSeconds", "Sector1TimeSeconds", "Sector2TimeSeconds", "Sector3TimeSeconds",
        "Compound", "TyreLife", "Position", "TrackStatus"
    ]
    existing_cols = [c for c in wanted_cols if c in laps.columns]
    lap_info = laps[existing_cols].copy()

    telemetry_rows = []
    for _, lap in laps.iterrows():
        # Skip invalid lap rows
        if pd.isna(lap.get("Driver", None)) or pd.isna(lap.get("LapNumber", None)):
            continue

        # 1) Try full telemetry
        tel = None
        source = None
        try:
            tel = lap.get_telemetry()
            source = "telemetry"
        except Exception:
            tel = None

        # 2) Fall back to car-only data if full telemetry failed
        if tel is None:
            try:
                tel = lap.get_car_data()
                source = "car_data"
            except Exception:
                tel = None

        if tel is None or tel.empty:
            continue

        # Annotate
        tel = tel.copy()
        tel["year"] = year
        tel["round"] = round_num
        tel["raceName"] = event_name
        tel["Driver"] = lap["Driver"]
        tel["LapNumber"] = int(lap["LapNumber"]) if not pd.isna(lap["LapNumber"]) else np.nan
        tel["Stint"] = int(lap["Stint"]) if "Stint" in lap and not pd.isna(lap["Stint"]) else np.nan
        tel["source"] = source  # tells you whether it's full telemetry or fallback
        telemetry_rows.append(tel)

    telemetry_df = pd.concat(telemetry_rows, ignore_index=True) if telemetry_rows else pd.DataFrame()
    return lap_info, telemetry_df


# ======================================================
# MAIN LOOP (2018–2025)
# ======================================================
def main():
    years = list(range(2018, 2026))

    for year in years:
        print(f"\n📅 YEAR {year}")

        rounds = get_rounds_for_year(year)
        if not rounds:
            log_error(f"⚠️ No rounds found for {year}. Skipping.")
            continue

        for rnd in tqdm(rounds, desc=f"{year} races"):
            rnd = int(rnd)

            if already_done(year, rnd):
                continue

            # If files already exist, you can optionally mark done:
            # (kept off by default to avoid false positives)
            try:
                lap_df, tel_df = extract_race(year, rnd)

                lap_path = os.path.join(LAPS_DIR, f"laps_{year}_{rnd:02d}.csv")
                tel_path = os.path.join(TEL_DIR, f"telemetry_{year}_{rnd:02d}.csv")

                lap_df.replace({np.nan: None}).to_csv(lap_path, index=False)
                tel_df.replace({np.nan: None}).to_csv(tel_path, index=False)

                mark_done(year, rnd)
                print(f"✅ Saved {year} Round {rnd} ({len(lap_df)} lap rows, {len(tel_df)} telemetry rows)")

            except Exception as e:
                # IMPORTANT: do NOT exit; just log and continue
                log_error(f"❌ Error at {year} Round {rnd}: {repr(e)}")
                log_error("   -> Continuing to next round...")

    print("\n🏁 ALL DONE (attempted 2018–2025). Check output/errors.log for any failures.")


if __name__ == "__main__":
    main()
