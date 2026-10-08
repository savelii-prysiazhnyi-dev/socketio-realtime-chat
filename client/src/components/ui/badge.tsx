import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.ts';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'owner' | 'admin' | 'member';
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: BadgeProps) {
  const variants = {
    default: 'bg-zinc-800 text-zinc-200 border-zinc-700',
    secondary: 'bg-zinc-900 text-zinc-400 border-zinc-800',
    outline: 'border-zinc-800 text-zinc-400 bg-transparent',
    owner: 'bg-amber-950/40 text-amber-300 border-amber-800/40',
    admin: 'bg-indigo-950/40 text-indigo-300 border-indigo-800/40',
    member: 'bg-zinc-900/60 text-zinc-400 border-zinc-800/60',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider border select-none',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
