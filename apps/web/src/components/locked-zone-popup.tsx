'use client';

import type { LockedZoneMeta } from '@/lib/districts';
import { Lock, X } from 'lucide-react';

interface LockedZonePopupProps {
  zone: LockedZoneMeta;
  onClose: () => void;
}

export function LockedZonePopup({ zone, onClose }: LockedZonePopupProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm rounded-xl overflow-hidden animate-fade-in-scale"
        style={{
          background: 'rgba(255, 255, 255, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '2px dashed rgba(107, 114, 128, 0.3)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Chain border accent */}
        <div
          className="absolute top-0 left-0 right-0 h-[3px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${zone.gradient[0]}80, ${zone.gradient[1]}80, transparent)`,
          }}
        />

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/5 transition-colors z-10"
          aria-label="Close popup"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content */}
        <div className="px-6 pt-6 pb-5">
          {/* Lock icon + name */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${zone.gradient[0]}15, ${zone.gradient[1]}25)`,
                border: `1px dashed ${zone.gradient[0]}40`,
              }}
            >
              <Lock className="h-5 w-5" style={{ color: zone.gradient[0] }} />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-0.5">Locked Zone</p>
              <h3 className="text-lg font-bold tracking-tight">{zone.name}</h3>
            </div>
          </div>

          {/* Teaser text */}
          <p className="text-sm text-muted-foreground leading-relaxed italic mb-5">
            &ldquo;{zone.teaser}&rdquo;
          </p>

          {/* Unlock requirements */}
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Required Level</span>
              <span className="text-sm font-mono font-semibold">Lv. {zone.unlockLevel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Unlock Cost</span>
              <span className="text-sm font-mono font-semibold">${zone.unlockCost.toLocaleString()}</span>
            </div>
          </div>

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Progress</span>
              <span className="text-[10px] font-mono text-muted-foreground">0%</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(0, 0, 0, 0.06)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: '0%',
                  background: `linear-gradient(90deg, ${zone.gradient[0]}, ${zone.gradient[1]})`,
                  transition: 'width 600ms ease',
                }}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-3 border-t border-black/5"
          style={{ background: 'rgba(0, 0, 0, 0.02)' }}
        >
          <p className="text-[10px] text-muted-foreground text-center font-mono">
            Keep playing to unlock this zone
          </p>
        </div>
      </div>
    </div>
  );
}
