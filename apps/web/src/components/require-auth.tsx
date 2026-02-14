'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useAuthLoopBreaker } from '@/hooks/use-auth-loop-breaker';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Route guard for protected pages. Redirects to /login when unauthenticated.
 * Only use on protected routes — never wrap /login or /register.
 *
 * Includes a circuit breaker: if auth status flips rapidly (>3 times in 5s),
 * stops auto-navigation and shows a recovery UI.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status, logout } = useAuth();
  const router = useRouter();
  const hasRedirected = useRef(false);
  const { recordTransition, isTripped, reset } = useAuthLoopBreaker();
  const [showLoopError, setShowLoopError] = useState(false);

  useEffect(() => {
    recordTransition(status);

    if (isTripped()) {
      setShowLoopError(true);
      return;
    }

    if (status === 'unauthenticated' && !hasRedirected.current) {
      hasRedirected.current = true;
      router.replace('/login');
    }
  }, [status, router, recordTransition, isTripped]);

  if (showLoopError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-lg text-destructive">Session Error</CardTitle>
            <CardDescription>
              Your authentication state is unstable. This usually means your session has expired or is corrupted.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              onClick={() => {
                reset();
                setShowLoopError(false);
                if (typeof window !== 'undefined') {
                  localStorage.removeItem('guest_token');
                }
                logout().catch(() => {});
                router.replace('/login');
              }}
            >
              Reset Session
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-4 text-center">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null;
  }

  return <>{children}</>;
}
