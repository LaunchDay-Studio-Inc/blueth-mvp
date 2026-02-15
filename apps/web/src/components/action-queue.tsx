'use client';

import { useActionQueue } from '@/hooks/use-action-queue';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

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

export function ActionQueue() {
  const { data: queue, isLoading } = useActionQueue();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Action Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const items = queue || [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Action Queue</CardTitle>
          {items.length > 0 && (
            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending actions</p>
        ) : (
          <ul className="space-y-1.5">
            {items.slice(0, 12).map((item) => (
              <li key={item.action_id} className="flex items-center gap-2 text-sm">
                {STATUS_ICONS[item.status] || STATUS_ICONS.pending}
                <span className="flex-1 truncate">{formatActionType(item.type)}</span>
                <Badge variant={STATUS_VARIANTS[item.status] || 'outline'} className="text-xs">
                  {item.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
