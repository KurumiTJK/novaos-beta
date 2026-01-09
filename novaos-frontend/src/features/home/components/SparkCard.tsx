// ═══════════════════════════════════════════════════════════════════════════════
// SPARK CARD — Daily micro-task card
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import type { Spark } from '@/shared/stores/lessonStore';

interface SparkCardProps {
  spark: Spark;
  onComplete: () => void;
  onSkip: () => void;
  compact?: boolean;
}

export function SparkCard({ spark, onComplete, onSkip, compact = false }: SparkCardProps) {
  const [isActioning, setIsActioning] = useState(false);

  const handleComplete = async () => {
    if (isActioning) return;
    setIsActioning(true);
    
    // Haptic feedback
    if ('vibrate' in navigator) {
      navigator.vibrate(20);
    }
    
    try {
      await onComplete();
    } finally {
      setIsActioning(false);
    }
  };

  const handleSkip = async () => {
    if (isActioning) return;
    setIsActioning(true);
    
    try {
      await onSkip();
    } finally {
      setIsActioning(false);
    }
  };

  if (compact) {
    return (
      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">⚡</span>
              <span className="text-green-400 text-xs font-medium">SPARK</span>
              <span className="text-white/30 text-xs">~{spark.estimatedMinutes}m</span>
            </div>
            <p className="text-white text-sm">{spark.task}</p>
          </div>
          <div className="flex gap-1">
            <button
              onClick={handleComplete}
              disabled={isActioning}
              className="px-3 py-1.5 bg-green-500 text-black text-xs font-medium rounded-lg active:opacity-80 disabled:opacity-50"
            >
              ✓
            </button>
            <button
              onClick={handleSkip}
              disabled={isActioning}
              className="px-2 py-1.5 text-white/50 text-xs active:text-white/70"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-2xl p-5 border border-green-500/20">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">⚡</span>
          <span className="text-green-400 text-sm font-medium">SPARK</span>
        </div>
        <span className="text-white/30 text-xs">
          ~{spark.estimatedMinutes} min
        </span>
      </div>

      {/* Task */}
      <p className="text-white text-lg mb-4 leading-relaxed">
        {spark.task}
      </p>

      {/* Context */}
      {spark.context && (
        <p className="text-white/40 text-sm mb-4">
          From: {spark.context}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleComplete}
          disabled={isActioning}
          className="flex-1 py-3 bg-green-500 text-black font-medium rounded-full active:opacity-80 disabled:opacity-50 transition-opacity"
        >
          {isActioning ? 'Saving...' : '✓ Complete'}
        </button>
        <button
          onClick={handleSkip}
          disabled={isActioning}
          className="px-4 py-3 bg-white/10 text-white/70 font-medium rounded-full active:bg-white/20 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
