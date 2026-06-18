import React, { useRef, useState, useCallback, useMemo } from 'react';
import { TRACK_OPTIONS, DEFAULT_TRACK } from '../data/mockRaceState';

// Static imports – no glob, no async; Vite resolves these at build time.
import buddhismSvg from '../racetrack-svgs/buddhism-svgfind-com.svg?raw';
import grandPrixSvg from '../racetrack-svgs/grand prix-svgfind-com.svg?raw';
import prenoesDijonSvg from '../racetrack-svgs/prenoes dijon-svgfind-com.svg?raw';

const TRACK_SVG_MAP = {
  'buddhism-svgfind-com': buddhismSvg,
  'grand prix-svgfind-com': grandPrixSvg,
  'prenoes dijon-svgfind-com': prenoesDijonSvg,
};

/**
 * Parses raw SVG string.
 *
 * These SVGs have a single <path> with two sub-paths inside the d attribute
 * (outer edge + inner edge) separated by z followed by m/M.  The full d
 * attribute is kept intact for rendering (fill-rule evenodd correctly fills
 * only the track surface between the two edges).
 *
 * For car positioning we extract only the FIRST sub-path (outer edge).
 * We do NOT try to use the inner sub-path as a separate <path> because its
 * starting `m` is relative to the outer path's origin — splitting it into
 * its own element would place it at the wrong position.
 *
 * Returns { viewBox, fullPathD, outerPathD } or null.
 */
function parseTrackSvg(svgText) {
  if (!svgText || typeof svgText !== 'string') return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  const allPaths = doc.querySelectorAll('path');
  if (!svg || allPaths.length === 0) return null;

  const viewBox = svg.getAttribute('viewBox') || '0 0 400 200';

  if (allPaths.length >= 2) {
    // Multiple <path> elements — use first for positioning, all for rendering
    const outerPathD = allPaths[0].getAttribute('d');
    const innerPathD = allPaths[1].getAttribute('d');
    const fullPathD = outerPathD && innerPathD ? `${outerPathD} ${innerPathD}` : outerPathD;
    return { viewBox, fullPathD, outerPathD };
  }

  // Single <path> with sub-paths
  const fullPathD = allPaths[0].getAttribute('d');
  if (!fullPathD) return null;

  // Extract the first sub-path (up to and including the first z/Z) for positioning
  const zIdx = fullPathD.search(/[zZ]/);
  const outerPathD = zIdx !== -1 ? fullPathD.substring(0, zIdx + 1).trim() : fullPathD;

  return { viewBox, fullPathD, outerPathD };
}

/**
 * Car markers — positioned along the outer edge path.
 * One getPointAtLength call per car = fast and smooth.
 */
function CarMarkers({ pathRef, drivers }) {
  if (!pathRef?.current || !drivers?.length) return null;
  const pathEl = pathRef.current;
  const totalLength = pathEl.getTotalLength();

  return (
    <g>
      {drivers.map((driver) => {
        const progress = Math.min(1, Math.max(0, (driver.lapProgress ?? 0) / 100));
        const pt = pathEl.getPointAtLength(progress * totalLength);
        const color = driver.color || '#6b7280';
        return (
          <g key={driver.id}>
            <circle
              cx={pt.x}
              cy={pt.y}
              r="5"
              fill={color}
              stroke="#0a0a0a"
              strokeWidth="1.2"
              opacity="0.95"
            />
            <text
              x={pt.x}
              y={pt.y + 1.2}
              textAnchor="middle"
              className="fill-white font-mono text-[4px] font-bold"
              style={{ pointerEvents: 'none' }}
            >
              {driver.number}
            </text>
          </g>
        );
      })}
    </g>
  );
}

export function TrackMap({ drivers, className = '' }) {
  const pathRef = useRef(null);
  const [trackId, setTrackId] = useState(DEFAULT_TRACK);
  const [pathReady, setPathReady] = useState(false);

  const parsed = useMemo(() => {
    const raw = TRACK_SVG_MAP[trackId];
    if (!raw) return null;
    return parseTrackSvg(raw);
  }, [trackId]);

  const setPathCallback = useCallback((el) => {
    pathRef.current = el;
    setPathReady(!!el);
  }, []);

  if (!parsed?.outerPathD) {
    return (
      <div className={`overflow-hidden rounded-lg border border-f1-border bg-f1-panel p-3 ${className}`}>
        <div className="mb-2 flex items-center justify-between">
          <span className="font-display text-xs font-semibold uppercase tracking-wider text-gray-500">
            Live track
          </span>
          <select
            value={trackId}
            onChange={(e) => { setPathReady(false); setTrackId(e.target.value); }}
            className="rounded border border-f1-border bg-black/40 px-2 py-1 font-mono text-xs text-white"
          >
            {TRACK_OPTIONS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex min-h-[200px] items-center justify-center">
          <span className="font-mono text-sm text-gray-500">
            {TRACK_SVG_MAP[trackId] ? 'Invalid SVG' : 'Unknown track'}
          </span>
        </div>
      </div>
    );
  }

  const vbParts = parsed.viewBox.trim().split(/\s+/);
  const vbW = Number(vbParts[2]) || 512;
  const vbH = Number(vbParts[3]) || 512;

  return (
    <div className={`overflow-hidden rounded-lg border border-f1-border bg-f1-panel p-3 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-xs font-semibold uppercase tracking-wider text-gray-500">
          Live track
        </span>
        <select
          value={trackId}
          onChange={(e) => { setPathReady(false); setTrackId(e.target.value); }}
          className="rounded border border-f1-border bg-black/40 px-2 py-1 font-mono text-xs text-white"
        >
          {TRACK_OPTIONS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <svg
        viewBox={parsed.viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="w-full block"
        style={{ aspectRatio: vbW / vbH, minHeight: 200 }}
      >
        <defs>
          <linearGradient id="trackFillRender" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2a2a35" />
            <stop offset="100%" stopColor="#1e1e28" />
          </linearGradient>
        </defs>
        {/* Track surface (area between outer + inner edges) */}
        <path
          d={parsed.fullPathD}
          fill="url(#trackFillRender)"
          fillRule="evenodd"
          stroke="#3a3a44"
          strokeWidth="1.5"
        />
        {/* Hidden outer-edge path used only for car positioning */}
        <path
          ref={setPathCallback}
          d={parsed.outerPathD}
          fill="none"
          stroke="none"
          aria-hidden="true"
        />
        {pathReady && <CarMarkers pathRef={pathRef} drivers={drivers ?? []} />}
      </svg>
    </div>
  );
}
