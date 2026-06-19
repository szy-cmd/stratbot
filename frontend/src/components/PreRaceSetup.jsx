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

export function PreRaceSetup({ onStart }) {
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
  const [showCustomizer, setShowCustomizer] = useState(false);

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
      <div className="mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <div className="mb-10 text-center animate-fade-in-up">
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
          <div className="grid grid-cols-3 gap-3">
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
                onClick={() => setTrackedDriver(d.id)}
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
          <button 
            onClick={() => setShowCustomizer(true)}
            className="mt-3 w-full rounded-lg border border-f1-accent/60 bg-f1-accent/5 py-2 text-sm font-display uppercase tracking-wider text-f1-accent hover:bg-f1-accent/10 transition"
          >
            Customize {DRIVERS.find(d => d.id === trackedDriver)?.name || 'Car'} (3D Visual)
          </button>
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
      </div>

      {/* 3D Car Customizer Modal - nice interactive visual like driving game car select */}
      {showCustomizer && (
        <CarCustomizer
          stats={carStats}
          onStatsChange={setCarStats}
          driverName={DRIVERS.find(d => d.id === trackedDriver)?.name}
          driverColor={DRIVERS.find(d => d.id === trackedDriver)?.color}
          weather={weather}
          trackName={TRACK_OPTIONS.find(t => t.id === trackId)?.name}
          onClose={() => setShowCustomizer(false)}
          onApply={(newStats) => {
            setCarStats(newStats);
            setShowCustomizer(false);
          }}
        />
      )}
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
