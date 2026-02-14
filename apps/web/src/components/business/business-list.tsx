'use client';

import type { Business } from '@/hooks/use-business';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Building2, Plus } from 'lucide-react';

interface BusinessListProps {
  businesses: Business[];
  selectedId: string;
  onSelect: (id: string) => void;
  onRegister: () => void;
}

export function BusinessList({ businesses, selectedId, onSelect, onRegister }: BusinessListProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Your Businesses</CardTitle>
          <Button size="sm" variant="outline" onClick={onRegister}>
            <Plus className="h-3 w-3 mr-1" />New
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {businesses.length === 0 ? (
          <p className="text-sm text-muted-foreground p-3">No businesses yet</p>
        ) : (
          <div className="space-y-0.5">
            {businesses.map((biz) => (
              <button
                key={biz.id}
                onClick={() => onSelect(biz.id)}
                className={cn(
                  'w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                  selectedId === biz.id
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'hover:bg-accent text-foreground',
                )}
              >
                <div className="flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate">{biz.name}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 ml-5">
                  {biz.districtCode.replace(/_/g, ' ')}
                </p>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
