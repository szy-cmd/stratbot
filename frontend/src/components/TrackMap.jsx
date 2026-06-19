import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { TRACK_OPTIONS, DEFAULT_TRACK } from '../data/mockRaceState';

// Static imports – no glob, no async; Vite resolves these at build time.
// New detailed RaceCircuit* (user-added, including better Monaco as RaceCircuitMonaco) + Spa + previous ones.
// Simple bahrain/monaco removed per request. The SVGs are used as the outline (stroked for new ones).
import buddhismSvg from '../racetrack-svgs/buddhism-svgfind-com.svg?raw';
import grandPrixSvg from '../racetrack-svgs/grand prix-svgfind-com.svg?raw';
import prenoesDijonSvg from '../racetrack-svgs/prenoes dijon-svgfind-com.svg?raw';
import raceBahrainSvg from '../racetrack-svgs/RaceCircuitBahrain.svg?raw';
import raceMonacoSvg from '../racetrack-svgs/RaceCircuitMonaco.svg?raw';
import raceCatalunyaSvg from '../racetrack-svgs/RaceCircuitCatalunya.svg?raw';
import raceSilverstoneSvg from '../racetrack-svgs/RaceCircuitSilverstone.svg?raw';
import raceSuzukaSvg from '../racetrack-svgs/RaceCircuitSuzuka.svg?raw';
import raceMonzaSvg from '../racetrack-svgs/RaceCircuitAutodromaDiMonza.svg?raw';
import raceInterlagosSvg from '../racetrack-svgs/RaceCircuitInterlagos.svg?raw';
import raceAbuDhabiSvg from '../racetrack-svgs/RaceCircuitAbuDhabi.svg?raw';
import raceSpaSvg from '../racetrack-svgs/Spa-FrancorchampsRaceCircuitSpa.svg?raw';

const TRACK_SVG_MAP = {
  'buddhism-svgfind-com': buddhismSvg,
  'grand prix-svgfind-com': grandPrixSvg,
  'prenoes dijon-svgfind-com': prenoesDijonSvg,
  // user-added detailed outlines (RaceCircuit*) - these provide the path to use exactly as the track outline
  // for visual (thick stroke) + car markers (getPointAtLength follows the d precisely)
  'RaceCircuitBahrain': raceBahrainSvg,
  'RaceCircuitMonaco': raceMonacoSvg,
  'RaceCircuitCatalunya': raceCatalunyaSvg,
  'RaceCircuitSilverstone': raceSilverstoneSvg,
  'RaceCircuitSuzuka': raceSuzukaSvg,
  'RaceCircuitAutodromaDiMonza': raceMonzaSvg,
  'RaceCircuitInterlagos': raceInterlagosSvg,
  'RaceCircuitAbuDhabi': raceAbuDhabiSvg,
  'Spa-FrancorchampsRaceCircuitSpa': raceSpaSvg,
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

  let outerPathD;
  let fullPathD;

  if (allPaths.length >= 2) {
    // Multiple <path> elements.
    // Pick the LONGEST d as the primary "outline" to follow for car markers (ensures detailed
    // new RaceCircuit* paths like Suzuka's main loop are used for positioning, not a secondary segment).
    // full uses concat for legacy evenodd band rendering (or multi-outline).
    const pathEls = [...allPaths].sort((a, b) => {
      const da = (b.getAttribute('d') || '').length;
      const db = (a.getAttribute('d') || '').length;
      return da - db;
    });
    const posEl = pathEls[0];
    outerPathD = posEl.getAttribute('d');
    fullPathD = [...allPaths].map(p => p.getAttribute('d')).filter(Boolean).join(' ');
  } else {
    // Single <path> element.
    // Legacy: if it contains z + m subpath (the svgfind-com ones), split and use first sub for positioning
    // so cars follow outer edge without relatives breaking position. New single-path outlines (no inner sub)
    // will use the whole d as the outline.
    fullPathD = allPaths[0].getAttribute('d');
    if (!fullPathD) return null;

    const zIdx = fullPathD.search(/[zZ]/);
    outerPathD = zIdx !== -1 ? fullPathD.substring(0, zIdx + 1).trim() : fullPathD;
  }

  if (!outerPathD) return null;

  // Detect pure outline SVGs (new RaceCircuit* etc): the main path is stroked (fill=none) and
  // should be rendered as thick stroke (the "outline") rather than evenodd filled band.
  // For these, outerPathD is the exact path to follow for cars.
  let isOutline = false;
  const candidate = allPaths.length >= 2
    ? [...allPaths].sort((a, b) => ((b.getAttribute('d') || '').length - (a.getAttribute('d') || '').length))[0]
    : allPaths[0];
  if (candidate) {
    const fillAttr = (candidate.getAttribute('fill') || '').trim().toLowerCase();
    const strokeAttr = candidate.getAttribute('stroke');
    isOutline = fillAttr === 'none' || (fillAttr === '' && !!strokeAttr);
  }

  return { viewBox, fullPathD, outerPathD, isOutline };
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

export function TrackMap({ drivers, className = '', trackId: propTrackId }) {
  const pathRef = useRef(null);
  const getValidTrack = (id) => (id && TRACK_SVG_MAP[id] ? id : DEFAULT_TRACK);
  const [trackId, setTrackId] = useState(() => getValidTrack(propTrackId));
  const [pathReady, setPathReady] = useState(false);

  // Keep map in sync with race config (e.g. selected track at race start)
  useEffect(() => {
    if (propTrackId) {
      const valid = getValidTrack(propTrackId);
      if (valid !== trackId) {
        setPathReady(false);
        setTrackId(valid);
      }
    }
  }, [propTrackId, trackId]);

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

  // Make the map content ~5% smaller (inset) to prevent clipping at the edges of the container box.
  // Scale towards center of the viewBox. Applied to a group containing visual track + hidden path + car markers
  // so that getPointAtLength positions align perfectly with the scaled visual outline.
  const mapScale = 0.95;
  const cx = vbW / 2;
  const cy = vbH / 2;
  const mapScaleTransform = `translate(${cx} ${cy}) scale(${mapScale}) translate(${-cx} ${-cy})`;

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
        {/* 5% scale inset applied to the entire track + cars so the outline doesn't clip the edges of the rendered box.
            The transform is on a group so visual (stroked outline or fill) + hidden path + CarMarkers (which use raw local coords from getPointAtLength)
            all stay aligned after scaling. */}
        <g transform={mapScaleTransform}>
          {/* Visual track: for new added RaceCircuit* SVGs (and similar) that provide the track as a stroked OUTLINE (fill="none"),
              render it as a thick stroked line so the exact provided path is the visible track "outline".
              Cars will follow it precisely via the hidden path below. Legacy SVGs keep the evenodd filled band surface. */}
          {parsed.isOutline ? (
            <path
              d={parsed.outerPathD}
              fill="none"
              stroke="#3a3a44"
              strokeWidth="16"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.95"
            />
          ) : (
            /* Track surface (area between outer + inner edges) for legacy */
            <path
              d={parsed.fullPathD}
              fill="url(#trackFillRender)"
              fillRule="evenodd"
              stroke="#3a3a44"
              strokeWidth="1.5"
            />
          )}
          {/* Subtle center line using the exact outline path from the SVG (helps visualize the line being followed by cars) */}
          <path
            d={parsed.outerPathD}
            fill="none"
            stroke="#5a5a66"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />
          {/* Hidden path (exact outline from SVG) used ONLY for car positioning via getPointAtLength + getTotalLength.
              This ensures cars follow the provided track outline precisely, even for the newly added SVGs. */}
          <path
            ref={setPathCallback}
            d={parsed.outerPathD}
            fill="none"
            stroke="none"
            aria-hidden="true"
          />
          {pathReady && <CarMarkers pathRef={pathRef} drivers={drivers ?? []} />}
        </g>
      </svg>
    </div>
  );
}
