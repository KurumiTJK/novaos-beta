// ═══════════════════════════════════════════════════════════════════════════════
// LESSON INTENT CLASSIFIER — Simple Intent Detection
// NovaOS Gates — Phase 20: Simplified Lesson Mode
// ═══════════════════════════════════════════════════════════════════════════════
//
// LLM-based intent classifier for 7 lesson intents:
//   - view: Show goals or current drill
//   - start: Begin lesson
//   - complete: Mark done
//   - pause: Save and exit
//   - delete: Delete goal
//   - cancel: Exit without saving
//   - select: User picked a goal
//   - question: Asking about lesson content
//
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';

import type { LessonIntent, LessonIntentResult, LessonStage } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

const INTENT_DEFINITIONS = `
## Intent Definitions

**view** — Show goals list, goal details, or current drill
Examples: "view", "show my goals", "what are my goals", "show me goal 2", "what's my lesson"

**start** — Start a new lesson or resume practice
Examples: "start", "start rust", "let's go", "begin", "practice", "start my lesson"

**complete** — Mark the current lesson as done (only valid when in lesson mode)
Examples: "done", "finished", "completed", "I did it", "mark complete"

**pause** — Save progress and exit lesson mode
Examples: "pause", "save", "I'll continue later", "stop for now", "take a break"

**delete** — Delete a goal
Examples: "delete", "delete goal 1", "remove rust goal", "delete all"

**cancel** — Exit lesson mode without saving
Examples: "cancel", "nevermind", "exit", "quit", "go back"

**select** — User is selecting/choosing a goal (by number or name)
Examples: "1", "2", "rust", "the first one", "goal 2", "piano"

**question** — User is asking about the lesson content (only valid when in lesson mode)
Examples: "what does this mean?", "can you explain?", "I don't understand", "help me with this"
`;

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSIFICATION PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

const CLASSIFICATION_PROMPT = `You are classifying user intent for a learning practice system.

${INTENT_DEFINITIONS}

## Current Mode
{mode}

## User's Goals
{goals}

## User Message
"{message}"

## Instructions
1. Match the user's message to the most appropriate intent
2. Extract any goal reference (name, number like "1" or "goal 2", or partial match like "rust")
3. Consider the current mode when classifying:
   - In "idle" or "selecting" mode: complete/pause/question are invalid, use "view" or "start"
   - In "active" mode: complete/pause/question are valid
   - In "confirming_review" mode: treat "yes"/"ok" as "start", "no"/"cancel" as "cancel"

## Important Rules
- If user just says a number or goal name, it's likely "select"
- "view" without a goal reference shows all goals
- "view" with a goal reference shows that goal's details
- "start" without a goal reference prompts for selection
- "start" with a goal reference starts that goal directly
- If message doesn't match any intent clearly, use "view" as fallback

Respond with JSON only, no markdown:
{"intent":"<intent>","confidence":0.0-1.0,"goalReference":"<goal name/number or null>","reasoning":"<brief explanation>"}`;

// ═══════════════════════════════════════════════════════════════════════════════
// FAST-PATH PATTERNS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Fast-path patterns for obvious intents (skip LLM call).
 */
const FAST_PATH_PATTERNS: Array<{
  patterns: RegExp[];
  intent: LessonIntent;
  confidence: number;
}> = [
  // Complete
  {
    patterns: [/^(done|finished|completed|did it|i did it)\.?!?$/i],
    intent: 'complete',
    confidence: 0.98,
  },
  // Cancel
  {
    patterns: [/^(cancel|nevermind|exit|quit|go back)\.?!?$/i],
    intent: 'cancel',
    confidence: 0.98,
  },
  // Pause
  {
    patterns: [/^(pause|stop|save|break)\.?!?$/i],
    intent: 'pause',
    confidence: 0.95,
  },
  // Start
  {
    patterns: [/^(start|begin|go|let'?s go)\.?!?$/i],
    intent: 'start',
    confidence: 0.95,
  },
  // View
  {
    patterns: [/^(view|show|list|goals)\.?!?$/i],
    intent: 'view',
    confidence: 0.95,
  },
  // Select (numbers and ordinals)
  {
    patterns: [
      /^[1-9]$/,                    // Single digit: 1, 2, 3...
      /^[1-9]\d?$/,                 // One or two digits: 1-99
      /^#?[1-9]\d?\.?$/,            // With optional # or dot: #1, 1.
      /^(option|number|choice)\s*#?[1-9]\d?$/i,  // "option 1"
      /^(the\s+)?(first|second|third|fourth|fifth)(\s+one)?$/i,  // ordinals
    ],
    intent: 'select',
    confidence: 0.95,
  },
  // Yes (for confirming_review)
  {
    patterns: [/^(yes|yeah|yep|ok|okay|sure)\.?!?$/i],
    intent: 'start',
    confidence: 0.95,
  },
  // No (for confirming_review)
  {
    patterns: [/^(no|nope|nah)\.?!?$/i],
    intent: 'cancel',
    confidence: 0.95,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSIFIER CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Context for intent classification.
 */
export interface LessonIntentContext {
  /** Current lesson mode stage */
  readonly stage: LessonStage;

  /** Available goals */
  readonly goals: readonly {
    readonly id: string;
    readonly title: string;
    readonly completedToday: boolean;
  }[];
}

/**
 * LLM-based intent classifier for lesson mode.
 */
export class LessonIntentClassifier {
  private readonly openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Classify user message intent.
   */
  async classify(
    message: string,
    context: LessonIntentContext
  ): Promise<LessonIntentResult> {
    const trimmed = message.trim();

    // Try fast-path for short, obvious messages
    if (trimmed.length < 20) {
      const fastResult = this.tryFastPath(trimmed, context.stage);
      if (fastResult) {
        console.log(`[LESSON_INTENT] Fast-path: ${fastResult.intent} (${fastResult.confidence})`);
        return fastResult;
      }
    }

    // Use LLM for complex messages
    return this.classifyWithLLM(trimmed, context);
  }

  /**
   * Try to classify using fast-path patterns.
   */
  private tryFastPath(
    message: string,
    stage: LessonStage
  ): LessonIntentResult | null {
    for (const { patterns, intent, confidence } of FAST_PATH_PATTERNS) {
      if (patterns.some(p => p.test(message))) {
        // Validate intent for current stage
        if (!this.isValidIntentForStage(intent, stage)) {
          continue;
        }

        // Extract goal reference for select intent
        const goalReference = intent === 'select' ? message : null;

        return {
          intent,
          confidence,
          goalReference,
          reasoning: 'Fast-path pattern match',
        };
      }
    }

    return null;
  }

  /**
   * Check if intent is valid for current stage.
   */
  private isValidIntentForStage(intent: LessonIntent, stage: LessonStage): boolean {
    switch (stage) {
      case 'idle':
        // Only view, start, delete valid in idle
        return ['view', 'start', 'delete'].includes(intent);

      case 'selecting':
        // View, start, select, cancel, delete valid when selecting
        return ['view', 'start', 'select', 'cancel', 'delete'].includes(intent);

      case 'active':
        // All intents valid in active mode
        return true;

      case 'confirming_review':
        // Only start (yes), cancel (no), view valid
        return ['start', 'cancel', 'view'].includes(intent);

      default:
        return true;
    }
  }

  /**
   * Classify using LLM.
   */
  private async classifyWithLLM(
    message: string,
    context: LessonIntentContext
  ): Promise<LessonIntentResult> {
    // Format goals list
    const goalsText = context.goals.length === 0
      ? 'No goals created yet.'
      : context.goals
          .map((g, i) => `${i + 1}. ${g.title}${g.completedToday ? ' (completed today)' : ''}`)
          .join('\n');

    // Format mode description
    const modeText = this.formatModeDescription(context.stage);

    // Build prompt
    const prompt = CLASSIFICATION_PROMPT
      .replace('{mode}', modeText)
      .replace('{goals}', goalsText)
      .replace('{message}', message);

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 150,
      });

      const content = response.choices[0]?.message?.content?.trim() ?? '';

      // Parse JSON response
      const result = this.parseResponse(content);

      console.log(
        `[LESSON_INTENT] LLM classification: ${result.intent} (${result.confidence.toFixed(2)}) - ${result.reasoning}`
      );

      return result;
    } catch (error) {
      console.error('[LESSON_INTENT] LLM classification failed:', error);

      // Fallback to view
      return {
        intent: 'view',
        confidence: 0.5,
        goalReference: null,
        reasoning: 'LLM classification failed, defaulting to view',
      };
    }
  }

  /**
   * Format mode description for prompt.
   */
  private formatModeDescription(stage: LessonStage): string {
    switch (stage) {
      case 'idle':
        return 'User is NOT in lesson mode (idle). They can view goals, start a lesson, or delete.';
      case 'selecting':
        return 'User is SELECTING a goal. They need to pick which goal to practice.';
      case 'active':
        return 'User is IN LESSON MODE (active). They can complete, pause, cancel, or ask questions.';
      case 'confirming_review':
        return 'User completed today already. Asking if they want to REVIEW. "yes" = start, "no" = cancel.';
      default:
        return 'Unknown mode.';
    }
  }

  /**
   * Parse LLM response JSON.
   */
  private parseResponse(content: string): LessonIntentResult {
    try {
      // Clean potential markdown
      const cleaned = content.replace(/```json\n?|\n?```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      const intent = parsed.intent as LessonIntent;
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.8;
      const goalReference = parsed.goalReference ?? null;
      const reasoning = parsed.reasoning ?? 'LLM classification';

      // Validate intent
      const validIntents: LessonIntent[] = [
        'view', 'start', 'complete', 'pause', 'delete', 'cancel', 'select', 'question'
      ];
      if (!validIntents.includes(intent)) {
        return {
          intent: 'view',
          confidence: 0.5,
          goalReference: null,
          reasoning: `Invalid intent "${intent}", defaulting to view`,
        };
      }

      return { intent, confidence, goalReference, reasoning };
    } catch (error) {
      console.error('[LESSON_INTENT] Failed to parse LLM response:', content);
      return {
        intent: 'view',
        confidence: 0.5,
        goalReference: null,
        reasoning: 'Failed to parse LLM response',
      };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a LessonIntentClassifier instance.
 */
export function createLessonIntentClassifier(apiKey?: string): LessonIntentClassifier | null {
  if (!apiKey) {
    console.warn('[LESSON_INTENT] No OpenAI API key provided, classifier disabled');
    return null;
  }

  return new LessonIntentClassifier(apiKey);
}
