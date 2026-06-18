import React, { useRef, useEffect } from 'react';

/**
 * Live race commentary feed — scrolling log of per-lap events.
 * Shows during racing phases so the user always has information.
 */
export function RaceFeed({ raceFeed, currentLap }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [raceFeed.length]);

  const typeColors = {
    tire: 'text-f1-red',
    gap: 'text-f1-accent',
    fuel: 'text-amber-400',
    pace: 'text-blue-400',
    rival: 'text-purple-400',
  };

  const typeLabels = {
    tire: 'TIRE',
    gap: 'GAP',
    fuel: 'FUEL',
    pace: 'PACE',
    rival: 'RIVAL',
  };

  return (
    <div className="rounded-lg border border-f1-border bg-f1-panel shadow-xl">
      <div className="flex items-center justify-between border-b border-f1-border bg-black/40 px-3 py-2">
        <span className="font-display text-xs font-semibold uppercase tracking-wider text-gray-400">
          Race Feed
        </span>
        {currentLap > 0 && (
          <span className="font-mono text-xs text-gray-500">
            LAP {currentLap}
          </span>
        )}
      </div>
      <div className="max-h-48 overflow-y-auto p-2 space-y-1">
        {raceFeed.length === 0 && (
          <div className="px-2 py-3 text-center text-xs text-gray-600">
            Waiting for race data...
          </div>
        )}
        {raceFeed.map((evt, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded px-2 py-1.5 text-xs hover:bg-white/5 dashboard-transition"
          >
            <span className="shrink-0 font-mono text-[10px] text-gray-600 mt-0.5 w-7 text-right">
              L{evt.lap}
            </span>
            <span
              className={`shrink-0 font-mono text-[9px] font-bold uppercase mt-0.5 w-9 ${typeColors[evt.type] || 'text-gray-500'}`}
            >
              {typeLabels[evt.type] || evt.type}
            </span>
            <span className="text-gray-300 leading-relaxed">{evt.text}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
