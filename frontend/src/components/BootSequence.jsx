import React, { useState, useEffect, useRef } from 'react';

const BOOT_LINES = [
  { text: 'F1 STRATEGY ENGINE v3.2.1', delay: 0, type: 'header' },
  { text: '────────────────────────────────────', delay: 200, type: 'divider' },
  { text: 'Initializing core systems...', delay: 400, type: 'info' },
  { text: '[OK] Telemetry streams online', delay: 900, type: 'ok' },
  { text: '[OK] Driver profiles loaded (10 drivers)', delay: 1300, type: 'ok' },
  { text: '[OK] Race control connection established', delay: 1700, type: 'ok' },
  { text: '[OK] Track data calibrated', delay: 2100, type: 'ok' },
  { text: '[OK] Strategy engine neural net ready', delay: 2400, type: 'ok' },
  { text: '[OK] Tire degradation model v2.8 loaded', delay: 2700, type: 'ok' },
  { text: '[OK] Fuel consumption matrix initialized', delay: 3000, type: 'ok' },
  { text: '[OK] Weather prediction module active', delay: 3200, type: 'ok' },
  { text: '────────────────────────────────────', delay: 3500, type: 'divider' },
  { text: 'ALL SYSTEMS NOMINAL — READY TO RACE', delay: 3700, type: 'ready' },
];

const TOTAL_DURATION = 4400;

export function BootSequence({ onComplete }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const startRef = useRef(performance.now());

  useEffect(() => {
    const timers = BOOT_LINES.map((line, i) =>
      setTimeout(() => setVisibleLines(i + 1), line.delay)
    );

    // Progress bar
    const progressInterval = setInterval(() => {
      const elapsed = performance.now() - startRef.current;
      setProgress(Math.min(100, (elapsed / (TOTAL_DURATION - 400)) * 100));
    }, 50);

    // Complete
    const completeTimer = setTimeout(() => {
      setFading(true);
      setTimeout(onComplete, 500);
    }, TOTAL_DURATION);

    return () => {
      timers.forEach(clearTimeout);
      clearInterval(progressInterval);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const lineColor = (type) => {
    switch (type) {
      case 'header': return 'text-f1-accent font-bold text-base';
      case 'divider': return 'text-gray-700';
      case 'ok': return 'text-gray-400';
      case 'info': return 'text-gray-500';
      case 'ready': return 'text-f1-accent font-bold';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center bg-f1-dark hud-grid ${fading ? 'animate-fade-out' : ''}`}>
      <div className="w-full max-w-xl px-6">
        {/* Logo */}
        <div className="mb-8 text-center animate-fade-in">
          <div className="font-display text-3xl font-bold tracking-widest text-white mb-1">
            F1 STRATEGY
          </div>
          <div className="font-display text-sm tracking-[0.3em] text-f1-accent">
            DASHBOARD
          </div>
        </div>

        {/* Terminal */}
        <div className="rounded-lg border border-f1-border bg-black/60 p-5 font-mono text-xs leading-relaxed backdrop-blur-sm">
          {/* Title bar */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-f1-border/60">
            <span className="h-2.5 w-2.5 rounded-full bg-f1-red" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
            <span className="h-2.5 w-2.5 rounded-full bg-f1-accent" />
            <span className="ml-2 text-[10px] text-gray-600 uppercase tracking-wider">system_init.sh</span>
          </div>

          {/* Lines */}
          <div className="space-y-1 min-h-[260px]">
            {BOOT_LINES.slice(0, visibleLines).map((line, i) => (
              <div
                key={i}
                className={`boot-line ${lineColor(line.type)}`}
                style={{ animationDelay: '0ms' }}
              >
                {line.type === 'ok' && (
                  <span className="text-emerald-500">[OK] </span>
                )}
                {line.type === 'ok' ? line.text.replace('[OK] ', '') : line.text}
              </div>
            ))}
            {visibleLines < BOOT_LINES.length && (
              <span className="cursor-blink text-gray-600" />
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-4 pt-3 border-t border-f1-border/60">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-gray-600 uppercase tracking-wider">System Load</span>
              <span className="text-[10px] text-f1-accent font-mono">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-f1-accent to-emerald-400 transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 text-center">
          <span className="font-mono text-[10px] text-gray-700 tracking-wider">
            FIA LICENSED SIMULATION ENGINE
          </span>
        </div>
      </div>
    </div>
  );
}
