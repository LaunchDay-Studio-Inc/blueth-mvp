import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const neonChipVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border transition-colors',
  {
    variants: {
      variant: {
        buff: 'border-green-500/30 bg-green-500/10 text-green-700',
        cost: 'border-red-500/30 bg-red-500/10 text-red-700',
        info: 'border-primary/30 bg-primary/10 text-primary',
        warning: 'border-amber-500/30 bg-amber-500/10 text-amber-700',
      },
    },
    defaultVariants: {
      variant: 'info',
    },
  },
);

export interface NeonChipProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof neonChipVariants> {}

function NeonChip({ className, variant, ...props }: NeonChipProps) {
  return <span className={cn(neonChipVariants({ variant }), className)} {...props} />;
}

export { NeonChip, neonChipVariants };
