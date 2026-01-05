// ═══════════════════════════════════════════════════════════════════════════════
// SHARED COMPONENTS — Index & Utility Components
// ═══════════════════════════════════════════════════════════════════════════════

// Re-exports
export { Button } from './Button';
export { Card, StanceIndicator, StanceBadge } from './Card';
export { Input, ChatInput } from './Input';
export { StatusBar } from './StatusBar';

// ─────────────────────────────────────────────────────────────────────────────────
// LOADING DOTS
// ─────────────────────────────────────────────────────────────────────────────────

import { motion } from 'framer-motion';

export function LoadingDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 bg-gray-500 rounded-full"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// BACK BUTTON
// ─────────────────────────────────────────────────────────────────────────────────

import { useNavigate } from 'react-router-dom';
import { haptic } from '../utils';

interface BackButtonProps {
  to?: string;
  onClick?: () => void;
  className?: string;
}

export function BackButton({ to, onClick, className }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    haptic('light');
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`text-gray-400 hover:text-white transition-colors ${className}`}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon = '📭', title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <span className="text-4xl mb-4">{icon}</span>
      <h3 className="text-lg font-semibold text-white mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-gray-400 mb-4 max-w-xs">{description}</p>
      )}
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// PAGE HEADER
// ─────────────────────────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, leftAction, rightAction, className }: PageHeaderProps) {
  return (
    <div className={`px-4 py-3 border-b border-gray-800 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {leftAction}
          <div>
            <h1 className="font-bold text-white">{title}</h1>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {rightAction}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  action?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-2 ${className}`}>
      <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h2>
      {action}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// BADGE
// ─────────────────────────────────────────────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
}

const badgeVariants = {
  default: 'bg-gray-700 text-gray-300',
  success: 'bg-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/20 text-amber-400',
  error: 'bg-red-500/20 text-red-400',
  info: 'bg-blue-500/20 text-blue-400',
};

export function Badge({ children, variant = 'default', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center rounded-full font-medium
        ${badgeVariants[variant]}
        ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm'}
      `}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROGRESS BAR
// ─────────────────────────────────────────────────────────────────────────────────

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
  className?: string;
}

export function ProgressBar({
  value,
  max = 100,
  color = 'bg-blue-500',
  size = 'md',
  showLabel = false,
  className,
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`w-full ${className}`}>
      <div className={`w-full bg-gray-800 rounded-full overflow-hidden ${size === 'sm' ? 'h-1.5' : 'h-2'}`}>
        <motion.div
          className={`h-full ${color} rounded-full`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      {showLabel && (
        <p className="text-xs text-gray-500 mt-1">{Math.round(percentage)}%</p>
      )}
    </div>
  );
}
