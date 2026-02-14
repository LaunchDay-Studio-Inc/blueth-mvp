'use client';

import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function SettingsPage() {
  const { user, isGuest, resetToken } = useAuth();
  const [tokenResetMsg, setTokenResetMsg] = useState('');

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
        <CardContent>
          <div className="flex items-center gap-2">
            <span
              className={`inline-block h-3 w-3 rounded-full ${apiDown ? 'bg-red-500' : 'bg-green-500'}`}
            />
            <span className="text-sm">{apiDown ? 'Unreachable' : 'Connected'}</span>
            {API_BASE && (
              <span className="text-xs text-muted-foreground ml-2">{API_BASE}</span>
            )}
          </div>
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
    </div>
  );
}
