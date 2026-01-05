// ═══════════════════════════════════════════════════════════════════════════════
// INPUT — Shared Input Components
// ═══════════════════════════════════════════════════════════════════════════════

import { forwardRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn, stanceColors, haptic } from '../utils';
import type { Stance } from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// BASE INPUT
// ─────────────────────────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, leftIcon, rightIcon, ...props }, ref) => {
    return (
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={cn(
            'w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3',
            'text-white placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'transition-colors',
            error && 'border-red-500 focus:ring-red-500',
            leftIcon ? 'pl-10' : undefined,
            rightIcon ? 'pr-10' : undefined,
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
            {rightIcon}
          </div>
        )}
        {error && (
          <p className="mt-1 text-xs text-red-400">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// ─────────────────────────────────────────────────────────────────────────────────
// CHAT INPUT
// ─────────────────────────────────────────────────────────────────────────────────

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
  disabled?: boolean;
  stance?: Stance;
  showAttach?: boolean;
}

export function ChatInput({
  onSend,
  placeholder = 'Message Nova...',
  disabled = false,
  stance = 'lens',
  showAttach = false,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const colors = stanceColors[stance];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      haptic('light');
      onSend(value.trim());
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="px-4 py-3 border-t border-gray-800 bg-gray-950/80 backdrop-blur-xl safe-bottom"
    >
      <div className="flex items-center gap-2">
        {showAttach && (
          <button
            type="button"
            className="p-2 text-gray-500 hover:text-gray-300 transition-colors"
          >
            <AttachIcon className="w-5 h-5" />
          </button>
        )}

        <div className="flex-1 relative">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            className={cn(
              'w-full bg-gray-800/50 border border-gray-700 rounded-2xl',
              'px-4 py-3 pr-12',
              'text-white text-sm placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:border-transparent',
              'transition-all',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            style={{
              '--tw-ring-color': colors.primary,
            } as React.CSSProperties}
          />

          <motion.button
            type="submit"
            whileTap={{ scale: 0.9 }}
            disabled={!value.trim() || disabled}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2',
              'p-2 rounded-xl transition-all',
              value.trim() && !disabled
                ? `${colors.bg} ${colors.text}`
                : 'text-gray-600'
            )}
          >
            <SendIcon className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────────

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function AttachIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}
