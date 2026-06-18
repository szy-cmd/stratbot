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

/**
 * Real-time telemetry charts for a single tracked driver.
 * Three graphs: Speed (km/h), Tire Degradation (%), Fuel Remaining (kg).
 */
export function TelemetryCharts({ telemetryHistory, trackedDriverId, drivers, onChangeDriver }) {
  const { speed, tireWear, fuel } = telemetryHistory;

  return (
    <div className="rounded-lg border border-f1-border bg-f1-panel p-4 shadow-xl">
      <div className="mb-4 flex items-center justify-between">
        <span className="font-display text-xs font-semibold uppercase tracking-wider text-gray-500">
          Driver Telemetry
        </span>
        <select
          value={trackedDriverId}
          onChange={(e) => onChangeDriver(e.target.value)}
          className="rounded border border-f1-border bg-black/40 px-2 py-1 font-mono text-xs text-white"
        >
          {drivers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name} ({d.id})
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {/* Speed Telemetry */}
        <div className="rounded-lg border border-f1-border/60 bg-black/30 p-3">
          <div className="mb-2 font-display text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Speed (km/h)
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={speed} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2a2a32" strokeDasharray="3 3" />
              <XAxis dataKey="tick" hide />
              <YAxis
                domain={[60, 360]}
                tick={{ fill: '#6b7280', fontSize: 9 }}
                width={32}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ background: '#15151a', border: '1px solid #2a2a32', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#6b7280' }}
                itemStyle={{ color: '#00d4aa' }}
                formatter={(val) => [`${val} km/h`, 'Speed']}
                labelFormatter={() => ''}
              />
              <Area
                type="monotone"
                dataKey="speed"
                stroke="#00d4aa"
                fill="url(#speedGrad)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Tire Degradation */}
        <div className="rounded-lg border border-f1-border/60 bg-black/30 p-3">
          <div className="mb-2 font-display text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Tire Wear (%)
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={tireWear} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tireGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#E10600" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#E10600" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2a2a32" strokeDasharray="3 3" />
              <XAxis
                dataKey="lap"
                tick={{ fill: '#6b7280', fontSize: 9 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#6b7280', fontSize: 9 }}
                width={32}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ background: '#15151a', border: '1px solid #2a2a32', borderRadius: 8, fontSize: 11 }}
                formatter={(val) => [`${Number(val).toFixed(1)}%`, 'Tire Wear']}
                labelFormatter={(lap) => `Lap ${lap}`}
              />
              <Area
                type="monotone"
                dataKey="wear"
                stroke="#E10600"
                fill="url(#tireGrad)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Fuel Consumption */}
        <div className="rounded-lg border border-f1-border/60 bg-black/30 p-3">
          <div className="mb-2 font-display text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Fuel Remaining (kg)
          </div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={fuel} margin={{ top: 2, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fuelGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF8700" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#FF8700" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#2a2a32" strokeDasharray="3 3" />
              <XAxis
                dataKey="lap"
                tick={{ fill: '#6b7280', fontSize: 9 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 120]}
                tick={{ fill: '#6b7280', fontSize: 9 }}
                width={32}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{ background: '#15151a', border: '1px solid #2a2a32', borderRadius: 8, fontSize: 11 }}
                formatter={(val) => [`${Number(val).toFixed(1)} kg`, 'Fuel']}
                labelFormatter={(lap) => `Lap ${lap}`}
              />
              <Area
                type="monotone"
                dataKey="fuel"
                stroke="#FF8700"
                fill="url(#fuelGrad)"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
