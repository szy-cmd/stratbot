import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchModelInfo, predictLapDelta } from '../services/stratbotApi';

export function useStratBotModel({ driver, lap, totalLaps, raceConfig, enabled = true }) {
  const [modelInfo, setModelInfo] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [apiOnline, setApiOnline] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    fetchModelInfo()
      .then((info) => {
        setModelInfo(info);
        setApiOnline(true);
        setError(null);
      })
      .catch((err) => {
        setApiOnline(false);
        setError(err.message);
      });

    return undefined;
  }, [enabled]);

  const refreshPrediction = useCallback(() => {
    if (!enabled || !driver || !apiOnline) return;

    setLoading(true);
    predictLapDelta({
      driver: driver.id,
      lap: driver.lap ?? lap,
      total_laps: totalLaps,
      lap_time: parseFloat(driver.lapTime) || undefined,
      tire_wear: driver.tireWear,
      pit_stops: driver.pitStops ?? 0,
      compound: raceConfig?.compound || 'medium',
      stint: (driver.pitStops ?? 0) + 1,
      weather: raceConfig?.weather || 'clear',
      variant: raceConfig?.modelVariant || 'base',
      race_weather: raceConfig?.weather,
    })
      .then((result) => {
        setPrediction(result);
        setError(null);
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, [enabled, driver, lap, totalLaps, raceConfig, apiOnline]);

  useEffect(() => {
    if (!enabled || !driver || !apiOnline) return undefined;

    refreshPrediction();
    timerRef.current = setInterval(refreshPrediction, 8000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, driver?.id, driver?.lap, driver?.lapTime, driver?.tireWear, apiOnline, refreshPrediction]);

  return { modelInfo, prediction, loading, error, apiOnline, refreshPrediction };
}