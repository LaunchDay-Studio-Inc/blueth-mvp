'use client';

export function CitySkyline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1200 300"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Window glow */}
        <filter id="window-glow">
          <feGaussianBlur stdDeviation="1.5" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* Building gradient */}
        <linearGradient id="bldg-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(220 30% 16%)" />
          <stop offset="100%" stopColor="hsl(222 40% 8%)" />
        </linearGradient>
        <linearGradient id="bldg-grad-2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(220 25% 14%)" />
          <stop offset="100%" stopColor="hsl(222 35% 7%)" />
        </linearGradient>
      </defs>

      {/* Far background buildings */}
      <g opacity="0.3">
        <rect x="50" y="120" width="60" height="180" fill="url(#bldg-grad-2)" />
        <rect x="140" y="100" width="40" height="200" fill="url(#bldg-grad-2)" />
        <rect x="200" y="140" width="50" height="160" fill="url(#bldg-grad-2)" />
        <rect x="350" y="90" width="45" height="210" fill="url(#bldg-grad-2)" />
        <rect x="750" y="110" width="55" height="190" fill="url(#bldg-grad-2)" />
        <rect x="900" y="130" width="40" height="170" fill="url(#bldg-grad-2)" />
        <rect x="1050" y="100" width="50" height="200" fill="url(#bldg-grad-2)" />
      </g>

      {/* Mid buildings */}
      <g opacity="0.6">
        <rect x="80" y="150" width="70" height="150" fill="url(#bldg-grad)" />
        <rect x="170" y="110" width="55" height="190" fill="url(#bldg-grad)" />
        <rect x="260" y="130" width="65" height="170" fill="url(#bldg-grad)" />
        <rect x="440" y="100" width="50" height="200" fill="url(#bldg-grad)" />
        <rect x="510" y="140" width="60" height="160" fill="url(#bldg-grad)" />
        <rect x="620" y="120" width="45" height="180" fill="url(#bldg-grad)" />
        <rect x="830" y="105" width="55" height="195" fill="url(#bldg-grad)" />
        <rect x="960" y="140" width="50" height="160" fill="url(#bldg-grad)" />
        <rect x="1080" y="125" width="60" height="175" fill="url(#bldg-grad)" />
      </g>

      {/* Foreground buildings */}
      <g>
        {/* Tall tower left */}
        <rect x="100" y="60" width="45" height="240" fill="hsl(220 30% 12%)" />
        <rect x="107" y="50" width="31" height="10" fill="hsl(220 25% 15%)" />
        {/* Antenna */}
        <line x1="122" y1="20" x2="122" y2="50" stroke="hsl(220 20% 20%)" strokeWidth="2" />
        <circle cx="122" cy="18" r="3" fill="hsl(192 91% 52%)" filter="url(#window-glow)" opacity="0.8" className="animate-pulse-neon" />

        {/* Wide building */}
        <rect x="160" y="100" width="80" height="200" fill="hsl(222 35% 10%)" />
        <rect x="165" y="92" width="70" height="8" fill="hsl(220 30% 13%)" />

        {/* Skyscraper center-left */}
        <rect x="280" y="40" width="50" height="260" fill="hsl(220 28% 11%)" />
        <polygon points="280,40 305,15 330,40" fill="hsl(220 25% 14%)" />

        {/* CBD tower */}
        <rect x="380" y="30" width="55" height="270" fill="hsl(222 32% 10%)" />
        <rect x="387" y="22" width="41" height="8" fill="hsl(220 28% 13%)" />
        <line x1="407" y1="0" x2="407" y2="22" stroke="hsl(220 20% 18%)" strokeWidth="2" />
        <circle cx="407" cy="0" r="2.5" fill="hsl(0 80% 55%)" filter="url(#window-glow)" className="animate-pulse-neon" />

        {/* Mid tower */}
        <rect x="460" y="80" width="60" height="220" fill="hsl(220 30% 11%)" />

        {/* Tech park tower */}
        <rect x="560" y="50" width="48" height="250" fill="hsl(222 30% 10%)" />
        <rect x="566" y="42" width="36" height="8" fill="hsl(220 25% 13%)" />

        {/* Right side buildings */}
        <rect x="660" y="90" width="65" height="210" fill="hsl(222 33% 11%)" />
        <rect x="760" y="70" width="50" height="230" fill="hsl(220 28% 10%)" />
        <line x1="785" y1="40" x2="785" y2="70" stroke="hsl(220 20% 18%)" strokeWidth="2" />
        <circle cx="785" cy="38" r="2.5" fill="hsl(192 91% 52%)" filter="url(#window-glow)" opacity="0.6" className="animate-pulse-neon" />

        <rect x="850" y="110" width="55" height="190" fill="hsl(222 30% 11%)" />
        <rect x="940" y="60" width="45" height="240" fill="hsl(220 32% 10%)" />
        <rect x="1020" y="100" width="70" height="200" fill="hsl(222 28% 11%)" />
        <rect x="1120" y="75" width="50" height="225" fill="hsl(220 30% 10%)" />
      </g>

      {/* Windows – scattered neon rectangles */}
      <g filter="url(#window-glow)" opacity="0.7">
        {/* Tower 1 windows */}
        <rect x="110" y="80" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="120" y="80" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="110" y="100" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="130" y="120" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="115" y="150" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="125" y="170" width="4" height="3" fill="hsl(38 90% 60%)" />

        {/* Wide building windows */}
        <rect x="175" y="120" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="195" y="120" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="215" y="120" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="185" y="145" width="4" height="3" fill="hsl(38 90% 60%)" />
        <rect x="205" y="145" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="175" y="170" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="195" y="195" width="4" height="3" fill="hsl(192 80% 60%)" />

        {/* Skyscraper windows */}
        <rect x="295" y="60" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="310" y="60" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="290" y="90" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="305" y="120" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="315" y="150" width="4" height="3" fill="hsl(38 90% 60%)" />
        <rect x="295" y="180" width="4" height="3" fill="hsl(50 80% 70%)" />

        {/* CBD tower windows */}
        <rect x="395" y="50" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="410" y="50" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="420" y="80" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="400" y="110" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="390" y="140" width="4" height="3" fill="hsl(38 90% 60%)" />
        <rect x="415" y="170" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="395" y="200" width="4" height="3" fill="hsl(50 80% 70%)" />

        {/* Mid tower windows */}
        <rect x="475" y="100" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="495" y="100" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="480" y="140" width="4" height="3" fill="hsl(38 90% 60%)" />
        <rect x="500" y="170" width="4" height="3" fill="hsl(50 80% 70%)" />

        {/* Tech park tower */}
        <rect x="575" y="70" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="590" y="100" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="575" y="130" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="585" y="160" width="4" height="3" fill="hsl(38 90% 60%)" />

        {/* Right buildings */}
        <rect x="675" y="110" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="695" y="140" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="775" y="90" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="770" y="130" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="865" y="130" width="4" height="3" fill="hsl(38 90% 60%)" />
        <rect x="880" y="160" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="955" y="80" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="950" y="120" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="1040" y="120" width="4" height="3" fill="hsl(192 80% 60%)" />
        <rect x="1060" y="150" width="4" height="3" fill="hsl(38 90% 60%)" />
        <rect x="1135" y="95" width="4" height="3" fill="hsl(50 80% 70%)" />
        <rect x="1140" y="130" width="4" height="3" fill="hsl(192 80% 60%)" />
      </g>

      {/* Ground line glow */}
      <line x1="0" y1="299" x2="1200" y2="299" stroke="hsl(192 91% 52%)" strokeWidth="1" opacity="0.3" />
    </svg>
  );
}
