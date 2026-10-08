import { useState, type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils.ts';

export interface AvatarProps extends HTMLAttributes<HTMLDivElement> {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}

export function Avatar({
  name,
  src,
  size = 'md',
  className,
  ...props
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);

  const sizes = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
  };

  const getInitials = (str: string) => {
    return str
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getColorFromName = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 45%, 22%)`;
  };

  const initials = getInitials(name || 'User');
  const bgColor = getColorFromName(name || 'User');

  return (
    <div
      className={cn(
        'relative inline-flex items-center justify-center rounded-md font-semibold text-zinc-200 select-none border border-zinc-800/80 overflow-hidden shrink-0',
        sizes[size],
        className,
      )}
      style={{ backgroundColor: src && !imageError ? 'transparent' : bgColor }}
      {...props}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={name}
          className="h-full w-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
