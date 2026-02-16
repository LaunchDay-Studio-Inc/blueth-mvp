import React from "react";

export function TerrainBackground() {
  return (
    <g id="terrain-background">
      {/* --- Definitions --- */}
      <defs>
        <radialGradient id="bg-land" cx="50%" cy="50%" r="65%">
          <stop offset="0%" stopColor="#8BC34A" />
          <stop offset="50%" stopColor="#7CB342" />
          <stop offset="100%" stopColor="#558B2F" />
        </radialGradient>

        <linearGradient id="water-grad" x1="0" y1="0" x2="1" y2="0.5">
          <stop offset="0%" stopColor="#4FC3F7" />
          <stop offset="100%" stopColor="#0277BD" />
        </linearGradient>

        {/* Noise texture filter */}
        <filter id="terrain-noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves={3} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
      </defs>

      {/* === Layer 1: Green grass base === */}
      <rect x={0} y={0} width={800} height={600} fill="url(#bg-land)" />
      {/* Subtle noise overlay */}
      <rect x={0} y={0} width={800} height={600} fill="url(#bg-land)" filter="url(#terrain-noise)" opacity={0.03} />

      {/* === Layer 6: Rolling hills (behind everything) === */}
      <ellipse cx={160} cy={350} rx={80} ry={25} fill="#66BB6A" opacity={0.18} />
      <ellipse cx={320} cy={280} rx={60} ry={20} fill="#66BB6A" opacity={0.15} />
      <ellipse cx={480} cy={380} rx={70} ry={22} fill="#66BB6A" opacity={0.12} />
      <ellipse cx={250} cy={460} rx={50} ry={18} fill="#66BB6A" opacity={0.2} />
      <ellipse cx={550} cy={300} rx={45} ry={15} fill="#66BB6A" opacity={0.14} />
      <ellipse cx={100} cy={500} rx={60} ry={20} fill="#66BB6A" opacity={0.16} />

      {/* === Layer 5: Mountains along the top === */}
      {/* Back row — taller */}
      <polygon points="50,130 110,40 170,130" fill="#78909C" />
      <polygon points="140,130 210,50 280,130" fill="#78909C" />
      <polygon points="250,130 330,30 410,130" fill="#78909C" />
      <polygon points="380,130 450,45 520,130" fill="#78909C" />
      <polygon points="490,130 560,55 630,130" fill="#78909C" />
      <polygon points="580,130 650,40 720,130" fill="#78909C" />
      <polygon points="660,130 730,60 800,130" fill="#78909C" />
      {/* Front row — shorter, lighter */}
      <polygon points="80,130 140,80 200,130" fill="#90A4AE" />
      <polygon points="200,130 270,70 340,130" fill="#90A4AE" />
      <polygon points="360,130 440,75 520,130" fill="#90A4AE" />
      <polygon points="520,130 590,85 660,130" fill="#90A4AE" />
      {/* Snow caps on tallest peaks */}
      <polygon points="110,40 95,65 125,65" fill="#ECEFF1" />
      <polygon points="210,50 195,72 225,72" fill="#ECEFF1" />
      <polygon points="330,30 313,58 347,58" fill="#ECEFF1" />
      <polygon points="450,45 435,67 465,67" fill="#ECEFF1" />
      <polygon points="650,40 635,63 665,63" fill="#ECEFF1" />

      {/* === Layer 4: River curving from top-center to bottom-right === */}
      <path
        d="M400,0 Q380,100 410,200 Q440,300 480,380 Q520,460 620,540"
        fill="none"
        stroke="#29B6F6"
        strokeWidth={5}
        opacity={0.6}
        strokeLinecap="round"
      />
      {/* Parallel depth stroke */}
      <path
        d="M401,0 Q381,100 411,200 Q441,300 481,380 Q521,460 621,540"
        fill="none"
        stroke="#81D4FA"
        strokeWidth={2}
        opacity={0.35}
        strokeLinecap="round"
      />

      {/* === Layer 2: Ocean on the east side === */}
      <path
        d="M620,0 Q640,60 630,130 Q620,220 635,300 Q650,380 630,460 Q615,530 630,600 L800,600 L800,0 Z"
        fill="url(#water-grad)"
        opacity={0.7}
      />
      {/* Wave ripples */}
      <path d="M660,80 Q675,85 690,80 Q705,75 720,80" fill="none" stroke="#81D4FA" strokeWidth={0.5} opacity={0.2} />
      <path d="M650,180 Q665,185 680,180 Q695,175 710,180" fill="none" stroke="#81D4FA" strokeWidth={0.5} opacity={0.2} />
      <path d="M640,300 Q658,306 675,300 Q692,294 710,300" fill="none" stroke="#81D4FA" strokeWidth={0.5} opacity={0.2} />
      <path d="M635,420 Q652,425 670,420 Q688,415 705,420" fill="none" stroke="#81D4FA" strokeWidth={0.5} opacity={0.2} />
      <path d="M640,530 Q655,535 670,530 Q685,525 700,530" fill="none" stroke="#81D4FA" strokeWidth={0.5} opacity={0.2} />

      {/* === Layer 3: Sandy coastline === */}
      <path
        d="M620,0 Q640,60 630,130 Q620,220 635,300 Q650,380 630,460 Q615,530 630,600"
        fill="none"
        stroke="#D7CCC8"
        strokeWidth={4}
        opacity={0.5}
        strokeLinecap="round"
      />

      {/* === Layer 7: Trees scattered between districts === */}
      <g id="scattered-trees">
        {/* Cluster top-left */}
        <circle cx={80} cy={180} r={4} fill="#43A047" opacity={0.4} />
        <rect x={79} y={184} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={92} cy={175} r={3} fill="#43A047" opacity={0.4} />
        <rect x={91} y={178} width={1} height={3} fill="#5D4037" opacity={0.3} />

        {/* Cluster mid-left */}
        <circle cx={60} cy={320} r={5} fill="#43A047" opacity={0.4} />
        <rect x={59} y={325} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={75} cy={315} r={3} fill="#43A047" opacity={0.4} />
        <rect x={74} y={318} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={50} cy={330} r={4} fill="#43A047" opacity={0.4} />
        <rect x={49} y={334} width={1} height={3} fill="#5D4037" opacity={0.3} />

        {/* Cluster bottom-left */}
        <circle cx={70} cy={500} r={5} fill="#2E7D32" opacity={0.4} />
        <rect x={69} y={505} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={90} cy={495} r={4} fill="#388E3C" opacity={0.4} />
        <rect x={89} y={499} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={55} cy={510} r={3} fill="#43A047" opacity={0.4} />
        <rect x={54} y={513} width={1} height={3} fill="#5D4037" opacity={0.3} />

        {/* Individual scattered */}
        <circle cx={180} cy={200} r={4} fill="#43A047" opacity={0.4} />
        <rect x={179} y={204} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={300} cy={250} r={3} fill="#43A047" opacity={0.4} />
        <rect x={299} y={253} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={250} cy={400} r={4} fill="#2E7D32" opacity={0.4} />
        <rect x={249} y={404} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={350} cy={480} r={3} fill="#43A047" opacity={0.4} />
        <rect x={349} y={483} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={150} cy={450} r={5} fill="#388E3C" opacity={0.4} />
        <rect x={149} y={455} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={500} cy={200} r={3} fill="#43A047" opacity={0.4} />
        <rect x={499} y={203} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={540} cy={350} r={4} fill="#2E7D32" opacity={0.4} />
        <rect x={539} y={354} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={200} cy={550} r={3} fill="#43A047" opacity={0.4} />
        <rect x={199} y={553} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={450} cy={480} r={4} fill="#388E3C" opacity={0.4} />
        <rect x={449} y={484} width={1} height={3} fill="#5D4037" opacity={0.3} />
        <circle cx={130} cy={300} r={3} fill="#43A047" opacity={0.4} />
        <rect x={129} y={303} width={1} height={3} fill="#5D4037" opacity={0.3} />
      </g>

      {/* === Layer 8: Sunlight glow === */}
      <circle cx={100} cy={80} r={120} fill="#FFF9C4" opacity={0.15} />

      {/* === Layer 9: Map border frame === */}
      <rect
        x={0}
        y={0}
        width={800}
        height={600}
        rx={8}
        fill="none"
        stroke="#5D4037"
        strokeWidth={3}
      />
    </g>
  );
}
