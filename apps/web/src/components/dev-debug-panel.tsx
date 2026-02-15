'use client';

import { useState, useSyncExternalStore } from 'react';
import { apiLog, type ApiLogEntry } from '@/lib/api';
import { Bug, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Subscribe to apiLog changes by polling (simplest approach for a ring buffer)
let logVersion = 0;
const originalPush = apiLog.push.bind(apiLog);
// Patch push to bump version for reactivity
(apiLog as ApiLogEntry[]).push = (...items: ApiLogEntry[]) => {
  const result = originalPush(...items);
  logVersion++;
  listeners.forEach((l) => l());
  return result;
};
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function getSnapshot() {
  return logVersion;
}

export function DevDebugPanel() {
  const [open, setOpen] = useState(false);
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Only render in development
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="fixed bottom-20 right-4 z-50 lg:bottom-4 h-8 w-8 rounded-full bg-muted/80 opacity-50 hover:opacity-100"
        onClick={() => setOpen(!open)}
        title="Dev Debug"
      >
        <Bug className="h-4 w-4" />
      </Button>

      {open && (
        <div className="fixed bottom-28 right-4 z-50 lg:bottom-14 w-80 max-h-72 overflow-auto rounded-md border bg-popover p-3 shadow-lg text-xs font-mono">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">API Log (last {apiLog.length})</span>
            <button onClick={() => setOpen(false)}><X className="h-3.5 w-3.5" /></button>
          </div>
          {apiLog.length === 0 ? (
            <p className="text-muted-foreground">No requests yet</p>
          ) : (
            <div className="space-y-1">
              {[...apiLog].reverse().map((entry, i) => (
                <div key={i} className="flex items-center gap-1.5 py-0.5 border-b border-border/50 last:border-0">
                  <span className={entry.error ? 'text-destructive' : 'text-green-600'}>
                    {entry.status ?? 'ERR'}
                  </span>
                  <span className="text-muted-foreground">{entry.method}</span>
                  <span className="flex-1 truncate">{entry.path}</span>
                  <span className="text-muted-foreground text-[10px]">
                    {new Date(entry.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
