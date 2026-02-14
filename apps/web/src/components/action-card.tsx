'use client';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, Clock, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react';
import { formatBlueth, type VigorDimension } from '@blueth/core';
import { VIGOR_SHORT_LABELS, VIGOR_TEXT_COLORS } from '@/lib/constants';
import type { VigorKey } from '@blueth/core';
import type { ActionProjection } from '@/hooks/use-action-preview';

interface ActionCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  vigorCost?: Partial<VigorDimension>;
  moneyGainCents?: number;
  moneyCostCents?: number;
  duration?: string;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
  /** Projected outcomes from the preview API. */
  projection?: ActionProjection | null;
}

export function ActionCard({
  title,
  description,
  icon: Icon,
  vigorCost,
  moneyGainCents,
  moneyCostCents,
  duration,
  disabled = false,
  loading = false,
  onClick,
  children,
  className,
  projection,
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
                  <TrendingDown className="h-3 w-3 mr-1 inline" />
                  {formatBlueth(moneyCostCents)}
                </Badge>
              )}
              {moneyGainCents !== undefined && moneyGainCents > 0 && (
                <Badge variant="outline" className="text-xs text-green-600">
                  <TrendingUp className="h-3 w-3 mr-1 inline" />
                  +{formatBlueth(moneyGainCents)}
                </Badge>
              )}
              {duration && (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="h-3 w-3 mr-1 inline" />
                  {duration}
                </Badge>
              )}
            </div>

            {/* Projected outcomes */}
            {projection && (
              <div className="mt-2 space-y-1">
                {/* Projected vigor delta */}
                {Object.keys(projection.vigorDelta).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(projection.vigorDelta).map(([key, val]) => (
                      <span key={key} className={cn('text-xs', val && val > 0 ? 'text-green-600' : 'text-red-500')}>
                        {VIGOR_SHORT_LABELS[key as VigorKey]} {val && val > 0 ? '+' : ''}{Math.round(val ?? 0)}
                      </span>
                    ))}
                  </div>
                )}

                {/* Projected completion time */}
                {projection.durationSeconds > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Completes: {new Date(projection.completionTime).toLocaleTimeString()}
                  </p>
                )}

                {/* Projected money */}
                {projection.moneyGainCents > 0 && (
                  <p className="text-xs text-green-600">
                    Est. earnings: {formatBlueth(projection.moneyGainCents)}
                  </p>
                )}

                {/* Warnings */}
                {projection.warnings.length > 0 && (
                  <div className="mt-1">
                    {projection.warnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-600 flex items-start gap-1">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        {w}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

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
