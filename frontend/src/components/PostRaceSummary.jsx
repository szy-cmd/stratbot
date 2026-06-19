import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const WEATHER_LABELS = { clear: 'Clear', overcast: 'Overcast', rainy: 'Rainy' };
const RACE_TYPE_LABELS = { sprint: 'Sprint', standard: 'Grand Prix', endurance: 'Endurance' };
const WEATHER_EFFECTS = {
  clear: 'Standard grip and degradation rates.',
  overcast: 'Cooler track reduced tire degradation by ~15%. Slightly lower top speeds.',
  rainy: 'Low grip increased tire wear by ~40%. Top speeds reduced ~18%. Higher fuel consumption.',
};

/**
 * Post-Race Telemetry Dashboard — shown after race completes or endSimulation.
 * Displays: session info, final standings, comparative telemetry graphs, stats, highlights.
 */
export function PostRaceSummary({ drivers, peakSpeed, highlightsLog, telemetryHistory, raceConfig, onReset, mlPredictions = [], trackedDriverId = null }) {
  const avgTireWear = drivers.length
    ? drivers.reduce((sum, d) => sum + d.tireWear, 0) / drivers.length
    : 0;
  const winner = drivers[0];
  const weather = raceConfig?.weather || 'clear';
  const raceType = raceConfig?.raceType || 'standard';
  const totalLaps = raceConfig?.totalLaps || 57;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-f1-accent/60 bg-gradient-to-br from-f1-panel to-black p-6 text-center glow-accent animate-fade-in-up">
        <div className="font-display text-xs font-semibold uppercase tracking-[0.3em] text-f1-accent mb-3">
          Data Analysis Complete
        </div>
        <h2 className="font-display text-3xl font-bold text-white mb-2">
          CHEQUERED FLAG
        </h2>
        <div className="flex items-center justify-center gap-4 text-xs text-gray-500 font-mono">
          <span>{RACE_TYPE_LABELS[raceType]} · {totalLaps} Laps</span>
          <span>·</span>
          <span>{WEATHER_LABELS[weather]} Conditions</span>
        </div>
      </div>

      {/* Session Impact Card */}
      <div className="rounded-lg border border-f1-border bg-f1-panel p-4 animate-fade-in-up stagger-1">
        <div className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-gray-400">
          Session Impact Analysis
        </div>
        <p className="text-sm text-gray-400 leading-relaxed">
          <span className="text-white font-medium">{WEATHER_LABELS[weather]}:</span>{' '}
          {WEATHER_EFFECTS[weather]}
        </p>
      </div>

      {/* Final Standings */}
      <div className="rounded-lg border border-f1-border bg-f1-panel overflow-hidden animate-fade-in-up stagger-2">
        <div className="border-b border-f1-border bg-black/40 px-4 py-2 font-display text-xs font-semibold uppercase tracking-wider text-gray-400">
          Final Classification
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-f1-border text-xs uppercase text-gray-500">
                <th className="w-10 py-2 pl-3 font-mono">POS</th>
                <th className="py-2 font-medium">Driver</th>
                <th className="w-24 py-2 text-right font-mono">Total Time</th>
                <th className="w-20 py-2 text-right font-mono">Gap</th>
                <th className="w-16 py-2 text-right font-mono">Tire %</th>
                <th className="w-12 py-2 text-right font-mono">Fuel</th>
                <th className="w-10 py-2 pr-3 text-center font-mono">Pits</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map((d, i) => (
                <tr
                  key={d.id}
                  className={`border-b border-f1-border/80 ${i < 3 ? 'bg-f1-accent/5' : ''}`}
                >
                  <td className="py-2 pl-3 font-mono font-semibold text-gray-300">
                    {d.position}
                  </td>
                  <td className="py-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full align-middle"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="ml-2 font-medium text-white">{d.name}</span>
                    <span className="ml-1 font-mono text-xs text-gray-500">{d.id}</span>
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-gray-400">
                    {formatTime(d.totalRaceTime)}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-f1-accent">
                    {d.gap}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-gray-400">
                    {d.tireWear != null ? `${d.tireWear.toFixed(1)}%` : '--'}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums text-gray-400">
                    {d.fuel != null ? `${d.fuel.toFixed(1)}` : '--'}
                  </td>
                  <td className="py-2 pr-3 text-center font-mono text-gray-500">
                    {d.pitStops}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 animate-fade-in-up stagger-3">
        <StatCard label="Peak Speed" value={`${peakSpeed} km/h`} color="text-f1-accent" />
        <StatCard label="Avg Tire Remaining" value={`${avgTireWear.toFixed(1)}%`} color="text-f1-red" />
        <StatCard label="Winner" value={winner?.name ?? '--'} color="text-white" />
        <StatCard label="Winning Time" value={formatTime(winner?.totalRaceTime)} color="text-gray-300" />
        <StatCard label="Weather" value={WEATHER_LABELS[weather]} color="text-blue-400" />
      </div>

      {/* Comparative Telemetry Graphs */}
      <div className="rounded-lg border border-f1-border bg-f1-panel p-4 animate-fade-in-up stagger-4">
        <div className="mb-4 font-display text-xs font-semibold uppercase tracking-wider text-gray-400">
          Tracked Driver Telemetry
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <TelemetryGraph
            title="Speed (km/h)"
            data={telemetryHistory.speed}
            dataKey="speed"
            color="#00d4aa"
            gradientId="postSpeedGrad"
            yDomain={[60, 360]}
            xKey="tick"
            hideX
            formatter={(v) => `${v} km/h`}
          />
          <TelemetryGraph
            title="Tire Wear (%)"
            data={telemetryHistory.tireWear}
            dataKey="wear"
            color="#E10600"
            gradientId="postTireGrad"
            yDomain={[0, 100]}
            xKey="lap"
            formatter={(v) => `${Number(v).toFixed(1)}%`}
            labelFmt={(l) => `Lap ${l}`}
          />
          <TelemetryGraph
            title="Fuel (kg)"
            data={telemetryHistory.fuel}
            dataKey="fuel"
            color="#FF8700"
            gradientId="postFuelGrad"
            yDomain={[0, 120]}
            xKey="lap"
            formatter={(v) => `${Number(v).toFixed(1)} kg`}
            labelFmt={(l) => `Lap ${l}`}
          />
        </div>
      </div>

      {/* Race Highlights */}
      <div className="rounded-lg border border-f1-border bg-f1-panel p-4 animate-fade-in-up stagger-5">
        <div className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-gray-400">
          Strategy Decisions
        </div>
        {highlightsLog.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {highlightsLog.map((h, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="shrink-0 font-mono text-xs text-f1-accent mt-0.5">
                  #{i + 1}
                </span>
                <span className="text-gray-300">{h.text}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-2">No decisions were recorded during this race.</p>
        )}
      </div>

      {/* NEW: ML Model Comparison & Analysis (the reason for the tool) */}
      <div className="rounded-lg border border-f1-accent/60 bg-f1-panel p-4 animate-fade-in-up stagger-6">
        <div className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-f1-accent">
          AI Model Results & Comparison
        </div>

        {/* FYP-II Advanced stubs */}
        <div className="mb-4 text-xs">
          <button onClick={() => alert('Tyre deg stub - extend predictor for real model')} className="mr-2 px-2 py-0.5 border">Predict Tyre Deg</button>
          <button onClick={() => alert('Pit window stub')} className="mr-2 px-2 py-0.5 border">Pit Window</button>
          <button onClick={() => alert('RL agent stub - see /api/strategy/rl-agent')} className="px-2 py-0.5 border">RL Strategy Agent</button>
          <span className="ml-2 text-gray-400">(FYP-II: real models + RL per SDS papers)</span>
        </div>

        {/* Variant & Conditions */}
        <div className="mb-4 text-sm text-gray-300">
          {mlPredictions?.length > 0 ? (
            <>
              Model variant used: <span className="font-semibold text-white">{mlPredictions[0]?.variant || 'base'}</span>
              {' · '} Weather: <span className="font-semibold">{mlPredictions[0]?.weather || raceConfig?.weather || 'clear'}</span>
              {' · '} Predictions captured: {mlPredictions.length}
            </>
          ) : (
            'No ML predictions were recorded during this race (start the backend API next time to experiment with live LapDelta).'
          )}
        </div>

        {/* Captured Predictions Table */}
        {mlPredictions?.length > 0 && (
          <div className="mb-4 overflow-x-auto">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-400">Live LapDelta Predictions (from selected variant)</div>
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-b border-f1-border text-[10px] uppercase text-gray-500">
                  <th className="py-1 pr-2">Lap</th>
                  <th className="py-1">Variant</th>
                  <th className="py-1">Weather</th>
                  <th className="py-1 text-right font-mono">Pred Δ (s)</th>
                  <th className="py-1">Interpretation</th>
                  <th className="py-1 text-right">Conf</th>
                </tr>
              </thead>
              <tbody className="text-gray-300">
                {mlPredictions.slice(-8).map((p, i) => (
                  <tr key={i} className="border-b border-f1-border/60 hover:bg-white/5">
                    <td className="py-1 pr-2 font-mono">{p.lap ?? '?'}</td>
                    <td className="py-1">{p.variant || 'base'}</td>
                    <td className="py-1">{p.weather_label || p.weather || '-'}</td>
                    <td className="py-1 text-right font-mono text-emerald-400">
                      {p.lap_delta_seconds > 0 ? '+' : ''}{p.lap_delta_seconds}
                    </td>
                    <td className="py-1 text-[11px] truncate max-w-[220px]">{p.interpretation}</td>
                    <td className="py-1 text-right font-mono">{p.confidence_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-[9px] text-gray-500">Last 8 shown. Lower |Δ| = closer to race-median pace.</p>
          </div>
        )}

        {/* FYP-II: Your Team's Custom Car for the Specific Driver - realistic results */}
        {raceConfig?.carStats && (
          <div className="mb-4 rounded border border-f1-accent/60 bg-black/20 p-3">
            <div className="font-display text-xs uppercase text-f1-accent mb-2">Your Team Strategy for {(drivers.find(d => d.id === trackedDriverId) || drivers[0])?.name || 'Tracked Driver'}'s Car</div>
            <div className="grid grid-cols-2 gap-x-4 text-xs text-gray-300">
              <div>Compound: <span className="text-white font-mono">{raceConfig.carStats.compound}</span></div>
              <div>Initial Tyre Wear: <span className="text-white font-mono">{raceConfig.carStats.initialTyreWear || 0}%</span></div>
              <div>Aero Level: <span className="text-white font-mono">{raceConfig.carStats.aeroLevel || 5}/10</span></div>
              <div>Power Level: <span className="text-white font-mono">{raceConfig.carStats.powerLevel || 5}/10</span></div>
            </div>
            <div className="mt-2 text-[10px] text-gray-400">
              These realistic team decisions (for this driver's car/setup) directly impacted the simulation: custom deg/speed/fuel for your driver + ML predictions used the stats for accurate LapDelta.
              {telemetryHistory?.tireWear?.length > 1 && (
                <> Final tyre wear for your car: ~{telemetryHistory.tireWear[telemetryHistory.tireWear.length-1]?.wear?.toFixed(1)}%</>
              )}
            </div>
          </div>
        )}

        {/* Weather & Model Impact Note (ties to our trained experiments) */}
        <div className="rounded border border-f1-border/60 bg-black/20 p-3 text-xs text-gray-400">
          <span className="text-white font-medium">Weather in our models:</span> The production "base" model uses 11 features without weather. The "weather" variant reflects our experiment models (LGBM-weather, XGBoost-w-weather, RF-w-weather) trained on the same parquet data + AirTemp_Avg, TrackTemp_Avg, Humidity, Wind, Rainfall from the pipeline. Weather affects real outcomes (see sim physics) and was important in several of our trained models (dashboards in docs/evaluation/graphs).
        </div>

        {/* Simple Benchmark Reminder */}
        <div className="mt-3 text-[10px] text-gray-500">
          Benchmark (from training on 2025 holdout): LGBM base 0.9683s MAE ★ | Weather variants ~0.95s in experiments | RF 1.051s
        </div>
      </div>

      {/* New Race Button */}
      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onReset}
          className="group relative rounded-xl border-2 border-f1-accent bg-f1-accent/10 px-8 py-3 font-display text-sm font-bold uppercase tracking-[0.2em] text-f1-accent transition-all duration-300 hover:bg-f1-accent/20 hover:shadow-[0_0_40px_rgba(0,212,170,0.3)]"
        >
          New Race
        </button>
      </div>
    </div>
  );
}

function TelemetryGraph({ title, data, dataKey, color, gradientId, yDomain, xKey, hideX, formatter, labelFmt }) {
  return (
    <div className="rounded-lg border border-f1-border/60 bg-black/30 p-3">
      <div className="mb-2 font-display text-[10px] font-semibold uppercase tracking-wider text-gray-400">
        {title}
      </div>
      <ResponsiveContainer width="100%" height={120}>
        <AreaChart data={data} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#2a2a32" strokeDasharray="3 3" />
          {!hideX && (
            <XAxis dataKey={xKey} tick={{ fill: '#6b7280', fontSize: 9 }} tickLine={false} axisLine={false} />
          )}
          {hideX && <XAxis dataKey={xKey} hide />}
          <YAxis domain={yDomain} tick={{ fill: '#6b7280', fontSize: 9 }} width={30} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: '#15151a', border: '1px solid #2a2a32', borderRadius: 8, fontSize: 11 }}
            formatter={(val) => [formatter(val), title]}
            labelFormatter={labelFmt || (() => '')}
          />
          <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatCard({ label, value, color }) {
  return (
    <div className="rounded-lg border border-f1-border bg-f1-panel p-3 text-center">
      <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      <div className={`font-display text-base font-bold ${color}`}>{value}</div>
    </div>
  );
}

function formatTime(seconds) {
  if (!seconds || seconds <= 0) return '--';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds % 60).toFixed(2);
  return `${mins}:${secs.padStart(5, '0')}`;
}
