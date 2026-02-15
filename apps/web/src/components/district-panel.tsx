'use client';

import type { DistrictMeta } from '@/lib/districts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Briefcase, UtensilsCrossed, Home, Zap } from 'lucide-react';
import Link from 'next/link';

interface DistrictPanelProps {
  district: DistrictMeta;
}

const VIBE_TEXT: Record<string, string> = {
  CBD: 'Glass towers hum with ambition. Money flows fast here — if you can keep up.',
  OLD_TOWN: 'Cobblestone streets and the smell of fresh bread. Slower pace, deeper roots.',
  MARINA: 'Salt air and champagne. The wealthy dock their yachts and their worries.',
  TECH_PARK: 'Screens glow through the night. Innovation never clocks out.',
  MARKET_SQ: 'Voices haggle, carts rattle. The heartbeat of everyday commerce.',
  ENTERTAINMENT: 'Neon signs flicker. The night is young and full of bad decisions.',
  UNIVERSITY: 'Knowledge is cheap here. Everything else costs extra.',
  HARBOR: 'Cranes swing, containers stack. Honest work for honest pay.',
  INDUSTRIAL: 'Smoke and steel. Not pretty, but it keeps the city running.',
  SUBURBS_N: 'Quiet streets, barking dogs. A good place to call home.',
  SUBURBS_S: 'Affordable, friendly, real. Community matters here.',
  OUTSKIRTS: 'Wide open nothing. Cheap land, long commutes, big dreams.',
};

const QUICK_ACTIONS: { label: string; href: string; icon: typeof Briefcase }[] = [
  { label: 'Find Work', href: '/jobs', icon: Briefcase },
  { label: 'Grab Food', href: '/food', icon: UtensilsCrossed },
  { label: 'Housing', href: '/bills', icon: Home },
];

export function DistrictPanel({ district }: DistrictPanelProps) {
  const modifierLabel =
    district.modifier === 1.0
      ? 'Base'
      : district.modifier > 1.0
        ? `+${Math.round((district.modifier - 1) * 100)}%`
        : `${Math.round((district.modifier - 1) * 100)}%`;

  const vibe = VIBE_TEXT[district.code] || district.description;

  return (
    <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden animate-slide-up">
      {/* Header with neon accent line */}
      <div className="relative px-5 pt-5 pb-3">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">District Dossier</p>
            <h2 className="text-lg font-bold tracking-tight">{district.name}</h2>
          </div>
          <Badge
            variant={district.modifier > 1.0 ? 'default' : district.modifier < 1.0 ? 'secondary' : 'outline'}
            className="text-[10px] font-mono"
          >
            {modifierLabel}
          </Badge>
        </div>
      </div>

      {/* Vibe text */}
      <div className="px-5 pb-4">
        <p className="text-sm text-muted-foreground leading-relaxed italic">
          &ldquo;{vibe}&rdquo;
        </p>
      </div>

      {/* Locations */}
      <div className="px-5 pb-4">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-2 flex items-center gap-1.5">
          <Zap className="h-3 w-3" /> Points of Interest
        </p>
        <div className="space-y-1.5">
          {district.locations.map((loc) => (
            <div key={loc} className="flex items-center gap-2 text-sm group">
              <MapPin className="h-3.5 w-3.5 text-primary/60 group-hover:text-primary transition-colors" />
              <span className="text-foreground/80 group-hover:text-foreground transition-colors">{loc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 pb-5 pt-2 border-t border-border/30">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-3">Quick Actions</p>
        <div className="flex gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Button
              key={action.href}
              variant="outline"
              size="sm"
              className="flex-1 text-xs border-border/40 hover:neon-border hover:text-primary transition-all"
              asChild
            >
              <Link href={action.href}>
                <action.icon className="h-3.5 w-3.5 mr-1.5" />
                {action.label}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      {/* Price modifier footer */}
      <div className="px-5 py-2.5 bg-muted/30 border-t border-border/20">
        <p className="text-[10px] text-muted-foreground font-mono">
          Price modifier: {district.modifier}x base
        </p>
      </div>
    </div>
  );
}
