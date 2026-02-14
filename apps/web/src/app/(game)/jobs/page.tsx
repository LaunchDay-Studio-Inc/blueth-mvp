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
  formatBlueth,
  type ShiftDuration,
  type VigorDimension,
} from '@blueth/core';
import { Briefcase } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const SHIFTS: ShiftDuration[] = ['short', 'full'];

export default function JobsPage() {
  const { user } = useAuth();
  const submitAction = useSubmitAction();

  if (!user) {
    return <Skeleton className="h-96 w-full" />;
  }

  const vigor = user.vigor as VigorDimension;

  function handleWork(jobId: string, shift: ShiftDuration) {
    submitAction.mutate({
      type: 'WORK_SHIFT',
      payload: { jobId, shiftDuration: shift },
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Job Center</h1>
      <p className="text-sm text-muted-foreground">
        Choose a job and shift duration. Pay depends on your skills and vigor.
      </p>

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
                        description={`${hours}h — Est. pay: ${formatBlueth(pay)}`}
                        icon={Briefcase}
                        vigorCost={vigorCost}
                        duration={`${hours}h`}
                        disabled={!affordable}
                        loading={submitAction.isPending}
                        onClick={() => handleWork(job.id, shift)}
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
