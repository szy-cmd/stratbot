import React, { useState, useEffect, useRef } from 'react';
import { useGLTF } from '@react-three/drei';

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
  { text: '[OK] 3D F1 car models preloading (6 teams: McLaren, Red Bull, Aston, Mercedes, Ferrari, Alpine)', delay: 3400, type: 'ok' },
  { text: '────────────────────────────────────', delay: 3700, type: 'divider' },
  { text: 'ALL SYSTEMS NOMINAL — READY TO RACE', delay: 3900, type: 'ready' },
];

const TOTAL_DURATION = 4600;

export function BootSequence({ onComplete }) {
  const [visibleLines, setVisibleLines] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const startRef = useRef(performance.now());

  useEffect(() => {
    // Preload all 3D models during the boot sequence so they are cached when the user reaches
    // PreRaceSetup + CarCustomizer (prevents "Loading detailed..." spinners and makes 3D instant).
    // useGLTF.preload uses the global drei cache; safe to call outside Canvas.
    const modelUrls = [
      '/models/f1_2025_mclaren_mcl39/scene.gltf',
      '/models/f1-2025_redbull_rb21/scene.gltf',
      '/models/aston_martin_aramco_amr25/scene.gltf',
      '/models/f1_mercedes_w14_free/scene.gltf',
      '/models/ferrari_sf-25/scene.gltf',
      '/models/2025_alpine_a525/scene.gltf',
    ];
    modelUrls.forEach((url) => {
      try {
        useGLTF.preload(url);
      } catch (e) {
        // non-fatal; model will lazy-load later if needed
        console.warn('[Boot] 3D preload skipped for', url, e);
      }
    });

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
        {/* Logo - matching the simulation part branding for consistency on first page */}
        <div className="mb-8 text-center animate-fade-in">
          <div className="flex flex-col items-center">
            <div className="flex items-baseline gap-2">
              <a
                href="https://github.com/szy-cmd/stratbot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors mt-1"
                title="View source on GitHub"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
                </svg>
              </a>
              <span className="font-display text-3xl font-black tracking-[3px] text-f1-accent hover:bg-f1-panel/40 hover:text-white px-1 -mx-1 rounded transition-colors">STRATBOT</span>
              <span className="font-display text-xl font-bold tracking-wider text-white hover:bg-f1-panel/40 hover:text-f1-accent px-1 -mx-1 rounded transition-colors">F1 STRATEGY DASHBOARD</span>
            </div>
            <div className="text-[9px] font-mono tracking-[0.5px] text-white/85 font-medium mt-1">
              ZAAFIR EJAZ (CS221222) • EBAD AHMED (CS221217) • FATIMA ATHER RAJPUT (CS221270)
            </div>
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
