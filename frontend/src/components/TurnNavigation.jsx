import React from 'react';

export function TurnNavigation({
  onPrev,
  onNext,
  onReset,
  onEndRace,
  onFastForward,
  fastForward,
  hasPrev,
  hasNext,
  currentIndex,
  totalTurns,
  raceActive,
  currentLap,
  totalLaps,
  onFastComplete,
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onPrev}
        disabled={!hasPrev}
        className="rounded-lg border border-f1-border bg-f1-panel px-4 py-2 font-display text-sm font-medium uppercase tracking-wider text-white transition hover:border-f1-accent hover:bg-f1-accent/10 disabled:opacity-40 disabled:hover:border-f1-border disabled:hover:bg-f1-panel"
      >
        ← Prev Turn
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext}
        className="rounded-lg border border-f1-accent bg-f1-accent/20 px-4 py-2 font-display text-sm font-medium uppercase tracking-wider text-f1-accent transition hover:bg-f1-accent/30 disabled:opacity-40"
      >
        Next Turn →
      </button>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-gray-500">
          Turn {currentIndex + 1}/{totalTurns}
        </span>
        {currentLap != null && totalLaps != null && (
          <span className="font-mono text-xs text-gray-400">
            | LAP {currentLap}/{totalLaps}
          </span>
        )}
      </div>

      {/* Top progress bar to easily "move around" the race at a glance */}
      {currentLap != null && totalLaps != null && (
        <div className="h-1.5 w-28 rounded bg-gray-800 overflow-hidden ml-1" title={`Race progress: ${currentLap}/${totalLaps}`}>
          <div className="h-full bg-f1-accent transition-all duration-150" style={{width: `${Math.min(100, (currentLap / totalLaps) * 100)}%`}} />
        </div>
      )}

      <div className="ml-auto flex items-center gap-2">
        {onFastForward && (
          <button
            type="button"
            onClick={onFastForward}
            className={`rounded-lg border px-3 py-2 font-display text-xs uppercase tracking-wider transition ${
              fastForward
                ? 'border-amber-400 bg-amber-400/20 text-amber-400'
                : 'border-f1-border text-gray-400 hover:border-amber-400 hover:text-amber-400'
            }`}
          >
            {fastForward ? '>> 5x' : '>> FF'}
          </button>
        )}
        {onEndRace && (
          <button
            type="button"
            onClick={onEndRace}
            className="rounded-lg border border-f1-red/60 px-3 py-2 font-display text-xs uppercase tracking-wider text-f1-red transition hover:border-f1-red hover:bg-f1-red/10"
          >
            End Race
          </button>
        )}
        {onFastComplete && (
          <button
            type="button"
            onClick={onFastComplete}
            className="rounded-lg border border-amber-400 bg-amber-400/10 px-3 py-2 font-display text-xs uppercase tracking-wider text-amber-400 transition hover:bg-amber-400/20"
          >
            Complete Full &gt;&gt;
          </button>
        )}
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-f1-border px-3 py-2 font-display text-xs uppercase tracking-wider text-gray-400 transition hover:border-f1-red hover:text-f1-red"
        >
          New Race
        </button>
      </div>
    </div>
  );
}
