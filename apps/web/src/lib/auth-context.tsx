'use client';

import { createContext, useContext, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { queryKeys } from './queries';

const ITCH_MODE = !!process.env.NEXT_PUBLIC_API_URL;

export interface PlayerStateData {
  playerId: string;
  username: string;
  timezone: string;
  vigor: { pv: number; mv: number; sv: number; cv: number; spv: number };
  caps: { pv_cap: number; mv_cap: number; sv_cap: number; cv_cap: number; spv_cap: number };
  sleepState: string;
  housingTier: number;
  balanceCents: number;
  balanceFormatted: string;
  skills: Record<string, number>;
  activeBuffs: Array<{
    id: string;
    source: string;
    startsAt: string;
    endsAt: string;
    perHourBonusByDim: Partial<Record<string, number>>;
  }>;
  mealsEatenToday: number;
  mealPenaltyLevel: number;
  pendingActions: number;
  updatedAt: string;
  nextDailyReset: string;
  localTime: string;
  secondsUntilDailyReset: number;
  softGates: {
    mvSlippage: number;
    svServiceMult: number;
    cvFeeMult: number;
    cvSpeedMult: number;
    spvRegenMult: number;
  };
}

interface AuthContextValue {
  user: PlayerStateData | null;
  isLoading: boolean;
  isError: boolean;
  isGuest: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, timezone?: string) => Promise<void>;
  logout: () => Promise<void>;
  guestLogin: () => Promise<void>;
  resetToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const guestLoginAttempted = useRef(false);

  const { data: user, isLoading, isError } = useQuery({
    queryKey: queryKeys.player.state(),
    queryFn: () => api.get<PlayerStateData>('/me/state'),
    retry: false,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  const isGuest = !!(user?.username?.startsWith('guest_'));

  const guestLogin = useCallback(async () => {
    const res = await api.post<{ token: string; playerId: string; username: string }>('/auth/guest');
    if (typeof window !== 'undefined') {
      localStorage.setItem('guest_token', res.token);
    }
    await queryClient.invalidateQueries({ queryKey: queryKeys.player.all });
  }, [queryClient]);

  // In itch mode, auto-create guest account if no token exists
  useEffect(() => {
    if (!ITCH_MODE) return;
    if (guestLoginAttempted.current) return;
    if (typeof window === 'undefined') return;

    const existingToken = localStorage.getItem('guest_token');
    if (existingToken) return; // Already have a token, query will use it

    guestLoginAttempted.current = true;
    guestLogin().catch(() => {
      // Reset so user can retry
      guestLoginAttempted.current = false;
    });
  }, [guestLogin]);

  const login = useCallback(async (username: string, password: string) => {
    await api.post('/auth/login', { username, password });
    await queryClient.invalidateQueries({ queryKey: queryKeys.player.all });
  }, [queryClient]);

  const register = useCallback(async (username: string, password: string, timezone?: string) => {
    await api.post('/auth/register', {
      username,
      password,
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    await queryClient.invalidateQueries({ queryKey: queryKeys.player.all });
  }, [queryClient]);

  const logout = useCallback(async () => {
    await api.post('/auth/logout');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('guest_token');
    }
    queryClient.clear();
    if (typeof window !== 'undefined' && !ITCH_MODE) {
      window.location.href = '/login';
    }
  }, [queryClient]);

  const resetToken = useCallback(async () => {
    const res = await api.post<{ token: string }>('/me/token-reset');
    if (typeof window !== 'undefined') {
      localStorage.setItem('guest_token', res.token);
    }
    return res.token;
  }, []);

  return (
    <AuthContext.Provider value={{
      user: user ?? null,
      isLoading,
      isError,
      isGuest,
      login,
      register,
      logout,
      guestLogin,
      resetToken,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
