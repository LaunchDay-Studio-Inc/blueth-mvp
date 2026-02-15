'use client';

import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api, apiLog, ApiError } from '@/lib/api';
import { queryKeys } from '@/lib/queries';
import { useAccessibility } from '@/hooks/use-accessibility';
import { useTutorial } from '@/hooks/use-tutorial';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const IS_DEV = process.env.NODE_ENV === 'development';

const TEXT_SIZE_OPTIONS: Array<{ value: 100 | 110 | 125; label: string }> = [
  { value: 100, label: '100%' },
  { value: 110, label: '110%' },
  { value: 125, label: '125%' },
];

export default function SettingsPage() {
  const { user, isGuest, resetToken } = useAuth();
  const queryClient = useQueryClient();
  const [tokenResetMsg, setTokenResetMsg] = useState('');
  const [ffMsg, setFfMsg] = useState('');
  const [ffLoading, setFfLoading] = useState(false);
  const { prefs, setReduceMotion, setTextSize, setHighContrast, setEnhancedFocus } = useAccessibility();
  const tutorial = useTutorial();

  const { isError: apiDown } = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const url = API_BASE ? `${API_BASE}/health` : '/api/health';
      const res = await fetch(url);
      if (!res.ok) throw new Error('unhealthy');
      return res.json();
    },
    retry: false,
    refetchInterval: 30_000,
  });

  if (!user) {
    return <Skeleton className="h-96 w-full" />;
  }

  const handleResetToken = async () => {
    try {
      setTokenResetMsg('');
      await resetToken();
      setTokenResetMsg('Token rotated successfully.');
    } catch {
      setTokenResetMsg('Failed to reset token.');
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* API Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">API Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-3 w-3 rounded-full ${apiDown ? 'bg-red-500' : 'bg-green-500'}`}
            />
            <span className="text-sm">{apiDown ? 'Unreachable' : 'Connected'}</span>
            {API_BASE && (
              <span className="text-xs text-muted-foreground ml-2">{API_BASE}</span>
            )}
          </div>
          {(() => {
            const recentErrors = apiLog.filter((e) => e.error !== null).slice(-3);
            if (recentErrors.length === 0) return null;
            return (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground mb-1">Recent errors:</p>
                {recentErrors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive">
                    {e.method} {e.path} — {e.status ?? 'NET'} {e.error}
                  </p>
                ))}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Account Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Username:</span>
            <span className="font-mono">{user.username}</span>
            {isGuest && <Badge variant="secondary">Guest</Badge>}
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Player ID:</span>
            <span className="font-mono text-xs">{user.playerId}</span>
          </div>
        </CardContent>
      </Card>

      {/* Accessibility */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Accessibility</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between min-h-[44px]">
            <div>
              <p className="text-sm font-medium">Reduce motion</p>
              <p className="text-xs text-muted-foreground">Disable animations and transitions</p>
            </div>
            <Switch
              checked={prefs.reduceMotion}
              onCheckedChange={setReduceMotion}
              aria-label="Reduce motion"
            />
          </div>

          <div className="flex items-center justify-between min-h-[44px]">
            <div>
              <p className="text-sm font-medium">Text size</p>
              <p className="text-xs text-muted-foreground">Scale UI text for readability</p>
            </div>
            <div className="flex gap-1">
              {TEXT_SIZE_OPTIONS.map((opt) => (
                <Button
                  key={opt.value}
                  variant={prefs.textSize === opt.value ? 'default' : 'outline'}
                  size="sm"
                  className="min-h-[36px] min-w-[48px] text-xs"
                  onClick={() => setTextSize(opt.value)}
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between min-h-[44px]">
            <div>
              <p className="text-sm font-medium">High contrast</p>
              <p className="text-xs text-muted-foreground">Increase text and border contrast</p>
            </div>
            <Switch
              checked={prefs.highContrast}
              onCheckedChange={setHighContrast}
              aria-label="High contrast"
            />
          </div>

          <div className="flex items-center justify-between min-h-[44px]">
            <div>
              <p className="text-sm font-medium">Enhanced focus outlines</p>
              <p className="text-xs text-muted-foreground">Larger, more visible focus indicators</p>
            </div>
            <Switch
              checked={prefs.enhancedFocus}
              onCheckedChange={setEnhancedFocus}
              aria-label="Enhanced focus outlines"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tutorial */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Getting Started Guide</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {tutorial.allComplete
              ? 'You\'ve completed all getting-started steps.'
              : `${tutorial.state.completed.length} of ${tutorial.steps.length} steps completed.`}
          </p>
          <Button
            variant="outline"
            className="min-h-[44px]"
            onClick={tutorial.reset}
          >
            Restart Getting Started Guide
          </Button>
        </CardContent>
      </Card>

      {/* Guest Token Management */}
      {isGuest && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Guest Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Your guest session is stored locally. Resetting the token will invalidate
              any other browser sessions using the old token.
            </p>
            <Button onClick={handleResetToken} variant="outline" className="min-h-[44px]">
              Reset Guest Token
            </Button>
            {tokenResetMsg && (
              <p className="text-sm text-muted-foreground">{tokenResetMsg}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* DEV: Time Fast-Forward */}
      {IS_DEV && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Dev: Time Fast-Forward</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Advance simulation time to complete queued actions faster.
              Only available in development mode.
            </p>
            <div className="flex gap-2 flex-wrap">
              {[15, 30, 60, 120].map((mins) => (
                <Button
                  key={mins}
                  variant="outline"
                  className="min-h-[44px]"
                  disabled={ffLoading}
                  onClick={async () => {
                    setFfLoading(true);
                    setFfMsg('');
                    try {
                      const res = await api.post<{ advanced: number; actionsShifted: number }>(
                        '/debug/advance',
                        { minutes: mins }
                      );
                      setFfMsg(`Advanced ${res.advanced}m — ${res.actionsShifted} action(s) shifted`);
                      await Promise.all([
                        queryClient.invalidateQueries({ queryKey: queryKeys.player.all }),
                        queryClient.invalidateQueries({ queryKey: queryKeys.actions.all }),
                      ]);
                    } catch (err) {
                      if (err instanceof ApiError) {
                        setFfMsg(`Error: ${err.message}`);
                      } else {
                        setFfMsg('Fast-forward failed');
                      }
                    } finally {
                      setFfLoading(false);
                    }
                  }}
                >
                  +{mins}m
                </Button>
              ))}
            </div>
            {ffMsg && (
              <p className="text-sm text-muted-foreground">{ffMsg}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
