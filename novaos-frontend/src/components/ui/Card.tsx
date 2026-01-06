// ═══════════════════════════════════════════════════════════════════════════════
// CARD — Card Container Component
// ═══════════════════════════════════════════════════════════════════════════════

import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils';
import type { Stance } from '../../types';
import { getStanceColors } from '../../utils/theme';

// ─────────────────────────────────────────────────────────────────────────────────
// CARD
// ─────────────────────────────────────────────────────────────────────────────────

interface CardProps {
  children: ReactNode;
  className?: string;
  stance?: Stance;
  variant?: 'default' | 'outlined' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export function Card({
  children,
  className,
  stance,
  variant = 'default',
  padding = 'md',
  animate = false,
}: CardProps) {
  const stanceColors = stance ? getStanceColors(stance) : null;

  const baseStyles = 'rounded-xl';

  const variantStyles = {
    default: 'bg-gray-900/80 border border-gray-700/50',
    outlined: stanceColors
      ? `${stanceColors.bg} border ${stanceColors.borderLight}`
      : 'bg-gray-800/30 border border-gray-700/30',
    gradient: stanceColors
      ? `bg-gradient-to-br ${stanceColors.gradient} border ${stanceColors.borderLight}`
      : 'bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/30',
  };

  const paddingStyles = {
    none: '',
    sm: 'p-2',
    md: 'p-3',
    lg: 'p-4',
  };

  const Component = animate ? motion.div : 'div';
  const animateProps = animate
    ? {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
      }
    : {};

  return (
    <Component
      className={cn(baseStyles, variantStyles[variant], paddingStyles[padding], className)}
      {...animateProps}
    >
      {children}
    </Component>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE INDICATOR
// ─────────────────────────────────────────────────────────────────────────────────

interface StanceIndicatorProps {
  stance: Stance;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  showPulse?: boolean;
  className?: string;
}

export function StanceIndicator({
  stance,
  size = 'md',
  showLabel = true,
  showPulse = false,
  className,
}: StanceIndicatorProps) {
  const colors = getStanceColors(stance);

  const sizeStyles = {
    sm: { dot: 'w-1.5 h-1.5', text: 'text-xs' },
    md: { dot: 'w-2 h-2', text: 'text-xs' },
    lg: { dot: 'w-3 h-3', text: 'text-sm' },
  };

  const stanceLabels: Record<Stance, string> = {
    control: 'Control Mode',
    shield: 'Shield Active',
    lens: 'Lens Mode',
    sword: 'Sword Mode',
  };

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <span
        className={cn(
          'rounded-full',
          sizeStyles[size].dot,
          colors.bgSolid,
          showPulse && 'animate-pulse'
        )}
      />
      {showLabel && (
        <span className={cn(sizeStyles[size].text, colors.text)}>
          {stanceLabels[stance]}
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
  icon?: string;
  label?: string;
  className?: string;
}

export function StanceBadge({ stance, icon, label, className }: StanceBadgeProps) {
  const colors = getStanceColors(stance);

  const defaultIcons: Record<Stance, string> = {
    control: '🚨',
    shield: '🛡️',
    lens: '🔍',
    sword: '⚔️',
  };

  const defaultLabels: Record<Stance, string> = {
    control: 'CONTROL',
    shield: 'SHIELD',
    lens: 'LENS',
    sword: 'SWORD',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 px-2 py-1 rounded-lg',
        colors.bg,
        className
      )}
    >
      <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs" style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
        {icon || defaultIcons[stance]}
      </span>
      <span className={cn('text-xs font-medium', colors.text)}>
        {label || defaultLabels[stance]}
      </span>
    </div>
  );
}

export default Card;
