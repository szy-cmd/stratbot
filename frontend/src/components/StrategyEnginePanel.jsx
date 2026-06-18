import React from 'react';

/**
 * "Strategy Engine Confidence" panel — research-level look.
 * Shows: confidence %, mini bar chart of branch probabilities, confidence meter, risk level.
 * All values from current turn (or random for demo).
 */
export function StrategyEnginePanel({ turn }) {
  const confidence = turn?.confidence ?? 87;
  const riskLevel = turn?.riskLevel ?? 'medium';
  const branches = turn?.branches ?? [];

  const riskLabel = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
  }[riskLevel] || 'Medium';
  const riskColor = {
    low: 'text-emerald-400',
    medium: 'text-amber-400',
    high: 'text-f1-red',
  }[riskLevel] || 'text-amber-400';

  return (
    <div className="rounded-lg border border-f1-border bg-f1-panel p-4 shadow-xl">
      <div className="mb-3 font-display text-xs font-semibold uppercase tracking-wider text-gray-500">
        Probabilistic decision model
      </div>
      <div className="mb-4 font-display text-xl font-bold text-white md:text-2xl">
        Strategy Engine Confidence: <span className="text-f1-accent">{confidence}%</span>
      </div>

      {/* Confidence meter */}
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs text-gray-500">
          <span>0%</span>
          <span>100%</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-gray-800">
          <div
            className="dashboard-transition h-full rounded-full bg-gradient-to-r from-f1-accent to-emerald-400"
            style={{ width: `${confidence}%` }}
          />
        </div>
      </div>

      {/* Mini bar chart — branch probabilities */}
      {branches.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium text-gray-400">
            Branch probabilities
          </div>
          <div className="flex h-12 items-end gap-1">
            {branches.map((b, i) => {
              const pct = Math.round(b.probability * 100);
              return (
                <div
                  key={b.id}
                  className="dashboard-transition flex-1 rounded-t bg-f1-accent/80"
                  style={{
                    height: `${Math.max(8, pct)}%`,
                    transitionDelay: `${i * 50}ms`,
                  }}
                  title={`${b.label}: ${pct}%`}
                />
              );
            })}
          </div>
          <div className="mt-1 flex gap-1 text-[10px] text-gray-500">
            {branches.map((b) => (
              <span key={b.id} className="flex-1 truncate" title={b.label}>
                {Math.round(b.probability * 100)}%
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Risk level */}
      <div className="flex items-center justify-between border-t border-f1-border pt-3">
        <span className="text-xs text-gray-500">Risk level</span>
        <span className={`font-mono text-sm font-semibold ${riskColor}`}>
          {riskLabel}
        </span>
      </div>
    </div>
  );
}
