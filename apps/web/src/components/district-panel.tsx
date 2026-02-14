'use client';

import type { DistrictMeta } from '@/lib/districts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MapPin } from 'lucide-react';

interface DistrictPanelProps {
  district: DistrictMeta;
}

export function DistrictPanel({ district }: DistrictPanelProps) {
  const modifierLabel =
    district.modifier === 1.0
      ? 'Base'
      : district.modifier > 1.0
        ? `+${Math.round((district.modifier - 1) * 100)}%`
        : `${Math.round((district.modifier - 1) * 100)}%`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{district.name}</CardTitle>
          <Badge variant={district.modifier > 1.0 ? 'default' : district.modifier < 1.0 ? 'secondary' : 'outline'}>
            {modifierLabel} prices
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{district.description}</p>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Locations</p>
          <div className="space-y-1.5">
            {district.locations.map((loc) => (
              <div key={loc} className="flex items-center gap-2 text-sm">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{loc}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">
            Price modifier: {district.modifier}x base price
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
