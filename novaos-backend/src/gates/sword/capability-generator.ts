// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GENERATOR — Dynamic Competence + Agency Progressions
// NovaOS Gates — Phase 14: SwordGate
// ═══════════════════════════════════════════════════════════════════════════════
//
// Generates capability-based learning progressions for ANY topic using LLM.
//
// The Universal 5-Stage Competence Model:
//   1. REPRODUCE — Create basic outcome unaided
//   2. MODIFY    — Change it under constraints
//   3. DIAGNOSE  — Find and fix failures
//   4. DESIGN    — Build independently from requirements
//   5. SHIP      — Deploy and defend decisions
//
// THE AGENCY LAYER (What Makes This Different)
// ─────────────────────────────────────────────
// Every stage includes a DECISION POINT — a moment of judgment where:
//   - Multiple options are plausible
//   - Each has real tradeoffs (not strawmen)
//   - There is NO correct answer
//   - The learner must CHOOSE and DEFEND
//
// The diagnostic:
//   If a learner never says "I chose this because the alternatives were worse,"
//   the plan isn't robust yet.
//
// This is what separates:
//   training (compliance) → thinking (agency)
//   execution → adaptation
//   following rails → owning consequences
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError } from '../../types/result.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tradeoff severity — determines visibility.
 * 
 * - 'info': Subtle mention, learner probably already considered it
 * - 'caution': Worth noting, easy to overlook
 * - 'warning': Significant tradeoff, could derail progress if ignored
 */
export type TradeoffSeverity = 'info' | 'caution' | 'warning';

/**
 * A consideration — what the learner gains and trades off by pursuing this stage.
 * 
 * NOT a menu of choices. Instead:
 * - Surfaces what they're implicitly gaining
 * - Warns about what they're implicitly trading off
 * - Only demands attention when severity is 'warning'
 * 
 * Think of it as the Shield role: protect from blind spots without being annoying.
 */
export interface Consideration {
  /** What the learner gains by completing this stage */
  gaining: string;
  
  /** What the learner is trading off or deferring */
  tradingOff: string;
  
  /** How significant is this tradeoff? */
  severity: TradeoffSeverity;
  
  /** 
   * Only shown if severity is 'warning'.
   * A prompt to make the learner consciously acknowledge the tradeoff.
   */
  checkpoint?: string;
}

/**
 * A single stage in the capability-based progression.
 * 
 * Now includes:
 * - CONSIDERATION — tradeoff awareness (what you gain vs sacrifice)
 * - RESILIENCE LAYER — consequence and recovery (what breaks and how to fix it)
 * 
 * The resilience layer ensures learners experience:
 * 1. A way to break the system (designedFailure)
 * 2. A visible consequence of that break (consequence)
 * 3. A required recovery or adaptation (recovery)
 * 
 * Skills are forged when things go wrong, not when they go right.
 */
export interface CapabilityStage {
  /** Short title (2-5 words) */
  title: string;
  
  /** What the learner CAN DO after (verb-based, verifiable) */
  capability: string;
  
  /** Inspectable, falsifiable output that proves competence */
  artifact: string;
  
  /** Specific mistake to make — the adversary/stressor */
  designedFailure: string;
  
  /** What happens when it breaks — visible impact the learner can observe */
  consequence: string;
  
  /** How to detect, fix, and prevent recurrence — where expertise lives */
  recovery: string;
  
  /** Apply skill in new context without scaffolding */
  transfer: string;
  
  /** Subtopics for resource discovery */
  topics: string[];
  
  /**
   * CONSIDERATION — The tradeoff awareness layer.
   * 
   * Not a forced choice. Instead:
   * - "By doing this, you're gaining X"
   * - "You're trading off Y"
   * - If Y is significant: "Is that acceptable for your situation?"
   * 
   * Only demands attention when the tradeoff could cause real problems.
   */
  consideration: Consideration;
}

/**
 * User level affects the depth and complexity of generated stages.
 */
export type UserLevel = 'beginner' | 'intermediate' | 'advanced';

/**
 * Configuration for capability generation.
 */
export interface CapabilityGeneratorConfig {
  /** OpenAI API key */
  openaiApiKey?: string;
  /** Model to use (default: gpt-4o-mini) */
  model?: string;
  /** Cache TTL in seconds (default: 3600 = 1 hour) */
  cacheTtlSeconds?: number;
  /** Maximum retries on failure */
  maxRetries?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LLM PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the system prompt for capability generation.
 */
function buildSystemPrompt(): string {
  return `You are an expert instructional designer who creates learning progressions for ANY topic.

CRITICAL REQUIREMENT — TOPIC-SPECIFIC TITLES:
Every stage title MUST be unique to the topic. Generic stage names are FORBIDDEN.

❌ FORBIDDEN TITLES (never use these patterns):
- "[Topic] Fundamentals" / "[Topic] Basics"
- "Adapting & Customizing" / "Modify & Adapt"
- "Debugging & Problem-Solving" / "Debug & Diagnose"
- "Building From Scratch" / "Design From Requirements"
- "Deploying & Real-World Application" / "Ship & Defend"

✅ REQUIRED TITLE STYLE (domain-specific, evocative):
- Cooking: "Master Your Mise en Place", "Build Flavor Intuition", "Rescue Kitchen Disasters", "Create Original Recipes", "Host a Dinner Party"
- Guitar: "Play Your First Song", "Smooth Chord Transitions", "Fix Buzzing & Timing", "Write Your Own Riffs", "Perform for an Audience"
- Photography: "Nail Exposure Basics", "Compose Compelling Shots", "Fix Bad Lighting", "Develop Your Style", "Build a Portfolio"
- Rust: "Build & Run Your First Program", "Own Your Data", "Model Real Data", "Handle Failure Gracefully", "Ship a Real Tool"

The title should make someone immediately know what topic this is about.

THE 5-STAGE COMPETENCE MODEL:
1. REPRODUCE: Create basic outcome unaided
2. MODIFY: Adapt existing work under constraints  
3. DIAGNOSE: Find and fix failures systematically
4. DESIGN: Build from requirements, not instructions
5. SHIP: Deploy to users and handle feedback

THE RESILIENCE LAYER (Critical for Real Learning):
Every stage must include:
- designedFailure: A specific way to BREAK the system
- consequence: What HAPPENS when it breaks (visible impact)
- recovery: How to DETECT, FIX, and PREVENT recurrence

Skills are forged when things go WRONG, not when they go right.

OUTPUT FORMAT (JSON array with exactly 5 objects):
{
  "title": "TOPIC-SPECIFIC title (2-5 words) — someone should know the topic from this alone",
  "capability": "What the learner can DO (verb-based, verifiable)",
  "artifact": "Inspectable output that proves competence (must be falsifiable)",
  "designedFailure": "Specific way to break it — the adversary or stressor",
  "consequence": "What happens when it breaks — visible impact they can observe",
  "recovery": "How to detect, diagnose, fix, and prevent recurrence",
  "transfer": "Apply skill in different context without scaffolding",
  "topics": ["subtopic1", "subtopic2", "subtopic3"],
  "consideration": {
    "gaining": "What completing this stage provides",
    "tradingOff": "What is deferred, skipped, or sacrificed",
    "severity": "info" | "caution" | "warning",
    "checkpoint": "Only if severity is 'warning': Question to confirm tradeoff is acceptable"
  }
}

QUALITY CRITERIA:
- Titles must be SPECIFIC to the topic (would someone know the topic just from the title?)
- Capabilities must be VERIFIABLE (observable action, not vague understanding)
- Artifacts must be FALSIFIABLE (can be inspected and judged)
- Consequences must be OBSERVABLE (learner can see the failure)
- Recovery must be ACTIONABLE (specific steps, not vague advice)`;
}

/**
 * Build the user prompt for a specific topic.
 */
function buildUserPrompt(topic: string, level: UserLevel, durationDays: number): string {
  const levelContext = {
    beginner: 'Complete beginner with no prior experience.',
    intermediate: 'Some familiarity, building solid foundations.',
    advanced: 'Has experience, filling gaps toward mastery.',
  };

  return `Generate a 5-stage capability progression for:

TOPIC: ${topic}
LEVEL: ${level} — ${levelContext[level]}
DURATION: ${durationDays} days (~${Math.ceil(durationDays / 5)} days per stage)

CRITICAL — TITLE REQUIREMENTS:
Each stage title MUST be specific to "${topic}". Someone should know the topic just from reading the titles.

BAD TITLES (too generic — DO NOT USE):
- "${topic} Fundamentals"
- "Adapting & Customizing"
- "Debugging & Problem-Solving"
- "Building From Scratch"
- "Deploying & Real-World Application"

GOOD TITLES (topic-specific — USE THIS STYLE):
For cooking: "Master Your Mise en Place", "Build Flavor Intuition", "Rescue Kitchen Disasters", "Create Original Recipes", "Host a Dinner Party"
For guitar: "Play Your First Song", "Smooth Chord Transitions", "Fix Buzzing & Timing", "Write Your Own Riffs", "Perform for an Audience"
For photography: "Nail Exposure Basics", "Compose Compelling Shots", "Fix Bad Lighting", "Develop Your Style", "Build a Portfolio"

For each stage, include:
1. title: TOPIC-SPECIFIC (2-5 words, unique to this domain)
2. capability: What the learner can DO (verb-based, verifiable)
3. artifact: Inspectable output that proves competence
4. designedFailure: Specific way to BREAK the system
5. consequence: What HAPPENS when it breaks
6. recovery: How to DETECT, FIX, and PREVENT
7. transfer: Apply skill in different context
8. topics: Relevant subtopics for resource discovery
9. consideration: { gaining, tradingOff, severity, checkpoint? }

Return ONLY the JSON array. No markdown. No explanation.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates capability-based learning progressions dynamically using LLM.
 * 
 * Key innovation: Every stage includes a DECISION POINT that forces
 * the learner to make judgment calls under uncertainty.
 */
export class CapabilityGenerator {
  private readonly config: Required<CapabilityGeneratorConfig>;
  private readonly cache: Map<string, { stages: CapabilityStage[]; expiresAt: number }>;

  constructor(config: CapabilityGeneratorConfig = {}) {
    this.config = {
      openaiApiKey: config.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '',
      model: config.model ?? 'gpt-4o-mini',
      cacheTtlSeconds: config.cacheTtlSeconds ?? 3600,
      maxRetries: config.maxRetries ?? 2,
    };
    this.cache = new Map();
  }

  /**
   * Generate capability-based progression for any topic.
   */
  async generate(
    topic: string,
    level: UserLevel = 'beginner',
    durationDays: number = 30
  ): AsyncAppResult<readonly CapabilityStage[]> {
    const normalizedTopic = this.normalizeTopic(topic);
    const cacheKey = `${normalizedTopic}:${level}:${durationDays}`;

    console.log(`[CAPABILITY_GEN] Generating progression for: "${normalizedTopic}" (${level}, ${durationDays} days)`);

    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(`[CAPABILITY_GEN] Cache hit for: "${normalizedTopic}"`);
      return ok(cached.stages);
    }

    // Generate via LLM
    const result = await this.generateViaLLM(normalizedTopic, level, durationDays);
    
    if (result.ok) {
      this.cache.set(cacheKey, {
        stages: result.value as CapabilityStage[],
        expiresAt: Date.now() + this.config.cacheTtlSeconds * 1000,
      });
      console.log(`[CAPABILITY_GEN] Generated ${result.value.length} stages with tradeoff considerations`);
    }

    return result;
  }

  /**
   * Generate progression via OpenAI API.
   */
  private async generateViaLLM(
    topic: string,
    level: UserLevel,
    durationDays: number
  ): AsyncAppResult<readonly CapabilityStage[]> {
    if (!this.config.openaiApiKey) {
      console.warn('[CAPABILITY_GEN] No OpenAI API key, using fallback generation');
      return ok(this.generateFallback(topic, level, durationDays));
    }

    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(topic, level, durationDays);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 4000,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json() as {
          choices: Array<{ message: { content: string } }>;
        };

        const content = data.choices[0]?.message?.content;
        if (!content) {
          throw new Error('Empty response from OpenAI');
        }

        const stages = this.parseResponse(content);
        const validated = this.validateStages(stages);
        
        if (!validated.ok) {
          throw new Error(validated.error.message);
        }

        return ok(validated.value);

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[CAPABILITY_GEN] Attempt ${attempt + 1} failed:`, lastError.message);
        
        if (attempt < this.config.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    console.warn('[CAPABILITY_GEN] All LLM attempts failed, using fallback');
    return ok(this.generateFallback(topic, level, durationDays));
  }

  /**
   * Parse LLM response into stages.
   */
  private parseResponse(content: string): unknown[] {
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    return JSON.parse(cleaned.trim());
  }

  /**
   * Validate parsed stages including considerations.
   */
  private validateStages(stages: unknown[]): { ok: true; value: CapabilityStage[] } | { ok: false; error: { message: string } } {
    if (!Array.isArray(stages)) {
      return { ok: false, error: { message: 'Response is not an array' } };
    }

    if (stages.length !== 5) {
      return { ok: false, error: { message: `Expected 5 stages, got ${stages.length}` } };
    }

    const validated: CapabilityStage[] = [];

    for (let i = 0; i < stages.length; i++) {
      const stage = stages[i] as Record<string, unknown>;
      
      // Validate basic fields
      if (typeof stage.title !== 'string' || !stage.title) {
        return { ok: false, error: { message: `Stage ${i + 1}: missing title` } };
      }
      if (typeof stage.capability !== 'string' || !stage.capability) {
        return { ok: false, error: { message: `Stage ${i + 1}: missing capability` } };
      }
      if (typeof stage.artifact !== 'string' || !stage.artifact) {
        return { ok: false, error: { message: `Stage ${i + 1}: missing artifact` } };
      }
      if (typeof stage.designedFailure !== 'string' || !stage.designedFailure) {
        return { ok: false, error: { message: `Stage ${i + 1}: missing designedFailure` } };
      }
      if (typeof stage.transfer !== 'string' || !stage.transfer) {
        return { ok: false, error: { message: `Stage ${i + 1}: missing transfer` } };
      }
      if (!Array.isArray(stage.topics) || stage.topics.length === 0) {
        return { ok: false, error: { message: `Stage ${i + 1}: missing or empty topics` } };
      }

      // Validate or generate consideration
      const cons = stage.consideration as Record<string, unknown> | undefined;
      let consideration: Consideration;
      
      if (!cons || typeof cons !== 'object') {
        consideration = this.getUniversalConsideration(i);
      } else {
        if (typeof cons.gaining !== 'string' || !cons.gaining) {
          return { ok: false, error: { message: `Stage ${i + 1}: consideration missing 'gaining'` } };
        }
        if (typeof cons.tradingOff !== 'string' || !cons.tradingOff) {
          return { ok: false, error: { message: `Stage ${i + 1}: consideration missing 'tradingOff'` } };
        }
        
        // Validate severity
        const severity = cons.severity as string;
        if (!['info', 'caution', 'warning'].includes(severity)) {
          // Default to 'info' if invalid
          console.warn(`[CAPABILITY_GEN] Stage ${i + 1}: invalid severity '${severity}', defaulting to 'info'`);
        }
        
        const validSeverity: TradeoffSeverity = 
          severity === 'warning' ? 'warning' :
          severity === 'caution' ? 'caution' : 'info';

        consideration = {
          gaining: cons.gaining as string,
          tradingOff: cons.tradingOff as string,
          severity: validSeverity,
          checkpoint: validSeverity === 'warning' && typeof cons.checkpoint === 'string' 
            ? cons.checkpoint 
            : undefined,
        };
      }

      validated.push({
        title: stage.title as string,
        capability: stage.capability as string,
        artifact: stage.artifact as string,
        designedFailure: stage.designedFailure as string,
        consequence: typeof stage.consequence === 'string' 
          ? stage.consequence 
          : 'The system fails in an observable way',
        recovery: typeof stage.recovery === 'string'
          ? stage.recovery
          : 'Identify the failure, diagnose the cause, fix it, and prevent recurrence',
        transfer: stage.transfer as string,
        topics: (stage.topics as unknown[]).map(String),
        consideration,
      });
    }

    return { ok: true, value: validated };
  }

  /**
   * Universal considerations for each stage phase.
   * These surface common tradeoffs across all learning domains.
   */
  private getUniversalConsideration(stageIndex: number): Consideration {
    const universalConsiderations: Consideration[] = [
      // Stage 1: REPRODUCE
      {
        gaining: 'Ability to produce basic output independently',
        tradingOff: 'Depth of understanding — you\'re learning enough to DO, not everything',
        severity: 'info',
      },
      // Stage 2: MODIFY
      {
        gaining: 'Flexibility to adapt existing work to new requirements',
        tradingOff: 'Time spent on original creation — building on others\' foundations',
        severity: 'info',
      },
      // Stage 3: DIAGNOSE
      {
        gaining: 'Systematic problem-solving skills',
        tradingOff: 'Speed — debugging properly takes longer than guessing',
        severity: 'caution',
        checkpoint: undefined,
      },
      // Stage 4: DESIGN
      {
        gaining: 'Independence — building from requirements, not instructions',
        tradingOff: 'Safety net of step-by-step guidance',
        severity: 'caution',
        checkpoint: undefined,
      },
      // Stage 5: SHIP
      {
        gaining: 'Real-world validation and feedback loops',
        tradingOff: 'Control — others will judge and critique your work',
        severity: 'info',
      },
    ];

    return universalConsiderations[stageIndex] ?? universalConsiderations[0]!;
  }

  /**
   * Generate fallback progression when LLM is unavailable.
   * Note: These titles are less topic-specific than LLM-generated ones,
   * but still better than completely generic stage names.
   */
  private generateFallback(topic: string, _level: UserLevel, _durationDays: number): CapabilityStage[] {
    const topicName = this.formatTopicName(topic);
    const t = topic.toLowerCase();

    return [
      {
        title: `Create Your First ${topicName}`,
        capability: `Create a basic ${t} deliverable from scratch without step-by-step guidance`,
        artifact: `A working example that demonstrates fundamental ${t} concepts`,
        designedFailure: `Missing a critical step that causes the output to fail in an obvious way`,
        consequence: `The output doesn't work at all, or produces obviously wrong results that you can see immediately`,
        recovery: `Compare your output against a known-working example, identify the missing step, and rebuild with that step included`,
        transfer: `Create the same type of output for a different use case or context`,
        topics: [t, 'basics', 'fundamentals', 'getting-started'],
        consideration: this.getUniversalConsideration(0),
      },
      {
        title: `Customize ${topicName} Your Way`,
        capability: `Take existing ${t} work and modify it to meet new requirements`,
        artifact: `An adapted version with documented changes and rationale`,
        designedFailure: `Breaking existing functionality while adding new features`,
        consequence: `Something that used to work now fails — you've introduced a regression that may not be immediately obvious`,
        recovery: `Test all existing functionality after each change, use version control to identify what broke, and learn to make isolated changes`,
        transfer: `Apply the same modification pattern to a completely different starting point`,
        topics: [t, 'customization', 'adaptation', 'requirements'],
        consideration: this.getUniversalConsideration(1),
      },
      {
        title: `Fix ${topicName} Problems`,
        capability: `Identify and fix problems in ${t} work systematically`,
        artifact: `A debugging log showing problem identification, investigation, and resolution`,
        designedFailure: `Fixing a symptom instead of the root cause`,
        consequence: `The problem appears fixed but returns later, or fixing it causes a different problem elsewhere`,
        recovery: `Ask "why" five times to find root cause, document the full causal chain, and verify the fix addresses the origin not just the symptom`,
        transfer: `Debug a problem in an unfamiliar context`,
        topics: [t, 'debugging', 'troubleshooting', 'problem-solving'],
        consideration: this.getUniversalConsideration(2),
      },
      {
        title: `Design Original ${topicName}`,
        capability: `Build a ${t} solution given only requirements, not instructions`,
        artifact: `A complete solution with design decisions documented`,
        designedFailure: `Over-engineering or under-engineering for the actual requirements`,
        consequence: `Either you've built something too complex that's hard to maintain, or too simple that can't handle real needs`,
        recovery: `Review requirements with fresh eyes, identify which constraints are real vs assumed, and refactor toward appropriate complexity`,
        transfer: `Design a solution for requirements in a domain you're less familiar with`,
        topics: [t, 'design', 'architecture', 'decision-making'],
        consideration: this.getUniversalConsideration(3),
      },
      {
        title: `Share ${topicName} With Others`,
        capability: `Deploy ${t} work to real users and handle feedback`,
        artifact: `A deployed solution with documentation and record of feedback addressed`,
        designedFailure: `Receiving critical feedback you didn't anticipate`,
        consequence: `Users struggle with something you thought was obvious, or reject the solution for reasons you didn't consider`,
        recovery: `Separate ego from work, categorize feedback by frequency and severity, prioritize fixes, and document lessons for next time`,
        transfer: `Help someone else ship their work and handle their feedback`,
        topics: [t, 'deployment', 'documentation', 'feedback', 'iteration'],
        consideration: this.getUniversalConsideration(4),
      },
    ];
  }

  /**
   * Normalize topic for consistent caching.
   */
  private normalizeTopic(topic: string): string {
    return topic
      .toLowerCase()
      .trim()
      .replace(/^(learn|study|master|understand)\s+(to\s+)?/i, '')
      .replace(/^(how\s+to\s+)/i, '')
      .replace(/^(i\s+want\s+to\s+)/i, '')
      .replace(/^(about\s+)/i, '')
      .trim();
  }

  /**
   * Format topic name for display.
   */
  private formatTopicName(topic: string): string {
    const normalized = this.normalizeTopic(topic);
    return normalized
      .split(/[\s-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  clearCache(): void {
    this.cache.clear();
  }

  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY & UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

export function createCapabilityGenerator(config?: CapabilityGeneratorConfig): CapabilityGenerator {
  return new CapabilityGenerator(config);
}

export function extractTopicsFromStages(stages: readonly CapabilityStage[]): string[] {
  const allTopics = stages.flatMap(stage => stage.topics);
  const unique = [...new Set(allTopics)];
  return unique.map(t => `topic:${t.toLowerCase().replace(/\s+/g, '-')}`);
}
