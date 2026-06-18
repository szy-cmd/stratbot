import React from 'react';

/**
 * Renders car markers along the SVG path by percentage (0–100% lap progress).
 * Uses pathRef.current.getTotalLength() and getPointAtLength().
 */
export function CarMarkers({ pathRef, drivers }) {
  if (!pathRef?.current || !drivers?.length) return null;

  const pathEl = pathRef.current;
  const totalLength = pathEl.getTotalLength();

  return (
    <g filter="url(#trackGlow)">
      {drivers.map((driver) => {
        const pct = Math.min(100, Math.max(0, driver.lapProgress ?? 0));
        const len = (pct / 100) * totalLength;
        const pt = pathEl.getPointAtLength(len);
        const color = driver.color || '#6b7280';
        return (
          <g key={driver.id} className="dashboard-transition">
            <circle
              cx={pt.x}
              cy={pt.y}
              r="5"
              fill={color}
              stroke="#0a0a0a"
              strokeWidth="1.2"
            />
            <text
              x={pt.x}
              y={pt.y + 1.2}
              textAnchor="middle"
              className="fill-white font-mono text-[4px] font-bold"
            >
              {driver.number}
            </text>
          </g>
        );
      })}
    </g>
  );
}
