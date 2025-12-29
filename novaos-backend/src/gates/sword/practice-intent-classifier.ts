// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE INTENT CLASSIFIER — LLM-Based Intent Detection
// NovaOS Gates — Phase 19D: Practice Intent System
// ═══════════════════════════════════════════════════════════════════════════════
//
// Replaces fragile regex pattern matching with robust LLM-based intent classification
// for practice mode commands.
//
// Why LLM instead of patterns?
//   - Users don't speak in templates
//   - Handles typos, slang, preambles naturally
//   - Understands intent regardless of phrasing
//   - No maintenance burden for new phrasings
//   - Extracts goal references, priorities, dates dynamically
//
// Intents:
//   - view_today: Get practice for current/specified goal
//   - view_bundle: See all goals with today's practice status
//   - complete_pass: Mark drill as successfully completed
//   - complete_fail: Mark drill as attempted but failed
//   - skip: Skip today's drill
//   - view_progress: Check progress on a goal
//   - view_week: See week plan
//   - view_goals: List all goals
//   - switch_goal: Change active goal
//   - set_priority: Change goal priority
//   - pause_goal: Pause a goal (with optional date)
//   - resume_goal: Resume a paused goal
//   - delete_goal: Delete a specific goal
//   - delete_all: Delete all goals
//   - start_now: Begin practice early
//   - cancel: Exit practice mode / abort action
//   - unknown: Could not classify
//
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import type { PracticeIntent } from './types.js';
import { isPracticeIntent } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Result of practice intent classification.
 */
export interface PracticeIntentResult {
  /** Classified intent */
  readonly intent: PracticeIntent;

  /** Confidence in the classification (0-1) */
  readonly confidence: number;

  /** Goal reference extracted from message (name, number, or partial match) */
  readonly goalReference?: string;

  /** Priority number if mentioned */
  readonly priority?: number;

  /** Pause until date if mentioned (YYYY-MM-DD) */
  readonly pauseUntil?: string;

  /** Brief explanation of why this intent was chosen */
  readonly reasoning: string;
}

/**
 * Context for practice intent classification.
 */
export interface PracticeIntentContext {
  /** User's active goals */
  readonly goals: ReadonlyArray<{
    id: string;
    title: string;
    status: string;
    paused: boolean;
    priority?: number;
  }>;

  /** Currently active drill, if any */
  readonly activeDrill: {
    goalId: string;
    goalTitle: string;
    skillTitle: string;
  } | null;
}

/**
 * Configuration for the intent classifier.
 */
export interface PracticeIntentClassifierConfig {
  /** OpenAI model to use (default: gpt-4o-mini) */
  readonly model: string;

  /** Temperature for classification (default: 0 for consistency) */
  readonly temperature: number;

  /** Maximum tokens for response (default: 200) */
  readonly maxTokens: number;

  /** Timeout in milliseconds (default: 10000) */
  readonly timeoutMs: number;
}

/**
 * Default configuration.
 */
export const DEFAULT_PRACTICE_INTENT_CONFIG: PracticeIntentClassifierConfig = {
  model: 'gpt-4o-mini',
  temperature: 0,
  maxTokens: 200,
  timeoutMs: 10000,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Intent definitions with descriptions and examples for the LLM.
 */
const INTENT_DEFINITIONS = `
## Intents

### Viewing Practice
- **view_today**: Get today's practice drill for one goal (default if no specific goal mentioned)
  Examples: "what's my lesson", "show my drill", "what should I learn today"

- **view_bundle**: See ALL active goals and their practice status for today
  Examples: "what should I practice today", "show all my goals for today", "practice overview", "what's on my plate"

### Drill Completion
- **complete_pass**: Mark the current drill as successfully completed
  Examples: "done", "completed", "finished", "I did it", "passed", "nailed it"

- **complete_fail**: Mark the current drill as attempted but not passed
  Examples: "I failed", "didn't get it", "struggled", "couldn't complete it", "too hard"

- **skip**: Skip today's drill without attempting
  Examples: "skip", "skip today", "not today", "pass on this one"

### Goal Management
- **view_goals**: List all goals and their status
  Examples: "what are my goals", "show my goals", "list all goals", "my learning goals"

- **switch_goal**: Switch focus to a different goal
  Examples: "switch to rust", "work on piano instead", "change to goal 2", "focus on dog grooming"

- **set_priority**: Change the priority/order of a goal (lower number = higher priority)
  Examples: "set priority 1 for rust", "make piano my top priority", "rust should be priority 2"

- **pause_goal**: Temporarily pause a goal (with optional date)
  Examples: "pause rust", "pause piano until january 15", "take a break from dog grooming for 2 weeks"

- **resume_goal**: Resume a paused goal
  Examples: "resume rust", "unpause piano", "start dog grooming again"

- **delete_goal**: Delete a specific goal permanently
  Examples: "delete rust goal", "remove piano", "delete goal 2"

- **delete_all**: Delete ALL goals (dangerous)
  Examples: "delete all goals", "clear all", "remove everything"

### Other
- **view_progress**: Check progress on a goal
  Examples: "show my progress", "how am I doing", "what's my status"

- **view_week**: See this week's plan
  Examples: "what's this week", "weekly plan", "show the week"

- **start_now**: Begin practice early (before scheduled time)
  Examples: "start now", "begin today", "practice now", "let's go"

- **cancel**: Exit practice mode or abort current action
  Examples: "cancel", "nevermind", "exit", "go back", "stop", "quit"

- **unknown**: Message doesn't match any practice intent
`;

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSIFICATION PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

const CLASSIFICATION_PROMPT = `You are classifying user intent for a learning practice system.

${INTENT_DEFINITIONS}

## User's Goals
{goals}

## Active Drill
{activeDrill}

## Today's Date
{today}

## User Message
"{message}"

## Instructions
1. Match the user's message to the most appropriate intent
2. Extract any goal reference (name, number like "goal 2", or partial match like "rust" for "Learn Rust")
3. Extract priority number if mentioned (1 = highest priority)
4. Extract pause date if mentioned (convert relative dates like "2 weeks" or "next month" to YYYY-MM-DD)
5. If message doesn't clearly match any intent, use "unknown"

## Important Rules
- "view_bundle" is for seeing ALL goals at once
- "view_today" is for getting the drill for ONE specific goal
- Goal references can be: full name, partial name, or "goal N" format
- For pause dates, calculate FUTURE dates from today:
  - "next Monday" = the NEXT upcoming Monday (if today is Monday, this means Monday of next week)
  - "2 weeks" = today + 14 days
  - "next month" = first day of the following month
  - Always return a date AFTER today, never today itself
- If user says "done" or "finished" but has no active drill, use "unknown"

Respond with JSON only, no markdown:
{"intent":"<intent_id>","confidence":0.0-1.0,"goalReference":"<goal name/number or null>","priority":<number or null>,"pauseUntil":"<YYYY-MM-DD or null>","reasoning":"<brief explanation>"}`;

// ═══════════════════════════════════════════════════════════════════════════════
// FAST-PATH PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ultra-obvious completion patterns.
 * Only matches single-word or very short completions.
 */
const FAST_COMPLETE_PASS_PATTERNS: RegExp[] = [
  /^(done|finished|completed|did it|passed)\.?!?$/i,
  /^i (did|finished|completed) it\.?!?$/i,
];

/**
 * Ultra-obvious fail patterns.
 */
const FAST_COMPLETE_FAIL_PATTERNS: RegExp[] = [
  /^(failed|couldn't|too hard)\.?!?$/i,
  /^i (failed|couldn't do it)\.?!?$/i,
];

/**
 * Ultra-obvious skip patterns.
 */
const FAST_SKIP_PATTERNS: RegExp[] = [
  /^(skip|pass|not today)\.?!?$/i,
];

/**
 * Ultra-obvious cancel/exit patterns.
 */
const FAST_CANCEL_PATTERNS: RegExp[] = [
  /^(cancel|quit|exit|stop|nevermind|never mind)\.?!?$/i,
  /^go back\.?$/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT CLASSIFIER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LLM-based intent classifier for practice mode.
 *
 * Uses GPT-4o-mini to understand user intent regardless of phrasing,
 * with fast-path pattern matching for trivial cases.
 */
export class PracticeIntentClassifier {
  private readonly openai: OpenAI;
  private readonly config: PracticeIntentClassifierConfig;

  constructor(
    openaiApiKey?: string,
    config?: Partial<PracticeIntentClassifierConfig>
  ) {
    const key = openaiApiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OpenAI API key required for PracticeIntentClassifier');
    }

    this.openai = new OpenAI({ apiKey: key });
    this.config = { ...DEFAULT_PRACTICE_INTENT_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN CLASSIFICATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Classify user intent for practice mode.
   *
   * @param message - The user's message
   * @param context - Current practice context (goals, active drill)
   */
  async classify(
    message: string,
    context: PracticeIntentContext
  ): Promise<PracticeIntentResult> {
    const normalized = message.trim();

    // Fast-path: Check for trivial patterns (saves API call)
    const fastResult = this.fastPathClassify(normalized, context);
    if (fastResult) {
      console.log('[PRACTICE_INTENT] Fast-path:', fastResult.intent, `(${fastResult.confidence})`);
      return fastResult;
    }

    // Full LLM classification
    try {
      return await this.llmClassify(normalized, context);
    } catch (error) {
      console.error('[PRACTICE_INTENT] Classification failed, using fallback:', error);
      return this.buildFallbackResult(normalized, context);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FAST-PATH CLASSIFICATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Fast-path classification for trivial cases.
   * Only matches ultra-obvious patterns to save API calls.
   * Returns null if unsure—let LLM handle it.
   */
  private fastPathClassify(
    message: string,
    context: PracticeIntentContext
  ): PracticeIntentResult | null {
    // Only use fast-path for very short messages
    if (message.length > 25) {
      return null;
    }

    // Completion patterns only valid if there's an active drill
    if (context.activeDrill) {
      if (FAST_COMPLETE_PASS_PATTERNS.some(p => p.test(message))) {
        return {
          intent: 'complete_pass',
          confidence: 0.98,
          reasoning: 'Fast-path: obvious completion (pass)',
        };
      }

      if (FAST_COMPLETE_FAIL_PATTERNS.some(p => p.test(message))) {
        return {
          intent: 'complete_fail',
          confidence: 0.98,
          reasoning: 'Fast-path: obvious completion (fail)',
        };
      }

      if (FAST_SKIP_PATTERNS.some(p => p.test(message))) {
        return {
          intent: 'skip',
          confidence: 0.98,
          reasoning: 'Fast-path: obvious skip',
        };
      }
    }

    // Cancel patterns valid any time
    if (FAST_CANCEL_PATTERNS.some(p => p.test(message))) {
      return {
        intent: 'cancel',
        confidence: 0.98,
        reasoning: 'Fast-path: obvious cancel/exit',
      };
    }

    // Not obvious enough—use LLM
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // LLM CLASSIFICATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Classify intent using LLM.
   */
  private async llmClassify(
    message: string,
    context: PracticeIntentContext
  ): Promise<PracticeIntentResult> {
    // Build goals description
    const goalsDescription = context.goals.length === 0
      ? '(no goals yet)'
      : context.goals.map((g, i) =>
          `${i + 1}. "${g.title}" [${g.status}${g.paused ? ', PAUSED' : ''}${g.priority ? `, priority ${g.priority}` : ''}]`
        ).join('\n');

    // Build active drill description
    const drillDescription = context.activeDrill
      ? `Currently practicing "${context.activeDrill.skillTitle}" for goal "${context.activeDrill.goalTitle}"`
      : 'No active drill';

    // Get today's date for relative date calculations
    const today = new Date().toISOString().split('T')[0];

    const prompt = CLASSIFICATION_PROMPT
      .replace('{goals}', goalsDescription)
      .replace('{activeDrill}', drillDescription)
      .replace('{today}', today!)
      .replace('{message}', message);

    const response = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    const content = response.choices[0]?.message?.content?.trim() ?? '';
    const result = this.parseResponse(content);

    console.log('[PRACTICE_INTENT] LLM classification:', result.intent,
      `(${result.confidence.toFixed(2)})`, '-', result.reasoning);

    return result;
  }

  /**
   * Parse LLM response into PracticeIntentResult.
   */
  private parseResponse(content: string): PracticeIntentResult {
    try {
      // Handle markdown code blocks if present
      let json = content;
      if (content.includes('```')) {
        const match = content.match(/```(?:json)?\s*([\s\S]*?)```/);
        json = match?.[1]?.trim() ?? content;
      }

      const parsed = JSON.parse(json);

      return {
        intent: this.validateIntent(parsed.intent),
        confidence: Math.max(0, Math.min(1, Number(parsed.confidence) ?? 0.8)),
        goalReference: parsed.goalReference || undefined,
        priority: parsed.priority != null ? Number(parsed.priority) : undefined,
        pauseUntil: parsed.pauseUntil || undefined,
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
      };
    } catch (error) {
      console.warn('[PRACTICE_INTENT] Failed to parse response:', content);
      return {
        intent: 'unknown',
        confidence: 0.5,
        reasoning: 'Failed to parse LLM response',
      };
    }
  }

  /**
   * Validate and normalize intent string.
   */
  private validateIntent(intent: unknown): PracticeIntent {
    if (isPracticeIntent(intent)) {
      return intent;
    }
    return 'unknown';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FALLBACK
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Build a safe fallback result when classification fails.
   */
  private buildFallbackResult(
    message: string,
    context: PracticeIntentContext
  ): PracticeIntentResult {
    // If there are goals and message is lesson-related, default to view_today
    if (context.goals.length > 0 && /lesson|practice|drill|learn/i.test(message)) {
      return {
        intent: 'view_today',
        confidence: 0.4,
        reasoning: 'Classification failed, defaulting to view_today based on keywords',
      };
    }

    return {
      intent: 'unknown',
      confidence: 0.3,
      reasoning: 'Classification failed, unable to determine intent',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a PracticeIntentClassifier instance.
 */
export function createPracticeIntentClassifier(
  openaiApiKey?: string,
  config?: Partial<PracticeIntentClassifierConfig>
): PracticeIntentClassifier {
  return new PracticeIntentClassifier(openaiApiKey, config);
}
