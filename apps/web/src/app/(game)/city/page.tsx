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
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">City Board</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tap a district to scout the area.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CityMapV3 onDistrictSelect={handleSelect} selectedCode={selected?.code} />
        </div>
        <div>
          {selected ? (
            <DistrictPanel district={selected} />
          ) : (
            <div className="rounded-xl glass-surface p-6 text-center">
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
