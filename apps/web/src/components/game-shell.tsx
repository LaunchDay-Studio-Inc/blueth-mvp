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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Map, Heart, Wallet, Receipt, Briefcase, UtensilsCrossed,
  Smile, TrendingUp, Building2, LayoutDashboard, LogOut, Menu, X,
} from 'lucide-react';
import { useState } from 'react';

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
];

export function GameShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, logout } = useAuth();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="space-y-4 text-center">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-32 mx-auto" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 gap-4">
          <button className="lg:hidden" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <Link href="/city" className="font-bold text-primary hidden sm:block">
            Blueth City
          </Link>

          <Separator orientation="vertical" className="h-6 hidden sm:block" />

          <span className="text-sm text-muted-foreground hidden md:block">{user.username}</span>

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

          <Separator orientation="vertical" className="h-6 hidden md:block" />

          <MoneyDisplay cents={user.balanceCents} size="sm" />

          <Separator orientation="vertical" className="h-6 hidden md:block" />

          {/* Daily reset timer — desktop */}
          <div className="hidden md:block">
            <DailyResetTimer />
          </div>

          <Button variant="ghost" size="icon" onClick={logout} title="Logout">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-56 flex-col border-r min-h-[calc(100vh-3.5rem)] p-2">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  pathname === item.href
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
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
            <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
            <aside className="absolute left-0 top-14 bottom-0 w-64 bg-background border-r p-2 overflow-y-auto">
              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      pathname === item.href
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
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
        <main className="flex-1 p-4 lg:p-6 max-w-5xl">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background lg:hidden">
        <div className="flex justify-around py-1">
          {NAV_ITEMS.slice(0, 5).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 text-xs',
                pathname === item.href ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
