'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useActionQueue, type ActionQueueItem } from '@/hooks/use-action-queue';
import { useActionHistory } from '@/hooks/use-action-history';
import { extractActionDeltas, formatDeltaSummary } from '@/lib/action-results';
import { queryKeys } from '@/lib/queries';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { NeonChip } from '@/components/ui/neon-chip';
import {
  Clock, CheckCircle2, Loader2, AlertCircle, ListTodo, ChevronDown,
} from 'lucide-react';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  scheduled: <Clock className="h-3.5 w-3.5 text-blue-500" />,
  running: <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  failed: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
};

function formatActionType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function computeEndIso(item: ActionQueueItem): string {
  const startMs = new Date(item.scheduled_for).getTime();
  return new Date(startMs + item.duration_seconds * 1000).toISOString();
}

/* ── ActionTimer ──────────────────────────────────── */

function ActionTimer({
  item,
  onComplete,
}: {
  item: ActionQueueItem;
  onComplete: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const firedRef = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Reset the fired flag when a new item starts
  useEffect(() => {
    firedRef.current = false;
  }, [item.action_id]);

  const startMs = new Date(item.scheduled_for).getTime();
  const durationMs = item.duration_seconds * 1000;
  const endMs = startMs + durationMs;
  const elapsedMs = now - startMs;
  const remainingS = Math.max(0, Math.ceil((endMs - now) / 1000));
  const pct = durationMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100)) : 100;
  const endsAtStr = formatTime(new Date(endMs).toISOString());

  useEffect(() => {
    if (remainingS === 0 && !firedRef.current) {
      firedRef.current = true;
      onComplete();
    }
  }, [remainingS, onComplete]);

  return (
    <div className="space-y-1 w-full mt-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-amber-600 font-mono">
          {formatDuration(remainingS)} left
        </span>
        <span className="text-muted-foreground text-[10px]">
          ends {endsAtStr} · {Math.round(pct)}%
        </span>
      </div>
      <Progress value={pct} className="h-1.5" indicatorClassName="bg-amber-500" />
    </div>
  );
}

/* ── ActionQueueDropdown ──────────────────────────── */

export function ActionQueueDropdown() {
  const queryClient = useQueryClient();
  const [hasRunning, setHasRunning] = useState(false);
  const { data: queue, isLoading } = useActionQueue(hasRunning);
  const { data: history } = useActionHistory();
  const [open, setOpen] = useState(false);

  const items = queue || [];
  const running = items.find((i) => i.status === 'running');
  const pending = items.filter((i) => i.status === 'pending' || i.status === 'scheduled');
  const activeCount = pending.length + (running ? 1 : 0);

  // Dynamic polling speed
  useEffect(() => {
    setHasRunning(!!running);
  }, [running]);

  // Auto-refetch when timer completes
  const handleTimerComplete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.actions.all });
    void queryClient.invalidateQueries({ queryKey: queryKeys.player.all });
  }, [queryClient]);

  // Last 5 completed/failed from history
  const recentHistory = (history || []).slice(0, 5);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 min-h-[44px] min-w-[44px]"
        onClick={() => setOpen(!open)}
      >
        <ListTodo className="h-4 w-4" />
        <span className="hidden sm:inline text-xs">Queue</span>
        {activeCount > 0 && (
          <Badge variant="default" className="h-5 min-w-[20px] px-1 text-xs">
            {activeCount}
          </Badge>
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 max-md:bg-black/40 max-md:backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel: desktop popover / mobile bottom drawer */}
          <div
            className={
              'z-50 rounded-md border bg-popover shadow-md '
              + 'absolute right-0 top-full mt-1 w-80 p-3 '
              + 'max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:top-auto '
              + 'max-md:w-auto max-md:max-h-[70vh] max-md:overflow-y-auto '
              + 'max-md:rounded-t-xl max-md:rounded-b-none max-md:p-4 '
              + 'max-md:animate-slide-up'
            }
          >
            {/* Mobile drag handle */}
            <div className="md:hidden flex justify-center pb-3">
              <div className="h-1 w-8 rounded-full bg-muted-foreground/30" />
            </div>

            <h4 className="text-sm font-medium mb-2">Action Queue</h4>

            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : items.length === 0 && recentHistory.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No actions — click Go on any activity!
              </p>
            ) : (
              <div className="space-y-3">
                {/* Running action */}
                {running && (
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 text-sm">
                      {STATUS_ICONS.running}
                      <span className="flex-1 truncate font-medium text-xs">
                        {formatActionType(running.type)}
                      </span>
                    </div>
                    <ActionTimer
                      item={running}
                      onComplete={handleTimerComplete}
                    />
                  </div>
                )}

                {/* Pending / scheduled with start → end times */}
                {pending.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                      Up Next
                    </p>
                    {pending.slice(0, 5).map((item) => {
                      const startTime = formatTime(item.scheduled_for);
                      const endTime = formatTime(computeEndIso(item));
                      return (
                        <div
                          key={item.action_id}
                          className="flex items-center gap-2 text-xs py-1"
                        >
                          {STATUS_ICONS[item.status] || STATUS_ICONS.pending}
                          <span className="flex-1 truncate">
                            {formatActionType(item.type)}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono whitespace-nowrap">
                            {startTime} → {endTime}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Last completed feed */}
                {recentHistory.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-border/30">
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                      Last Completed
                    </p>
                    {recentHistory.map((item) => {
                      const isFailed = item.status === 'failed';
                      const deltas = isFailed
                        ? null
                        : extractActionDeltas(item.type, item.result);
                      const summary = deltas
                        ? formatDeltaSummary(deltas)
                        : '';
                      const timeStr = formatRelativeTime(
                        item.finished_at || item.created_at,
                      );
                      return (
                        <div
                          key={item.action_id}
                          className="flex items-center gap-2 text-xs py-1"
                          title={
                            isFailed && item.failure_reason
                              ? item.failure_reason
                              : undefined
                          }
                        >
                          {isFailed
                            ? STATUS_ICONS.failed
                            : STATUS_ICONS.completed}
                          <span
                            className={`flex-1 truncate ${
                              isFailed ? 'text-destructive' : ''
                            }`}
                          >
                            {formatActionType(item.type)}
                          </span>
                          {isFailed ? (
                            <NeonChip variant="cost">failed</NeonChip>
                          ) : summary ? (
                            <NeonChip
                              variant={
                                (deltas?.moneyCents ?? 0) > 0 ? 'buff' : 'info'
                              }
                            >
                              {summary}
                            </NeonChip>
                          ) : null}
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {timeStr}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
