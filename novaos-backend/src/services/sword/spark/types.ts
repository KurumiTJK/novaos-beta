// ═══════════════════════════════════════════════════════════════════════════════
// SPARK TYPES
// Quick actionable tasks (~5 min) based on today's learning context
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────────

export type SparkStatus = 'active' | 'completed' | 'skipped';

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK
// ─────────────────────────────────────────────────────────────────────────────────

export interface Spark {
  id: string;
  userId: string;
  
  // Context (links to today's lesson)
  planId?: string;
  subskillId?: string;
  dailyLessonId?: string;
  sessionNumber?: number;
  
  // Content
  task: string;
  context?: string;
  estimatedMinutes: number;
  
  // Status
  status: SparkStatus;
  skipReason?: string;
  
  // Timestamps
  createdAt: Date;
  completedAt?: Date;
}

export interface SparkRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  subskill_id: string | null;
  daily_lesson_id: string | null;
  session_number: number | null;
  task: string;
  context: string | null;
  estimated_minutes: number;
  status: string;
  skip_reason: string | null;
  created_at: string;
  completed_at: string | null;
}

export function mapSpark(row: SparkRow): Spark {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id || undefined,
    subskillId: row.subskill_id || undefined,
    dailyLessonId: row.daily_lesson_id || undefined,
    sessionNumber: row.session_number || undefined,
    task: row.task,
    context: row.context || undefined,
    estimatedMinutes: row.estimated_minutes,
    status: row.status as SparkStatus,
    skipReason: row.skip_reason || undefined,
    createdAt: new Date(row.created_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// API TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface GenerateSparkResult {
  spark: Spark;
  subskillTitle?: string;
  sessionGoal?: string;
}

export interface SkipSparkInput {
  reason?: string;
}
