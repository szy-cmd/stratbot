import React, { useState } from 'react';
import { DRIVERS, TRACK_OPTIONS } from '../data/mockRaceState';

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

export function PreRaceSetup({ onStart }) {
  const [weather, setWeather] = useState('clear');
  const [raceType, setRaceType] = useState('standard');
  const [trackedDriver, setTrackedDriver] = useState('VER');
  const [trackId, setTrackId] = useState('buddhism-svgfind-com');

  const handleStart = () => {
    const raceConfig = RACE_TYPE_OPTIONS.find((r) => r.id === raceType);
    onStart({
      weather,
      raceType,
      totalLaps: raceConfig?.laps ?? 57,
      trackedDriver,
      trackId,
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
