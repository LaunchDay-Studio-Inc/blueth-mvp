import { GameShell } from '@/components/game-shell';
import { RequireAuth } from '@/components/require-auth';
import { DevDebugPanel } from '@/components/dev-debug-panel';

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <GameShell>{children}</GameShell>
      <DevDebugPanel />
    </RequireAuth>
  );
}
