import React from "react";

export function MapDecorations() {
  return (
    <g id="map-decorations" className="pointer-events-none">
      {/* 1. Clouds */}
      <g id="clouds">
        <g opacity={0.2}>
          <ellipse cx={120} cy={60} rx={28} ry={12} fill="white" />
          <ellipse cx={145} cy={55} rx={22} ry={10} fill="white" />
          <ellipse cx={100} cy={55} rx={20} ry={9} fill="white" />
        </g>
        <g opacity={0.15}>
          <ellipse cx={380} cy={40} rx={32} ry={14} fill="white" />
          <ellipse cx={410} cy={35} rx={25} ry={11} fill="white" />
          <ellipse cx={355} cy={36} rx={22} ry={10} fill="white" />
        </g>
        <g opacity={0.25}>
          <ellipse cx={580} cy={70} rx={26} ry={11} fill="white" />
          <ellipse cx={602} cy={65} rx={20} ry={9} fill="white" />
          <ellipse cx={562} cy={66} rx={18} ry={8} fill="white" />
        </g>
        <g opacity={0.18}>
          <ellipse cx={260} cy={90} rx={30} ry={13} fill="white" />
          <ellipse cx={288} cy={85} rx={24} ry={10} fill="white" />
          <ellipse cx={238} cy={86} rx={20} ry={9} fill="white" />
        </g>
      </g>

      {/* 2. Birds */}
      <g id="birds" stroke="#555" strokeWidth={0.5} fill="none">
        <path d="M-3,-1 L0,1 L3,-1" transform="translate(200,50)" />
        <path d="M-3,-1 L0,1 L3,-1" transform="translate(210,45)" />
        <path d="M-3,-1 L0,1 L3,-1" transform="translate(450,30)" />
        <path d="M-3,-1 L0,1 L3,-1" transform="translate(530,55)" />
        <path d="M-3,-1 L0,1 L3,-1" transform="translate(680,40)" />
      </g>

      {/* 3. Compass rose */}
      <g id="compass" transform="translate(720,540)">
        <circle r={20} fill="#FFF8E1" opacity={0.8} />
        <circle r={18} fill="none" stroke="#795548" strokeWidth={0.5} opacity={0.5} />
        {/* Diamond pointer */}
        <polygon points="0,-14 4,0 0,14 -4,0" fill="#795548" opacity={0.6} />
        <polygon points="0,-14 4,0 0,0 -4,0" fill="#C62828" opacity={0.7} />
        {/* Cardinal tick marks */}
        <line x1={0} y1={-17} x2={0} y2={-15} stroke="#795548" strokeWidth={0.8} />
        <line x1={0} y1={15} x2={0} y2={17} stroke="#795548" strokeWidth={0.8} />
        <line x1={-17} y1={0} x2={-15} y2={0} stroke="#795548" strokeWidth={0.8} />
        <line x1={15} y1={0} x2={17} y2={0} stroke="#795548" strokeWidth={0.8} />
        {/* Labels */}
        <text y={-16} textAnchor="middle" dominantBaseline="auto" fill="#5D4037" fontSize={6} fontWeight="bold" dy={-2}>N</text>
        <text y={16} textAnchor="middle" dominantBaseline="hanging" fill="#5D4037" fontSize={6} fontWeight="bold" dy={2}>S</text>
        <text x={-16} textAnchor="end" dominantBaseline="central" fill="#5D4037" fontSize={6} fontWeight="bold" dx={-2}>W</text>
        <text x={16} textAnchor="start" dominantBaseline="central" fill="#5D4037" fontSize={6} fontWeight="bold" dx={2}>E</text>
      </g>

      {/* 4. Map title cartouche */}
      <g id="cartouche" transform="translate(400,30)">
        <rect x={-80} y={-15} width={160} height={30} rx={8} fill="#D7CCC8" opacity={0.9} />
        <rect x={-76} y={-12} width={152} height={24} rx={6} fill="none" stroke="#5D4037" strokeWidth={0.5} opacity={0.4} />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fill="#3E2723"
          fontSize={14}
          fontWeight="bold"
          letterSpacing={3}
        >
          BLUETH CITY
        </text>
      </g>

      {/* 5. Dock/pier area near harbor */}
      <g id="docks">
        <rect x={775} y={170} width={25} height={3} rx={1} fill="#795548" opacity={0.6} />
        <rect x={778} y={200} width={22} height={3} rx={1} fill="#795548" opacity={0.5} />
        <rect x={772} y={230} width={28} height={3} rx={1} fill="#795548" opacity={0.55} />
      </g>

      {/* 6. City wall / fence */}
      <rect
        x={5}
        y={5}
        width={790}
        height={590}
        rx={20}
        fill="none"
        stroke="#795548"
        strokeWidth={1.5}
        strokeDasharray="8 4"
        opacity={0.3}
      />
    </g>
  );
}
