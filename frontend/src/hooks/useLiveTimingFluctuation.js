import { useState, useEffect } from 'react';

/**
 * Adds small random time fluctuations to leaderboard times (fake live timing).
 * Updates every 2–3s so the board feels "live".
 */
export function useLiveTimingFluctuation(leaderboard, setLeaderboard) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!leaderboard?.length) return;
    const interval = setInterval(() => {
      setLeaderboard((prev) =>
        prev.map((row, i) => {
          if (i === 0) return row;
          const wiggle = (Math.random() - 0.5) * 0.04;
          const parse = (s) => (typeof s === 'string' && s !== '—' ? parseFloat(s) : 0);
          const gapVal = parse(row.gap);
          const intervalVal = parse(row.interval);
          const lastVal = parse(row.lastLap);
          return {
            ...row,
            gap: gapVal ? `+${Math.max(0, gapVal + wiggle).toFixed(2)}` : row.gap,
            interval: intervalVal ? `+${Math.max(0, intervalVal + wiggle * 0.5).toFixed(2)}` : row.interval,
            lastLap: lastVal ? (lastVal + wiggle * 0.2).toFixed(2) : row.lastLap,
          };
        })
      );
      setTick((t) => t + 1);
    }, 2200 + Math.random() * 800);
    return () => clearInterval(interval);
  }, [leaderboard?.length, setLeaderboard]);

  return tick;
}
