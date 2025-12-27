// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GENERATOR — Dynamic Competence-Based Learning Progressions
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
// Each stage defines:
//   - Capability: What the learner CAN DO (verb-based)
//   - Artifact: Inspectable, falsifiable output that proves competence
//   - Designed Failure: Specific mistake to make and recover from
//   - Transfer: Apply skill in new context without scaffolding
//   - Topics: Subtopics for resource discovery
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../types/result.js';
import { ok, err, appError } from '../../types/result.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * A single stage in the capability-based progression.
 */
export interface CapabilityStage {
  title: string;
  capability: string;
  artifact: string;
  designedFailure: string;
  transfer: string;
  topics: string[];
}

/**
 * The universal competence phases.
 */
export type CompetencePhase = 'reproduce' | 'modify' | 'diagnose' | 'design' | 'ship';

/**
 * Framework definition for each competence phase.
 */
interface PhaseDefinition {
  phase: CompetencePhase;
  order: number;
  verb: string;
  focus: string;
  prompt: string;
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
// COMPETENCE FRAMEWORK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * The universal 5-stage competence model.
 * This framework applies to ANY skill or topic.
 */
const COMPETENCE_FRAMEWORK: readonly PhaseDefinition[] = [
  {
    phase: 'reproduce',
    order: 1,
    verb: 'Create',
    focus: 'basic outcome unaided',
    prompt: 'The learner creates the most fundamental output in this domain without step-by-step guidance. Focus on the "hello world" equivalent that proves they can produce SOMETHING real.',
  },
  {
    phase: 'modify',
    order: 2,
    verb: 'Adapt',
    focus: 'existing work under constraints',
    prompt: 'The learner takes working examples and modifies them to meet new requirements. Focus on understanding structure well enough to change it purposefully.',
  },
  {
    phase: 'diagnose',
    order: 3,
    verb: 'Debug',
    focus: 'failures and edge cases',
    prompt: 'The learner identifies what went wrong and fixes it. Focus on building mental models of how things break and systematic troubleshooting.',
  },
  {
    phase: 'design',
    order: 4,
    verb: 'Architect',
    focus: 'solutions from requirements',
    prompt: 'The learner builds something new from scratch given only requirements, not instructions. Focus on making decisions and trade-offs independently.',
  },
  {
    phase: 'ship',
    order: 5,
    verb: 'Deploy',
    focus: 'to real users and defend decisions',
    prompt: 'The learner puts work in front of others and handles feedback. Focus on documentation, handoff, and explaining/defending choices.',
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// LLM PROMPT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build the system prompt for capability generation.
 */
function buildSystemPrompt(): string {
  return `You are an expert instructional designer who creates capability-based learning progressions.

Your job is to generate a 5-stage learning path that transforms someone from novice to competent practitioner.

CRITICAL PRINCIPLES:
1. CAPABILITY over content — Define what learners CAN DO, not what they "know"
2. ARTIFACT over assessment — Every stage produces inspectable, falsifiable work
3. DESIGNED FAILURE — Each stage includes a specific mistake to make and recover from
4. TRANSFER REQUIRED — Each stage requires applying skills in a new context
5. IMMEDIATE APPLICATION — No "learn now, apply later" — practice from day one

The 5 stages follow the universal competence model:
1. REPRODUCE: Create the basic outcome unaided (the "hello world")
2. MODIFY: Adapt existing work under new constraints
3. DIAGNOSE: Find and fix failures systematically
4. DESIGN: Build from requirements, not instructions
5. SHIP: Deploy to real users and defend your decisions

OUTPUT FORMAT:
Return a JSON array with exactly 5 objects, one per stage. Each object must have:
{
  "title": "Short title (2-5 words)",
  "capability": "What the learner can DO after this stage (verb-based, specific)",
  "artifact": "The concrete, inspectable output that proves competence",
  "designedFailure": "A specific mistake they will make and must recover from",
  "transfer": "How they apply this skill in a different context",
  "topics": ["subtopic1", "subtopic2", "subtopic3"] // 3-5 topics for resource discovery
}

QUALITY CRITERIA:
- Capabilities must be VERIFIABLE — can someone observe if the learner has it?
- Artifacts must be FALSIFIABLE — can it be wrong? If not, it's not a real artifact.
- Failures must be SPECIFIC — not "make a mistake" but "forget to handle the null case"
- Transfers must require ADAPTATION — not just repetition in new context`;
}

/**
 * Build the user prompt for a specific topic.
 */
function buildUserPrompt(topic: string, level: UserLevel, durationDays: number): string {
  const levelContext = {
    beginner: 'The learner is a complete beginner with no prior experience in this area.',
    intermediate: 'The learner has some familiarity but needs to build solid foundations.',
    advanced: 'The learner has experience but wants to fill gaps and reach mastery.',
  };

  return `Generate a 5-stage capability-based learning progression for:

TOPIC: ${topic}
LEVEL: ${level} — ${levelContext[level]}
DURATION: ${durationDays} days total (roughly ${Math.ceil(durationDays / 5)} days per stage)

Remember:
- Stage 1 (Reproduce): The simplest thing that counts as "doing" this skill
- Stage 2 (Modify): Take something working and change it purposefully  
- Stage 3 (Diagnose): Fix something broken, understand failure modes
- Stage 4 (Design): Build something new from just requirements
- Stage 5 (Ship): Put it in front of others, handle feedback, document

Each stage should be achievable in roughly ${Math.ceil(durationDays / 5)} days at the ${level} level.

Return ONLY the JSON array, no markdown, no explanation.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generates capability-based learning progressions dynamically using LLM.
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
    // Normalize topic for caching
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
      // Cache successful result
      this.cache.set(cacheKey, {
        stages: result.value as CapabilityStage[],
        expiresAt: Date.now() + this.config.cacheTtlSeconds * 1000,
      });
      console.log(`[CAPABILITY_GEN] Generated ${result.value.length} stages for: "${normalizedTopic}"`);
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
            max_tokens: 2000,
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

        // Parse JSON response
        const stages = this.parseResponse(content);
        
        // Validate stages
        const validated = this.validateStages(stages);
        if (!validated.ok) {
          throw new Error(validated.error.message);
        }

        return ok(validated.value);

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[CAPABILITY_GEN] Attempt ${attempt + 1} failed:`, lastError.message);
        
        if (attempt < this.config.maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }
    }

    // All retries failed, use fallback
    console.warn('[CAPABILITY_GEN] All LLM attempts failed, using fallback');
    return ok(this.generateFallback(topic, level, durationDays));
  }

  /**
   * Parse LLM response into stages.
   */
  private parseResponse(content: string): unknown[] {
    // Clean up response (remove markdown code blocks if present)
    let cleaned = content.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.slice(7);
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    return JSON.parse(cleaned);
  }

  /**
   * Validate parsed stages.
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

      validated.push({
        title: stage.title,
        capability: stage.capability,
        artifact: stage.artifact,
        designedFailure: stage.designedFailure,
        transfer: stage.transfer,
        topics: stage.topics.map(String),
      });
    }

    return { ok: true, value: validated };
  }

  /**
   * Generate fallback progression when LLM is unavailable.
   * Uses the universal framework with topic-specific placeholders.
   */
  private generateFallback(topic: string, level: UserLevel, durationDays: number): CapabilityStage[] {
    const daysPerStage = Math.ceil(durationDays / 5);
    const topicName = this.formatTopicName(topic);

    return [
      {
        title: `Your First ${topicName} Output`,
        capability: `Create a basic ${topicName.toLowerCase()} deliverable from scratch without step-by-step guidance`,
        artifact: `A working example that demonstrates fundamental ${topicName.toLowerCase()} concepts`,
        designedFailure: `Missing a critical step that causes the output to fail in an obvious way`,
        transfer: `Create the same type of output for a different use case or context`,
        topics: [topic.toLowerCase(), 'basics', 'fundamentals', 'getting-started'],
      },
      {
        title: `Modify & Adapt`,
        capability: `Take existing ${topicName.toLowerCase()} work and modify it to meet new requirements`,
        artifact: `An adapted version of an example with documented changes and rationale`,
        designedFailure: `Breaking existing functionality while adding new features`,
        transfer: `Apply the same modification pattern to a completely different starting point`,
        topics: [topic.toLowerCase(), 'customization', 'adaptation', 'requirements'],
      },
      {
        title: `Debug & Diagnose`,
        capability: `Identify and fix problems in ${topicName.toLowerCase()} work systematically`,
        artifact: `A debugging log showing problem identification, investigation, and resolution`,
        designedFailure: `Fixing a symptom instead of the root cause`,
        transfer: `Debug a problem in an unfamiliar codebase or context`,
        topics: [topic.toLowerCase(), 'debugging', 'troubleshooting', 'problem-solving'],
      },
      {
        title: `Design From Requirements`,
        capability: `Build a ${topicName.toLowerCase()} solution given only requirements, not instructions`,
        artifact: `A complete solution with design decisions documented`,
        designedFailure: `Over-engineering or under-engineering for the actual requirements`,
        transfer: `Design a solution for requirements in a domain you're less familiar with`,
        topics: [topic.toLowerCase(), 'design', 'architecture', 'decision-making'],
      },
      {
        title: `Ship & Defend`,
        capability: `Deploy ${topicName.toLowerCase()} work to real users and handle feedback`,
        artifact: `A deployed solution with documentation and a record of feedback addressed`,
        designedFailure: `Receiving critical feedback you didn't anticipate`,
        transfer: `Help someone else ship their work and handle their feedback process`,
        topics: [topic.toLowerCase(), 'deployment', 'documentation', 'feedback', 'iteration'],
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

  /**
   * Clear the cache (useful for testing).
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats (useful for monitoring).
   */
  getCacheStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys()),
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a capability generator with default configuration.
 */
export function createCapabilityGenerator(config?: CapabilityGeneratorConfig): CapabilityGenerator {
  return new CapabilityGenerator(config);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACT TOPICS FOR RESOURCE DISCOVERY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract topic IDs from capability stages for resource discovery.
 */
export function extractTopicsFromStages(stages: readonly CapabilityStage[]): string[] {
  const allTopics = stages.flatMap(stage => stage.topics);
  const unique = [...new Set(allTopics)];
  return unique.map(t => `topic:${t.toLowerCase().replace(/\s+/g, '-')}`);
}
