// ═══════════════════════════════════════════════════════════════════════════════
// SPARK CARD — Quick action task display
// ═══════════════════════════════════════════════════════════════════════════════

import { useHaptic } from '@/shared/hooks';
import { useLessonStore } from '@/shared/stores/lessonStore';
import type { Spark } from '@/shared/stores/lessonStore';

interface SparkCardProps {
  spark: Spark;
}

export function SparkCard({ spark }: SparkCardProps) {
  const haptic = useHaptic();
  const { completeSpark, skipSpark } = useLessonStore();

  const handleComplete = async () => {
    haptic('medium');
    await completeSpark(spark.id);
  };

  const handleSkip = async () => {
    haptic('light');
    await skipSpark(spark.id);
  };

  return (
    <div className="bg-gradient-to-br from-purple-600/30 to-purple-900/30 rounded-2xl p-4 border border-purple-500/20">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center gap-1.5 bg-purple-500/20 rounded-full px-3 py-1">
          <span className="text-yellow-400">⚡</span>
          <span className="text-white text-xs font-medium">Spark</span>
        </div>
        {spark.context && (
          <span className="text-white/40 text-xs">{spark.context}</span>
        )}
      </div>

      {/* Task */}
      <p className="text-white text-[15px] leading-relaxed mb-3">
        {spark.task}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-white/40 text-xs">
          ⏱️ ~{spark.estimatedMinutes} min
        </span>
        
        <div className="flex gap-2">
          <button
            onClick={handleSkip}
            className="px-4 py-2 rounded-xl text-white/60 text-sm font-medium bg-white/5 active:bg-white/10 transition-colors"
          >
            Skip
          </button>
          <button
            onClick={handleComplete}
            className="px-4 py-2 rounded-xl text-white text-sm font-medium bg-purple-500 active:bg-purple-600 transition-colors"
          >
            Complete ✓
          </button>
        </div>
      </div>
    </div>
  );
}
