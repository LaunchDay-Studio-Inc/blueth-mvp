'use client';

import { useSubmitAction } from '@/hooks/use-submit-action';
import { ActionCard } from '@/components/action-card';
import { Smile, Users, Info } from 'lucide-react';

export default function LeisurePage() {
  const submitAction = useSubmitAction();

  function handleLeisure() {
    submitAction.mutate({ type: 'LEISURE' });
  }

  function handleSocialCall() {
    submitAction.mutate({ type: 'SOCIAL_CALL' });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leisure</h1>
      <p className="text-sm text-muted-foreground">
        Take a break to restore your mental and spiritual vigor.
      </p>

      <div className="flex items-start gap-2 p-3 rounded-md bg-muted text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" />
        <span>
          Effects apply when the action completes (after the duration elapses).
          Track progress in the Queue dropdown at the top.
        </span>
      </div>

      <div className="grid gap-3">
        <ActionCard
          title="Leisure Activity"
          description="Relax and unwind — completes in 1 hour."
          icon={Smile}
          vigorCost={{ mv: 2, pv: 1 }}
          duration="1h"
          loading={submitAction.isPending}
          onClick={handleLeisure}
        >
          <div className="mt-1 space-y-0.5">
            <p className="text-xs text-green-600">
              On completion: MV +4, SPV +2
            </p>
            <p className="text-xs text-blue-600">
              Buff (3h): MV +1/hr, SPV +0.5/hr
            </p>
          </div>
        </ActionCard>

        <ActionCard
          title="Social Call"
          description="Visit a friend for a quick social boost — completes in 15 minutes."
          icon={Users}
          duration="15m"
          loading={submitAction.isPending}
          onClick={handleSocialCall}
        >
          <p className="text-xs text-green-600 mt-1">
            On completion: SV +3, MV +1
          </p>
        </ActionCard>
      </div>
    </div>
  );
}
