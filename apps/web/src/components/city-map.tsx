'use client';

import { useState } from 'react';
import { DISTRICTS, type DistrictMeta } from '@/lib/districts';

interface CityMapProps {
  onDistrictSelect?: (district: DistrictMeta) => void;
  selectedCode?: string;
}

// ── District icon SVG paths (24x24 viewBox) ──────────────────────

export const DISTRICT_ICONS: Record<string, (color: string) => React.ReactNode> = {
  skyscraper: (c) => (
    <g fill={c} opacity="0.9">
      <rect x="3" y="8" width="6" height="16" rx="0.5" />
      <rect x="4.5" y="10" width="1" height="1" fill="#000" opacity="0.3" />
      <rect x="4.5" y="13" width="1" height="1" fill="#000" opacity="0.3" />
      <rect x="4.5" y="16" width="1" height="1" fill="#000" opacity="0.3" />
      <rect x="10" y="4" width="5" height="20" rx="0.5" />
      <rect x="11.5" y="6" width="1.2" height="1" fill="#000" opacity="0.3" />
      <rect x="11.5" y="9" width="1.2" height="1" fill="#000" opacity="0.3" />
      <rect x="11.5" y="12" width="1.2" height="1" fill="#000" opacity="0.3" />
      <rect x="11.5" y="15" width="1.2" height="1" fill="#000" opacity="0.3" />
      <rect x="16" y="10" width="5" height="14" rx="0.5" />
      <rect x="17.5" y="12" width="1" height="1" fill="#000" opacity="0.3" />
      <rect x="17.5" y="15" width="1" height="1" fill="#000" opacity="0.3" />
      <line x1="12.5" y1="2" x2="12.5" y2="4" stroke={c} strokeWidth="0.8" />
    </g>
  ),
  clocktower: (c) => (
    <g fill={c} opacity="0.9">
      <rect x="8" y="10" width="8" height="14" rx="0.5" />
      <polygon points="7,10 12,3 17,10" />
      <circle cx="12" cy="8" r="2" fill="#000" opacity="0.2" />
      <line x1="12" y1="7" x2="12" y2="8" stroke="#000" strokeWidth="0.5" opacity="0.4" />
      <line x1="12" y1="8" x2="13" y2="8.5" stroke="#000" strokeWidth="0.5" opacity="0.4" />
      <rect x="10" y="14" width="1.5" height="1" fill="#000" opacity="0.2" />
      <rect x="10" y="17" width="1.5" height="1" fill="#000" opacity="0.2" />
      <rect x="10.5" y="20" width="3" height="4" fill="#000" opacity="0.15" />
    </g>
  ),
  sailboat: (c) => (
    <g fill={c} opacity="0.9">
      <polygon points="12,3 12,16 5,16" />
      <polygon points="12,6 12,16 18,16" opacity="0.7" />
      <line x1="12" y1="3" x2="12" y2="18" stroke={c} strokeWidth="0.8" />
      <path d="M4,18 Q8,16 12,18 Q16,20 20,18" fill="none" stroke={c} strokeWidth="1" opacity="0.5" />
      <path d="M3,20 Q8,18 12,20 Q16,22 21,20" fill="none" stroke={c} strokeWidth="0.8" opacity="0.3" />
      <ellipse cx="12" cy="17.5" rx="5" ry="1.5" opacity="0.3" />
    </g>
  ),
  circuit: (c) => (
    <g fill={c} opacity="0.9">
      <rect x="6" y="6" width="12" height="12" rx="1" fill="none" stroke={c} strokeWidth="1.2" />
      <rect x="9" y="9" width="6" height="6" rx="0.5" />
      <line x1="6" y1="10" x2="3" y2="10" stroke={c} strokeWidth="0.8" />
      <line x1="6" y1="14" x2="3" y2="14" stroke={c} strokeWidth="0.8" />
      <line x1="18" y1="10" x2="21" y2="10" stroke={c} strokeWidth="0.8" />
      <line x1="18" y1="14" x2="21" y2="14" stroke={c} strokeWidth="0.8" />
      <line x1="10" y1="6" x2="10" y2="3" stroke={c} strokeWidth="0.8" />
      <line x1="14" y1="6" x2="14" y2="3" stroke={c} strokeWidth="0.8" />
      <line x1="10" y1="18" x2="10" y2="21" stroke={c} strokeWidth="0.8" />
      <line x1="14" y1="18" x2="14" y2="21" stroke={c} strokeWidth="0.8" />
      <circle cx="12" cy="12" r="1" fill="#000" opacity="0.3" />
    </g>
  ),
  'market-stall': (c) => (
    <g fill={c} opacity="0.9">
      <path d="M4,10 L12,4 L20,10 Z" />
      <path d="M4,10 Q8,8 12,10 Q16,12 20,10" fill={c} opacity="0.6" />
      <rect x="5" y="10" width="14" height="10" rx="0.5" opacity="0.8" />
      <rect x="7" y="13" width="3" height="3" fill="#000" opacity="0.15" />
      <rect x="12" y="13" width="3" height="3" fill="#000" opacity="0.15" />
      <circle cx="8.5" cy="14.5" r="1" fill="#000" opacity="0.1" />
      <circle cx="13.5" cy="14.5" r="1" fill="#000" opacity="0.1" />
      <rect x="10" y="17" width="4" height="3" fill="#000" opacity="0.12" />
    </g>
  ),
  spotlight: (c) => (
    <g fill={c} opacity="0.9">
      <polygon points="12,2 14,9 21,9 15.5,13.5 17.5,21 12,16 6.5,21 8.5,13.5 3,9 10,9" />
      <circle cx="12" cy="12" r="3" fill="#000" opacity="0.15" />
      <circle cx="12" cy="12" r="1.5" fill={c} opacity="0.6" />
    </g>
  ),
  'book-tower': (c) => (
    <g fill={c} opacity="0.9">
      <rect x="6" y="16" width="12" height="3" rx="0.3" />
      <rect x="7" y="12.5" width="11" height="3" rx="0.3" opacity="0.85" />
      <rect x="6.5" y="9" width="10" height="3" rx="0.3" opacity="0.7" />
      <rect x="7.5" y="5.5" width="9" height="3" rx="0.3" opacity="0.6" />
      <polygon points="9,5.5 12,2 15,5.5" opacity="0.5" />
      <line x1="8" y1="17.5" x2="16" y2="17.5" stroke="#000" strokeWidth="0.3" opacity="0.2" />
      <line x1="8.5" y1="14" x2="15.5" y2="14" stroke="#000" strokeWidth="0.3" opacity="0.2" />
      <rect x="5" y="19" width="14" height="2" rx="0.3" opacity="0.4" />
    </g>
  ),
  crane: (c) => (
    <g fill={c} opacity="0.9">
      <rect x="11" y="4" width="2" height="18" />
      <line x1="12" y1="4" x2="22" y2="7" stroke={c} strokeWidth="1.2" />
      <line x1="12" y1="4" x2="5" y2="7" stroke={c} strokeWidth="1" />
      <line x1="12" y1="7" x2="20" y2="7" stroke={c} strokeWidth="0.6" opacity="0.5" />
      <line x1="20" y1="7" x2="20" y2="14" stroke={c} strokeWidth="0.6" />
      <rect x="18.5" y="14" width="3" height="2" opacity="0.6" />
      <rect x="8" y="20" width="8" height="2" rx="0.3" opacity="0.5" />
      <line x1="11" y1="22" x2="9" y2="22" stroke={c} strokeWidth="1" />
      <line x1="13" y1="22" x2="15" y2="22" stroke={c} strokeWidth="1" />
    </g>
  ),
  factory: (c) => (
    <g fill={c} opacity="0.9">
      <rect x="4" y="12" width="16" height="10" rx="0.5" />
      <rect x="5" y="6" width="3" height="6" />
      <rect x="10" y="8" width="3" height="4" />
      <rect x="6" y="3" width="1" height="3" opacity="0.6" />
      <rect x="11" y="5" width="1" height="3" opacity="0.6" />
      <ellipse cx="6.5" cy="3" rx="2" ry="1" fill={c} opacity="0.2" />
      <ellipse cx="11.5" cy="5" rx="1.8" ry="0.8" fill={c} opacity="0.15" />
      <rect x="7" y="15" width="2" height="2" fill="#000" opacity="0.15" />
      <rect x="11" y="15" width="2" height="2" fill="#000" opacity="0.15" />
      <rect x="15" y="15" width="2" height="2" fill="#000" opacity="0.15" />
      <rect x="9" y="19" width="3" height="3" fill="#000" opacity="0.12" />
    </g>
  ),
  'house-tree': (c) => (
    <g fill={c} opacity="0.9">
      <rect x="3" y="14" width="10" height="8" rx="0.5" />
      <polygon points="2,14 8,7 14,14" />
      <rect x="6" y="17" width="3" height="5" fill="#000" opacity="0.12" />
      <rect x="4" y="16" width="2" height="2" fill="#000" opacity="0.15" />
      <circle cx="19" cy="10" r="4" opacity="0.7" />
      <circle cx="17" cy="12" r="3" opacity="0.5" />
      <rect x="18.5" y="14" width="1" height="6" opacity="0.6" />
    </g>
  ),
  community: (c) => (
    <g fill={c} opacity="0.9">
      <rect x="2" y="15" width="7" height="6" rx="0.3" />
      <polygon points="1.5,15 5.5,10 9.5,15" />
      <rect x="9" y="13" width="6" height="8" rx="0.3" opacity="0.85" />
      <polygon points="8.5,13 12,8 15.5,13" opacity="0.85" />
      <rect x="16" y="15" width="6" height="6" rx="0.3" opacity="0.7" />
      <polygon points="15.5,15 19,11 22.5,15" opacity="0.7" />
      <rect x="4" y="17" width="1.5" height="2" fill="#000" opacity="0.12" />
      <rect x="11" y="16" width="2" height="3" fill="#000" opacity="0.12" />
      <rect x="18" y="17" width="1.5" height="2" fill="#000" opacity="0.12" />
    </g>
  ),
  windmill: (c) => (
    <g fill={c} opacity="0.9">
      <polygon points="10,10 14,10 13,22 11,22" />
      <circle cx="12" cy="10" r="1.5" fill="#000" opacity="0.2" />
      <line x1="12" y1="10" x2="12" y2="2" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="10" x2="20" y2="7" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="10" x2="4" y2="13" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <line x1="12" y1="10" x2="15" y2="18" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="10" r="1" fill={c} />
      <rect x="9" y="22" width="6" height="1" rx="0.3" opacity="0.4" />
    </g>
  ),
};

// ── Road segments (pairs of district codes for natural adjacencies) ──

const ROADS: [string, string][] = [
  ['SUBURBS_N', 'OLD_TOWN'],
  ['SUBURBS_N', 'OUTSKIRTS'],
  ['OLD_TOWN', 'CBD'],
  ['CBD', 'MARINA'],
  ['CBD', 'TECH_PARK'],
  ['CBD', 'MARKET_SQ'],
  ['MARINA', 'HARBOR'],
  ['HARBOR', 'INDUSTRIAL'],
  ['TECH_PARK', 'ENTERTAINMENT'],
  ['TECH_PARK', 'INDUSTRIAL'],
  ['MARKET_SQ', 'ENTERTAINMENT'],
  ['MARKET_SQ', 'UNIVERSITY'],
  ['UNIVERSITY', 'OUTSKIRTS'],
  ['UNIVERSITY', 'SUBURBS_S'],
  ['OUTSKIRTS', 'SUBURBS_S'],
  ['OLD_TOWN', 'MARKET_SQ'],
];

export function CityMap({ onDistrictSelect, selectedCode }: CityMapProps) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  // Pre-compute centers for road drawing and icon placement
  const centers = Object.fromEntries(
    DISTRICTS.map((d) => [d.code, getPolygonCenter(d.points)])
  );

  return (
    <div
      className="w-full aspect-[4/3] relative rounded-xl overflow-hidden"
      style={{
        touchAction: 'pan-y',
        boxShadow:
          '0 0 20px hsl(192 91% 52% / 0.3), 0 0 60px hsl(192 91% 52% / 0.1), inset 0 1px 0 hsl(210 20% 90% / 0.05)',
      }}
    >
      <svg
        viewBox="20 60 620 420"
        className="w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* ── Filters ── */}
          <filter id="district-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="icon-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="fog" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="20" />
          </filter>
          <filter id="shadow-lift" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
          </filter>

          {/* ── Per-district gradients ── */}
          {DISTRICTS.map((d) => (
            <linearGradient key={`grad-${d.code}`} id={`grad-${d.code}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={d.gradient[0]} stopOpacity="0.85" />
              <stop offset="100%" stopColor={d.gradient[1]} stopOpacity="0.95" />
            </linearGradient>
          ))}

          {/* ── Glass overlay gradient ── */}
          <linearGradient id="glass-overlay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.12" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.08" />
          </linearGradient>

          {/* ── Background gradient ── */}
          <radialGradient id="bg-radial" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="hsl(222 47% 10%)" />
            <stop offset="60%" stopColor="hsl(222 47% 7%)" />
            <stop offset="100%" stopColor="hsl(222 47% 4%)" />
          </radialGradient>

          {/* ── Water gradient ── */}
          <linearGradient id="water-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0E7490" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#164E63" stopOpacity="0.15" />
          </linearGradient>

          {/* ── Subtle grid ── */}
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="hsl(192 50% 30%)" strokeWidth="0.2" opacity="0.08" />
          </pattern>

          {/* ── Noise texture ── */}
          <filter id="noise">
            <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="4" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
            <feBlend in="SourceGraphic" mode="multiply" />
          </filter>
        </defs>

        {/* ═══ Background layers ═══ */}
        <rect x="20" y="60" width="620" height="420" fill="url(#bg-radial)" />
        <rect x="20" y="60" width="620" height="420" fill="url(#grid)" />

        {/* ── Water body (east coast along Marina/Harbor) ── */}
        <path
          d="M510,80 Q560,90 620,80 L640,80 L640,280 Q600,290 560,270 Q530,250 510,220 Q500,180 510,130 Z"
          fill="url(#water-grad)"
        />
        <path
          d="M520,100 Q560,95 600,100"
          fill="none"
          stroke="#22D3EE"
          strokeWidth="0.5"
          opacity="0.15"
          className="animate-icon-float"
        />
        <path
          d="M530,130 Q570,125 610,130"
          fill="none"
          stroke="#22D3EE"
          strokeWidth="0.4"
          opacity="0.1"
          className="animate-icon-float"
          style={{ animationDelay: '1s' }}
        />
        <path
          d="M515,200 Q555,195 605,200"
          fill="none"
          stroke="#22D3EE"
          strokeWidth="0.4"
          opacity="0.1"
          className="animate-icon-float"
          style={{ animationDelay: '2s' }}
        />

        {/* ── Green patches (suburbs/university) ── */}
        <ellipse cx="180" cy="130" rx="60" ry="40" fill="#15803D" opacity="0.06" />
        <ellipse cx="160" cy="380" rx="55" ry="40" fill="#047857" opacity="0.05" />
        <ellipse cx="160" cy="290" rx="35" ry="25" fill="#4D7C0F" opacity="0.04" />

        {/* ── Industrial haze ── */}
        <ellipse cx="560" cy="320" rx="50" ry="40" fill="#78716C" opacity="0.06" />

        {/* ── Atmospheric fog spots ── */}
        <circle cx="330" cy="250" r="80" fill="#fff" opacity="0.015" filter="url(#fog)" />
        <circle cx="150" cy="200" r="60" fill="#fff" opacity="0.01" filter="url(#fog)" />
        <circle cx="500" cy="180" r="50" fill="#22D3EE" opacity="0.012" filter="url(#fog)" />

        {/* ═══ Road network ═══ */}
        <g opacity="0.12">
          {ROADS.map(([a, b], i) => {
            const ca = centers[a];
            const cb = centers[b];
            if (!ca || !cb) return null;
            // Slight curve for organic feel
            const mx = (ca.x + cb.x) / 2 + (i % 2 === 0 ? 5 : -5);
            const my = (ca.y + cb.y) / 2 + (i % 3 === 0 ? 5 : -3);
            return (
              <path
                key={`road-${a}-${b}`}
                d={`M${ca.x},${ca.y} Q${mx},${my} ${cb.x},${cb.y}`}
                fill="none"
                stroke="hsl(210 20% 70%)"
                strokeWidth="1"
                strokeDasharray="4 3"
                strokeLinecap="round"
              />
            );
          })}
        </g>

        {/* ═══ Districts ═══ */}
        {DISTRICTS.map((d) => {
          const isSelected = selectedCode === d.code;
          const isHovered = hoveredCode === d.code;
          const isActive = isSelected || isHovered;
          const center = centers[d.code];

          return (
            <g key={d.code}>
              {/* Glow behind active district */}
              {isActive && (
                <polygon
                  points={d.points}
                  fill={d.gradient[0]}
                  opacity="0.35"
                  filter="url(#district-glow)"
                />
              )}

              {/* Main polygon with gradient fill */}
              <polygon
                points={d.points}
                fill={`url(#grad-${d.code})`}
                stroke={
                  isSelected
                    ? 'hsl(192 91% 52%)'
                    : isHovered
                      ? 'hsl(192 70% 45%)'
                      : d.stroke
                }
                strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 0.6}
                opacity={isActive ? 1 : 0.7}
                className="cursor-pointer"
                style={{
                  transition:
                    'opacity 300ms ease, stroke-width 300ms ease, stroke 300ms ease',
                  filter: isActive ? 'url(#shadow-lift)' : 'none',
                }}
                onMouseEnter={() => setHoveredCode(d.code)}
                onMouseLeave={() => setHoveredCode(null)}
                onClick={() => onDistrictSelect?.(d)}
              />

              {/* Glass overlay for 3D depth */}
              <polygon
                points={d.points}
                fill="url(#glass-overlay)"
                className="pointer-events-none"
                opacity={isActive ? 0.7 : 0.4}
                style={{ transition: 'opacity 300ms ease' }}
              />

              {/* District icon */}
              {center && (
                <g
                  transform={`translate(${center.x - 12}, ${center.y - 16}) scale(${isActive ? 1.15 : 1})`}
                  className={`pointer-events-none ${isActive ? '' : 'animate-icon-float'}`}
                  style={{
                    transformOrigin: `${center.x}px ${center.y - 4}px`,
                    transition: 'transform 300ms ease',
                    filter: isActive ? 'url(#icon-glow)' : 'none',
                    animationDelay: `${(DISTRICTS.indexOf(d) * 0.4) % 3}s`,
                  }}
                  opacity={isActive ? 1 : 0.6}
                >
                  {DISTRICT_ICONS[d.icon]?.(isActive ? '#fff' : d.gradient[0])}
                </g>
              )}

              {/* Label below icon */}
              {center && (
                <text
                  x={center.x}
                  y={center.y + 12}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="pointer-events-none select-none"
                  style={{
                    fill: isActive ? '#fff' : 'hsl(210 20% 80%)',
                    fontSize: isActive ? '9px' : '8px',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase' as const,
                    textShadow: isActive
                      ? `0 0 10px ${d.gradient[0]}80, 0 1px 4px rgba(0,0,0,0.9)`
                      : '0 1px 3px rgba(0,0,0,0.8)',
                    transition: 'fill 300ms ease, font-size 300ms ease',
                  }}
                >
                  {d.name.length > 14 ? d.code.replace(/_/g, ' ') : d.name}
                </text>
              )}
            </g>
          );
        })}

        {/* ═══ Vignette overlay ═══ */}
        <rect x="20" y="60" width="620" height="420" fill="url(#bg-radial)" opacity="0.3" style={{ mixBlendMode: 'multiply' }} />

        {/* ═══ Outer frame ═══ */}
        <rect
          x="20" y="60" width="620" height="420"
          fill="none"
          stroke="hsl(192 91% 52%)"
          strokeWidth="0.8"
          opacity="0.2"
          rx="2"
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
