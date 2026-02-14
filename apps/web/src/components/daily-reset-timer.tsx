'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';

function formatCountdown(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

/**
 * Displays current local time and a countdown to the daily reset (midnight).
 * Updates every second.
 */
export function DailyResetTimer() {
  const { user } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState(user?.secondsUntilDailyReset ?? 0);

  useEffect(() => {
    if (user?.secondsUntilDailyReset != null) {
      setSecondsLeft(user.secondsUntilDailyReset);
    }
  }, [user?.secondsUntilDailyReset]);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!user) return null;

  const localTime = user.localTime
    ? new Date(user.localTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '--:--';

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Clock className="h-3.5 w-3.5" />
      <span>{localTime}</span>
      <span className="text-muted-foreground/60">|</span>
      <span>Reset in {formatCountdown(secondsLeft)}</span>
    </div>
  );
}
