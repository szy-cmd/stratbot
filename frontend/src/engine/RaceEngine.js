/**
 * Mock race simulation engine.
 * Each driver: position, lapProgress (0-100), lap, lapTime, totalRaceTime, delta, gap, interval.
 * Tick: advance lapProgress, small random lapTime; re-sort by totalRaceTime.
 * Pauses at decision laps; resume() continues until next decision lap.
 *
 * BUG FIX: Side effects (setPaused, setDecisionIndex, ref mutations) moved OUTSIDE
 * the setDrivers updater to prevent React 18 StrictMode double-invocation issues.
 * Computation now uses a driversRef mirror so tick() reads from the ref and writes
 * to both the ref and state, keeping side effects in the RAF callback scope.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { DRIVERS, TURNS } from '../data/mockRaceState';

const TICK_MS = 50;
const PROGRESS_PER_TICK = 0.12;        // % lap per tick when running
const PROGRESS_SLOW = 0.04;           // when approaching decision
const LAP_TIME_BASE = 78;
const LAP_TIME_WIGGLE = 0.08;
const TOTAL_LAPS = 57;
const INITIAL_FUEL_KG = 110;
const FUEL_PER_LAP = 1.9;
const TIRE_DEG_PER_LAP = 1.6;
const MAX_SPEED_KMH = 340;
const MIN_SPEED_KMH = 85;

const ALL_DECISION_LAPS = TURNS.map((t) => t.lap);
const FAST_FORWARD_MULTIPLIER = 5;

/** Weather multiplier presets */
const WEATHER_PRESETS = {
  clear:    { tireDeg: 1.0,  speedMult: 1.0,  fuelMult: 1.0,  label: 'Clear' },
  overcast: { tireDeg: 0.85, speedMult: 0.97, fuelMult: 0.95, label: 'Overcast' },
  rainy:    { tireDeg: 1.4,  speedMult: 0.82, fuelMult: 1.1,  label: 'Rainy' },
};

const DEFAULT_CONFIG = {
  weather: 'clear',
  raceType: 'standard',
  totalLaps: TOTAL_LAPS,
  trackedDriver: 'VER',
  trackId: 'buddhism-svgfind-com',
};

/** Race commentary templates — filled with live data each lap */
const FEED_TEMPLATES = {
  tire: [
    'Tire update: rear grip at {wear}%. {warnMsg}',
    'Fronts starting to grain — current wear {wear}%.',
    'Tire temps stable. Grip level: {wear}%.',
    'Surface deg higher than expected — {wear}% remaining.',
  ],
  gap: [
    'Gap report: {gapAhead}s to P{posAhead}, {gapBehind}s from P{posBehind}.',
    '{driverAhead} ahead by {gapAhead}s. {driverBehind} closing at {closingRate}s/lap.',
    'Running P{pos}. {gapAhead}s to leader.',
    'Interval: +{gapBehind}s behind, +{gapAhead}s ahead.',
  ],
  fuel: [
    'Fuel: {fuel}kg remaining. Delta: {fuelDelta} laps {fuelDir} target.',
    'Fuel consumption nominal — {fuel}kg in tank.',
    'Fuel mode adjusted. {fuel}kg remaining, {lapsLeft} laps to go.',
  ],
  pace: [
    'Lap {lap} complete — {lapTime}s. Sector 3 was {s3}.',
    'Last lap: {lapTime}s. Track evolution improving — times dropping.',
    'P{pos} — Lap {lap}: {lapTime}s. {paceMsg}',
  ],
  rival: [
    '{rivalName} pits from P{rivalPos} for {compound} compound.',
    '{rivalName} sets purple S1 — pace is strong.',
    '{rivalName} under investigation for track limits.',
    'Team radio: {rivalName} reporting vibrations.',
  ],
};

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function generateLapEvent(sorted, lap, trackedId, totalLaps) {
  const tracked = sorted.find((d) => d.id === trackedId) || sorted[0];
  const pos = tracked.position;
  const ahead = sorted.find((d) => d.position === pos - 1);
  const behind = sorted.find((d) => d.position === pos + 1);
  const rival = sorted.find((d) => d.id !== trackedId && Math.random() > 0.5) || sorted[1];
  const compounds = ['Soft', 'Medium', 'Hard'];
  const lapsLeft = Math.max(0, totalLaps - lap);

  const vars = {
    wear: tracked.tireWear?.toFixed(1) ?? '?',
    warnMsg: (tracked.tireWear ?? 100) < 50 ? 'Cliff approaching!' : 'Holding steady.',
    gapAhead: ahead ? (tracked.totalRaceTime - ahead.totalRaceTime).toFixed(2) : '--',
    gapBehind: behind ? (behind.totalRaceTime - tracked.totalRaceTime).toFixed(2) : '--',
    posAhead: ahead ? ahead.position : '-',
    posBehind: behind ? behind.position : '-',
    driverAhead: ahead?.name ?? 'Leader',
    driverBehind: behind?.name ?? 'Nobody',
    closingRate: (Math.random() * 0.4 + 0.1).toFixed(2),
    pos,
    lap,
    lapTime: tracked.lapTime,
    s3: Math.random() > 0.5 ? 'purple' : 'green',
    paceMsg: Math.random() > 0.5 ? 'Consistent pace.' : 'Pushing hard.',
    fuel: tracked.fuel?.toFixed(1) ?? '?',
    fuelDelta: Math.floor(Math.random() * 3),
    fuelDir: Math.random() > 0.5 ? 'over' : 'under',
    lapsLeft,
    rivalName: rival?.name ?? 'Rival',
    rivalPos: rival?.position ?? '?',
    compound: pickRandom(compounds),
  };

  // Pick 1-2 event types per lap
  const types = Object.keys(FEED_TEMPLATES);
  const type1 = types[Math.floor(Math.random() * types.length)];
  const template = pickRandom(FEED_TEMPLATES[type1]);
  const text = template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '?');
  return { lap, text, type: type1 };
}

/** Simplified speed profile along the lap (0–100 progress → factor) */
function speedProfile(progress) {
  const p = progress / 100;
  return 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(p * Math.PI * 6)) * (0.5 + 0.5 * Math.cos(p * Math.PI * 2.5));
}

function buildInitialDrivers() {
  return DRIVERS.slice(0, 10).map((d, i) => {
    const lapTime = LAP_TIME_BASE + (Math.random() - 0.5) * 2;
    return {
      ...d,
      position: i + 1,
      lap: 1,
      lapProgress: Math.random() * 15,
      lapTime: lapTime.toFixed(2),
      totalRaceTime: 0,
      gap: '—',
      interval: '—',
      delta: '—',
      pitStops: 0,
      tireWear: 100,
      fuel: INITIAL_FUEL_KG,
      currentSpeed: 0,
    };
  });
}

function raceDistance(d) {
  return (d.lap - 1) * 100 + (d.lapProgress ?? 0);
}

function sortAndRank(drivers) {
  // Sort by who has covered the most race distance (laps + progress).
  const sorted = [...drivers].sort((a, b) => raceDistance(b) - raceDistance(a));
  const leaderDist = raceDistance(sorted[0]);

  return sorted.map((d, i) => {
    const dist = raceDistance(d);
    const gapDist = leaderDist - dist;                    // in % of a lap
    const gapSec = (gapDist / 100) * LAP_TIME_BASE;      // approx seconds behind

    const prevDist = i > 0 ? raceDistance(sorted[i - 1]) : leaderDist;
    const intervalDist = prevDist - dist;
    const intervalSec = (intervalDist / 100) * LAP_TIME_BASE;

    return {
      ...d,
      position: i + 1,
      gap: i === 0 ? '—' : `+${gapSec.toFixed(1)}s`,
      interval: i === 0 ? '—' : `+${intervalSec.toFixed(1)}s`,
      delta: i === 0 ? '—' : `+${gapSec.toFixed(1)}s`,
    };
  });
}

export function useRaceEngine() {
  /* --- refs initialized once via useState initializer (safe in StrictMode) --- */
  const driversRef = useRef(null);
  const [drivers, setDrivers] = useState(() => {
    const initial = sortAndRank(buildInitialDrivers());
    driversRef.current = initial;
    return initial;
  });

  const [started, setStarted] = useState(false);   // idle until startRace()
  const [paused, setPaused] = useState(true);       // starts paused
  const [decisionIndex, setDecisionIndex] = useState(-1);
  const [slowing, setSlowing] = useState(false);
  const [raceFinished, setRaceFinished] = useState(false);
  const [raceConfig, setRaceConfig] = useState(DEFAULT_CONFIG);
  const configRef = useRef(DEFAULT_CONFIG);
  const totalLapsRef = useRef(TOTAL_LAPS);
  const decisionLapsRef = useRef(ALL_DECISION_LAPS);

  /* Telemetry state */
  const [telemetryHistory, setTelemetryHistory] = useState({
    speed: [],
    tireWear: [{ lap: 1, wear: 100 }],
    fuel: [{ lap: 1, fuel: INITIAL_FUEL_KG }],
  });
  const [highlightsLog, setHighlightsLog] = useState([]);
  const [raceFeed, setRaceFeed] = useState([]);
  /* ML predictions captured during race for post-race analysis & comparison (variant + weather aware) */
  const [mlPredictions, setMlPredictions] = useState([]);
  const [trackedDriverId, setTrackedDriverIdState] = useState(DEFAULT_CONFIG.trackedDriver);
  const trackedIdRef = useRef(DEFAULT_CONFIG.trackedDriver);
  const [fastForward, setFastForward] = useState(false);
  const fastForwardRef = useRef(false);

  const nextDecisionIndexRef = useRef(0);
  const rafRef = useRef(null);
  const lastTickRef = useRef(0);
  const tickCountRef = useRef(0);
  const peakSpeedsRef = useRef({});
  const allTelemetryRef = useRef(null);
  const lastLeaderLapRef = useRef(1);

  /* Lazy-init per-driver telemetry ref */
  if (allTelemetryRef.current === null) {
    const t = {};
    DRIVERS.slice(0, 10).forEach((d) => {
      t[d.id] = { speed: [], tireWear: [{ lap: 1, wear: 100 }], fuel: [{ lap: 1, fuel: INITIAL_FUEL_KG }] };
    });
    allTelemetryRef.current = t;
  }

  const setTrackedDriverId = useCallback((id) => {
    trackedIdRef.current = id;
    setTrackedDriverIdState(id);
    // Immediately populate charts from the ref so switching is instant
    const entry = allTelemetryRef.current?.[id];
    if (entry) {
      setTelemetryHistory({ speed: [...entry.speed], tireWear: [...entry.tireWear], fuel: [...entry.fuel] });
    }
  }, []);

  /**
   * Core tick — all computation on driversRef (no updater side-effects).
   * State is written via setDrivers(value) rather than setDrivers(fn).
   */
  const tick = useCallback(() => {
    const prev = driversRef.current;
    if (!prev) return;

    const leader = prev.find((d) => d.position === 1);
    const leaderLap = leader?.lap ?? 1;
    const activeLaps = decisionLapsRef.current;
    const nextDecisionLap = activeLaps[nextDecisionIndexRef.current];
    const approaching =
      nextDecisionLap != null && leaderLap === nextDecisionLap - 1 && leader?.lapProgress > 85;

    const ffMultiplier = fastForwardRef.current ? FAST_FORWARD_MULTIPLIER : 1;
    const progressDelta = (approaching ? PROGRESS_SLOW : PROGRESS_PER_TICK) * ffMultiplier;
    const lapCompletions = [];

    const next = prev.map((d) => {
      let lap = d.lap;
      let lapProgress = d.lapProgress;
      let lapTime = parseFloat(d.lapTime);
      let totalRaceTime = d.totalRaceTime;
      let tireWear = d.tireWear;
      let fuel = d.fuel;

      lapProgress += progressDelta + (Math.random() - 0.5) * 0.01;
      lapTime += (Math.random() - 0.5) * LAP_TIME_WIGGLE;
      lapTime = Math.max(75, Math.min(82, lapTime));

      const wx = WEATHER_PRESETS[configRef.current.weather] || WEATHER_PRESETS.clear;
      const sf = speedProfile(lapProgress);
      const tireEffect = Math.max(0.85, tireWear / 100);
      const currentSpeed = Math.round(
        MIN_SPEED_KMH +
          (MAX_SPEED_KMH - MIN_SPEED_KMH) * Math.max(0.2, sf) * tireEffect * wx.speedMult +
          (Math.random() - 0.5) * 8
      );

      if (lapProgress >= 100) {
        lapProgress -= 100;
        lap += 1;
        totalRaceTime += lapTime;
        lapTime = LAP_TIME_BASE + (Math.random() - 0.5) * 2;
        tireWear = Math.max(0, tireWear - (TIRE_DEG_PER_LAP * wx.tireDeg) - Math.random() * 0.5);
        fuel = Math.max(0, fuel - (FUEL_PER_LAP * wx.fuelMult) - (Math.random() - 0.3) * 0.4);

        lapCompletions.push({ id: d.id, newLap: lap });
      }

      return { ...d, lap, lapProgress, lapTime: lapTime.toFixed(2), totalRaceTime, tireWear, fuel, currentSpeed };
    });

    const sorted = sortAndRank(next);

    /* Write to ref first, then trigger React render */
    driversRef.current = sorted;
    setDrivers(sorted);

    /* --- Side-effects OUTSIDE the updater (safe in StrictMode) --- */

    if (approaching) setSlowing(true);

    /* Telemetry recording — store ALL drivers in ref, push tracked driver to state */
    tickCountRef.current += 1;
    const isSampleTick = tickCountRef.current % 3 === 0;

    // Update ref for every driver (cheap — no React re-render)
    for (const d of sorted) {
      const entry = allTelemetryRef.current[d.id];
      if (!entry) continue;
      if (d.currentSpeed > (peakSpeedsRef.current[d.id] || 0)) peakSpeedsRef.current[d.id] = d.currentSpeed;
      if (isSampleTick) {
        entry.speed = [...entry.speed.slice(-200), { tick: tickCountRef.current, speed: d.currentSpeed }];
      }
    }
    for (const lc of lapCompletions) {
      const d = sorted.find((x) => x.id === lc.id);
      if (!d) continue;
      const entry = allTelemetryRef.current[d.id];
      if (!entry) continue;
      entry.tireWear = [...entry.tireWear, { lap: lc.newLap, wear: d.tireWear }];
      entry.fuel = [...entry.fuel, { lap: lc.newLap, fuel: d.fuel }];
    }

    // Push tracked driver's data to React state (triggers chart re-render)
    const trackedEntry = allTelemetryRef.current[trackedIdRef.current];
    const trackedLc = lapCompletions.find((lc) => lc.id === trackedIdRef.current);
    if (trackedEntry && (isSampleTick || trackedLc)) {
      setTelemetryHistory({ speed: [...trackedEntry.speed], tireWear: [...trackedEntry.tireWear], fuel: [...trackedEntry.fuel] });
    }

    /* Race feed — generate per-lap commentary when leader completes a lap */
    const newLeader = sorted[0];
    const newLeaderLap = newLeader.lap;
    if (newLeaderLap > lastLeaderLapRef.current) {
      lastLeaderLapRef.current = newLeaderLap;
      const evt = generateLapEvent(sorted, newLeaderLap, trackedIdRef.current, totalLapsRef.current);
      setRaceFeed((prev) => [...prev.slice(-40), evt]);
    }

    /* Decision-point detection */
    const atDecision = nextDecisionLap != null && newLeaderLap >= nextDecisionLap;

    if (atDecision) {
      const idx = nextDecisionIndexRef.current;
      nextDecisionIndexRef.current = Math.min(idx + 1, activeLaps.length);
      setDecisionIndex(idx);
      setPaused(true);
      setSlowing(false);
    }

    /* Race finish */
    if (newLeaderLap > totalLapsRef.current) {
      setRaceFinished(true);
      setPaused(true);
    }
  }, []);

  useEffect(() => {
    if (!started || paused || raceFinished) return;
    lastTickRef.current = performance.now();
    const loop = (now) => {
      const elapsed = now - lastTickRef.current;
      if (elapsed >= TICK_MS) {
        lastTickRef.current = now;
        tick();
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [started, paused, raceFinished, tick]);

  const resume = useCallback(() => {
    if (!raceFinished) setPaused(false);
  }, [raceFinished]);

  const toggleFastForward = useCallback(() => {
    setFastForward((v) => {
      fastForwardRef.current = !v;
      return !v;
    });
  }, []);

  /** Immediately end the race and transition to post-race summary. */
  const endSimulation = useCallback(() => {
    setRaceFinished(true);
    setPaused(true);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  /** Start (or restart) the race with a config object from PreRaceSetup. */
  const startRace = useCallback((config) => {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    configRef.current = cfg;
    totalLapsRef.current = cfg.totalLaps;
    decisionLapsRef.current = ALL_DECISION_LAPS.filter((l) => l <= cfg.totalLaps);
    setRaceConfig(cfg);

    trackedIdRef.current = cfg.trackedDriver;
    setTrackedDriverIdState(cfg.trackedDriver);

    nextDecisionIndexRef.current = 0;
    tickCountRef.current = 0;
    peakSpeedsRef.current = {};
    lastLeaderLapRef.current = 1;
    fastForwardRef.current = false;

    const initial = sortAndRank(buildInitialDrivers());
    driversRef.current = initial;

    const t = {};
    DRIVERS.slice(0, 10).forEach((d) => {
      t[d.id] = { speed: [], tireWear: [{ lap: 1, wear: 100 }], fuel: [{ lap: 1, fuel: INITIAL_FUEL_KG }] };
    });
    allTelemetryRef.current = t;

    setDrivers(initial);
    setDecisionIndex(-1);
    setSlowing(false);
    setRaceFinished(false);
    setTelemetryHistory({ speed: [], tireWear: [{ lap: 1, wear: 100 }], fuel: [{ lap: 1, fuel: INITIAL_FUEL_KG }] });
    setHighlightsLog([]);
    setRaceFeed([]);
    setMlPredictions([]);
    setFastForward(false);
    setPaused(false);
    setStarted(true);
  }, []);

  const reset = useCallback(() => {
    setStarted(false);
    setPaused(true);
    setRaceFinished(false);
    setDecisionIndex(-1);
    setSlowing(false);
    setMlPredictions([]);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const addHighlight = useCallback((text) => {
    setHighlightsLog((prev) => [...prev, { time: Date.now(), text }]);
  }, []);

  /** Record a live ML prediction (called from App/useStratBotModel during racing) for post-race comparison */
  const recordPrediction = useCallback((pred) => {
    if (!pred) return;
    setMlPredictions((prev) => [...prev.slice(-50), { ...pred, lap: pred.lap || (driversRef.current?.[0]?.lap ?? 0), ts: Date.now() }]);
  }, []);

  return {
    drivers,
    paused,
    decisionIndex,
    slowing,
    raceFinished,
    resume,
    reset,
    endSimulation,
    started,
    startRace,
    raceConfig,
    decisionLaps: decisionLapsRef.current,
    telemetryHistory,
    trackedDriverId,
    setTrackedDriverId,
    peakSpeed: peakSpeedsRef.current[trackedDriverId] || 0,
    highlightsLog,
    addHighlight,
    raceFeed,
    fastForward,
    toggleFastForward,
    totalLaps: totalLapsRef.current,
    mlPredictions,
    recordPrediction,
  };
}
