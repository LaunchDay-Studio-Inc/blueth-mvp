import * as React from 'react';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

export interface HUDStatPillProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  onClick?: () => void;
  active?: boolean;
  className?: string;
}

function HUDStatPill({ label, value, icon: Icon, onClick, active = false, className }: HUDStatPillProps) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      onClick={onClick}
      title={label}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        'transition-all duration-150',
        'glass-surface',
        active
          ? 'neon-border text-primary'
          : 'text-muted-foreground hover:text-foreground',
        onClick && 'cursor-pointer hover:glass-glow-cool',
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="font-mono">{value}</span>
    </Comp>
  );
}

export { HUDStatPill };
