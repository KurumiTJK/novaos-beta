// ═══════════════════════════════════════════════════════════════════════════════
// EXPLORE INTENT CLASSIFIER — LLM-Based Intent Detection
// NovaOS Gates — Phase 14A: SwordGate Explore Module
// ═══════════════════════════════════════════════════════════════════════════════
//
// Replaces fragile regex pattern matching with robust LLM-based intent classification.
//
// Why LLM instead of patterns?
//   - Users don't speak in templates
//   - Handles typos, slang, preambles naturally
//   - Understands intent regardless of phrasing
//   - No maintenance burden for new phrasings
//
// Intents:
//   - continue: User is engaging with exploration
//   - skip: User wants to move forward to plan creation
//   - confirm: User is confirming a proposed goal
//   - reject: User is rejecting/modifying a proposed goal
//   - clarify: User is asking for clarification
//   - exit: User wants to abandon the flow
//   - off_topic: User went off-topic
//
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Possible user intents during exploration.
 */
export type ExploreIntent =
  | 'continue'      // User is engaging with exploration, answering questions
  | 'skip'          // User wants to skip exploration and move to plan creation
  | 'confirm'       // User is confirming a proposed goal
  | 'reject'        // User is rejecting or wants to modify a proposed goal
  | 'clarify'       // User is asking the assistant for clarification
  | 'exit'          // User wants to abandon the goal creation flow entirely
  | 'off_topic';    // User's message is unrelated to goal setting

/**
 * Result of intent classification.
 */
export interface ExploreIntentResult {
  /** Classified intent */
  readonly intent: ExploreIntent;

  /** Confidence in the classification (0-1) */
  readonly confidence: number;

  /** If user stated a clear goal inline, extract it */
  readonly extractedGoal?: string;

  /** Brief explanation of why this intent was chosen */
  readonly reasoning: string;
}

/**
 * Configuration for the intent classifier.
 */
export interface ExploreIntentClassifierConfig {
  /** OpenAI model to use (default: gpt-4o-mini) */
  readonly model: string;

  /** Temperature for classification (default: 0.1 for consistency) */
  readonly temperature: number;

  /** Maximum tokens for response (default: 150) */
  readonly maxTokens: number;

  /** Timeout in milliseconds (default: 10000) */
  readonly timeoutMs: number;
}

/**
 * Default configuration.
 */
export const DEFAULT_INTENT_CLASSIFIER_CONFIG: ExploreIntentClassifierConfig = {
  model: 'gpt-4o-mini',
  temperature: 0.1,
  maxTokens: 150,
  timeoutMs: 10000,
} as const;

// ═══════════════════════════════════════════════════════════════════════════════
// CLASSIFICATION PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

const INTENT_CLASSIFICATION_PROMPT = `You are classifying user intent during a goal exploration conversation for a learning platform.

The user is defining what they want to learn. Based on their message and the conversation stage, classify their intent.

## Intents

- **continue**: User is engaging with the exploration—answering questions, sharing information, discussing interests. They're participating in the conversation.

- **skip**: User wants to stop exploring and move forward to creating a plan NOW. They're impatient or ready to proceed. Examples:
  - "let's just start"
  - "create the lesson"
  - "can we begin already?"
  - "I'm ready"
  - "just make it"
  - "build the plan"
  - Any variation expressing readiness to proceed

- **confirm**: User is agreeing to a proposed goal. Only applies in PROPOSING stage. Examples:
  - "yes"
  - "that's it"
  - "perfect"
  - "sounds good"
  - "exactly"

- **reject**: User is disagreeing with or wanting to modify a proposed goal. Only applies in PROPOSING stage. Examples:
  - "no, that's not quite right"
  - "not exactly"
  - "change it to..."
  - "actually I meant..."

- **clarify**: User is asking YOU a question, not answering one. Examples:
  - "what do you mean?"
  - "can you explain?"
  - "I don't understand"

- **exit**: User wants to stop entirely and do something else. Examples:
  - "never mind"
  - "cancel"
  - "forget it"
  - "I changed my mind"

- **off_topic**: User's message is completely unrelated to learning goals. Examples:
  - "what's the weather?"
  - "tell me a joke"

## Current Stage
{stage}

## Recent Conversation
{context}

## User Message
"{message}"

Respond with JSON only, no markdown code blocks:
{"intent":"continue|skip|confirm|reject|clarify|exit|off_topic","confidence":0.0-1.0,"extractedGoal":"if user stated a clear goal, extract it here or null","reasoning":"brief explanation"}`;

// ═══════════════════════════════════════════════════════════════════════════════
// FAST-PATH PATTERNS (Obvious cases only)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Ultra-obvious confirmation patterns.
 * Only matches single-word or very short confirmations.
 */
const FAST_CONFIRM_PATTERNS: RegExp[] = [
  /^(yes|yeah|yep|yup|sure|ok|okay|perfect|exactly|correct|right)\.?!?$/i,
  /^(sounds? good|looks? good)\.?!?$/i,
];

/**
 * Ultra-obvious rejection patterns.
 * Only matches single-word rejections.
 */
const FAST_REJECT_PATTERNS: RegExp[] = [
  /^(no|nope|nah|wrong)\.?!?$/i,
  /^not (quite|exactly|really)\.?$/i,
];

/**
 * Ultra-obvious exit patterns.
 */
const FAST_EXIT_PATTERNS: RegExp[] = [
  /^(cancel|stop|quit|exit|nevermind|never mind)\.?!?$/i,
  /^forget (it|this)\.?$/i,
];

// ═══════════════════════════════════════════════════════════════════════════════
// INTENT CLASSIFIER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * LLM-based intent classifier for the explore phase.
 *
 * Uses GPT-4o-mini to understand user intent regardless of phrasing,
 * with fast-path pattern matching for trivial cases.
 */
export class ExploreIntentClassifier {
  private readonly openai: OpenAI;
  private readonly config: ExploreIntentClassifierConfig;

  constructor(
    openaiApiKey?: string,
    config?: Partial<ExploreIntentClassifierConfig>
  ) {
    const key = openaiApiKey ?? process.env.OPENAI_API_KEY;
    if (!key) {
      throw new Error('OpenAI API key required for ExploreIntentClassifier');
    }

    this.openai = new OpenAI({ apiKey: key });
    this.config = { ...DEFAULT_INTENT_CLASSIFIER_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN CLASSIFICATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Classify user intent.
   *
   * @param message - The user's message
   * @param stage - Current exploration stage ('exploring' or 'proposing')
   * @param recentHistory - Recent conversation messages for context
   */
  async classify(
    message: string,
    stage: 'exploring' | 'proposing',
    recentHistory: string[] = []
  ): Promise<ExploreIntentResult> {
    const normalized = message.trim();

    // Fast-path: Check for trivial patterns (saves API call)
    const fastResult = this.fastPathClassify(normalized, stage);
    if (fastResult) {
      console.log('[EXPLORE_INTENT] Fast-path:', fastResult.intent, `(${fastResult.confidence})`);
      return fastResult;
    }

    // Full LLM classification
    try {
      return await this.llmClassify(normalized, stage, recentHistory);
    } catch (error) {
      console.error('[EXPLORE_INTENT] Classification failed, using fallback:', error);
      return this.buildFallbackResult(normalized, stage);
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
    stage: 'exploring' | 'proposing'
  ): ExploreIntentResult | null {
    // Only use fast-path for very short messages
    if (message.length > 30) {
      return null;
    }

    // Confirmations only valid in proposing stage
    if (stage === 'proposing') {
      if (FAST_CONFIRM_PATTERNS.some(p => p.test(message))) {
        return {
          intent: 'confirm',
          confidence: 0.98,
          reasoning: 'Fast-path: obvious confirmation',
        };
      }

      if (FAST_REJECT_PATTERNS.some(p => p.test(message))) {
        return {
          intent: 'reject',
          confidence: 0.98,
          reasoning: 'Fast-path: obvious rejection',
        };
      }
    }

    // Exit patterns valid in any stage
    if (FAST_EXIT_PATTERNS.some(p => p.test(message))) {
      return {
        intent: 'exit',
        confidence: 0.98,
        reasoning: 'Fast-path: obvious exit request',
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
    stage: 'exploring' | 'proposing',
    recentHistory: string[]
  ): Promise<ExploreIntentResult> {
    // Build context
    const stageDescription = stage === 'proposing'
      ? 'PROPOSING - A goal has been proposed and we are waiting for the user to confirm or reject it.'
      : 'EXPLORING - We are actively discussing what the user wants to learn. No goal has been proposed yet.';

    const context = recentHistory.length > 0
      ? recentHistory.slice(-4).join('\n')
      : 'No prior messages in this session.';

    const prompt = INTENT_CLASSIFICATION_PROMPT
      .replace('{stage}', stageDescription)
      .replace('{context}', context)
      .replace('{message}', message);

    const response = await this.openai.chat.completions.create({
      model: this.config.model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
    });

    const content = response.choices[0]?.message?.content?.trim() ?? '';
    const result = this.parseResponse(content);

    console.log('[EXPLORE_INTENT] LLM classification:', result.intent,
      `(${result.confidence.toFixed(2)})`, '-', result.reasoning);

    return result;
  }

  /**
   * Parse LLM response into ExploreIntentResult.
   */
  private parseResponse(content: string): ExploreIntentResult {
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
        extractedGoal: parsed.extractedGoal || undefined,
        reasoning: String(parsed.reasoning || 'No reasoning provided'),
      };
    } catch (error) {
      console.warn('[EXPLORE_INTENT] Failed to parse response:', content);
      return {
        intent: 'continue',
        confidence: 0.5,
        reasoning: 'Failed to parse LLM response, defaulting to continue',
      };
    }
  }

  /**
   * Validate and normalize intent string.
   */
  private validateIntent(intent: unknown): ExploreIntent {
    const valid: ExploreIntent[] = [
      'continue', 'skip', 'confirm', 'reject', 'clarify', 'exit', 'off_topic'
    ];

    if (typeof intent === 'string' && valid.includes(intent as ExploreIntent)) {
      return intent as ExploreIntent;
    }

    return 'continue';
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // FALLBACK
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Build a safe fallback result when classification fails.
   */
  private buildFallbackResult(
    message: string,
    stage: 'exploring' | 'proposing'
  ): ExploreIntentResult {
    // Conservative fallback: if in proposing stage and message is short,
    // treat as potential confirmation. Otherwise, continue.
    if (stage === 'proposing' && message.length < 20) {
      return {
        intent: 'continue',
        confidence: 0.4,
        reasoning: 'Classification failed, conservative fallback to continue',
      };
    }

    return {
      intent: 'continue',
      confidence: 0.5,
      reasoning: 'Classification failed, defaulting to continue',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create an ExploreIntentClassifier instance.
 */
export function createExploreIntentClassifier(
  openaiApiKey?: string,
  config?: Partial<ExploreIntentClassifierConfig>
): ExploreIntentClassifier {
  return new ExploreIntentClassifier(openaiApiKey, config);
}
