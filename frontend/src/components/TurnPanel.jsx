import React from 'react';

/**
 * Displays current turn: lap number, description, 2–4 strategic branches with probabilities.
 * Turn-based: user selects a branch to advance (chess-like).
 */
export function TurnPanel({ turn, selectedBranchId, onSelectBranch, turnIndex, totalTurns }) {
  if (!turn) return null;

  const { lap, description, branches } = turn;

  return (
    <div className="dashboard-transition rounded-lg border border-f1-border bg-f1-panel p-5 shadow-xl">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-sm font-semibold uppercase tracking-wider text-f1-red">
          Decision point
        </span>
        <span className="font-mono text-xs text-gray-500">
          {turnIndex + 1} / {totalTurns}
        </span>
      </div>
      <div className="mb-1 font-display text-2xl font-bold text-white">
        Lap {lap}
      </div>
      <p className="mb-5 text-sm leading-relaxed text-gray-300">
        {description}
      </p>
      <div className="space-y-2">
        {branches.map((branch) => {
          const isSelected = selectedBranchId === branch.id;
          const pct = Math.round(branch.probability * 100);
          return (
            <button
              key={branch.id}
              type="button"
              onClick={() => onSelectBranch(branch.id)}
              className={`dashboard-transition w-full rounded-lg border px-4 py-3 text-left ${
                isSelected
                  ? 'border-f1-accent bg-f1-accent/10 glow-accent'
                  : 'border-f1-border bg-black/30 hover:border-gray-500 hover:bg-black/50'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white">{branch.label}</div>
                  <div className="text-xs text-gray-400">{branch.outcome}</div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full bg-f1-accent transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="font-mono text-sm font-semibold text-f1-accent w-10 text-right">
                    {pct}%
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
