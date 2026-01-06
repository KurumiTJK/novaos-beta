// ═══════════════════════════════════════════════════════════════════════════════
// THEME — Stance Colors and Design Tokens
// ═══════════════════════════════════════════════════════════════════════════════

import type { Stance } from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE COLORS
// Per Constitution: Control > Shield > Lens > Sword priority
// ─────────────────────────────────────────────────────────────────────────────────

export const stanceColors = {
  control: {
    bg: 'bg-red-500/20',
    bgSolid: 'bg-red-500',
    bgHover: 'hover:bg-red-500/30',
    border: 'border-red-500',
    borderLight: 'border-red-500/30',
    text: 'text-red-400',
    textBright: 'text-red-300',
    glow: 'shadow-red-500/30',
    gradient: 'from-red-500/20 to-red-600/10',
  },
  shield: {
    bg: 'bg-amber-500/20',
    bgSolid: 'bg-amber-500',
    bgHover: 'hover:bg-amber-500/30',
    border: 'border-amber-500',
    borderLight: 'border-amber-500/30',
    text: 'text-amber-400',
    textBright: 'text-amber-300',
    glow: 'shadow-amber-500/30',
    gradient: 'from-amber-500/20 to-amber-600/10',
  },
  lens: {
    bg: 'bg-blue-500/20',
    bgSolid: 'bg-blue-500',
    bgHover: 'hover:bg-blue-500/30',
    border: 'border-blue-500',
    borderLight: 'border-blue-500/30',
    text: 'text-blue-400',
    textBright: 'text-blue-300',
    glow: 'shadow-blue-500/30',
    gradient: 'from-blue-500/20 to-blue-600/10',
  },
  sword: {
    bg: 'bg-emerald-500/20',
    bgSolid: 'bg-emerald-500',
    bgHover: 'hover:bg-emerald-500/30',
    border: 'border-emerald-500',
    borderLight: 'border-emerald-500/30',
    text: 'text-emerald-400',
    textBright: 'text-emerald-300',
    glow: 'shadow-emerald-500/30',
    gradient: 'from-emerald-500/20 to-emerald-600/10',
  },
} as const;

export type StanceColorKey = keyof typeof stanceColors.control;

export function getStanceColor(stance: Stance, key: StanceColorKey): string {
  return stanceColors[stance][key];
}

export function getStanceColors(stance: Stance) {
  return stanceColors[stance];
}

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE INFO
// ─────────────────────────────────────────────────────────────────────────────────

export const stanceInfo = {
  control: {
    name: 'Control',
    icon: '🚨',
    description: 'Crisis & Safety',
    subtitle: 'Crisis Resolution Active',
  },
  shield: {
    name: 'Shield',
    icon: '🛡️',
    description: 'Protection & Warning',
    subtitle: 'Protection Active',
  },
  lens: {
    name: 'Lens',
    icon: '🔍',
    description: 'Clarity & Information',
    subtitle: 'Clarity Mode',
  },
  sword: {
    name: 'Sword',
    icon: '⚔️',
    description: 'Action & Progress',
    subtitle: 'Forward Motion',
  },
} as const;

export function getStanceInfo(stance: Stance) {
  return stanceInfo[stance];
}

// ─────────────────────────────────────────────────────────────────────────────────
// MODULE COLORS
// ─────────────────────────────────────────────────────────────────────────────────

export const moduleColors = {
  finance: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400' },
  health: { bg: 'bg-rose-500/20', border: 'border-rose-500/30', text: 'text-rose-400' },
  calendar: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400' },
  weather: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400' },
  reminders: { bg: 'bg-violet-500/20', border: 'border-violet-500/30', text: 'text-violet-400' },
  email: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-400' },
  maps: { bg: 'bg-orange-500/20', border: 'border-orange-500/30', text: 'text-orange-400' },
  abilities: { bg: 'bg-pink-500/20', border: 'border-pink-500/30', text: 'text-pink-400' },
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// MODULE CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

export const modules = [
  { id: 'finance', icon: '📊', name: 'Finance' },
  { id: 'health', icon: '❤️', name: 'Health' },
  { id: 'calendar', icon: '📅', name: 'Calendar' },
  { id: 'weather', icon: '🌤️', name: 'Weather' },
  { id: 'reminders', icon: '⏰', name: 'Reminders' },
  { id: 'email', icon: '✉️', name: 'Email' },
  { id: 'maps', icon: '📍', name: 'Maps' },
  { id: 'abilities', icon: '⚡', name: 'Abilities' },
] as const;

// ─────────────────────────────────────────────────────────────────────────────────
// ANIMATION VARIANTS (for Framer Motion)
// ─────────────────────────────────────────────────────────────────────────────────

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

export const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

export const slideIn = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

export const scaleIn = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

export const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};
