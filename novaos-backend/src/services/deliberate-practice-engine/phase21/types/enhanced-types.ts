// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 21: ENHANCED TYPES — Science-Based Learning Extensions
// NovaOS — Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// These types EXTEND the existing DailyDrill, WeekPlan, and Skill interfaces.
// Add these fields to the existing interfaces in types.ts.
//
// KEY ADDITIONS:
//   - DrillDayType: 5-day E/S/C/F/P pattern
//   - LearningDomain: Domain classification for content adaptation
//   - Enhanced drill fields: prime, do, done, stuck, unstuck, why, reflect
//   - Enhanced week fields: skill, competenceProof
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// LEARNING DOMAINS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Learning domain classification.
 * Determines how drills are structured, validated, and displayed.
 */
export type LearningDomain =
  | 'technical'      // Programming, DevOps, Data Science, Math
  | 'creative'       // Music, Art, Writing, Design
  | 'language'       // Spanish, Japanese, Sign Language
  | 'physical'       // Sports, Yoga, Dance, Martial Arts
  | 'knowledge'      // History, Philosophy, Science
  | 'professional'   // Leadership, Negotiation, Public Speaking
  | 'craft'          // Woodworking, Cooking, Gardening
  | 'mixed';         // Combination of domains

/**
 * All valid learning domains.
 */
export const LEARNING_DOMAINS: readonly LearningDomain[] = [
  'technical',
  'creative',
  'language',
  'physical',
  'knowledge',
  'professional',
  'craft',
  'mixed',
] as const;

/**
 * Domain-specific configuration.
 */
export interface DomainProfile {
  readonly domain: LearningDomain;
  readonly proofType: 'build' | 'perform' | 'explain' | 'create' | 'do';
  readonly failureMode: 'error' | 'mistake' | 'flaw' | 'gap' | 'weakness';
  readonly artifactType: 'code' | 'recording' | 'writing' | 'output' | 'demonstration';
  readonly hasGivenMaterial: boolean;
  readonly preferredResources: readonly ResourceType[];
}

export type ResourceType = 'video' | 'article' | 'docs' | 'tutorial' | 'interactive' | 'course' | 'book' | 'audio';

export const DOMAIN_PROFILES: Record<LearningDomain, DomainProfile> = {
  technical: {
    domain: 'technical',
    proofType: 'build',
    failureMode: 'error',
    artifactType: 'code',
    hasGivenMaterial: true,
    preferredResources: ['docs', 'tutorial', 'video', 'interactive'],
  },
  creative: {
    domain: 'creative',
    proofType: 'perform',
    failureMode: 'mistake',
    artifactType: 'recording',
    hasGivenMaterial: true,
    preferredResources: ['video', 'tutorial', 'course'],
  },
  language: {
    domain: 'language',
    proofType: 'do',
    failureMode: 'mistake',
    artifactType: 'demonstration',
    hasGivenMaterial: true,
    preferredResources: ['video', 'interactive', 'audio'],
  },
  physical: {
    domain: 'physical',
    proofType: 'do',
    failureMode: 'weakness',
    artifactType: 'demonstration',
    hasGivenMaterial: false,
    preferredResources: ['video', 'tutorial'],
  },
  knowledge: {
    domain: 'knowledge',
    proofType: 'explain',
    failureMode: 'gap',
    artifactType: 'writing',
    hasGivenMaterial: true,
    preferredResources: ['article', 'book', 'video', 'docs'],
  },
  professional: {
    domain: 'professional',
    proofType: 'do',
    failureMode: 'flaw',
    artifactType: 'demonstration',
    hasGivenMaterial: true,
    preferredResources: ['video', 'article', 'book'],
  },
  craft: {
    domain: 'craft',
    proofType: 'create',
    failureMode: 'mistake',
    artifactType: 'output',
    hasGivenMaterial: true,
    preferredResources: ['video', 'tutorial', 'article'],
  },
  mixed: {
    domain: 'mixed',
    proofType: 'build',
    failureMode: 'error',
    artifactType: 'output',
    hasGivenMaterial: true,
    preferredResources: ['video', 'tutorial', 'docs'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// DRILL DAY TYPES (5-Day Pattern)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * The 5-day learning pattern based on learning science.
 */
export type DrillDayType =
  | 'encounter'   // Day 1: First exposure, maximum scaffolding
  | 'struggle'    // Day 2: Attempt without aids (desirable difficulty)
  | 'connect'     // Day 3: Variation + link to prior knowledge
  | 'fail'        // Day 4: Intentional failure → diagnosis → repair
  | 'prove';      // Day 5: Demonstrate competence, zero aids

export const DRILL_DAY_TYPES: readonly DrillDayType[] = [
  'encounter', 'struggle', 'connect', 'fail', 'prove',
] as const;

export type ResourcePolicy = 'available' | 'after_attempt' | 'hint_only' | 'none';

export interface DayTypeConfig {
  readonly dayNumber: 1 | 2 | 3 | 4 | 5;
  readonly type: DrillDayType;
  readonly principle: string;
  readonly action: string;
  readonly cognitiveLoad: 'low' | 'medium' | 'high' | 'retrieval';
  readonly hasGivenMaterial: boolean;
  readonly resourcePolicy: ResourcePolicy;
}

export const DAY_TYPE_CONFIGS: Record<DrillDayType, DayTypeConfig> = {
  encounter: {
    dayNumber: 1,
    type: 'encounter',
    principle: 'First exposure with maximum scaffolding',
    action: 'Copy exactly, see it work',
    cognitiveLoad: 'low',
    hasGivenMaterial: true,
    resourcePolicy: 'available',
  },
  struggle: {
    dayNumber: 2,
    type: 'struggle',
    principle: 'Attempt WITHOUT aids (desirable difficulty)',
    action: 'Try yourself first, reference only after 5-min attempt',
    cognitiveLoad: 'high',
    hasGivenMaterial: false,
    resourcePolicy: 'after_attempt',
  },
  connect: {
    dayNumber: 3,
    type: 'connect',
    principle: 'Link to prior knowledge, explain WHY',
    action: 'Variation + self-explanation + interleave',
    cognitiveLoad: 'medium',
    hasGivenMaterial: false,
    resourcePolicy: 'available',
  },
  fail: {
    dayNumber: 4,
    type: 'fail',
    principle: 'Intentional failure → diagnosis → repair',
    action: 'Break it on purpose, understand WHY, fix it',
    cognitiveLoad: 'high',
    hasGivenMaterial: true,
    resourcePolicy: 'hint_only',
  },
  prove: {
    dayNumber: 5,
    type: 'prove',
    principle: 'Demonstrate competence with ZERO aids',
    action: 'Test conditions, no reference, pass/fail',
    cognitiveLoad: 'retrieval',
    hasGivenMaterial: false,
    resourcePolicy: 'none',
  },
};

export function getDayType(dayNumber: 1 | 2 | 3 | 4 | 5): DrillDayType {
  const mapping: Record<number, DrillDayType> = {
    1: 'encounter', 2: 'struggle', 3: 'connect', 4: 'fail', 5: 'prove',
  };
  return mapping[dayNumber]!;
}

export function getDayNumber(dayType: DrillDayType): 1 | 2 | 3 | 4 | 5 {
  const mapping: Record<DrillDayType, 1 | 2 | 3 | 4 | 5> = {
    encounter: 1, struggle: 2, connect: 3, fail: 4, prove: 5,
  };
  return mapping[dayType];
}

// ─────────────────────────────────────────────────────────────────────────────────
// GIVEN MATERIAL TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type GivenMaterialType =
  | 'code'          // Code to copy (technical)
  | 'text'          // Text to read/repeat (language, knowledge)
  | 'steps'         // Steps to follow (physical, craft)
  | 'notation'      // Musical notation, diagrams (creative)
  | 'broken_code'   // Code with bugs to fix (technical Day 4)
  | 'broken_text'   // Text with errors to correct (language Day 4)
  | 'video_ref';    // Video timestamp reference (physical)

// ─────────────────────────────────────────────────────────────────────────────────
// ENHANCED DRILL FIELDS (Add to existing DailyDrill interface)
// ─────────────────────────────────────────────────────────────────────────────────

export interface EnhancedDrillFields {
  // DAY TYPE
  readonly dayType: DrillDayType;
  readonly globalDayNumber: number;

  // PRIME (Spaced retrieval)
  readonly prime: string | null;
  readonly primeAnswer: string | null;

  // DO (Main action)
  readonly do: string;
  readonly givenMaterial: string | null;
  readonly givenMaterialType: GivenMaterialType | null;

  // DONE (Binary success)
  readonly done: string;

  // STUCK/UNSTUCK
  readonly stuck: string;
  readonly unstuck: string;

  // WHY/REFLECT
  readonly why: string;
  readonly reflect: string;

  // RESOURCES
  readonly resourceTopics: readonly string[];
  readonly resourcePolicy: ResourcePolicy;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ENHANCED WEEK PLAN FIELDS (Add to existing WeekPlan interface)
// ─────────────────────────────────────────────────────────────────────────────────

export interface EnhancedWeekPlanFields {
  /** The ONE skill for this week */
  readonly skill: string;
  /** Day 5 PROVE criteria */
  readonly competenceProof: string;
  /** Learning domain */
  readonly domain: LearningDomain;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FETCHED RESOURCE (Runtime only)
// ─────────────────────────────────────────────────────────────────────────────────

export interface FetchedResource {
  readonly title: string;
  readonly url: string;
  readonly type: ResourceType;
  readonly section?: string;
  readonly estimatedMinutes?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

export const DONE_BANNED_WORDS: readonly string[] = [
  'understand', 'learn', 'know', 'feel', 'comfortable', 
  'familiar', 'grasp', 'comprehend', 'confident', 'get', 'appreciate',
] as const;

export const UNSTUCK_BANNED_PHRASES: readonly string[] = [
  'read the docs', 'read documentation', 'google it', 'search online',
  'try again', 'practice more', 'keep trying', 'look it up',
  'check the manual', 'review the material',
] as const;

export const STUCK_BANNED_PHRASES: readonly string[] = [
  'common mistakes', 'common errors', 'various issues',
  'might have problems', 'could struggle', 'may find it difficult',
] as const;

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE GUARDS
// ─────────────────────────────────────────────────────────────────────────────────

export function isLearningDomain(value: unknown): value is LearningDomain {
  return typeof value === 'string' && LEARNING_DOMAINS.includes(value as LearningDomain);
}

export function isDrillDayType(value: unknown): value is DrillDayType {
  return typeof value === 'string' && DRILL_DAY_TYPES.includes(value as DrillDayType);
}
