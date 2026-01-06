// ═══════════════════════════════════════════════════════════════════════════════
// LOADING DOTS — Novaux
// ═══════════════════════════════════════════════════════════════════════════════

interface LoadingDotsProps {
  className?: string;
}

export function LoadingDots({ className = '' }: LoadingDotsProps) {
  return (
    <div className={`flex gap-1.5 ${className}`}>
      <span className="loading-dot w-2 h-2 bg-gray-400 rounded-full" />
      <span className="loading-dot w-2 h-2 bg-gray-400 rounded-full" />
      <span className="loading-dot w-2 h-2 bg-gray-400 rounded-full" />
    </div>
  );
}
