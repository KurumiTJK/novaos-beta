// ═══════════════════════════════════════════════════════════════════════════════
// CARD — Shared Card Component
// ═══════════════════════════════════════════════════════════════════════════════

import { forwardRef } from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn, stanceColors } from '../utils';
import type { Stance } from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────────────────────────

type CardVariant = 'default' | 'outlined' | 'gradient';
type CardPadding = 'none' | 'sm' | 'md' | 'lg';

interface CardProps extends HTMLMotionProps<'div'> {
  variant?: CardVariant;
  padding?: CardPadding;
  stance?: Stance;
  hoverable?: boolean;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-gray-900 border border-gray-800',
  outlined: 'bg-transparent border border-gray-700',
  gradient: 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50',
};

const paddingStyles: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      padding = 'md',
      stance,
      hoverable = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    const stanceStyle = stance ? `${stanceColors[stance].border} ${stanceColors[stance].bgSubtle}` : '';

    return (
      <motion.div
        ref={ref}
        className={cn(
          'rounded-2xl',
          variantStyles[variant],
          paddingStyles[padding],
          stanceStyle,
          hoverable && 'hover:bg-gray-800/50 cursor-pointer transition-colors',
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE INDICATOR
// ─────────────────────────────────────────────────────────────────────────────────

interface StanceIndicatorProps {
  stance: Stance;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  pulse?: boolean;
}

export function StanceIndicator({
  stance,
  size = 'md',
  showLabel = false,
  pulse = false,
}: StanceIndicatorProps) {
  const colors = stanceColors[stance];

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4',
  };

  const stanceNames: Record<Stance, string> = {
    control: 'Control',
    shield: 'Shield',
    lens: 'Lens',
    sword: 'Sword',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <div
          className={cn(
            'rounded-full',
            sizeClasses[size],
            pulse && 'animate-pulse'
          )}
          style={{ backgroundColor: colors.primary }}
        />
        {pulse && (
          <div
            className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-75',
              sizeClasses[size]
            )}
            style={{ backgroundColor: colors.primary }}
          />
        )}
      </div>
      {showLabel && (
        <span className={cn('text-sm font-medium', colors.text)}>
          {stanceNames[stance]}
        </span>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE BADGE
// ─────────────────────────────────────────────────────────────────────────────────

interface StanceBadgeProps {
  stance: Stance;
  size?: 'sm' | 'md';
}

export function StanceBadge({ stance, size = 'md' }: StanceBadgeProps) {
  const colors = stanceColors[stance];

  const stanceIcons: Record<Stance, string> = {
    control: '🛑',
    shield: '🛡️',
    lens: '🔍',
    sword: '⚔️',
  };

  const stanceNames: Record<Stance, string> = {
    control: 'Control',
    shield: 'Shield',
    lens: 'Lens',
    sword: 'Sword',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        colors.bg,
        colors.text,
        colors.border,
        'border',
        sizeClasses[size]
      )}
    >
      <span>{stanceIcons[stance]}</span>
      <span>{stanceNames[stance]}</span>
    </div>
  );
}
