import React from "react";

export function TerrainBackground() {
  return (
    <g id="terrain-background">
      {/* --- Gradient Definitions --- */}
      <defs>
        <radialGradient id="bg-land" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#8BC34A" />
          <stop offset="100%" stopColor="#558B2F" />
        </radialGradient>

        <linearGradient id="water-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4FC3F7" />
          <stop offset="100%" stopColor="#01579B" />
        </linearGradient>

        <radialGradient id="sunlight" cx="10%" cy="10%" r="90%">
          <stop offset="0%" stopColor="#FFF9C4" stopOpacity={0.08} />
          <stop offset="100%" stopColor="#FFF9C4" stopOpacity={0} />
        </radialGradient>

        {/* Small tree symbol */}
        <symbol id="tree-sm" viewBox="-5 -11 10 17">
          <rect x={-0.75} y={-2} width={1.5} height={6} fill="#5D4037" />
          <circle cx={0} cy={-6} r={5} fill="#43A047" />
        </symbol>
      </defs>

      {/* 1. Full-canvas background */}
      <rect x={0} y={0} width={800} height={600} fill="url(#bg-land)" />

      {/* 8. Rolling hills (behind districts) */}
      <ellipse cx={200} cy={320} rx={180} ry={60} fill="#7CB342" opacity={0.3} />
      <ellipse cx={500} cy={280} rx={200} ry={50} fill="#7CB342" opacity={0.3} />
      <ellipse cx={350} cy={420} rx={160} ry={45} fill="#7CB342" opacity={0.3} />
      <ellipse cx={120} cy={480} rx={140} ry={40} fill="#7CB342" opacity={0.3} />

      {/* 5. Mountain range across the top */}
      {/* Back row — taller */}
      <polygon points="40,160 100,40 160,160" fill="#78909C" />
      <polygon points="120,160 190,30 260,160" fill="#78909C" />
      <polygon points="220,160 300,25 380,160" fill="#78909C" />
      <polygon points="340,160 420,35 500,160" fill="#78909C" />
      <polygon points="440,160 520,45 600,160" fill="#78909C" />
      {/* Front row — shorter */}
      <polygon points="80,160 140,80 200,160" fill="#90A4AE" />
      <polygon points="200,160 270,70 340,160" fill="#90A4AE" />
      <polygon points="360,160 440,75 520,160" fill="#90A4AE" />
      {/* Snow caps on top 4 peaks */}
      <polygon points="100,40 85,70 115,70" fill="#ECEFF1" />
      <polygon points="190,30 173,62 207,62" fill="#ECEFF1" />
      <polygon points="300,25 282,58 318,58" fill="#ECEFF1" />
      <polygon points="420,35 403,65 437,65" fill="#ECEFF1" />

      {/* 4. River curving from top-center down to the east coast */}
      {/* Bank details — thinner parallel paths */}
      <path
        d="M400,0 Q380,120 420,220 Q460,320 500,400 Q540,480 620,520"
        fill="none"
        stroke="#81D4FA"
        strokeWidth={9}
        opacity={0.4}
      />
      <path
        d="M400,0 Q380,120 420,220 Q460,320 500,400 Q540,480 620,520"
        fill="none"
        stroke="#4FC3F7"
        strokeWidth={6}
      />
      <path
        d="M400,0 Q380,120 420,220 Q460,320 500,400 Q540,480 620,520"
        fill="none"
        stroke="#B3E5FC"
        strokeWidth={2}
        opacity={0.5}
      />

      {/* 2. Large blue water body — east coast */}
      <path
        d="M680,0 Q640,80 650,160 Q660,260 640,340 Q620,440 650,520 Q670,570 680,600 L800,600 L800,0 Z"
        fill="url(#water-grad)"
      />
      {/* Wave ripples */}
      <path
        d="M660,80 Q670,85 680,80 Q690,75 700,80"
        fill="none"
        stroke="#B3E5FC"
        strokeWidth={1.5}
        opacity={0.4}
      />
      <path
        d="M650,200 Q665,205 680,200 Q695,195 710,200"
        fill="none"
        stroke="#B3E5FC"
        strokeWidth={1.2}
        opacity={0.3}
      />
      <path
        d="M640,320 Q655,326 670,320 Q685,314 700,320"
        fill="none"
        stroke="#B3E5FC"
        strokeWidth={1.5}
        opacity={0.35}
      />
      <path
        d="M655,440 Q670,445 685,440 Q700,435 715,440"
        fill="none"
        stroke="#B3E5FC"
        strokeWidth={1}
        opacity={0.2}
      />
      <path
        d="M665,540 Q678,545 690,540 Q703,535 716,540"
        fill="none"
        stroke="#B3E5FC"
        strokeWidth={1.3}
        opacity={0.3}
      />

      {/* 3. Sandy beach strip between land and water */}
      <path
        d="M675,0 Q635,80 645,160 Q655,260 635,340 Q615,440 645,520 Q665,570 675,600 L680,600 Q670,570 650,520 Q620,440 640,340 Q660,260 650,160 Q640,80 680,0 Z"
        fill="#FFE0B2"
      />

      {/* 6. Forest area bottom-left */}
      {/* Trunks */}
      <rect x={58} y={510} width={3} height={12} fill="#5D4037" />
      <rect x={88} y={505} width={3} height={14} fill="#5D4037" />
      <rect x={118} y={515} width={3} height={10} fill="#5D4037" />
      <rect x={43} y={520} width={3} height={12} fill="#5D4037" />
      <rect x={138} y={518} width={3} height={11} fill="#5D4037" />
      {/* Canopy circles */}
      <circle cx={40} cy={500} r={14} fill="#2E7D32" />
      <circle cx={60} cy={495} r={16} fill="#388E3C" />
      <circle cx={80} cy={500} r={12} fill="#43A047" />
      <circle cx={95} cy={492} r={18} fill="#2E7D32" />
      <circle cx={115} cy={498} r={14} fill="#388E3C" />
      <circle cx={130} cy={505} r={10} fill="#43A047" />
      <circle cx={50} cy={510} r={15} fill="#388E3C" />
      <circle cx={70} cy={512} r={12} fill="#2E7D32" />
      <circle cx={105} cy={508} r={20} fill="#43A047" />
      <circle cx={140} cy={512} r={13} fill="#2E7D32" />
      <circle cx={25} cy={515} r={10} fill="#43A047" />
      <circle cx={155} cy={500} r={8} fill="#388E3C" />
      <circle cx={35} cy={490} r={11} fill="#2E7D32" />
      <circle cx={75} cy={488} r={9} fill="#43A047" />
      <circle cx={120} cy={490} r={15} fill="#388E3C" />

      {/* 7. Scattered individual trees */}
      <use href="#tree-sm" x={100} y={200} width={10} height={17} transform="translate(100,200) scale(0.9) translate(-100,-200)" />
      <use href="#tree-sm" x={680} y={150} width={10} height={17} transform="translate(680,150) scale(0.7) translate(-680,-150)" />
      <use href="#tree-sm" x={150} y={450} width={10} height={17} transform="translate(150,450) scale(1.1) translate(-150,-450)" />
      <use href="#tree-sm" x={250} y={350} width={10} height={17} transform="translate(250,350) scale(0.8) translate(-250,-350)" />
      <use href="#tree-sm" x={320} y={190} width={10} height={17} transform="translate(320,190) scale(1.0) translate(-320,-190)" />
      <use href="#tree-sm" x={550} y={250} width={10} height={17} transform="translate(550,250) scale(1.2) translate(-550,-250)" />
      <use href="#tree-sm" x={480} y={450} width={10} height={17} transform="translate(480,450) scale(0.7) translate(-480,-450)" />
      <use href="#tree-sm" x={200} y={280} width={10} height={17} transform="translate(200,280) scale(1.3) translate(-200,-280)" />
      <use href="#tree-sm" x={600} y={350} width={10} height={17} transform="translate(600,350) scale(0.9) translate(-600,-350)" />
      <use href="#tree-sm" x={350} y={480} width={10} height={17} transform="translate(350,480) scale(1.0) translate(-350,-480)" />
      <use href="#tree-sm" x={70} y={300} width={10} height={17} transform="translate(70,300) scale(0.8) translate(-70,-300)" />
      <use href="#tree-sm" x={500} y={180} width={10} height={17} transform="translate(500,180) scale(0.6) translate(-500,-180)" />
      <use href="#tree-sm" x={280} y={500} width={10} height={17} transform="translate(280,500) scale(1.1) translate(-280,-500)" />
      <use href="#tree-sm" x={420} y={320} width={10} height={17} transform="translate(420,320) scale(0.7) translate(-420,-320)" />
      <use href="#tree-sm" x={160} y={350} width={10} height={17} transform="translate(160,350) scale(1.2) translate(-160,-350)" />
      <use href="#tree-sm" x={570} y={480} width={10} height={17} transform="translate(570,480) scale(0.8) translate(-570,-480)" />
      <use href="#tree-sm" x={90} y={400} width={10} height={17} transform="translate(90,400) scale(1.0) translate(-90,-400)" />
      <use href="#tree-sm" x={450} y={150} width={10} height={17} transform="translate(450,150) scale(0.9) translate(-450,-150)" />
      <use href="#tree-sm" x={300} y={250} width={10} height={17} transform="translate(300,250) scale(0.6) translate(-300,-250)" />
      <use href="#tree-sm" x={620} y={450} width={10} height={17} transform="translate(620,450) scale(1.0) translate(-620,-450)" />
      <use href="#tree-sm" x={180} y={180} width={10} height={17} transform="translate(180,180) scale(0.8) translate(-180,-180)" />
      <use href="#tree-sm" x={530} y={380} width={10} height={17} transform="translate(530,380) scale(1.3) translate(-530,-380)" />
      <use href="#tree-sm" x={380} y={400} width={10} height={17} transform="translate(380,400) scale(0.7) translate(-380,-400)" />
      <use href="#tree-sm" x={230} y={430} width={10} height={17} transform="translate(230,430) scale(1.1) translate(-230,-430)" />
      <use href="#tree-sm" x={470} y={550} width={10} height={17} transform="translate(470,550) scale(0.9) translate(-470,-550)" />

      {/* 9. Warm sunlight overlay */}
      <rect x={0} y={0} width={800} height={600} fill="url(#sunlight)" />
    </g>
  );
}
