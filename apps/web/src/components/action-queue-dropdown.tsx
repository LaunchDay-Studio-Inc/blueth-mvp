'use client';

import { useState, useEffect } from 'react';
import { useActionQueue, type ActionQueueItem } from '@/hooks/use-action-queue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Clock, CheckCircle2, Loader2, AlertCircle, ListTodo, ChevronDown } from 'lucide-react';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5 text-muted-foreground" />,
  scheduled: <Clock className="h-3.5 w-3.5 text-blue-500" />,
  running: <Loader2 className="h-3.5 w-3.5 text-amber-500 animate-spin" />,
  completed: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  failed: <AlertCircle className="h-3.5 w-3.5 text-destructive" />,
};

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  scheduled: 'secondary',
  running: 'default',
  completed: 'secondary',
  failed: 'destructive',
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

function ActionTimer({ item }: { item: ActionQueueItem }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const startMs = new Date(item.scheduled_for).getTime();
  const durationMs = item.duration_seconds * 1000;
  const endMs = startMs + durationMs;
  const elapsedMs = now - startMs;
  const remainingS = Math.max(0, Math.ceil((endMs - now) / 1000));
  const pct = durationMs > 0 ? Math.min(100, Math.max(0, (elapsedMs / durationMs) * 100)) : 100;

  return (
    <div className="space-y-1 w-full mt-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-amber-600 font-mono">{formatDuration(remainingS)} left</span>
        <span className="text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      <Progress value={pct} className="h-1.5" indicatorClassName="bg-amber-500" />
    </div>
  );
}

export function ActionQueueDropdown() {
  const { data: queue, isLoading } = useActionQueue();
  const [open, setOpen] = useState(false);

  const items = queue || [];
  const running = items.find((i) => i.status === 'running');
  const pending = items.filter((i) => i.status === 'pending' || i.status === 'scheduled');
  const lastCompleted = items.find((i) => i.status === 'completed');
  const lastFailed = items.find((i) => i.status === 'failed');
  const activeCount = pending.length + (running ? 1 : 0);

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
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-md border bg-popover p-3 shadow-md">
            <h4 className="text-sm font-medium mb-2">Action Queue</h4>

            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : items.length === 0 ? (
              <p className="text-xs text-muted-foreground">No actions — click Go on any activity!</p>
            ) : (
              <div className="space-y-2">
                {/* Running action */}
                {running && (
                  <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
                    <div className="flex items-center gap-2 text-sm">
                      {STATUS_ICONS.running}
                      <span className="flex-1 truncate font-medium text-xs">
                        {formatActionType(running.type)}
                      </span>
                    </div>
                    <ActionTimer item={running} />
                  </div>
                )}

                {/* Pending / scheduled */}
                {pending.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground font-medium">Up next</p>
                    {pending.slice(0, 5).map((item) => (
                      <div key={item.action_id} className="flex items-center gap-2 text-xs py-1">
                        {STATUS_ICONS[item.status] || STATUS_ICONS.pending}
                        <span className="flex-1 truncate">{formatActionType(item.type)}</span>
                        <Badge variant={STATUS_VARIANTS[item.status] || 'outline'} className="text-[10px] px-1">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}

                {/* Last completed */}
                {lastCompleted && (
                  <div className="pt-1 border-t">
                    <p className="text-xs text-muted-foreground font-medium mb-1">Last completed</p>
                    <div className="flex items-center gap-2 text-xs">
                      {STATUS_ICONS.completed}
                      <span className="flex-1 truncate">{formatActionType(lastCompleted.type)}</span>
                      <span className="text-muted-foreground text-[10px]">
                        {new Date(lastCompleted.finished_at || lastCompleted.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                )}

                {/* Last failed */}
                {lastFailed && (
                  <div className="pt-1 border-t">
                    <div className="flex items-center gap-2 text-xs">
                      {STATUS_ICONS.failed}
                      <span className="flex-1 truncate text-destructive">{formatActionType(lastFailed.type)}</span>
                      <Badge variant="destructive" className="text-[10px] px-1">failed</Badge>
                    </div>
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
