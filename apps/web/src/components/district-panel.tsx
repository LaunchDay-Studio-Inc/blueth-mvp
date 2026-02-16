'use client';

import type { DistrictMeta } from '@/lib/districts';
import { DISTRICT_ICONS } from '@/components/city-map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Briefcase, UtensilsCrossed, Home, Zap, X } from 'lucide-react';
import Link from 'next/link';

interface DistrictPanelProps {
  district: DistrictMeta;
  onClose?: () => void;
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

export function DistrictPanel({ district, onClose }: DistrictPanelProps) {
  const modifierLabel =
    district.modifier === 1.0
      ? 'Base'
      : district.modifier > 1.0
        ? `+${Math.round((district.modifier - 1) * 100)}%`
        : `${Math.round((district.modifier - 1) * 100)}%`;

  const vibe = VIBE_TEXT[district.code] || district.description;

  return (
    <div className="rounded-xl overflow-hidden animate-slide-up"
      style={{
        background: 'rgba(255, 255, 255, 0.40)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255, 255, 255, 0.25)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)',
      }}
    >
      {/* Header with district-colored accent line */}
      <div className="relative px-5 pt-5 pb-3">
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${district.gradient[0]}99, ${district.gradient[1]}99, transparent)`,
          }}
        />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* District SVG icon */}
            <div
              className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${district.gradient[0]}20, ${district.gradient[1]}30)`,
                border: `1px solid ${district.gradient[0]}30`,
              }}
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
                {DISTRICT_ICONS[district.icon]?.(district.gradient[0])}
              </svg>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">District Dossier</p>
              <h2 className="text-lg font-bold tracking-tight">{district.name}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant={district.modifier > 1.0 ? 'default' : district.modifier < 1.0 ? 'secondary' : 'outline'}
              className="text-[10px] font-mono"
            >
              {modifierLabel}
            </Badge>
            {onClose && (
              <button
                onClick={onClose}
                className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors"
                aria-label="Close panel"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
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
            <div key={loc} className="flex items-center gap-2 text-sm group cursor-default">
              <MapPin
                className="h-3.5 w-3.5 transition-colors"
                style={{ color: `${district.gradient[0]}99` }}
              />
              <span className="text-foreground/80 group-hover:text-foreground transition-colors">{loc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-5 pb-5 pt-2 border-t border-black/5">
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
      <div className="px-5 py-2.5 border-t border-black/5" style={{ background: 'rgba(0, 0, 0, 0.03)' }}>
        <p className="text-[10px] text-muted-foreground font-mono">
          Price modifier: {district.modifier}x base
        </p>
      </div>
    </div>
  );
}
