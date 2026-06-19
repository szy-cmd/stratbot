import React, { useState } from 'react';
import { DRIVERS, TRACK_OPTIONS } from '../data/mockRaceState';
import { login as apiLogin, logout as apiLogout } from '../services/stratbotApi';
import { CarCustomizer } from './CarCustomizer';

const WEATHER_OPTIONS = [
  {
    id: 'clear',
    label: 'Clear',
    icon: '☀',
    desc: 'Optimal grip, standard tire degradation',
    color: 'text-amber-400',
  },
  {
    id: 'overcast',
    label: 'Overcast',
    icon: '☁',
    desc: 'Cooler track, slightly reduced deg',
    color: 'text-gray-400',
  },
  {
    id: 'rainy',
    label: 'Rainy',
    icon: '🌧',
    desc: 'Low grip, high deg, safety car likely',
    color: 'text-blue-400',
  },
];

const RACE_TYPE_OPTIONS = [
  {
    id: 'sprint',
    label: 'Sprint',
    laps: 25,
    desc: '25 laps — flat out, no pitstop required',
    icon: '⚡',
    color: 'text-f1-red',
  },
  {
    id: 'standard',
    label: 'Grand Prix',
    laps: 57,
    desc: '57 laps — full race distance',
    icon: '🏁',
    color: 'text-f1-accent',
  },
  {
    id: 'endurance',
    label: 'Endurance',
    laps: 70,
    desc: '70 laps — fuel & tire management critical',
    icon: '🔋',
    color: 'text-amber-400',
  },
];

const COMPOUND_OPTIONS = [
  { id: 'soft', label: 'Soft', desc: 'Fast but high degradation', color: 'text-f1-red' },
  { id: 'medium', label: 'Medium', desc: 'Balanced — default choice', color: 'text-amber-400' },
  { id: 'hard', label: 'Hard', desc: 'Durable for long stints', color: 'text-gray-400' },
  { id: 'intermediate', label: 'Inter', desc: 'Wet but not full rain', color: 'text-blue-400' },
];

const MODEL_VARIANT_OPTIONS = [
  { id: 'base', label: 'Base (RF winner)', desc: 'Production 16-feature model *with weather data always included*', mae: '1.0202s' },
  { id: 'rf', label: 'Random Forest', desc: 'The current production winner (uses weather)', mae: '1.0202s' },
  { id: 'xgb', label: 'XGBoost', desc: 'XGB from same training run (uses weather)', mae: '1.5323s' },
];

export function PreRaceSetup({ onStart, previousRaces = [], onViewPrevious = () => {} }) {
  const [weather, setWeather] = useState('clear');
  const [raceType, setRaceType] = useState('standard');
  const [trackedDriver, setTrackedDriver] = useState('VER');
  const [trackId, setTrackId] = useState('buddhism-svgfind-com');
  const [compound, setCompound] = useState('medium');
  const [modelVariant, setModelVariant] = useState('base'); // base | weather | rf (for experimentation with our trained models)
  const [useMLDeltas, setUseMLDeltas] = useState(true); // FYP-II: feed live-predicted deltas into sim engine
  const [dataMode, setDataMode] = useState('mock'); // 'mock' | 'ml-enhanced' | 'historical' (Parquet slices)

  // FYP-II simple auth demo
  const [authUser, setAuthUser] = useState(null);
  const [loginUser, setLoginUser] = useState('student');
  const [loginPass, setLoginPass] = useState('fyp2026');
  const [loginError, setLoginError] = useState('');

  // Car customization state (FYP-II interactive 3D)
  const [carStats, setCarStats] = useState({ compound: 'medium', initialTyreWear: 0, aeroLevel: 5, powerLevel: 5 });

  // Derived current selections for the left summary sidebar (live updating, no scroll needed)
  const currentWeather = WEATHER_OPTIONS.find(w => w.id === weather);
  const currentRace = RACE_TYPE_OPTIONS.find(r => r.id === raceType);
  const currentTrack = TRACK_OPTIONS.find(t => t.id === trackId);
  const currentDriver = DRIVERS.find(d => d.id === trackedDriver);
  const currentModel = MODEL_VARIANT_OPTIONS.find(m => m.id === modelVariant);

  const handleLogin = async () => {
    setLoginError('');
    try {
      const res = await apiLogin(loginUser, loginPass);
      setAuthUser(res.user);
    } catch (e) {
      setLoginError(e.message || 'Login failed (try student/fyp2026 or admin/stratbot2026)');
    }
  };

  const handleLogout = () => {
    apiLogout();
    setAuthUser(null);
  };

  const handleStart = () => {
    const raceConfig = RACE_TYPE_OPTIONS.find((r) => r.id === raceType);
    onStart({
      weather,
      raceType,
      totalLaps: raceConfig?.laps ?? 57,
      trackedDriver,
      trackId,
      compound,
      modelVariant,
      useMLDeltas,
      dataMode,
      carStats,
    });
  };

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-f1-dark hud-grid">
      {/* Full edge-to-edge sticky top bar with StratBot branding, names + CS numbers (visible on scroll).
          Brighter text for names, larger size, added right-side content. */}
      <div className="sticky top-0 z-50 w-full border-b border-f1-border bg-f1-dark/95 backdrop-blur-md">
        <div className="flex w-full">
          {/* Left column aligned to sidebar (under STRATBOT logo) - contains only STRATBOT + GitHub for alignment */}
          <div className="w-72 flex-shrink-0 px-4 py-2">
            <div className="text-left flex items-center gap-2">
              {/* GitHub link on the left side, with logo, vertically center aligned with STRATBOT */}
              <a
                href="https://github.com/szy-cmd/stratbot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                title="View source on GitHub"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                </svg>
              </a>
              <span 
                className="font-display text-3xl font-black tracking-[3px] text-f1-accent cursor-pointer select-none hover:bg-f1-panel/40 hover:text-white px-1 -mx-1 rounded transition-colors"
                title="StratBot - FYP P80F25"
              >
                STRATBOT
              </span>
            </div>
          </div>

          {/* Main top area - F1 STRATEGY DASHBOARD continues the one line, names under as one continuous line, right info on far right */}
          <div className="flex-1 px-4 py-2 flex justify-between items-start">
            <div className="flex flex-col">
              <span className="font-display text-lg font-bold tracking-wider text-white hover:bg-f1-panel/40 hover:text-f1-accent px-1 -mx-1 rounded transition-colors cursor-pointer select-none" title="F1 Strategy Dashboard">
                &nbsp;F1 STRATEGY DASHBOARD
              </span>
              <div className="text-[9px] font-mono tracking-[0.5px] text-white/85 font-medium mt-1">
                ZAAFIR EJAZ (CS221222) • EBAD AHMED (CS221217) • FATIMA ATHER RAJPUT (CS221270)
              </div>
            </div>
            <div className="text-right text-[10px] font-mono text-gray-400 tracking-wider hidden sm:block">
              DHA SUFFA UNIVERSITY<br />
              <span className="text-f1-accent/70">FYP P80F25</span>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width layout with sidebar on the very left (under the STRATBOT logo area in top bar), like Gmail sidebar. Uses full available space. */}
      <div className="flex w-full pt-6 pb-8">
        {/* Left sidebar - sticky, moves along with scroll. Current selection fixed at top of sidebar, previous results scrollable below within sidebar if long. */}
        <div className="w-72 flex-shrink-0 px-4 border-r border-f1-border/40 bg-f1-dark/50 sticky top-20 h-[calc(100vh-5rem)] flex flex-col overflow-hidden">
          {/* CURRENT SELECTION - always visible at top of sidebar */}
          <div className="flex-shrink-0 bg-f1-panel border border-f1-border rounded-lg p-4 text-sm shadow-xl mb-2">
            <div className="font-display text-xs font-semibold uppercase tracking-wider text-f1-accent mb-3">CURRENT SELECTION</div>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 shrink-0">Weather</span>
                <span className="font-medium text-white text-right">{currentWeather?.icon} {currentWeather?.label}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 shrink-0">Race</span>
                <span className="font-medium text-white text-right">{currentRace?.label} ({currentRace?.laps} laps)</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 shrink-0">Circuit</span>
                <span className="font-medium text-white truncate text-right">{currentTrack?.name}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 shrink-0">Driver</span>
                <span className="font-medium text-white flex items-center gap-1.5 justify-end truncate text-right">
                  <span className="inline-block h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: currentDriver?.color }}></span>
                  {currentDriver?.name} #{currentDriver?.number}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 shrink-0">Setup</span>
                <span className="font-medium text-white text-right leading-tight">
                  {carStats.compound} • {carStats.initialTyreWear}% wear • A{carStats.aeroLevel}/P{carStats.powerLevel}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-gray-400 shrink-0">Model</span>
                <span className="font-medium text-white text-right">{currentModel?.label}</span>
              </div>
            </div>
            <div className="mt-3 pt-2 border-t border-f1-border/50 text-[10px] text-gray-500">Live • Affects sim + ML</div>
          </div>

          {/* PREVIOUS RESULTS - scrolls inside the sticky sidebar if many entries */}
          <div className="flex-1 overflow-auto bg-f1-panel border border-f1-border rounded-lg p-4 text-sm shadow-xl">
            <div className="font-display text-xs font-semibold uppercase tracking-wider text-f1-accent mb-2">PREVIOUS RESULTS</div>
            {previousRaces.length === 0 ? (
              <div className="text-[10px] text-gray-500 italic">Complete a simulation to record results here.</div>
            ) : (
              <div className="space-y-1">
                {previousRaces.slice(0, 8).map((race) => {
                  const winner = race.drivers?.[0];
                  const trackName = TRACK_OPTIONS.find((t) => t.id === race.raceConfig?.trackId)?.name || 'Track';
                  const date = new Date(race.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                  return (
                    <button
                      key={race.id}
                      onClick={() => onViewPrevious(race)}
                      className="w-full text-left px-2 py-1.5 rounded text-xs border border-transparent hover:border-f1-border/60 hover:bg-f1-panel/60 transition flex justify-between items-center gap-2"
                    >
                      <span className="font-mono text-gray-400">{date}</span>
                      <span className="truncate text-white/90 flex-1 text-right">{trackName}</span>
                      <span className="text-f1-accent/80 font-medium text-[10px] whitespace-nowrap">→ {winner?.name || '?'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Main content - takes remaining space to the right of sidebar */}
        <div className="flex-1 min-w-0 px-4">
          {/* Header */}
          <div className="mb-8 text-center animate-fade-in-up">
            <div className="font-display text-2xl font-bold tracking-widest text-white mb-1">
              RACE CONFIGURATION
            </div>
            <p className="font-mono text-xs text-gray-600 tracking-wider">
              CONFIGURE YOUR SESSION PARAMETERS
            </p>
          </div>

        {/* FYP-II: Simple User Auth (SRS) - demo login */}
        <Section title="User Login (FYP-II)" index={0}>
          {!authUser ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input value={loginUser} onChange={e => setLoginUser(e.target.value)} placeholder="username" className="px-2 py-1 bg-black/30 border border-f1-border text-sm" />
                <input type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)} placeholder="password" className="px-2 py-1 bg-black/30 border border-f1-border text-sm" />
                <button onClick={handleLogin} className="px-3 py-1 bg-f1-accent text-black text-sm">Login</button>
              </div>
              {loginError && <div className="text-red-400 text-xs">{loginError}</div>}
              <div className="text-[10px] text-gray-500">Demo: student/fyp2026 (user) or admin/stratbot2026 (admin for retrain)</div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-sm">
              Logged in as <span className="font-mono text-f1-accent">{authUser.username}</span> ({authUser.role})
              <button onClick={handleLogout} className="text-xs underline">Logout</button>
            </div>
          )}
        </Section>

        {/* Weather */}
        <Section title="Weather Conditions" index={1}>
          <div className="grid grid-cols-3 gap-3">
            {WEATHER_OPTIONS.map((w) => (
              <button
                key={w.id}
                type="button"
                onClick={() => setWeather(w.id)}
                className={`setup-card text-center ${weather === w.id ? 'selected' : ''}`}
              >
                <div className="text-3xl mb-2">{w.icon}</div>
                <div className={`font-display text-sm font-bold tracking-wider ${w.color}`}>
                  {w.label}
                </div>
                <div className="mt-1 text-[10px] text-gray-500 leading-relaxed">{w.desc}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Race Type */}
        <Section title="Race Type" index={2}>
          <div className="grid grid-cols-3 gap-3">
            {RACE_TYPE_OPTIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRaceType(r.id)}
                className={`setup-card text-center ${raceType === r.id ? 'selected' : ''}`}
              >
                <div className="text-2xl mb-2">{r.icon}</div>
                <div className={`font-display text-sm font-bold tracking-wider ${r.color}`}>
                  {r.label}
                </div>
                <div className="mt-1 font-mono text-[10px] text-gray-400">{r.laps} LAPS</div>
                <div className="mt-1 text-[10px] text-gray-500 leading-relaxed">{r.desc}</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Track Selection */}
        <Section title="Circuit" index={3}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {TRACK_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTrackId(t.id)}
                className={`setup-card text-center ${trackId === t.id ? 'selected' : ''}`}
              >
                <div className="font-display text-xs font-bold tracking-wider text-white">
                  {t.name}
                </div>
              </button>
            ))}
          </div>
        </Section>

        {/* Driver Selection */}
        <Section title="Your Driver" index={4}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {DRIVERS.slice(0, 10).map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  setTrackedDriver(d.id);
                  // Reset car stats for new driver (team-specific defaults)
                  setCarStats({ compound: 'medium', initialTyreWear: 0, aeroLevel: 5, powerLevel: 5 });
                }}
                className={`setup-card flex items-center gap-2 px-3 py-3 ${trackedDriver === d.id ? 'selected' : ''}`}
              >
                <span
                  className="h-6 w-1 rounded-full shrink-0"
                  style={{ backgroundColor: d.color }}
                />
                <div className="min-w-0">
                  <div className="font-display text-[11px] font-bold text-white truncate">
                    {d.name}
                  </div>
                  <div className="font-mono text-[9px] text-gray-500">
                    #{d.number} · {d.team}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-gray-600 text-center">
            You will make strategic decisions for this driver. You can still view other drivers' telemetry during the race.
          </p>
        </Section>

        {/* FYP-II: 3D Interactive Car Customizer - visible "page" for deciding realistic team stats for your driver.
            Now with significantly enhanced procedural F1 geometry (detailed wings, halo, sidepods, PBR materials) + optional GLTF import path for max realism. */}
        <Section title="Customize Your Driver's Car (Interactive 3D F1 Team Strategy)" index={5}>
          <CarCustomizer
            stats={carStats}
            onStatsChange={setCarStats}
            driverName={DRIVERS.find(d => d.id === trackedDriver)?.name}
            driverColor={DRIVERS.find(d => d.id === trackedDriver)?.color}
            team={DRIVERS.find(d => d.id === trackedDriver)?.team || 'McLaren'}
            weather={weather}
            trackName={TRACK_OPTIONS.find(t => t.id === trackId)?.name}
            onClose={() => {}}  // no close, always visible in section
            onApply={(newStats) => setCarStats(newStats)}
          />
          <p className="mt-2 text-[10px] text-gray-600 text-center">
            This is your dedicated page to decide tyres, setup etc. realistically as the team for this specific driver. Changes are live in 3D and will affect the simulation and ML results accurately.
          </p>
        </Section>

        {/* Starting Compound (affects ML LapDelta prediction directly via CompoundCode) */}
        <Section title="Starting Compound" index={5}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {COMPOUND_OPTIONS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCompound(c.id)}
                className={`setup-card text-center ${compound === c.id ? 'selected' : ''}`}
              >
                <div className={`font-display text-sm font-bold tracking-wider ${c.color}`}>{c.label}</div>
                <div className="mt-1 text-[10px] text-gray-500 leading-relaxed">{c.desc}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-gray-600 text-center">
            Directly influences the ML prediction (CompoundCode feature). Choose wisely for your strategy.
          </p>
        </Section>

        {/* AI Model Variant — experiment with models we actually trained (including weather variants) */}
        <Section title="AI Model / Variant" index={6}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {MODEL_VARIANT_OPTIONS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => setModelVariant(v.id)}
                className={`setup-card text-left p-3 ${modelVariant === v.id ? 'selected' : ''}`}
              >
                <div className="font-display text-sm font-bold tracking-wider text-white">{v.label}</div>
                <div className="mt-1 text-[10px] text-gray-400">{v.desc}</div>
                <div className="mt-1 font-mono text-[10px] text-f1-accent">MAE ~{v.mae}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-gray-600 text-center">
            Select which trained model powers the live LapDelta predictions. Weather-aware uses data from our pipeline experiments.
          </p>
        </Section>

        {/* FYP-II Admin (if logged as admin) */}
        {authUser?.role === 'admin' && (
          <Section title="Admin Controls (FYP-II)" index={8}>
            <div className="flex gap-2 text-sm">
              <button
                onClick={async () => {
                  try {
                    const r = await fetch((import.meta.env.VITE_API_BASE || '') + '/api/admin/retrain', { method: 'POST' });
                    const data = await r.json();
                    alert('Retrain result: ' + JSON.stringify(data).slice(0, 200));
                  } catch (e) { alert('Admin call failed (is backend running?)'); }
                }}
                className="px-3 py-1 border border-f1-accent"
              >
                Trigger Model Retrain
              </button>
              <button
                onClick={async () => {
                  try {
                    const r = await fetch((import.meta.env.VITE_API_BASE || '') + '/api/admin/refresh-dataset', { method: 'POST' });
                    const data = await r.json();
                    alert('Refresh: ' + JSON.stringify(data));
                  } catch (e) { alert('Admin call failed'); }
                }}
                className="px-3 py-1 border border-f1-accent"
              >
                Refresh Dataset (stub)
              </button>
            </div>
            <p className="text-[10px] text-gray-500 mt-1">Admin actions require valid admin login. Retrain runs the full pipeline (slow).</p>
          </Section>
        )}

        {/* FYP-II: ML Integration into Simulation */}
        <Section title="Simulation Mode (FYP-II)" index={7}>
          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={useMLDeltas}
                onChange={(e) => setUseMLDeltas(e.target.checked)}
                className="w-4 h-4"
              />
              <span>Use live ML LapDelta predictions to influence pace, tyre wear & fuel (realistic sim sync)</span>
            </label>
            <div>
              <div className="text-xs text-gray-400 mb-1">Data Mode</div>
              <div className="flex gap-2 text-sm">
                {['mock', 'ml-enhanced', 'historical'].map(m => (
                  <button
                    key={m}
                    onClick={() => setDataMode(m)}
                    className={`px-3 py-1 rounded border ${dataMode === m ? 'bg-f1-accent text-black' : 'border-f1-border'}`}
                  >
                    {m === 'mock' ? 'Mock' : m === 'ml-enhanced' ? 'ML-Enhanced' : 'Historical Parquet'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-gray-500 mt-1">Historical uses real slices from the F1 parquet (future: full integration).</p>
            </div>
          </div>
        </Section>

        {/* Launch */}
        <div className="mt-10 text-center animate-fade-in-up stagger-5">
          <button
            type="button"
            onClick={handleStart}
            className="group relative rounded-xl border-2 border-f1-accent bg-f1-accent/10 px-10 py-4 font-display text-sm font-bold uppercase tracking-[0.2em] text-f1-accent transition-all duration-300 hover:bg-f1-accent/20 hover:shadow-[0_0_40px_rgba(0,212,170,0.3)]"
          >
            <span className="relative z-10">Launch Simulation</span>
            <div className="absolute inset-0 rounded-xl bg-f1-accent/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <div className="mt-3 font-mono text-[10px] text-gray-700">
            Press to begin the race simulation
          </div>
        </div>
          </div> {/* close flex-1 main content */}
        </div> {/* close outer flex for sidebar + main */}
    </div>
  );
}

function Section({ title, index, children }) {
  return (
    <div className={`mb-8 animate-fade-in-up stagger-${index}`}>
      <div className="mb-3 flex items-center gap-2">
        <span className="font-mono text-[10px] text-f1-accent">0{index}</span>
        <span className="font-display text-xs font-semibold uppercase tracking-wider text-gray-400">
          {title}
        </span>
        <div className="flex-1 border-t border-f1-border/40" />
      </div>
      {children}
    </div>
  );
}
