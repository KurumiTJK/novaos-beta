// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 21: PRIME LINKER — Spaced Retrieval Chain
// NovaOS — Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Links PRIME questions across drills to create a spaced retrieval chain:
//   - Day 1 of Week 1: No prime (first drill ever)
//   - Day N: Prime asks about Day N-1's key concept
//   - Week N Day 1: Prime asks about Week N-1 Day 5's key concept
//
// This implements the spacing effect (Ebbinghaus, Cepeda):
//   - Retrieval at start of session strengthens memory
//   - Linking to previous day creates continuous chain
//   - Failed retrieval still improves learning (generation effect)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { DrillDayType, LearningDomain, GivenMaterialType, ResourcePolicy } from '../types/enhanced-types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generated drill content before prime linking.
 */
export interface DrillContent {
  readonly dayType: DrillDayType;
  readonly do: string;
  readonly done: string;
  readonly stuck: string;
  readonly unstuck: string;
  readonly why: string;
  readonly reflect: string;
  readonly givenMaterial: string | null;
  readonly resourceTopics: readonly string[];
}

/**
 * Prime question and answer pair.
 */
export interface PrimePair {
  readonly prime: string;
  readonly primeAnswer: string;
}

/**
 * Drill content with prime linked.
 */
export interface LinkedDrillContent extends DrillContent {
  readonly prime: string | null;
  readonly primeAnswer: string | null;
  readonly globalDayNumber: number;
  readonly weekNumber: number;
  readonly dayInWeek: 1 | 2 | 3 | 4 | 5;
  readonly givenMaterialType?: GivenMaterialType | null;
  readonly resourcePolicy?: ResourcePolicy;
}

/**
 * Week content for prime extraction.
 */
export interface WeekContent {
  readonly weekNumber: number;
  readonly skill: string;
  readonly drills: readonly DrillContent[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// PRIME EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract a prime question from a drill's content.
 * The prime should test recall of the key concept from that drill.
 */
export function extractPrimeFromDrill(
  drill: DrillContent,
  domain: LearningDomain
): PrimePair {
  // Safety check for missing fields
  if (!drill || !drill.do || !drill.done) {
    return {
      prime: 'What did you learn in the previous session?',
      primeAnswer: 'Review your notes from yesterday.',
    };
  }
  
  // Extract key concept from the DO field
  const keyAction = extractKeyAction(drill.do);
  const keyResult = extractKeyResult(drill.done);
  
  // Generate prime question based on domain
  const primeQuestion = generatePrimeQuestion(keyAction, keyResult, domain);
  const primeAnswer = generatePrimeAnswer(drill, domain);
  
  return {
    prime: primeQuestion,
    primeAnswer: primeAnswer,
  };
}

/**
 * Extract the key action from a DO statement.
 */
function extractKeyAction(doStatement: string): string {
  if (!doStatement) return '';
  // Get first 10-15 words, which usually contain the main action
  const words = doStatement.split(/\s+/).slice(0, 12);
  return words.join(' ');
}

/**
 * Extract the key result from a DONE statement.
 */
function extractKeyResult(doneStatement: string): string {
  if (!doneStatement) return '';
  // Get first part before AND/OR
  const parts = doneStatement.split(/\s+(?:AND|OR|,)\s+/i);
  return parts[0]?.trim() ?? doneStatement;
}

/**
 * Generate a prime question for recall.
 */
function generatePrimeQuestion(
  keyAction: string,
  keyResult: string,
  domain: LearningDomain
): string {
  // Domain-specific question patterns
  const patterns: Record<LearningDomain, string[]> = {
    technical: [
      'Without looking: {action}?',
      'From memory: How do you {action}?',
      'Quick recall: What\'s the command to {action}?',
    ],
    creative: [
      'Without looking: {action}?',
      'From memory: How do you {action}?',
      'Quick recall: What\'s the technique for {action}?',
    ],
    language: [
      'Without looking: How do you say "{action}" in the target language?',
      'From memory: {action}?',
      'Quick recall: What\'s the word/phrase for {action}?',
    ],
    physical: [
      'Without looking: What\'s the position for {action}?',
      'From memory: How do you {action}?',
      'Quick recall: What\'s the first step in {action}?',
    ],
    knowledge: [
      'Without looking: {action}?',
      'From memory: What are the key points about {action}?',
      'Quick recall: {action}?',
    ],
    professional: [
      'Without looking: {action}?',
      'From memory: What\'s the approach for {action}?',
      'Quick recall: What\'s the first step in {action}?',
    ],
    craft: [
      'Without looking: {action}?',
      'From memory: What\'s the technique for {action}?',
      'Quick recall: What tools/materials are needed for {action}?',
    ],
    mixed: [
      'Without looking: {action}?',
      'From memory: How do you {action}?',
      'Quick recall: {action}?',
    ],
  };

  const domainPatterns = patterns[domain] ?? patterns.mixed;
  const pattern = domainPatterns[Math.floor(Math.random() * domainPatterns.length)]!;
  
  // Simplify the action for the question
  const simplifiedAction = simplifyAction(keyAction);
  
  return pattern.replace('{action}', simplifiedAction);
}

/**
 * Simplify an action for use in a question.
 */
function simplifyAction(action: string): string {
  // Remove leading verb (the question already provides context)
  const words = action.split(/\s+/);
  
  // If starts with common verbs, remove them
  const removeVerbs = ['write', 'create', 'build', 'implement', 'make', 'do', 'perform', 'execute'];
  if (removeVerbs.includes(words[0]?.toLowerCase() ?? '')) {
    return words.slice(1).join(' ');
  }
  
  // Remove "a", "an", "the" after verb
  if (['a', 'an', 'the'].includes(words[1]?.toLowerCase() ?? '')) {
    return [words[0], ...words.slice(2)].join(' ');
  }
  
  return action;
}

/**
 * Generate a prime answer based on drill content.
 */
function generatePrimeAnswer(
  drill: DrillContent,
  domain: LearningDomain
): string {
  // For technical: use the stuck/unstuck as the key concept
  if (domain === 'technical' && drill.unstuck) {
    // Extract the key fix
    return drill.unstuck;
  }
  
  // For knowledge: use the why
  if (domain === 'knowledge' && drill.why) {
    return drill.why;
  }
  
  // For language: might be in the given material
  if (domain === 'language' && drill.givenMaterial) {
    // First line or phrase
    const lines = drill.givenMaterial.split('\n');
    return lines[0]?.trim() ?? drill.givenMaterial.substring(0, 100);
  }
  
  // Default: use the done statement (abbreviated)
  const doneWords = drill.done.split(/\s+/).slice(0, 10);
  return doneWords.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────────
// PRIME LINKING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Link prime questions across all drills in a goal.
 * 
 * Chain:
 *   Week 1 Day 1: prime = null
 *   Week 1 Day 2: prime from Day 1
 *   Week 1 Day 3: prime from Day 2
 *   Week 1 Day 4: prime from Day 3
 *   Week 1 Day 5: prime from Day 4
 *   Week 2 Day 1: prime from Week 1 Day 5
 *   Week 2 Day 2: prime from Week 2 Day 1
 *   ...
 */
export function linkPrimes(
  weeks: readonly WeekContent[],
  domain: LearningDomain
): readonly LinkedDrillContent[][] {
  const result: LinkedDrillContent[][] = [];
  let globalDayNumber = 0;
  let previousDrill: DrillContent | null = null;

  for (let weekIndex = 0; weekIndex < weeks.length; weekIndex++) {
    const week = weeks[weekIndex]!;
    const weekNumber = week.weekNumber;
    const linkedWeek: LinkedDrillContent[] = [];

    for (let dayIndex = 0; dayIndex < week.drills.length; dayIndex++) {
      const drill = week.drills[dayIndex]!;
      const dayInWeek = (dayIndex + 1) as 1 | 2 | 3 | 4 | 5;
      globalDayNumber++;

      let prime: string | null = null;
      let primeAnswer: string | null = null;

      // Generate prime from previous drill (if exists)
      if (previousDrill) {
        const primePair = extractPrimeFromDrill(previousDrill, domain);
        prime = primePair.prime;
        primeAnswer = primePair.primeAnswer;
      }

      linkedWeek.push({
        ...drill,
        prime,
        primeAnswer,
        globalDayNumber,
        weekNumber,
        dayInWeek,
      });

      previousDrill = drill;
    }

    result.push(linkedWeek);
  }

  return result;
}

/**
 * Link primes for a single week (standalone).
 * Used when generating one week at a time.
 */
export function linkWeekPrimes(
  week: WeekContent,
  previousWeekLastDrill: DrillContent | null,
  domain: LearningDomain,
  globalDayOffset: number = 0
): readonly LinkedDrillContent[] {
  const result: LinkedDrillContent[] = [];
  let previousDrill = previousWeekLastDrill;

  for (let dayIndex = 0; dayIndex < week.drills.length; dayIndex++) {
    const drill = week.drills[dayIndex]!;
    const dayInWeek = (dayIndex + 1) as 1 | 2 | 3 | 4 | 5;
    const globalDayNumber = globalDayOffset + dayIndex + 1;

    let prime: string | null = null;
    let primeAnswer: string | null = null;

    if (previousDrill) {
      const primePair = extractPrimeFromDrill(previousDrill, domain);
      prime = primePair.prime;
      primeAnswer = primePair.primeAnswer;
    }

    result.push({
      ...drill,
      prime,
      primeAnswer,
      globalDayNumber,
      weekNumber: week.weekNumber,
      dayInWeek,
    });

    previousDrill = drill;
  }

  return result;
}

/**
 * Get the last drill of a week for linking to next week.
 */
export function getLastDrillOfWeek(week: WeekContent): DrillContent | null {
  if (week.drills.length === 0) return null;
  return week.drills[week.drills.length - 1] ?? null;
}
