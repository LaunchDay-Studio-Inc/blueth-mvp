import { GameShell } from '@/components/game-shell';
import { RequireAuth } from '@/components/require-auth';

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <GameShell>{children}</GameShell>
    </RequireAuth>
  );
}
