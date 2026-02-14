'use client';

import { useSubmitAction } from '@/hooks/use-submit-action';
import { ActionCard } from '@/components/action-card';
import { Smile, Users } from 'lucide-react';

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

      <div className="grid gap-3">
        <ActionCard
          title="Leisure Activity"
          description="Relax and unwind. Restores MV and SPV over time."
          icon={Smile}
          vigorCost={{ mv: 2, pv: 1 }}
          duration="1h action + 3h buff"
          loading={submitAction.isPending}
          onClick={handleLeisure}
        >
          <p className="text-xs text-green-600 mt-1">
            Instant: MV +4, SPV +2 | Buff: MV +1/hr, SPV +0.5/hr for 3h
          </p>
        </ActionCard>

        <ActionCard
          title="Social Call"
          description="Visit a friend for a quick social boost."
          icon={Users}
          duration="15m action"
          loading={submitAction.isPending}
          onClick={handleSocialCall}
        >
          <p className="text-xs text-green-600 mt-1">
            Instant: SV +3, MV +1
          </p>
        </ActionCard>
      </div>
    </div>
  );
}
