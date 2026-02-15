'use client';

import { useState } from 'react';
import { CityMap } from '@/components/city-map';
import { DistrictPanel } from '@/components/district-panel';
import type { DistrictMeta } from '@/lib/districts';

export default function CityPage() {
  const [selected, setSelected] = useState<DistrictMeta | null>(null);

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
          <CityMap onDistrictSelect={setSelected} selectedCode={selected?.code} />
        </div>
        <div>
          {selected ? (
            <DistrictPanel district={selected} />
          ) : (
            <div className="rounded-xl border border-border/30 bg-card/40 backdrop-blur-sm p-6 text-center">
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
