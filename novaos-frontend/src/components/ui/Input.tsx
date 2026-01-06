// ═══════════════════════════════════════════════════════════════════════════════
// INPUT — Text Input Components
// ═══════════════════════════════════════════════════════════════════════════════

import { forwardRef, type InputHTMLAttributes, type FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils';
import type { Stance } from '../../types';
import { getStanceColors } from '../../utils/theme';

// ─────────────────────────────────────────────────────────────────────────────────
// BASE INPUT
// ─────────────────────────────────────────────────────────────────────────────────

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          ref={ref}
          className={cn(
            'w-full bg-gray-800 text-white text-sm rounded-xl px-4 py-3',
            'placeholder-gray-500 outline-none',
            'border border-transparent focus:border-blue-500',
            'transition-colors',
            error && 'border-red-500',
            className
          )}
          {...props}
        />
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
  showAttachButton?: boolean;
  className?: string;
}

export function ChatInput({
  onSend,
  placeholder = 'Ask Nova anything...',
  disabled = false,
  stance = 'lens',
  showAttachButton = false,
  className,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const stanceColors = getStanceColors(stance);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setValue('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('p-4 border-t border-gray-800', className)}>
      <div className="flex items-center gap-2">
        {showAttachButton && (
          <motion.button
            type="button"
            whileTap={{ scale: 0.95 }}
            className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
          </motion.button>
        )}
        
        <div className="flex-1 flex items-center bg-gray-800 rounded-2xl px-4 py-3">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-gray-500"
          />
        </div>
        
        <motion.button
          type="submit"
          whileTap={{ scale: 0.95 }}
          disabled={disabled || !value.trim()}
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            stanceColors.bgSolid
          )}
        >
          <ArrowUpIcon className="w-5 h-5 text-white" />
        </motion.button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────────

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  );
}

export default Input;
