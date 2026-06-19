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
  useMLDeltas: false,  // FYP-II: feed live ML LapDelta predictions to influence pace/tyre/fuel
  dataMode: 'mock',    // 'mock' | 'ml-enhanced' | 'historical' (for real Parquet slices)
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

function buildInitialDrivers(customCarStats = null, trackedId = null) {
  return DRIVERS.slice(0, 10).map((d, i) => {
    const lapTime = LAP_TIME_BASE + (Math.random() - 0.5) * 2;
    const isTracked = d.id === trackedId && customCarStats;
    const initialWear = isTracked ? (100 - (customCarStats.initialTyreWear || 0)) : 100;
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
      tireWear: initialWear,
      fuel: INITIAL_FUEL_KG,
      currentSpeed: 0,
      customStats: isTracked ? customCarStats : null, // attach for per-driver use
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
  /* --- all refs first to avoid TDZ in initializers --- */
  const driversRef = useRef(null);
  const startedRef = useRef(false);
  const raceFinishedRef = useRef(false);
  const configRef = useRef(DEFAULT_CONFIG);
  const totalLapsRef = useRef(TOTAL_LAPS);
  const decisionLapsRef = useRef(ALL_DECISION_LAPS);
  const trackedIdRef = useRef(DEFAULT_CONFIG.trackedDriver);
  const fastForwardRef = useRef(false);
  const currentMLDeltaRef = useRef(0);
  const useMLDeltasRef = useRef(false);
  const dataModeRef = useRef('mock');
  const customCarStatsRef = useRef(null);
  const isFastCompletingRef = useRef(false);
  const nextDecisionIndexRef = useRef(0);
  const rafRef = useRef(null);
  const lastTickRef = useRef(0);
  const tickCountRef = useRef(0);
  const peakSpeedsRef = useRef({});
  const allTelemetryRef = useRef(null);

  /* --- state --- */
  const [drivers, setDrivers] = useState(() => {
    const initial = sortAndRank(buildInitialDrivers());
    driversRef.current = initial;
    return initial;
  });

  const [started, setStarted] = useState(() => {
    startedRef.current = false;
    return false;
  });
  const [paused, setPaused] = useState(true);
  const [decisionIndex, setDecisionIndex] = useState(-1);
  const [slowing, setSlowing] = useState(false);
  const [raceFinished, setRaceFinished] = useState(() => {
    raceFinishedRef.current = false;
    return false;
  });

  const [raceConfig, setRaceConfig] = useState(DEFAULT_CONFIG);

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
  const [fastForward, setFastForward] = useState(false);

  const [isFastCompleting, setIsFastCompleting] = useState(false);
  const lastLeaderLapRef = useRef(1);

  /* FYP post-race analytics data capture (additive, minimal perf cost) */
  const lapHistoryRef = useRef([]); // [{lap, positions, lapTimes, tireWears, fuels, raceTimes}] at each lap completion (raceTimes = cumulative for accurate post-race gaps)
  const [lapHistory, setLapHistory] = useState([]);

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
    let progressDelta = (approaching ? PROGRESS_SLOW : PROGRESS_PER_TICK) * ffMultiplier;
    if (isFastCompletingRef.current) {
      progressDelta *= 25; // very aggressive to complete full sim quickly
    }
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
      // FYP-II: integrate live-predicted ML LapDelta to affect pace (positive = slower lap)
      if (useMLDeltasRef.current && currentMLDeltaRef.current) {
        lapTime += currentMLDeltaRef.current * 0.7;  // scale influence
        lapTime = Math.max(70, Math.min(90, lapTime));
      }
      lapTime = Math.max(75, Math.min(82, lapTime));

      const wx = WEATHER_PRESETS[configRef.current.weather] || WEATHER_PRESETS.clear;
      const sf = speedProfile(lapProgress);
      let tireEffect = Math.max(0.85, tireWear / 100);
      let speedMult = wx.speedMult;

      // FYP-II: apply custom car stats ONLY to the tracked driver's physics for accurate results
      const trackedId = trackedIdRef.current;
      const isTracked = d.id === trackedId;
      if (isTracked && d.customStats) {
        const cs = d.customStats;
        // Aero reduces effective deg (more downforce = less slide)
        tireEffect *= (1 - (cs.aeroLevel - 5) / 25);
        // Power boosts speed, but more fuel use later
        speedMult *= (cs.powerLevel / 5);
      }

      const currentSpeed = Math.round(
        MIN_SPEED_KMH +
          (MAX_SPEED_KMH - MIN_SPEED_KMH) * Math.max(0.2, sf) * tireEffect * speedMult +
          (Math.random() - 0.5) * 8
      );

      if (lapProgress >= 100) {
        while (lapProgress >= 100) {
          lapProgress -= 100;
          lap += 1;
          totalRaceTime += lapTime;
          lapTime = LAP_TIME_BASE + (Math.random() - 0.5) * 2;
          // FYP-II: apply custom car stats for tracked driver (realistic team strategy for specific driver)
          let tireDegMult = wx.tireDeg;
          let fuelMult = wx.fuelMult;
          const isTracked = d.id === trackedIdRef.current;
          if (isTracked && d.customStats) {
            const cs = d.customStats;
            const aeroFactor = 1 - (cs.aeroLevel - 5) / 30; // high aero = less deg
            tireDegMult *= Math.max(0.7, aeroFactor);
            const powerFactor = cs.powerLevel / 5;
            fuelMult *= powerFactor;
          }
          tireWear = Math.max(0, tireWear - (TIRE_DEG_PER_LAP * tireDegMult) - Math.random() * 0.5);
          fuel = Math.max(0, fuel - (FUEL_PER_LAP * fuelMult) - (Math.random() - 0.3) * 0.4);

          lapCompletions.push({ id: d.id, newLap: lap });
        }
      }

      return { ...d, lap, lapProgress, lapTime: lapTime.toFixed(2), totalRaceTime, tireWear, fuel, currentSpeed };
    });

    const sorted = sortAndRank(next);

    const newLeader = sorted[0];
    const newLeaderLap = newLeader.lap;

    /* Write to ref first, then trigger React render */
    driversRef.current = sorted;
    // During fast complete, update UI state every lap (so the overlay lap counter visibly advances smoothly).
    // + always at end. Smaller bursts above ensure it feels like accurate ongoing simulation.
    if (!isFastCompletingRef.current || (newLeaderLap % 1 === 0) || (newLeaderLap > totalLapsRef.current)) {
      setDrivers(sorted);
    }

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

      /* Record lap completion snapshot for post-race analytics (positions, pace, tire/fuel per lap).
         Enhanced: includes per-driver cumulative raceTimeAtLap for accurate gap-to-leader calculations in dashboard (no more approx). */
      const lapNum = lc.newLap;
      let snap = lapHistoryRef.current.find((s) => s.lap === lapNum);
      if (!snap) {
        snap = { lap: lapNum, positions: {}, lapTimes: {}, tireWears: {}, fuels: {}, raceTimes: {} };
        lapHistoryRef.current.push(snap);
      }
      snap.positions[d.id] = d.position;
      snap.lapTimes[d.id] = parseFloat(d.lapTime);
      snap.tireWears[d.id] = d.tireWear;
      snap.fuels[d.id] = d.fuel;
      snap.raceTimes[d.id] = d.totalRaceTime || 0; // cumulative for precise gaps
    }

    // Push tracked driver's data to React state (triggers chart re-render)
    const trackedEntry = allTelemetryRef.current[trackedIdRef.current];
    const trackedLc = lapCompletions.find((lc) => lc.id === trackedIdRef.current);
    if (trackedEntry && (isSampleTick || trackedLc)) {
      setTelemetryHistory({ speed: [...trackedEntry.speed], tireWear: [...trackedEntry.tireWear], fuel: [...trackedEntry.fuel] });
    }

    /* Race feed — generate per-lap commentary when leader completes a lap */
    if (newLeaderLap > lastLeaderLapRef.current && !isFastCompletingRef.current) {
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
      if (isFastCompletingRef.current) {
        // Auto-resolve decision for full fast sim: pick highest probability branch, add highlight
        const turn = TURNS.find(t => t.lap === nextDecisionLap);
        if (turn && turn.branches && turn.branches.length > 0) {
          const best = turn.branches.reduce((a, b) => (b.probability > a.probability ? b : a));
          setHighlightsLog((prev) => [...prev, { time: Date.now(), text: `Lap ${turn.lap}: AUTO ${best.label} — ${best.outcome} (fast sim)` }]);
        }
        setPaused(false);  // continue without pause
      } else {
        setPaused(true);
        setSlowing(false);
      }
    }

    /* Race finish */
    if (newLeaderLap > totalLapsRef.current) {
      setRaceFinished(true);
      raceFinishedRef.current = true;
      setPaused(true);
      isFastCompletingRef.current = false;
      setIsFastCompleting(false);
      // Snapshot history for post-race dashboard (sorted by lap for charts)
      const finalHistory = [...lapHistoryRef.current].sort((a, b) => a.lap - b.lap);
      setLapHistory(finalHistory);
    }
  }, []);

  useEffect(() => {
    if (!startedRef.current || paused || raceFinishedRef.current || isFastCompletingRef.current) return;
    lastTickRef.current = performance.now();
    const loop = (now) => {
      if (isFastCompletingRef.current) return; // fast loop handles it
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
    setIsFastCompleting(false);
    isFastCompletingRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    // Ensure history captured for manual end too
    const finalHistory = [...(lapHistoryRef.current || [])].sort((a, b) => a.lap - b.lap);
    setLapHistory(finalHistory);
  }, []);

  /** Start (or restart) the race with a config object from PreRaceSetup. */
  const startRace = useCallback((config) => {
    const cfg = { ...DEFAULT_CONFIG, ...config };
    configRef.current = cfg;
    totalLapsRef.current = cfg.totalLaps;
    decisionLapsRef.current = ALL_DECISION_LAPS.filter((l) => l <= cfg.totalLaps);
    useMLDeltasRef.current = !!cfg.useMLDeltas;
    dataModeRef.current = cfg.dataMode || 'mock';
    customCarStatsRef.current = cfg.carStats || null;
    isFastCompletingRef.current = false;
    setRaceConfig(cfg);

    trackedIdRef.current = cfg.trackedDriver;
    setTrackedDriverIdState(cfg.trackedDriver);

    nextDecisionIndexRef.current = 0;
    tickCountRef.current = 0;
    peakSpeedsRef.current = {};
    lastLeaderLapRef.current = 1;
    lapHistoryRef.current = [];
    setLapHistory([]);
    fastForwardRef.current = false;

    const initial = sortAndRank(buildInitialDrivers(cfg.carStats, cfg.trackedDriver));
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
    setIsFastCompleting(false);
    isFastCompletingRef.current = false;
    setTelemetryHistory({ speed: [], tireWear: [{ lap: 1, wear: 100 }], fuel: [{ lap: 1, fuel: INITIAL_FUEL_KG }] });
    setHighlightsLog([]);
    setRaceFeed([]);
    setMlPredictions([]);
    setFastForward(false);
    setPaused(false);
    setStarted(true);
    startedRef.current = true;
  }, []);

  const reset = useCallback(() => {
    setStarted(false);
    startedRef.current = false;
    setPaused(true);
    setRaceFinished(false);
    raceFinishedRef.current = false;
    setDecisionIndex(-1);
    setSlowing(false);
    setMlPredictions([]);
    setIsFastCompleting(false);
    isFastCompletingRef.current = false;
    lapHistoryRef.current = [];
    setLapHistory([]);
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

  // FYP-II: feed live-predicted LapDelta into simulation to influence pace, tyre, etc.
  const setCurrentMLDelta = useCallback((delta) => {
    currentMLDeltaRef.current = parseFloat(delta) || 0;
  }, []);

  /** FYP-II: button to complete FULL SIMULATION fast (shows "loading" while advancing quickly to see final results) */
  const fastCompleteRace = useCallback(() => {
    if (raceFinishedRef.current || !startedRef.current) return;
    isFastCompletingRef.current = true;
    setIsFastCompleting(true);
    fastForwardRef.current = true;
    setFastForward(true);
    setPaused(false);
    setSlowing(false);

    // Run a fast simulation loop using setTimeout bursts.
    // IMPORTANT: Previously too aggressive (120 sync ticks + 10ms) which made it feel instantaneous
    // and "not simulating". Now: smaller bursts (8 ticks ~1 lap), longer yield (33ms) so the full
    // 57-lap race takes ~2-4 visible seconds with the overlay lap counter visibly advancing lap-by-lap.
    // All physics (progress, tire deg, fuel, speed profile, lap completions, telemetry refs, lapHistory)
    // still execute fully and accurately in every tick() call. Auto-resolve only affects UI narrative
    // (picks best-prob branch for post-race report) — core race sim is unchanged.
    const TICKS_PER_BURST = 8;
    const BURST_INTERVAL_MS = 33;
    const runFastBurst = () => {
      if (raceFinishedRef.current || !startedRef.current || !isFastCompletingRef.current) {
        isFastCompletingRef.current = false;
        setIsFastCompleting(false);
        return;
      }
      // Smaller burst so UI (overlay lap progress) updates frequently and feels like real sim running.
      for (let i = 0; i < TICKS_PER_BURST; i++) {
        tick();
        if (raceFinishedRef.current) break;
      }
      // Yield longer to give browser time to paint the updated lap counter / drivers in overlay.
      if (!raceFinishedRef.current) {
        setTimeout(runFastBurst, BURST_INTERVAL_MS);
      } else {
        isFastCompletingRef.current = false;
        setIsFastCompleting(false);
      }
    };
    // Yield to React first so the isFastCompleting overlay (with "Fast-forwarding..." text + progress)
    // is painted before we start the bursts. This ensures the loading indicator is visible.
    setTimeout(runFastBurst, 16);
  }, [tick]);  // tick is stable from useCallback([])

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
    setCurrentMLDelta,  // for ML integration into sim
    useMLDeltas: useMLDeltasRef.current,
    isFastCompleting,
    fastCompleteRace,
    /* New: rich lap-by-lap history for post-race analytics dashboard (positions, lapTimes, tire/fuel) */
    lapHistory,
  };
}
