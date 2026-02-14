'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, type LucideIcon } from 'lucide-react';
import { formatBlueth, type VigorDimension } from '@blueth/core';
import { VIGOR_SHORT_LABELS, VIGOR_TEXT_COLORS } from '@/lib/constants';
import type { VigorKey } from '@blueth/core';

interface ActionCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  vigorCost?: Partial<VigorDimension>;
  moneyCostCents?: number;
  duration?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function ActionCard({
  title,
  description,
  icon: Icon,
  vigorCost,
  moneyCostCents,
  duration,
  disabled = false,
  loading = false,
  onClick,
  children,
  className,
}: ActionCardProps) {
  return (
    <Card className={cn('transition-colors hover:border-primary/50', disabled && 'opacity-60', className)}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {Icon && (
            <div className="rounded-md bg-primary/10 p-2 shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-sm">{title}</h3>
            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}

            <div className="flex flex-wrap gap-1.5 mt-2">
              {vigorCost && Object.entries(vigorCost).map(([key, val]) => (
                <Badge key={key} variant="outline" className="text-xs">
                  <span className={cn('mr-1', VIGOR_TEXT_COLORS[key as VigorKey])}>
                    {VIGOR_SHORT_LABELS[key as VigorKey]}
                  </span>
                  -{val}
                </Badge>
              ))}
              {moneyCostCents !== undefined && moneyCostCents > 0 && (
                <Badge variant="outline" className="text-xs">
                  {formatBlueth(moneyCostCents)}
                </Badge>
              )}
              {duration && (
                <Badge variant="secondary" className="text-xs">
                  {duration}
                </Badge>
              )}
            </div>

            {children}
          </div>

          {onClick && (
            <Button size="sm" onClick={onClick} disabled={disabled || loading} className="shrink-0">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Go'}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
