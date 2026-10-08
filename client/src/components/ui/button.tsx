import * as React from 'react';
import { cn } from '../../lib/utils.ts';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'subtle';
  size?: 'default' | 'sm' | 'lg' | 'icon' | 'xs';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', disabled, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer';

    const variants = {
      default:
        'bg-zinc-100 text-zinc-900 hover:bg-zinc-200 border border-zinc-200 shadow-sm active:bg-zinc-300',
      secondary:
        'bg-zinc-900 text-zinc-100 hover:bg-zinc-800 border border-zinc-800 active:bg-zinc-700',
      outline:
        'border border-zinc-800 bg-transparent text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100 hover:border-zinc-700 active:bg-zinc-800',
      ghost:
        'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/60 active:bg-zinc-800',
      destructive:
        'bg-red-950/80 text-red-200 border border-red-800/60 hover:bg-red-900 active:bg-red-950',
      subtle:
        'bg-zinc-800/40 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100 border border-zinc-800/50',
    };

    const sizes = {
      xs: 'h-6 px-2 text-xs rounded',
      sm: 'h-7 px-2.5 text-xs rounded-md',
      default: 'h-8 px-3 text-xs rounded-md',
      lg: 'h-9 px-4 text-sm rounded-md',
      icon: 'h-8 w-8 rounded-md shrink-0',
    };

    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
