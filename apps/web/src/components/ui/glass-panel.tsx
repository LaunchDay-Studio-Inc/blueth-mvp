import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const glassPanelVariants = cva(
  'rounded-xl overflow-hidden',
  {
    variants: {
      variant: {
        surface: 'glass-surface',
        elevated: 'glass-elevated',
        inset: 'glass-inset',
      },
      padding: {
        none: '',
        sm: 'p-3',
        md: 'p-5',
        lg: 'p-6',
      },
    },
    defaultVariants: {
      variant: 'surface',
      padding: 'md',
    },
  },
);

export interface GlassPanelProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof glassPanelVariants> {}

const GlassPanel = React.forwardRef<HTMLDivElement, GlassPanelProps>(
  ({ className, variant, padding, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(glassPanelVariants({ variant, padding, className }))}
      {...props}
    />
  ),
);
GlassPanel.displayName = 'GlassPanel';

export { GlassPanel, glassPanelVariants };
