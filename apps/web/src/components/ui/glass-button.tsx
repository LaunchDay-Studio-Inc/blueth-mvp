import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const glassButtonVariants = cva(
  'glass-btn-motion inline-flex items-center justify-center gap-2 rounded-lg font-medium text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transition-all duration-150 ease-out active:scale-[0.97]',
  {
    variants: {
      variant: {
        primary:
          'glass-elevated text-primary hover:border-primary/30 active:brightness-110',
        ghost:
          'bg-transparent border border-transparent text-foreground/80 hover:bg-black/5 hover:text-foreground',
        outline:
          'glass-surface text-foreground/80 hover:border-primary/30 hover:text-primary',
      },
      size: {
        sm: 'h-9 px-3 text-xs',
        md: 'h-10 px-4 text-sm',
        lg: 'h-11 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const isDisabled = disabled || loading;

    return (
      <Comp
        className={cn(glassButtonVariants({ variant, size, className }))}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span className="sr-only">Loading</span>
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
GlassButton.displayName = 'GlassButton';

export { GlassButton, glassButtonVariants };
