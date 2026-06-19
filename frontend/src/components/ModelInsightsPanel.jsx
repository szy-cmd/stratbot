import React from 'react';

/**
 * Live ML insights from the StratBot backend.
 * Additive panel — does not modify the race simulation engine.
 */
export const ModelInsightsPanel = React.memo(function ModelInsightsPanel({ modelInfo, prediction, loading, error, apiOnline, onRefresh }) {
  const benchmark = modelInfo?.benchmark || {};
  const entries = Object.entries(benchmark).sort((a, b) => a[1].mae - b[1].mae);
  const winner = modelInfo?.model_name;

  return (
    <div className="rounded-lg border border-f1-border bg-f1-panel p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <div className="font-display text-xs font-semibold uppercase tracking-wider text-gray-500">
          ML LapDelta Engine
        </div>
        <span
          className={`rounded px-2 py-0.5 font-mono text-[10px] uppercase ${
            apiOnline ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'
          }`}
        >
          {apiOnline ? 'API online' : 'API offline'}
        </span>
      </div>

      {modelInfo && (
        <div className="mb-4 rounded border border-f1-border/60 bg-black/20 p-3">
          <div className="text-sm text-gray-400">Production model</div>
          <div className="font-display text-lg font-bold text-white">
            {modelInfo.model_name}
            <span className="ml-2 text-sm font-normal text-f1-accent">
              MAE {modelInfo.metrics?.mae?.toFixed(4)}s
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-500">
            2025 holdout · predicts lap time delta vs race median
          </div>
        </div>
      )}

      {entries.length > 0 && (
        <div className="mb-4">
          <div className="mb-2 text-xs font-medium text-gray-400">Model benchmark (lower is better)</div>
          <div className="space-y-2">
            {entries.map(([name, stats]) => {
              const isWinner = name === winner;
              const width = Math.min(100, (stats.mae / 1.2) * 100);
              return (
                <div key={name}>
                  <div className="mb-0.5 flex justify-between text-[11px]">
                    <span className={isWinner ? 'text-f1-accent font-semibold' : 'text-gray-400'}>
                      {name}{isWinner ? ' ★' : ''}
                    </span>
                    <span className="font-mono text-gray-300">{stats.mae.toFixed(4)}s</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className={`h-full rounded-full ${isWinner ? 'bg-f1-accent' : 'bg-gray-600'}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {prediction && (
        <div className="mb-3 rounded border border-emerald-900/40 bg-emerald-950/20 p-3">
          <div className="text-xs text-gray-400">Live prediction</div>
          <div className="font-mono text-2xl font-bold text-emerald-400">
            {prediction.lap_delta_seconds > 0 ? '+' : ''}
            {prediction.lap_delta_seconds}s
          </div>
          <div className="mt-1 text-sm text-gray-300">{prediction.interpretation}</div>
          <div className="mt-1 text-[10px] text-gray-400">
            {prediction.variant && prediction.variant !== 'base' ? `${prediction.variant} variant · ` : ''}
            {prediction.weather_considered ? `Weather: ${prediction.weather_label || prediction.weather} (considered)` : `Weather: ${prediction.weather || 'clear'} (base model)`}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>Model confidence: {prediction.confidence_pct}%</span>
            <button
              type="button"
              onClick={onRefresh}
              className="rounded border border-f1-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-gray-400 hover:text-white"
            >
              Refresh
            </button>
          </div>
          {prediction.variant_note && (
            <div className="mt-1 text-[9px] text-gray-500 italic">{prediction.variant_note}</div>
          )}
        </div>
      )}

      {loading && !prediction && (
        <div className="text-xs text-gray-500">Fetching prediction...</div>
      )}

      {error && (
        <div className="rounded border border-red-900/50 bg-red-950/20 p-2 text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
});