'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { VIGOR_KEYS } from '@blueth/core';
import { VigorBar } from './vigor-bar';
import { MoneyDisplay } from './money-display';
import { DailyResetTimer } from './daily-reset-timer';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Map, Heart, Wallet, Receipt, Briefcase, UtensilsCrossed,
  Smile, TrendingUp, Building2, LayoutDashboard, LogOut, Menu, X, Settings,
  Ellipsis,
} from 'lucide-react';
import { useState } from 'react';
import { ActionQueueDropdown } from './action-queue-dropdown';

const NAV_ITEMS = [
  { href: '/city', label: 'City Map', icon: Map },
  { href: '/vigor', label: 'Vigor', icon: Heart },
  { href: '/wallet', label: 'Wallet', icon: Wallet },
  { href: '/bills', label: 'Bills', icon: Receipt },
  { href: '/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/food', label: 'Food', icon: UtensilsCrossed },
  { href: '/leisure', label: 'Leisure', icon: Smile },
  { href: '/market', label: 'Market', icon: TrendingUp },
  { href: '/business', label: 'Business', icon: Building2 },
  { href: '/summary', label: 'Summary', icon: LayoutDashboard },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function GameShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen game-gradient">
        <div className="space-y-4 text-center">
          <Skeleton className="h-8 w-48 mx-auto bg-muted/40" />
          <Skeleton className="h-4 w-32 mx-auto bg-muted/30" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen game-gradient">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-card/70 backdrop-blur-md">
        <div className="flex h-14 items-center px-4 gap-4">
          <button
            className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/city" className="font-bold tracking-tight hidden sm:block neon-text text-sm">
            BLUETH CITY
          </Link>

          <div className="hidden sm:block h-4 w-px bg-border/40" />

          <span className="text-xs text-muted-foreground hidden md:block font-mono">{user.username}</span>

          <div className="flex-1" />

          {/* Mini vigor bars - desktop */}
          <div className="hidden md:flex items-center gap-2">
            {VIGOR_KEYS.map((key) => (
              <VigorBar
                key={key}
                dimension={key}
                value={user.vigor[key]}
                cap={user.caps[`${key}_cap` as keyof typeof user.caps]}
                compact
              />
            ))}
          </div>

          {/* Mini vigor chips - mobile */}
          <div className="flex md:hidden items-center gap-1.5">
            {VIGOR_KEYS.map((key) => {
              const val = Math.round(user.vigor[key]);
              const cap = user.caps[`${key}_cap` as keyof typeof user.caps];
              const pct = cap > 0 ? (val / cap) * 100 : 0;
              const dot = pct > 60 ? 'bg-green-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';
              return (
                <span key={key} className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <span
                    className={cn('inline-block h-1.5 w-1.5 rounded-full', dot)}
                    style={{ boxShadow: pct <= 20 ? '0 0 4px hsl(0 80% 50%)' : 'none' }}
                  />
                  {val}
                </span>
              );
            })}
          </div>

          <div className="hidden md:block h-4 w-px bg-border/40" />

          <MoneyDisplay cents={user.balanceCents} size="sm" />

          <div className="hidden md:block h-4 w-px bg-border/40" />

          <ActionQueueDropdown />

          <div className="hidden md:block h-4 w-px bg-border/40" />
          <div className="hidden md:block">
            <DailyResetTimer />
          </div>

          <Button variant="ghost" size="icon" onClick={logout} title="Logout" className="min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-52 flex-col border-r border-border/30 min-h-[calc(100vh-3.5rem)] p-2 bg-card/30">
          <nav className="space-y-0.5">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 min-h-[40px] text-sm transition-all',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary font-medium neon-border'
                    : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>

        {/* Mobile sidebar overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-30 lg:hidden">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-14 bottom-0 w-64 bg-card/95 backdrop-blur-md border-r border-border/30 p-2 overflow-y-auto animate-slide-up">
              <nav className="space-y-0.5">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 min-h-[44px] text-sm transition-all',
                      pathname === item.href
                        ? 'bg-primary/10 text-primary font-medium neon-border'
                        : 'text-muted-foreground hover:bg-accent/40 hover:text-foreground',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                ))}
              </nav>
            </aside>
          </div>
        )}

        {/* Main content */}
        <main className="flex-1 p-4 lg:p-6 max-w-5xl pb-20 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/30 bg-card/80 backdrop-blur-md lg:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around py-1">
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-1 text-xs transition-colors',
                pathname === item.href ? 'text-primary' : 'text-muted-foreground',
              )}
              style={pathname === item.href ? { textShadow: '0 0 8px hsl(192 91% 52% / 0.5)' } : undefined}
            >
              <item.icon className="h-4 w-4" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 min-h-[44px] min-w-[44px] px-1 text-xs transition-colors',
              NAV_ITEMS.slice(5).some((item) => pathname === item.href) || mobileOpen
                ? 'text-primary'
                : 'text-muted-foreground',
            )}
            style={
              NAV_ITEMS.slice(5).some((item) => pathname === item.href)
                ? { textShadow: '0 0 8px hsl(192 91% 52% / 0.5)' }
                : undefined
            }
          >
            <Ellipsis className="h-4 w-4" />
            <span className="text-[10px]">More</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
