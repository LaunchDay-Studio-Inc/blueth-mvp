'use client';

import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { queryKeys } from './queries';

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
}

interface AuthContextValue {
  user: PlayerStateData | null;
  isLoading: boolean;
  isError: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, timezone?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user, isLoading, isError } = useQuery({
    queryKey: queryKeys.player.state(),
    queryFn: () => api.get<PlayerStateData>('/me/state'),
    retry: false,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

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
    queryClient.clear();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, isError, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
