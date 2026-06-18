import React from 'react';

/**
 * Live timing leaderboard driven by RaceEngine (position, gap, interval, lapTime, delta).
 * Dark F1 broadcast style.
 */
export function LiveTimingLeaderboard({ leaderboard }) {
  if (!leaderboard?.length) return null;

  return (
    <div className="overflow-hidden rounded-lg border border-f1-border bg-f1-panel">
      <div className="border-b border-f1-border bg-black/40 px-3 py-2 font-display text-xs font-semibold uppercase tracking-wider text-gray-400">
        Live timing
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-f1-border text-xs uppercase text-gray-500">
              <th className="w-10 py-2 pl-3 font-mono">POS</th>
              <th className="py-2 font-medium">Driver</th>
              <th className="w-20 py-2 text-right font-mono">Gap</th>
              <th className="w-20 py-2 text-right font-mono">Interval</th>
              <th className="w-16 py-2 text-right font-mono">Last</th>
              <th className="w-10 py-2 pr-3 text-center font-mono">Pits</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((row) => (
              <tr
                key={row.id}
                className="dashboard-transition border-b border-f1-border/80 hover:bg-white/5"
              >
                <td className="py-2 pl-3 font-mono font-semibold text-gray-300">
                  {row.position}
                </td>
                <td className="py-2">
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0 align-middle"
                    style={{ backgroundColor: row.color }}
                  />
                  <span className="ml-2 font-medium text-white">{row.name}</span>
                  <span className="ml-1 font-mono text-xs text-gray-500">{row.id}</span>
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-f1-accent">
                  {row.gap}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-gray-400">
                  {row.interval}
                </td>
                <td className="py-2 text-right font-mono tabular-nums text-gray-400">
                  {row.lapTime ?? row.lastLap ?? '—'}
                </td>
                <td className="py-2 pr-3 text-center font-mono text-gray-500">
                  {row.pitStops}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
