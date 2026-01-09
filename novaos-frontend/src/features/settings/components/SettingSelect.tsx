// ═══════════════════════════════════════════════════════════════════════════════
// SETTING SELECT — Dropdown/option selector setting
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SettingSelectProps<T extends string> {
  label: string;
  description?: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

export function SettingSelect<T extends string>({
  label,
  description,
  value,
  options,
  onChange,
  disabled = false,
}: SettingSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = options.find(opt => opt.value === value);

  const handleSelect = (optionValue: T) => {
    if (disabled) return;
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(10);
    }
    
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between p-4 bg-[#1C1C1E] rounded-xl
          active:bg-[#2C2C2E] transition-colors text-left
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${isOpen ? 'rounded-b-none' : ''}
        `}
      >
        <div className="flex-1 mr-4">
          <p className="text-white font-medium">{label}</p>
          {description && (
            <p className="text-white/40 text-sm mt-0.5">{description}</p>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-white/70 text-sm">
            {selectedOption?.label || value}
          </span>
          <svg
            className={`w-4 h-4 text-white/30 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Options */}
          <div className="absolute left-0 right-0 z-20 bg-[#1C1C1E] rounded-b-xl border-t border-white/5 overflow-hidden">
            {options.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`
                  w-full flex items-center justify-between px-4 py-3 text-left
                  active:bg-white/5 transition-colors
                  ${option.value === value ? 'bg-white/5' : ''}
                `}
              >
                <span className={`text-sm ${option.value === value ? 'text-white' : 'text-white/70'}`}>
                  {option.label}
                </span>
                {option.value === value && (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
