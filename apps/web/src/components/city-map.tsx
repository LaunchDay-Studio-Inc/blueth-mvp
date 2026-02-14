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
    <div className="w-full aspect-[4/3] relative">
      <svg
        viewBox="20 60 620 420"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Background */}
        <rect x="20" y="60" width="620" height="420" fill="hsl(var(--muted))" rx="8" />

        {/* Districts */}
        {DISTRICTS.map((d) => {
          const isSelected = selectedCode === d.code;
          const isHovered = hoveredCode === d.code;

          return (
            <g key={d.code}>
              <polygon
                points={d.points}
                fill={d.fill}
                stroke={isSelected ? 'hsl(var(--primary))' : d.stroke}
                strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
                opacity={isHovered || isSelected ? 1 : 0.8}
                className="cursor-pointer transition-all duration-150"
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
                className="pointer-events-none select-none fill-white text-[10px] font-medium"
                style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
              >
                {d.name.length > 12 ? d.code.replace(/_/g, ' ') : d.name}
              </text>
            </g>
          );
        })}
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
