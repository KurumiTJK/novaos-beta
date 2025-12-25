// ═══════════════════════════════════════════════════════════════════════════════
// SWORD TYPES — Goals, Quests, Plans, Sparks (Nova Constitution §2.3)
// ═══════════════════════════════════════════════════════════════════════════════
//
// Sword enables progress through directed action, combining long-term guidance
// with immediate execution.
//
// Hierarchy:
//   Goal → Quest → Step → Spark
//
// - Goal: Long-term desired state (e.g., "Launch my startup")
// - Quest: Milestone toward a goal (e.g., "Complete MVP")
// - Step: Ordered action within a quest (e.g., "Set up database")
// - Spark: Minimal, immediate action (e.g., "Create schema.sql file")
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// INTEREST STACK (Constitution §4)
// ─────────────────────────────────────────────────────────────────────────────────

export type InterestLevel = 
  | 'physical_safety'      // 1. Physical safety, mental health, legal safety
  | 'financial_stability'  // 2. Long-term financial stability
  | 'career_capital'       // 3. Career capital and skill development
  | 'reputation'           // 4. Reputation and relationships
  | 'emotional_stability'  // 5. Emotional stability and peace of mind
  | 'comfort';             // 6. Short-term comfort, entertainment

export const INTEREST_PRIORITY: Record<InterestLevel, number> = {
  physical_safety: 1,
  financial_stability: 2,
  career_capital: 3,
  reputation: 4,
  emotional_stability: 5,
  comfort: 6,
};

// ─────────────────────────────────────────────────────────────────────────────────
// GOAL — Long-term desired state
// ─────────────────────────────────────────────────────────────────────────────────

export type GoalStatus = 
  | 'active'       // Currently being pursued
  | 'paused'       // Temporarily on hold
  | 'completed'    // Successfully achieved
  | 'abandoned';   // No longer pursuing

export interface Goal {
  id: string;
  userId: string;
  
  // Core
  title: string;
  description: string;
  desiredOutcome: string;  // What success looks like
  
  // Classification
  interestLevel: InterestLevel;
  tags: string[];
  
  // Status
  status: GoalStatus;
  progress: number;  // 0-100
  
  // Timing
  targetDate?: string;  // ISO date
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  
  // Relations
  questIds: string[];
  
  // Metadata
  motivations: string[];  // Why this matters
  constraints: string[];  // What to avoid
  successCriteria: string[];  // How to measure
}

// ─────────────────────────────────────────────────────────────────────────────────
// QUEST — Milestone toward a goal
// ─────────────────────────────────────────────────────────────────────────────────

export type QuestStatus = 
  | 'not_started'  // Planned but not begun
  | 'active'       // Currently in progress
  | 'blocked'      // Waiting on something
  | 'completed'    // Successfully finished
  | 'skipped';     // Decided not to do

export type QuestPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Quest {
  id: string;
  userId: string;
  goalId: string;
  
  // Core
  title: string;
  description: string;
  outcome: string;  // What completing this achieves
  
  // Status
  status: QuestStatus;
  priority: QuestPriority;
  progress: number;  // 0-100
  
  // Order
  order: number;  // Position in goal's quest sequence
  
  // Timing
  estimatedMinutes?: number;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // Relations
  stepIds: string[];
  blockedBy?: string[];  // IDs of blocking quests/external factors
  
  // Shield integration
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  riskNotes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STEP — Ordered action within a quest
// ─────────────────────────────────────────────────────────────────────────────────

export type StepStatus = 
  | 'pending'      // Not yet started
  | 'active'       // Currently working on
  | 'completed'    // Done
  | 'skipped';     // Decided to skip

export type StepType = 
  | 'action'       // Something to do
  | 'decision'     // Choice to make
  | 'verification' // Something to check/confirm
  | 'milestone';   // Checkpoint/celebration

export type ActionType = 
  // Primary action types (used by routes)
  | 'do'           // General action/task
  | 'learn'        // Learning new material
  | 'decide'       // Making a decision
  | 'create'       // Creating something
  | 'review'       // Reviewing previous material
  // Extended action types (used by curriculum)
  | 'read'         // Reading/watching content
  | 'write'        // Writing/creating content
  | 'practice'     // Hands-on practice
  | 'exercise'     // Completing exercises
  | 'project'      // Working on a project
  | 'discuss'      // Discussion/collaboration
  | 'reflect';     // Reflection/journaling

export interface Step {
  id: string;
  questId: string;
  
  // Core
  title: string;
  description?: string;
  type: StepType;
  actionType?: ActionType;  // More specific action classification
  
  // Status
  status: StepStatus;
  order: number;
  
  // Timing
  estimatedMinutes?: number;
  actualMinutes?: number;  // How long it actually took
  createdAt: string;
  completedAt?: string;
  
  // Day-based scheduling
  dayNumber?: number;      // Day in the learning sequence
  scheduledDate?: string;  // ISO date for when this step is scheduled
  
  // Spark generation
  sparkPrompt?: string;  // Hint for generating spark
  lastSparkId?: string;
  
  // Completion
  completionNotes?: string;
  skipReason?: string;     // Why it was skipped
  skipNotes?: string;      // Alias for skipReason (route compatibility)
  verificationRequired: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK — Minimal, immediate action (Constitution §2.3)
// ─────────────────────────────────────────────────────────────────────────────────
//
// "Spark — produces a minimal, low-friction action that creates immediate
// forward motion. Sword exists to convert intention into motion without
// relying on motivation or willpower."
//

export type SparkStatus = 
  | 'suggested'    // Generated, not yet acted on
  | 'accepted'     // User said they'll do it
  | 'completed'    // User confirmed done
  | 'skipped'      // User skipped it
  | 'expired';     // Too old, no longer relevant

export type SparkVariant = 
  | 'standard'     // Normal spark
  | 'reduced'      // Reduced scope (escalation level 1)
  | 'minimal'      // Minimal scope (escalation level 2)
  | 'micro';       // Micro-action (escalation level 3)

export interface Spark {
  id: string;
  userId: string;
  stepId?: string;   // May be generated without a step
  questId?: string;
  goalId?: string;   // Direct goal reference for quick lookups
  
  // Core
  action: string;           // The specific action (imperative, < 100 chars)
  rationale: string;        // Why this action (1-2 sentences)
  estimatedMinutes: number; // Should be small (2-15 min typical)
  actualMinutes?: number;   // How long it actually took
  
  // Design principles
  frictionLevel: 'minimal' | 'low' | 'medium';  // How easy to start
  reversible: boolean;      // Can it be undone?
  
  // Escalation
  escalationLevel?: number;  // 0-3, higher = simpler spark
  variant?: SparkVariant;    // Type of spark based on escalation
  
  // Status
  status: SparkStatus;
  
  // Timing
  createdAt: string;
  expiresAt: string;        // Sparks are time-limited
  completedAt?: string;
  scheduledFor?: string;    // When the user plans to do this
  
  // Completion tracking
  completionNotes?: string; // Notes from completing the spark
  skipReason?: string;      // Why the user skipped this spark
  skipNotes?: string;       // Alias for skipReason (route compatibility)
  satisfactionRating?: number; // User satisfaction (1-5)
  
  // Follow-up
  nextSparkHint?: string;   // What might come next
  completionPrompt?: string; // What to ask when done
}

// ─────────────────────────────────────────────────────────────────────────────────
// PATH — The route from current state to desired state
// ─────────────────────────────────────────────────────────────────────────────────
//
// "Path — defines the route from the user's current state to a desired
// future state through ordered milestones and constraints"
//

export interface Path {
  goalId: string;
  
  // Current position
  currentQuestId?: string;
  currentStepId?: string;
  
  // Progress
  completedQuests: number;
  totalQuests: number;
  overallProgress: number;  // 0-100
  
  // Next actions
  nextStep?: Step;
  activeSpark?: Spark;
  
  // Blockers
  blockers: PathBlocker[];
  
  // Timeline
  estimatedCompletionDate?: string;
  daysRemaining?: number;
  onTrack: boolean;
}

export interface PathBlocker {
  type: 'quest_dependency' | 'external' | 'resource' | 'decision';
  description: string;
  questId?: string;
  suggestedAction?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CREATE/UPDATE REQUESTS
// ─────────────────────────────────────────────────────────────────────────────────

export interface CreateGoalRequest {
  title: string;
  description: string;
  desiredOutcome: string;
  interestLevel?: InterestLevel;
  targetDate?: string;
  motivations?: string[];
  constraints?: string[];
  successCriteria?: string[];
  tags?: string[];
}

export interface CreateQuestRequest {
  goalId: string;
  title: string;
  description: string;
  outcome: string;
  priority?: QuestPriority;
  estimatedMinutes?: number;
  targetDate?: string;
  order?: number;
}

export interface CreateStepRequest {
  questId: string;
  title: string;
  description?: string;
  type?: StepType;
  actionType?: ActionType;
  estimatedMinutes?: number;
  sparkPrompt?: string;
  verificationRequired?: boolean;
  order?: number;
  dayNumber?: number;
  scheduledDate?: string;
}

export interface GenerateSparkRequest {
  stepId?: string;
  questId?: string;
  goalId?: string;
  context?: string;  // Additional context for generation
  maxMinutes?: number;
  frictionLevel?: 'minimal' | 'low' | 'medium';
  escalationLevel?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EVENTS (for state machine)
// ─────────────────────────────────────────────────────────────────────────────────

// String event types for convenience (used by routes)
export type GoalEventType = 'START' | 'PAUSE' | 'RESUME' | 'COMPLETE' | 'ABANDON' | 'UPDATE_PROGRESS';
export type QuestEventType = 'START' | 'BLOCK' | 'UNBLOCK' | 'COMPLETE' | 'SKIP' | 'UPDATE_PROGRESS';
export type StepEventType = 'START' | 'COMPLETE' | 'SKIP';
export type SparkEventType = 'ACCEPT' | 'COMPLETE' | 'SKIP' | 'EXPIRE';

// Full event objects with optional payload
export type GoalEvent = 
  | { type: 'START' }
  | { type: 'PAUSE'; reason?: string }
  | { type: 'RESUME' }
  | { type: 'COMPLETE' }
  | { type: 'ABANDON'; reason: string }
  | { type: 'UPDATE_PROGRESS'; progress: number };

export type QuestEvent = 
  | { type: 'START' }
  | { type: 'BLOCK'; reason: string; blockedBy?: string[] }
  | { type: 'UNBLOCK' }
  | { type: 'COMPLETE' }
  | { type: 'SKIP'; reason: string }
  | { type: 'UPDATE_PROGRESS'; progress: number };

export type StepEvent = 
  | { type: 'START' }
  | { type: 'COMPLETE'; notes?: string }
  | { type: 'SKIP'; reason?: string };

export type SparkEvent = 
  | { type: 'ACCEPT' }
  | { type: 'COMPLETE' }
  | { type: 'SKIP'; reason?: string }
  | { type: 'EXPIRE' };

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER: Convert string event to event object
// ─────────────────────────────────────────────────────────────────────────────────

export function toGoalEvent(eventType: GoalEventType | GoalEvent, payload?: Record<string, unknown>): GoalEvent {
  if (typeof eventType === 'object') return eventType;
  switch (eventType) {
    case 'START': return { type: 'START' };
    case 'PAUSE': return { type: 'PAUSE', reason: payload?.reason as string };
    case 'RESUME': return { type: 'RESUME' };
    case 'COMPLETE': return { type: 'COMPLETE' };
    case 'ABANDON': return { type: 'ABANDON', reason: (payload?.reason as string) ?? 'No reason provided' };
    case 'UPDATE_PROGRESS': return { type: 'UPDATE_PROGRESS', progress: (payload?.progress as number) ?? 0 };
  }
}

export function toQuestEvent(eventType: QuestEventType | QuestEvent, payload?: Record<string, unknown>): QuestEvent {
  if (typeof eventType === 'object') return eventType;
  switch (eventType) {
    case 'START': return { type: 'START' };
    case 'BLOCK': return { type: 'BLOCK', reason: (payload?.reason as string) ?? 'Blocked', blockedBy: payload?.blockedBy as string[] };
    case 'UNBLOCK': return { type: 'UNBLOCK' };
    case 'COMPLETE': return { type: 'COMPLETE' };
    case 'SKIP': return { type: 'SKIP', reason: (payload?.reason as string) ?? 'Skipped' };
    case 'UPDATE_PROGRESS': return { type: 'UPDATE_PROGRESS', progress: (payload?.progress as number) ?? 0 };
  }
}

export function toStepEvent(eventType: StepEventType | StepEvent, payload?: Record<string, unknown>): StepEvent {
  if (typeof eventType === 'object') return eventType;
  switch (eventType) {
    case 'START': return { type: 'START' };
    case 'COMPLETE': return { type: 'COMPLETE', notes: payload?.notes as string };
    case 'SKIP': return { type: 'SKIP', reason: payload?.reason as string };
  }
}

export function toSparkEvent(eventType: SparkEventType | SparkEvent, payload?: Record<string, unknown>): SparkEvent {
  if (typeof eventType === 'object') return eventType;
  switch (eventType) {
    case 'ACCEPT': return { type: 'ACCEPT' };
    case 'COMPLETE': return { type: 'COMPLETE' };
    case 'SKIP': return { type: 'SKIP', reason: payload?.reason as string };
    case 'EXPIRE': return { type: 'EXPIRE' };
  }
}
