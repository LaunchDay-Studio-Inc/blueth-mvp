'use client';

import { useState } from 'react';
import { CityMap } from '@/components/city-map';
import { DistrictPanel } from '@/components/district-panel';
import type { DistrictMeta } from '@/lib/districts';

export default function CityPage() {
  const [selected, setSelected] = useState<DistrictMeta | null>(null);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">City Map</h1>
      <p className="text-sm text-muted-foreground">
        Click a district to see available locations and actions.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <CityMap onDistrictSelect={setSelected} selectedCode={selected?.code} />
        </div>
        <div>
          {selected ? (
            <DistrictPanel district={selected} />
          ) : (
            <div className="text-sm text-muted-foreground p-4 border rounded-lg text-center">
              Select a district on the map
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
