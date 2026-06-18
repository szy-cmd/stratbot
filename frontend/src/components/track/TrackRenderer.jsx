import React, { useState, useEffect, useRef } from 'react';

/**
 * Loads track SVG from public/racetrack-svgs/{trackId}.svg,
 * extracts the main center path (for car positioning) and outline path.
 * Renders an SVG with the path ref so getPointAtLength can be used.
 */
export function TrackRenderer({ trackId, pathRef, children, onPathReady, className = '' }) {
  const [state, setState] = useState({
    viewBox: '0 0 400 200',
    centerPathD: null,
    outlinePathD: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!trackId) {
      setState((s) => ({ ...s, loading: false, error: 'No track selected' }));
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    const url = `/racetrack-svgs/${trackId}.svg`;
    fetch(url)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('Failed to load'))))
      .then((svgText) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(svgText, 'image/svg+xml');
        const svg = doc.querySelector('svg');
        const viewBox = svg?.getAttribute('viewBox') || '0 0 400 200';
        const centerPath = doc.querySelector('path#track-center') || doc.querySelector('path');
        const allPaths = doc.querySelectorAll('path');
        let centerPathD = null;
        let outlinePathD = null;
        if (centerPath) {
          centerPathD = centerPath.getAttribute('d');
          const outline = [...allPaths].find((p) => p !== centerPath && p.getAttribute('fill') !== 'none');
          if (outline) outlinePathD = outline.getAttribute('d');
        }
        setState({
          viewBox,
          centerPathD,
          outlinePathD,
          loading: false,
          error: centerPathD ? null : 'No path in SVG',
        });
      })
      .catch((err) => {
        setState((s) => ({
          ...s,
          loading: false,
          error: err?.message || 'Failed to load track',
        }));
      });
  }, [trackId]);

  const pathMountedRef = useRef(false);
  useEffect(() => {
    if (pathRef?.current && state.centerPathD && !pathMountedRef.current) {
      pathMountedRef.current = true;
      onPathReady?.();
    }
    if (!state.centerPathD) pathMountedRef.current = false;
  }, [state.centerPathD, pathRef, onPathReady]);

  if (state.loading) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-f1-border bg-f1-panel p-8 ${className}`}>
        <span className="font-mono text-sm text-gray-500">Loading track…</span>
      </div>
    );
  }

  if (state.error || !state.centerPathD) {
    return (
      <div className={`flex items-center justify-center rounded-lg border border-f1-border bg-f1-panel p-8 ${className}`}>
        <span className="font-mono text-sm text-red-400">{state.error || 'No path'}</span>
      </div>
    );
  }

  return (
    <svg
      viewBox={state.viewBox}
      className={`w-full ${className}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="trackFillRender" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e1e24" />
          <stop offset="100%" stopColor="#121218" />
        </linearGradient>
        <filter id="trackGlow">
          <feGaussianBlur stdDeviation="0.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {state.outlinePathD && (
        <path
          d={state.outlinePathD}
          fill="url(#trackFillRender)"
          stroke="#2a2a32"
          strokeWidth="4"
        />
      )}
      <path
        ref={pathRef}
        d={state.centerPathD}
        fill="none"
        stroke="none"
        aria-hidden="true"
      />
      {children}
    </svg>
  );
}
