import { cn } from '@/lib/utils';
import { formatBlueth } from '@blueth/core';

interface MoneyDisplayProps {
  cents: number;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function MoneyDisplay({ cents, className, size = 'md' }: MoneyDisplayProps) {
  const formatted = formatBlueth(cents);
  const isNegative = cents < 0;

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-lg font-semibold',
    lg: 'text-3xl font-bold',
  };

  return (
    <span className={cn(
      sizeClasses[size],
      isNegative ? 'text-destructive' : 'text-foreground',
      className,
    )}>
      {formatted}
    </span>
  );
}
