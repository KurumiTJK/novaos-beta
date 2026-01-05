// ═══════════════════════════════════════════════════════════════════════════════
// STATUS BAR — iPhone-style Status Bar
// ═══════════════════════════════════════════════════════════════════════════════

import { cn } from '../../utils';

interface StatusBarProps {
  crisis?: boolean;
  className?: string;
}

export function StatusBar({ crisis = false, className }: StatusBarProps) {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: false,
  });

  return (
    <div
      className={cn(
        'h-12 px-6 flex items-end justify-between text-xs pb-1',
        crisis ? 'text-red-400' : 'text-white',
        className
      )}
    >
      <span className="font-semibold">{timeString}</span>
      <div className="flex items-center gap-1">
        {crisis && (
          <span className="text-red-500 animate-pulse mr-1">●</span>
        )}
        <SignalIcon className="w-4 h-4" />
        <WifiIcon className="w-4 h-4" />
        <BatteryIcon className="w-5 h-5" />
      </div>
    </div>
  );
}

// Simple icons
function SignalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <rect x="2" y="12" width="3" height="6" rx="1" />
      <rect x="7" y="8" width="3" height="10" rx="1" />
      <rect x="12" y="4" width="3" height="14" rx="1" />
      <rect x="17" y="0" width="3" height="18" rx="1" opacity="0.3" />
    </svg>
  );
}

function WifiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 15a2 2 0 100 4 2 2 0 000-4z" />
      <path d="M4 10c3.5-3.5 8.5-3.5 12 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M1 7c5-5 13-5 18 0" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

function BatteryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 12" fill="currentColor">
      <rect x="0" y="0" width="20" height="12" rx="2" stroke="currentColor" strokeWidth="1" fill="none" />
      <rect x="2" y="2" width="14" height="8" rx="1" />
      <rect x="21" y="3" width="3" height="6" rx="1" opacity="0.5" />
    </svg>
  );
}

export default StatusBar;
