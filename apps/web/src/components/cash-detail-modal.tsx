'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { getDailyRent, getDailyUtilities, getDailyHousingCost, getHousingTier, formatBlueth } from '@blueth/core';
import type { PlayerStateData } from '@/lib/auth-context';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { NeonChip } from '@/components/ui/neon-chip';
import { Wallet, Clock } from 'lucide-react';

interface CashDetailModalProps {
  open: boolean;
  onClose: () => void;
  user: PlayerStateData;
}

export function CashDetailModal({ open, onClose, user }: CashDetailModalProps) {
  const data = useMemo(() => {
    const housing = getHousingTier(user.housingTier);
    const rentCents = getDailyRent(user.housingTier);
    const utilitiesCents = getDailyUtilities(user.housingTier);
    const dailyBurnCents = getDailyHousingCost(user.housingTier);
    const runwayDays = dailyBurnCents > 0 ? Math.floor(user.balanceCents / dailyBurnCents) : Infinity;

    return { housing, rentCents, utilitiesCents, dailyBurnCents, runwayDays };
  }, [user.housingTier, user.balanceCents]);

  const runwayColor =
    data.runwayDays === Infinity
      ? 'text-green-400'
      : data.runwayDays > 7
        ? 'text-green-400'
        : data.runwayDays >= 3
          ? 'text-yellow-400'
          : 'text-red-400';

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="glass-elevated border-border/50">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4" />
            Cash Balance
          </DialogTitle>
          <DialogDescription asChild>
            <div>
              <p className={`text-2xl font-bold font-mono ${user.balanceCents >= 0 ? 'text-foreground' : 'text-red-400'}`}>
                {user.balanceFormatted}
              </p>
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* Daily Burn */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Daily Burn
          </p>

          <BurnRow label="Rent" amount={data.rentCents} note={data.housing.name} />
          <BurnRow label="Utilities" amount={data.utilitiesCents} />

          <div className="flex items-center justify-between py-1 border-t border-border/20">
            <span className="text-xs font-medium text-foreground">Total</span>
            <NeonChip variant="cost">{formatBlueth(data.dailyBurnCents)}/day</NeonChip>
          </div>
        </div>

        {/* Runway */}
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" /> Runway
          </p>
          <p className={`text-lg font-bold font-mono ${runwayColor}`}>
            {data.runwayDays === Infinity ? '∞' : data.runwayDays} {data.runwayDays === 1 ? 'day' : 'days'}
          </p>
          <p className="text-[10px] text-muted-foreground">at current daily burn</p>
        </div>

        {/* Recent Transactions placeholder */}
        <div className="space-y-1.5 pt-2 border-t border-border/30">
          <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
            Recent Transactions
          </p>
          <p className="text-xs text-muted-foreground/60 italic py-2">
            Transaction history coming soon.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" asChild className="w-full sm:w-auto">
            <Link href="/wallet">View Full Wallet</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BurnRow({
  label,
  amount,
  note,
}: {
  label: string;
  amount: number;
  note?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-foreground/80">{label}</span>
      <div className="flex items-center gap-2">
        {note && <span className="text-[10px] text-muted-foreground">{note}</span>}
        <span className="text-xs font-mono text-foreground/70">{formatBlueth(amount)}/day</span>
      </div>
    </div>
  );
}
