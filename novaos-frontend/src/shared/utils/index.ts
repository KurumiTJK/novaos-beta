// ═══════════════════════════════════════════════════════════════════════════════
// SHARED UTILS — Helper Functions & Theme
// ═══════════════════════════════════════════════════════════════════════════════

import type { Stance, ModuleType } from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// CLASSNAME HELPER
// ─────────────────────────────────────────────────────────────────────────────────

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────────
// TIME FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// ─────────────────────────────────────────────────────────────────────────────────
// STRING HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length - 3) + '...';
}

export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

// ─────────────────────────────────────────────────────────────────────────────────
// HAPTIC FEEDBACK (iOS)
// ─────────────────────────────────────────────────────────────────────────────────

type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

export function haptic(style: HapticStyle = 'light'): void {
  if (!('vibrate' in navigator)) return;

  const patterns: Record<HapticStyle, number | number[]> = {
    light: 10,
    medium: 20,
    heavy: 30,
    success: [10, 50, 10],
    warning: [20, 50, 20],
    error: [30, 50, 30, 50, 30],
  };

  navigator.vibrate(patterns[style]);
}

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE COLORS & INFO
// ─────────────────────────────────────────────────────────────────────────────────

export const stanceColors: Record<Stance, {
  primary: string;
  bg: string;
  bgSubtle: string;
  border: string;
  text: string;
  glow: string;
}> = {
  control: {
    primary: 'rgb(239, 68, 68)',
    bg: 'bg-red-500/20',
    bgSubtle: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
    glow: 'shadow-red-500/20',
  },
  shield: {
    primary: 'rgb(245, 158, 11)',
    bg: 'bg-amber-500/20',
    bgSubtle: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    glow: 'shadow-amber-500/20',
  },
  lens: {
    primary: 'rgb(59, 130, 246)',
    bg: 'bg-blue-500/20',
    bgSubtle: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    glow: 'shadow-blue-500/20',
  },
  sword: {
    primary: 'rgb(16, 185, 129)',
    bg: 'bg-emerald-500/20',
    bgSubtle: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'shadow-emerald-500/20',
  },
};

export const stanceInfo: Record<Stance, {
  name: string;
  icon: string;
  description: string;
}> = {
  control: {
    name: 'Control',
    icon: '🛑',
    description: 'Crisis mode - immediate safety focus',
  },
  shield: {
    name: 'Shield',
    icon: '🛡️',
    description: 'Protection from risk and harm',
  },
  lens: {
    name: 'Lens',
    icon: '🔍',
    description: 'Clarity and understanding',
  },
  sword: {
    name: 'Sword',
    icon: '⚔️',
    description: 'Forward progress and action',
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// MODULE COLORS
// ─────────────────────────────────────────────────────────────────────────────────

export const moduleColors: Record<ModuleType, {
  bg: string;
  text: string;
  icon: string;
}> = {
  finance: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: '📊' },
  health: { bg: 'bg-rose-500/20', text: 'text-rose-400', icon: '❤️' },
  calendar: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: '📅' },
  weather: { bg: 'bg-cyan-500/20', text: 'text-cyan-400', icon: '🌤️' },
  reminders: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: '⏰' },
  email: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', icon: '✉️' },
  maps: { bg: 'bg-orange-500/20', text: 'text-orange-400', icon: '📍' },
  abilities: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: '⚡' },
};

// ─────────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS (Framer Motion)
// ─────────────────────────────────────────────────────────────────────────────────

export const animations = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 },
  },
  slideUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 20 },
    transition: { duration: 0.3 },
  },
  slideDown: {
    initial: { opacity: 0, y: -20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3 },
  },
  scale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { duration: 0.2 },
  },
  staggerContainer: {
    animate: {
      transition: {
        staggerChildren: 0.05,
      },
    },
  },
  staggerItem: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
  },
};
