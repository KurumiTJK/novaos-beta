// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BAR — iPhone-style Status Bar
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import { cn } from '../utils';

interface StatusBarProps {
  variant?: 'default' | 'crisis';
}

export function StatusBar({ variant = 'default' }: StatusBarProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <div
      className={cn(
        'h-11 px-6 flex items-center justify-between text-xs font-medium safe-top',
        variant === 'crisis' ? 'bg-red-950/50 text-red-200' : 'text-white'
      )}
    >
      {/* Left: Time */}
      <span className="font-semibold">{formattedTime}</span>

      {/* Center: Dynamic Island placeholder (for iPhone frame) */}
      <div className="w-24" />

      {/* Right: Icons */}
      <div className="flex items-center gap-1.5">
        {variant === 'crisis' && (
          <span className="text-red-400 animate-pulse mr-1">●</span>
        )}
        <SignalIcon className="w-4 h-4" />
        <WifiIcon className="w-4 h-4" />
        <BatteryIcon className="w-6 h-3" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// ICONS
// ─────────────────────────────────────────────────────────────────────────────────

function SignalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <rect x="2" y="16" width="3" height="6" rx="0.5" />
      <rect x="7" y="12" width="3" height="10" rx="0.5" />
      <rect x="12" y="8" width="3" height="14" rx="0.5" />
      <rect x="17" y="4" width="3" height="18" rx="0.5" />
    </svg>
  );
}

function WifiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 18c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm-4.9-2.3l1.4 1.4C9.4 18 10.6 18.5 12 18.5s2.6-.5 3.5-1.4l1.4-1.4c-1.3-1.3-3.1-2.1-4.9-2.1s-3.6.8-4.9 2.1zM2.8 11.2l1.4 1.4c2.1-2.1 5-3.4 7.8-3.4s5.7 1.3 7.8 3.4l1.4-1.4C18.9 8.9 15.6 7.3 12 7.3s-6.9 1.6-9.2 3.9zM12 3C7.3 3 3 4.9 0 8l1.4 1.4C4.1 6.7 7.8 5 12 5s7.9 1.7 10.6 4.4L24 8c-3-3.1-7.3-5-12-5z" />
    </svg>
  );
}

function BatteryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 14" fill="currentColor">
      <rect x="0.5" y="0.5" width="24" height="13" rx="3" stroke="currentColor" strokeWidth="1" fill="none" />
      <rect x="2" y="2" width="20" height="9" rx="1.5" />
      <path d="M26 4v5a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" opacity="0.4" />
    </svg>
  );
}
