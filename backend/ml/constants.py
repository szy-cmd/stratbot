FEATURES = [
    "TyreLife",
    "Speed_mean",
    "RPM_mean",
    "Brake_mean",
    "Speed_max",
    "LapNumber",
    "Stint",
    "CompoundCode",
    "DRS_max",
    "FuelProxy",
    "DriverDelta",
    # Weather features - now included in ALL trained models (from pipeline merge + historical experiments)
    "AirTemp_Avg",
    "TrackTemp_Avg",
    "Humidity_Avg",
    "WindSpeed_Avg",
    "Rainfall_Max",
]

TARGET = "LapDelta"

COMPOUND_MAP = {
    "soft": 0,
    "medium": 1,
    "hard": 2,
    "intermediate": 3,
    "wet": 4,
}