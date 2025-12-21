// ═══════════════════════════════════════════════════════════════════════════════
// CURRICULUM TYPES — Structured Learning Plan Types
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════
//
// Types for structured curriculum generation:
//   - CurriculumDay: Single day's learning plan
//   - StructuredCurriculum: Complete multi-day curriculum
//   - ResourceAssignment: Resource with time allocation
//
// INVARIANT: All resources must reference verified resources by index.
//            The LLM never fabricates resource URLs or content.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { TopicId, ResourceId, VerifiedResource } from '../resource-discovery/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Curriculum constraints.
 */
export const CURRICULUM_CONSTRAINTS = {
  /** Maximum days in a curriculum */
  MAX_DAYS: 30,
  
  /** Minimum days in a curriculum */
  MIN_DAYS: 1,
  
  /** Maximum resources per day */
  MAX_RESOURCES_PER_DAY: 10,
  
  /** Maximum minutes per day */
  MAX_MINUTES_PER_DAY: 480, // 8 hours
  
  /** Minimum minutes per resource */
  MIN_MINUTES_PER_RESOURCE: 5,
  
  /** Maximum minutes per resource */
  MAX_MINUTES_PER_RESOURCE: 180, // 3 hours
  
  /** Maximum theme length */
  MAX_THEME_LENGTH: 100,
  
  /** Maximum notes length */
  MAX_NOTES_LENGTH: 500,
  
  /** Maximum learning objective length */
  MAX_OBJECTIVE_LENGTH: 200,
  
  /** Maximum exercise description length */
  MAX_EXERCISE_LENGTH: 300,
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// DIFFICULTY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Resource difficulty level.
 */
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * Difficulty progression within curriculum.
 */
export type DifficultyProgression = 'flat' | 'gradual' | 'steep';

// ─────────────────────────────────────────────────────────────────────────────────
// RESOURCE ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A resource assigned to a curriculum day.
 * References a verified resource by index (1-based).
 */
export interface ResourceAssignment {
  /** 1-based index referencing the verified resource list */
  readonly index: number;
  
  /** Allocated time in minutes */
  readonly minutes: number;
  
  /** Whether this is optional */
  readonly optional: boolean;
  
  /** Specific sections/chapters to focus on (if applicable) */
  readonly focus?: string;
  
  /** Notes for the learner */
  readonly notes?: string;
}

/**
 * Resource assignment with resolved resource data.
 */
export interface ResolvedResourceAssignment extends ResourceAssignment {
  /** The resolved verified resource */
  readonly resource: VerifiedResource;
  
  /** Resource ID */
  readonly resourceId: ResourceId;
  
  /** Display title */
  readonly title: string;
  
  /** Display URL */
  readonly url: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LEARNING OBJECTIVES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A learning objective for a day.
 */
export interface LearningObjective {
  /** Objective description */
  readonly description: string;
  
  /** Related topic */
  readonly topic?: TopicId;
  
  /** Expected outcome */
  readonly outcome?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXERCISES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Exercise type.
 */
export type ExerciseType =
  | 'practice'       // Hands-on coding/practice
  | 'quiz'           // Knowledge check
  | 'project'        // Mini-project
  | 'reflection'     // Journaling/reflection
  | 'discussion';    // Discussion prompt

/**
 * A practice exercise for a day.
 */
export interface Exercise {
  /** Exercise type */
  readonly type: ExerciseType;
  
  /** Description */
  readonly description: string;
  
  /** Estimated time in minutes */
  readonly minutes: number;
  
  /** Whether this is optional */
  readonly optional: boolean;
  
  /** Related resource indices */
  readonly relatedResources?: readonly number[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// CURRICULUM DAY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A single day's learning plan.
 */
export interface CurriculumDay {
  /** Day number (1-based) */
  readonly day: number;
  
  /** Theme for the day */
  readonly theme: string;
  
  /** Learning objectives */
  readonly objectives: readonly LearningObjective[];
  
  /** Assigned resources */
  readonly resources: readonly ResourceAssignment[];
  
  /** Practice exercises */
  readonly exercises: readonly Exercise[];
  
  /** Total study time in minutes */
  readonly totalMinutes: number;
  
  /** Difficulty level for this day */
  readonly difficulty: DifficultyLevel;
  
  /** Notes for the learner */
  readonly notes?: string;
  
  /** Prerequisites from previous days */
  readonly prerequisiteDays?: readonly number[];
}

/**
 * Curriculum day with resolved resources.
 */
export interface ResolvedCurriculumDay extends Omit<CurriculumDay, 'resources'> {
  /** Resolved resource assignments */
  readonly resources: readonly ResolvedResourceAssignment[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// STRUCTURED CURRICULUM
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Curriculum metadata.
 */
export interface CurriculumMetadata {
  /** Curriculum title */
  readonly title: string;
  
  /** Description */
  readonly description: string;
  
  /** Target audience */
  readonly targetAudience: string;
  
  /** Prerequisites */
  readonly prerequisites: readonly string[];
  
  /** Topics covered */
  readonly topics: readonly TopicId[];
  
  /** Overall difficulty */
  readonly difficulty: DifficultyLevel;
  
  /** Difficulty progression */
  readonly progression: DifficultyProgression;
  
  /** Estimated total hours */
  readonly estimatedHours: number;
}

/**
 * Complete structured curriculum.
 */
export interface StructuredCurriculum {
  /** Unique curriculum ID */
  readonly id: string;
  
  /** Curriculum metadata */
  readonly metadata: CurriculumMetadata;
  
  /** Daily learning plans */
  readonly days: readonly CurriculumDay[];
  
  /** Total number of days */
  readonly totalDays: number;
  
  /** Total study time in minutes */
  readonly totalMinutes: number;
  
  /** Number of verified resources used */
  readonly resourceCount: number;
  
  /** Generation metadata */
  readonly generation: {
    /** When generated */
    readonly generatedAt: Date;
    /** LLM model used */
    readonly model: string;
    /** Request ID */
    readonly requestId: string;
    /** User ID */
    readonly userId?: string;
  };
}

/**
 * Structured curriculum with resolved resources.
 */
export interface ResolvedCurriculum extends Omit<StructuredCurriculum, 'days'> {
  /** Days with resolved resources */
  readonly days: readonly ResolvedCurriculumDay[];
  
  /** All verified resources used */
  readonly allResources: readonly VerifiedResource[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// RAW LLM OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Raw resource assignment from LLM (before validation).
 */
export interface RawResourceAssignment {
  index: number;
  minutes: number;
  optional?: boolean;
  focus?: string;
  notes?: string;
}

/**
 * Raw exercise from LLM.
 */
export interface RawExercise {
  type: string;
  description: string;
  minutes: number;
  optional?: boolean;
  relatedResources?: number[];
}

/**
 * Raw curriculum day from LLM.
 */
export interface RawCurriculumDay {
  day: number;
  theme: string;
  objectives?: Array<{ description: string; topic?: string; outcome?: string }>;
  resources: RawResourceAssignment[];
  exercises?: RawExercise[];
  totalMinutes: number;
  difficulty?: string;
  notes?: string;
  prerequisiteDays?: number[];
}

/**
 * Raw curriculum output from LLM.
 */
export interface RawCurriculumOutput {
  title?: string;
  description?: string;
  targetAudience?: string;
  prerequisites?: string[];
  difficulty?: string;
  progression?: string;
  days: RawCurriculumDay[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION RESULT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validation issue severity.
 */
export type ValidationSeverity = 'error' | 'warning';

/**
 * A validation issue.
 */
export interface ValidationIssue {
  /** Issue severity */
  readonly severity: ValidationSeverity;
  
  /** Path to the issue (e.g., "days[0].resources[1].index") */
  readonly path: string;
  
  /** Issue code */
  readonly code: string;
  
  /** Human-readable message */
  readonly message: string;
  
  /** Suggested fix */
  readonly suggestion?: string;
}

/**
 * Validation result.
 */
export interface CurriculumValidationResult {
  /** Whether validation passed */
  readonly valid: boolean;
  
  /** Validation issues found */
  readonly issues: readonly ValidationIssue[];
  
  /** Error count */
  readonly errorCount: number;
  
  /** Warning count */
  readonly warningCount: number;
  
  /** Validated curriculum (if valid) */
  readonly curriculum?: StructuredCurriculum;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATION REQUEST
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Request to generate a curriculum.
 */
export interface CurriculumGenerationRequest {
  /** Goal description */
  readonly goal: string;
  
  /** Verified resources to use */
  readonly resources: readonly VerifiedResource[];
  
  /** Number of days */
  readonly days: number;
  
  /** Target minutes per day */
  readonly minutesPerDay: number;
  
  /** Target difficulty */
  readonly targetDifficulty: DifficultyLevel;
  
  /** Topics to cover */
  readonly topics: readonly TopicId[];
  
  /** User ID */
  readonly userId?: string;
  
  /** Additional preferences */
  readonly preferences?: {
    /** Include exercises */
    readonly includeExercises?: boolean;
    /** Difficulty progression */
    readonly progression?: DifficultyProgression;
    /** Focus areas */
    readonly focusAreas?: readonly string[];
  };
}

/**
 * Generation result.
 */
export interface CurriculumGenerationResult {
  /** Whether generation succeeded */
  readonly success: boolean;
  
  /** Generated curriculum (if successful) */
  readonly curriculum?: ResolvedCurriculum;
  
  /** Error message (if failed) */
  readonly error?: string;
  
  /** Error code (if failed) */
  readonly errorCode?: string;
  
  /** Generation metrics */
  readonly metrics: {
    /** Total duration in ms */
    readonly durationMs: number;
    /** LLM tokens used */
    readonly tokensUsed: number;
    /** Validation attempts */
    readonly validationAttempts: number;
  };
}
