'use client';

import { useMemo } from 'react';
import type { VigorKey } from '@blueth/core';
import { computeRegenBreakdown, getHousingTier } from '@blueth/core';
import type { PlayerStateData } from '@/lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { NeonChip } from '@/components/ui/neon-chip';
import { Progress } from '@/components/ui/progress';
import { Clock, Lightbulb } from 'lucide-react';

const VIGOR_LABELS: Record<VigorKey, string> = {
  pv: 'Physical Vigor',
  mv: 'Mental Vigor',
  sv: 'Social Vigor',
  cv: 'Creative Vigor',
  spv: 'Spiritual Vigor',
};

const PERIOD_LABELS: Record<string, string> = {
  morning: 'Morning (06–12)',
  afternoon: 'Afternoon (12–18)',
  evening: 'Evening (18–00)',
  night: 'Night (00–06)',
};

const IMPROVEMENT_TIPS: Record<VigorKey, string[]> = {
  pv: [
    'Eat a meal — even street food gives +2 PV/hr',
    'Upgrade housing for passive PV regen bonus',
    'Sleep during night for ×2.0 PV regen',
  ],
  mv: [
    'Sleep — MV gets a ×1.2 boost while sleeping',
    'Morning is peak MV regen (×1.5)',
    'Visit a library or café for a leisure buff',
  ],
  sv: [
    'Visit leisure venues for a social buff',
    'Try the social call action for instant SV',
    'Afternoon is peak SV regen (×1.5)',
  ],
  cv: [
    'Afternoon is peak CV regen (×1.5)',
    'Housing tier 3+ adds MV bonus (fuels creativity)',
    'Creative leisure activities boost CV',
  ],
  spv: [
    'Evening is peak SPV regen (×1.5)',
    'Spiritual leisure activities give SPV buffs',
    'Keep SPV above 50 to avoid global regen penalty',
  ],
};

interface StatDetailModalProps {
  dimension: VigorKey | null;
  onClose: () => void;
  user: PlayerStateData;
}

function formatRate(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}/hr`;
}

function formatMultiplier(n: number): string {
  return `×${n.toFixed(2)}`;
}

function formatRemainingTime(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function StatDetailModal({ dimension, onClose, user }: StatDetailModalProps) {
  const breakdown = useMemo(() => {
    if (!dimension) return null;
    return computeRegenBreakdown(
      user.vigor as { pv: number; mv: number; sv: number; cv: number; spv: number },
      user.sleepState as 'awake' | 'sleeping' | 'exhausted',
      user.activeBuffs.map((b) => ({
        ...b,
        source: b.source as 'MEAL' | 'LEISURE' | 'SOCIAL_CALL' | 'PENALTY',
        perHourBonusByDim: b.perHourBonusByDim as Partial<{ pv: number; mv: number; sv: number; cv: number; spv: number }>,
      })),
      user.mealPenaltyLevel,
      user.housingTier,
      user.localTime || new Date().toISOString(),
      user.timezone || 'UTC',
    );
  }, [dimension, user]);

  if (!dimension || !breakdown) return null;

  const dim = breakdown.perDim[dimension];
  const value = Math.round(user.vigor[dimension]);
  const cap = user.caps[`${dimension}_cap` as keyof typeof user.caps];
  const pct = cap > 0 ? (value / cap) * 100 : 0;
  const housing = getHousingTier(user.housingTier);

  const penaltyNote =
    user.mealPenaltyLevel === 0
      ? 'Well-fed'
      : user.mealPenaltyLevel === 1
        ? '2 meals yesterday'
        : user.mealPenaltyLevel === 2
          ? '1 meal yesterday'
          : '0 meals yesterday';

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="glass-elevated border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {VIGOR_LABELS[dimension]}
            <Badge variant="outline" className="text-[10px] font-mono uppercase">
              {dimension.toUpperCase()}
            </Badge>
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>{value} / {cap}</span>
                <span className="text-muted-foreground">{Math.round(pct)}%</span>
              </div>
              <Progress value={pct} className="h-2" />
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Net regen rate */}
        <div className="text-center py-2">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">
            Current Regen Rate
          </p>
          <p className={`text-2xl font-bold font-mono ${dim.netPerHour >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatRate(dim.netPerHour)}
          </p>
        </div>

        {/* Breakdown table */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">Breakdown</p>

          <Row label="Base regen" chip={formatRate(dim.baseRate)} variant="info" />

          <Row
            label="Housing bonus"
            chip={dim.housingBonus > 0 ? formatRate(dim.housingBonus) : 'none'}
            variant={dim.housingBonus > 0 ? 'buff' : 'info'}
            note={housing.name}
          />

          <Row
            label="Circadian"
            chip={formatMultiplier(dim.circadianMultiplier)}
            variant={dim.circadianMultiplier > 1 ? 'buff' : dim.circadianMultiplier < 1 ? 'cost' : 'info'}
            note={PERIOD_LABELS[dim.circadianPeriod]}
            icon={<Clock className="h-3 w-3" />}
          />

          <Row
            label="Sleep modifier"
            chip={formatMultiplier(dim.sleepMultiplier)}
            variant={dim.sleepMultiplier > 1 ? 'buff' : 'info'}
            note={user.sleepState === 'sleeping' ? 'Sleeping' : 'Awake'}
          />

          <Row
            label="Meal penalty"
            chip={formatMultiplier(dim.penaltyMultiplier)}
            variant={dim.penaltyMultiplier < 1 ? 'cost' : 'info'}
            note={penaltyNote}
          />

          <Row
            label="SPV regen penalty"
            chip={formatMultiplier(dim.spvRegenMultiplier)}
            variant={dim.spvRegenMultiplier < 1 ? 'warning' : 'info'}
            note={dim.spvRegenMultiplier < 1 ? 'Low spirituality' : undefined}
          />

          {dim.buffBonus > 0 && (
            <Row
              label="Buff bonus"
              chip={formatRate(dim.buffBonus)}
              variant="buff"
              note={breakdown.activeBuffDetails
                .filter((b) => (b.perHourBonusByDim[dimension] ?? 0) > 0)
                .map((b) => `${b.source} (${formatRemainingTime(b.remainingMs)})`)
                .join(', ')}
            />
          )}

          {dim.cascadeDrain > 0 && (
            <Row
              label="Cascade drain"
              chip={`-${dim.cascadeDrain.toFixed(2)}/hr`}
              variant="cost"
              note={breakdown.criticalDims.map((k) => `${k.toUpperCase()} < 20`).join(', ')}
            />
          )}
        </div>

        {/* Tips */}
        <div className="space-y-1.5 pt-2 border-t border-border/30">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1">
            <Lightbulb className="h-3 w-3" /> How to Improve
          </p>
          {IMPROVEMENT_TIPS[dimension].map((tip, i) => (
            <p key={i} className="text-xs text-foreground/70 pl-4">• {tip}</p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  label,
  chip,
  variant,
  note,
  icon,
}: {
  label: string;
  chip: string;
  variant: 'buff' | 'cost' | 'info' | 'warning';
  note?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-foreground/80 flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <div className="flex items-center gap-2">
        {note && <span className="text-[10px] text-muted-foreground hidden sm:block">{note}</span>}
        <NeonChip variant={variant}>{chip}</NeonChip>
      </div>
    </div>
  );
}
