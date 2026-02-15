'use client';

import { useAuth } from '@/lib/auth-context';
import { useSubmitAction } from '@/hooks/use-submit-action';
import { ActionCard } from '@/components/action-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  JOBS_CATALOG,
  SHIFT_VIGOR_COSTS,
  SHIFT_HOURS,
  calculateShiftPay,
  calculatePerformance,
  canAffordVigorCost,
  GIGS_CATALOG,
  getGigVigorCost,
  calculateGigPay,
  GIG_DIMINISH_THRESHOLD,
  type ShiftDuration,
  type VigorDimension,
} from '@blueth/core';
import { Briefcase, Zap, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const SHIFTS: ShiftDuration[] = ['short', 'full'];

export default function JobsPage() {
  const { user } = useAuth();
  const submitAction = useSubmitAction();

  if (!user) {
    return <Skeleton className="h-96 w-full" />;
  }

  const vigor = user.vigor as VigorDimension;

  function handleWork(jobFamily: string, shift: ShiftDuration) {
    submitAction.mutate({
      type: 'WORK_SHIFT',
      payload: { jobFamily, duration: shift },
    });
  }

  function handleGig(gigId: string) {
    submitAction.mutate({
      type: 'GIG_JOB',
      payload: { gigId },
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Job Center</h1>
      <p className="text-sm text-muted-foreground">
        Choose a job and shift duration. Pay depends on your skills and vigor.
      </p>

      <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Clicking <strong>Go</strong> queues the action. Pay and vigor costs apply when it
          completes. Check the Queue in the top bar to track progress.
        </span>
      </div>

      {/* ── Gig Board ── */}
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2 mb-1">
          <Zap className="h-5 w-5 text-primary" />
          Gig Board
        </h2>
        <p className="text-xs text-muted-foreground mb-3">
          Quick 10-minute tasks. Better hourly rate for active players. Returns diminish after {GIG_DIMINISH_THRESHOLD} gigs/day.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {GIGS_CATALOG.map((gig) => {
            const skill = user.skills[gig.family] ?? 0.1;
            const perf = calculatePerformance(gig.family, skill, vigor);
            const vigorCost = getGigVigorCost(gig.family);
            const estPay = calculateGigPay(gig.baseWageDaily, perf, 0);

            return (
              <ActionCard
                key={gig.id}
                title={gig.label}
                description={`${gig.family} gig`}
                icon={Zap}
                vigorCost={vigorCost}
                moneyGainCents={estPay}
                duration="10 min"
                loading={submitAction.isPending}
                onClick={() => handleGig(gig.id)}
              />
            );
          })}
        </div>
      </div>

      {/* ── Standard Jobs ── */}
      <h2 className="text-lg font-semibold">Available Jobs</h2>

      <div className="grid gap-4">
        {JOBS_CATALOG.map((job) => {
          const skill = user.skills[job.family] ?? 0.1;
          const perf = calculatePerformance(job.family, skill, vigor);

          return (
            <Card key={job.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{job.name}</CardTitle>
                  <Badge variant="secondary">{job.family}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{job.description}</p>
                <p className="text-xs text-muted-foreground">
                  Skill: {job.family} ({skill.toFixed(2)}) | Performance: {(perf * 100).toFixed(0)}%
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2">
                  {SHIFTS.map((shift) => {
                    const vigorCost = SHIFT_VIGOR_COSTS[job.family][shift];
                    const hours = SHIFT_HOURS[shift];
                    const pay = calculateShiftPay(job.baseWageDaily, perf, shift);
                    const affordable = canAffordVigorCost(vigor, vigorCost);

                    return (
                      <ActionCard
                        key={shift}
                        title={`${shift === 'short' ? 'Short' : 'Full'} Shift`}
                        description={`${hours}h — Completes in ${hours} hour${hours > 1 ? 's' : ''}`}
                        icon={Briefcase}
                        vigorCost={vigorCost}
                        moneyGainCents={pay}
                        duration={`${hours}h`}
                        disabled={!affordable}
                        loading={submitAction.isPending}
                        onClick={() => handleWork(job.family, shift)}
                      >
                        {!affordable && (
                          <p className="text-xs text-destructive mt-1">Not enough vigor</p>
                        )}
                      </ActionCard>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
