'use client';

import { useState } from 'react';
import { DISTRICTS, type DistrictMeta } from '@/lib/districts';

interface CityMapProps {
  onDistrictSelect?: (district: DistrictMeta) => void;
  selectedCode?: string;
}

export function CityMap({ onDistrictSelect, selectedCode }: CityMapProps) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  return (
    <div className="w-full aspect-[4/3] relative rounded-xl overflow-hidden neon-border" style={{ touchAction: 'pan-y' }}>
      <svg
        viewBox="20 60 620 420"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Glow filter for selected/hovered districts */}
          <filter id="district-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Subtle inner glow */}
          <filter id="inner-glow" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          {/* Grid pattern for board feel */}
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(192 50% 30%)" strokeWidth="0.3" opacity="0.15" />
          </pattern>
          {/* Noise texture */}
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feBlend in="SourceGraphic" mode="multiply" />
          </filter>
        </defs>

        {/* Dark background with gradient */}
        <rect x="20" y="60" width="620" height="420" fill="hsl(222 47% 6%)" rx="0" />

        {/* Grid overlay */}
        <rect x="20" y="60" width="620" height="420" fill="url(#grid)" />

        {/* Districts */}
        {DISTRICTS.map((d) => {
          const isSelected = selectedCode === d.code;
          const isHovered = hoveredCode === d.code;
          const isActive = isSelected || isHovered;

          return (
            <g key={d.code}>
              {/* Glow layer behind active district */}
              {isActive && (
                <polygon
                  points={d.points}
                  fill={d.fill}
                  opacity="0.3"
                  filter="url(#district-glow)"
                />
              )}
              <polygon
                points={d.points}
                fill={d.fill}
                stroke={isSelected ? 'hsl(192 91% 52%)' : isHovered ? 'hsl(192 70% 45%)' : d.stroke}
                strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 0.8}
                opacity={isActive ? 0.9 : 0.55}
                className="cursor-pointer"
                style={{
                  transition: 'opacity 200ms ease, stroke-width 200ms ease, stroke 200ms ease',
                  filter: isActive ? 'brightness(1.3)' : 'none',
                }}
                onMouseEnter={() => setHoveredCode(d.code)}
                onMouseLeave={() => setHoveredCode(null)}
                onClick={() => onDistrictSelect?.(d)}
              />
              {/* Label */}
              <text
                x={getPolygonCenter(d.points).x}
                y={getPolygonCenter(d.points).y}
                textAnchor="middle"
                dominantBaseline="central"
                className="pointer-events-none select-none"
                style={{
                  fill: isActive ? 'hsl(0 0% 100%)' : 'hsl(210 20% 85%)',
                  fontSize: '11px',
                  fontWeight: isActive ? 700 : 500,
                  textShadow: isActive
                    ? '0 0 8px hsl(192 91% 52% / 0.8), 0 1px 3px rgba(0,0,0,0.8)'
                    : '0 1px 3px rgba(0,0,0,0.7)',
                  letterSpacing: '0.02em',
                  transition: 'fill 200ms ease, font-weight 200ms ease',
                }}
              >
                {d.name.length > 12 ? d.code.replace(/_/g, ' ') : d.name}
              </text>
            </g>
          );
        })}

        {/* Border glow */}
        <rect
          x="20" y="60" width="620" height="420"
          fill="none"
          stroke="hsl(192 91% 52%)"
          strokeWidth="0.5"
          opacity="0.2"
          rx="0"
        />
      </svg>
    </div>
  );
}

function getPolygonCenter(points: string): { x: number; y: number } {
  const coords = points.split(' ').map((p) => {
    const [x, y] = p.split(',').map(Number);
    return { x, y };
  });
  const x = coords.reduce((sum, c) => sum + c.x, 0) / coords.length;
  const y = coords.reduce((sum, c) => sum + c.y, 0) / coords.length;
  return { x, y };
}
