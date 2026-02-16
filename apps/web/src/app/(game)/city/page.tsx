'use client';

import { useState } from 'react';
import { CityMapV3 } from '@/components/map/city-map-v3';
import { DistrictPanel } from '@/components/district-panel';
import type { DistrictMeta } from '@/lib/districts';

export default function CityPage() {
  const [selected, setSelected] = useState<DistrictMeta | null>(null);

  const handleSelect = (district: DistrictMeta | null) => {
    // Toggle: clicking same district deselects
    if (district && selected?.code === district.code) {
      setSelected(null);
    } else {
      setSelected(district);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">City Board</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tap a district to scout the area.
        </p>
      </div>
      <div className="relative w-full">
        <CityMapV3 onDistrictSelect={handleSelect} selectedCode={selected?.code} />
        {/* Dossier overlay */}
        <div className="absolute top-3 right-14 z-10 w-[320px] max-h-[calc(100%-1.5rem)] overflow-y-auto hidden lg:block pointer-events-auto">
          {selected ? (
            <DistrictPanel district={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="rounded-xl bg-white/40 backdrop-blur-xl border border-white/20 p-4 text-center shadow-lg">
              <p className="text-sm text-muted-foreground">
                Select a district on the board
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Each zone has its own vibe, prices, and opportunities.
              </p>
            </div>
          )}
        </div>
        {/* Mobile: panel below map */}
        <div className="lg:hidden mt-3">
          {selected ? (
            <DistrictPanel district={selected} onClose={() => setSelected(null)} />
          ) : (
            <div className="rounded-xl glass-surface p-4 text-center">
              <p className="text-sm text-muted-foreground">
                Select a district on the board
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Each zone has its own vibe, prices, and opportunities.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
