// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 21: QUALITY GENERATOR — Science-Based Drill Content
// NovaOS — Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Generates high-quality, validated drill content using LLM with:
//   - 5-day E/S/C/F/P pattern enforcement
//   - Week-over-week concept escalation
//   - Integration of previous weeks' skills
//   - Real-world primitives (I/O, debugging) in later weeks
//   - Escalating cognitive load
//   - Domain-specific formatting
//   - Quality validation with retry
//
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';

import type { AsyncAppResult, AppResult } from '../../../../types/result.js';
import { ok, err, appError } from '../../../../types/result.js';

import type {
  LearningDomain,
  DrillDayType,
  GivenMaterialType,
  ResourcePolicy,
} from '../types/enhanced-types.js';
import { DOMAIN_PROFILES, DAY_TYPE_CONFIGS } from '../types/enhanced-types.js';
import { DomainDetector, createDomainDetector } from '../types/domain-detector.js';
import { validateWeek, formatValidationResult } from '../validators/drill-validator.js';
import { 
  linkWeekPrimes, 
  type DrillContent, 
  type WeekContent,
  type LinkedDrillContent,
} from './prime-linker.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface QualityGeneratorConfig {
  readonly openaiApiKey?: string;
  readonly model: string;
  readonly maxRetries: number;
  readonly strictValidation: boolean;
}

export interface GenerationContext {
  readonly topic: string;
  readonly focus?: string;
  readonly motivation?: string;
  readonly priorKnowledge?: string;
  readonly level?: 'beginner' | 'intermediate' | 'advanced';
  readonly minutesPerDay?: number;
  readonly totalWeeks: number;
}

export interface GeneratedWeek {
  readonly weekNumber: number;
  readonly title: string;
  readonly theme: string;
  readonly skill: string;
  readonly competenceProof: string;
  readonly domain: LearningDomain;
  readonly drills: readonly LinkedDrillContent[];
}

export interface GeneratedLessonPlan {
  readonly topic: string;
  readonly domain: LearningDomain;
  readonly totalWeeks: number;
  readonly weeks: readonly GeneratedWeek[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CURRICULUM PROGRESSION FRAMEWORK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate progression requirements for a given week.
 * Forces concept escalation and integration.
 */
function getProgressionRequirements(weekNumber: number, totalWeeks: number, domain: LearningDomain): string {
  const phase = Math.ceil((weekNumber / totalWeeks) * 4); // 1-4
  
  const phaseRequirements: Record<number, string> = {
    1: `WEEK ${weekNumber} FOCUS: FUNDAMENTALS
- Introduce core primitives/vocabulary
- Single-concept drills (no mixing)
- Maximum scaffolding
- Success with exact copying`,
    
    2: `WEEK ${weekNumber} FOCUS: BUILDING BLOCKS  
- Combine 2-3 concepts from previous weeks
- Require recall of Week 1 knowledge
- Reduce scaffolding
- Add light variation`,
    
    3: `WEEK ${weekNumber} FOCUS: INTEGRATION + REAL-WORLD
- Require ALL previous concepts together
- Introduce external I/O (files, user input, APIs, external tools)
- Add debugging/error scenarios
- Day 4 FAIL should require diagnosis of complex errors`,
    
    4: `WEEK ${weekNumber} FOCUS: SYNTHESIS + TRANSFER
- Create something novel (not just following steps)
- Handle unexpected input/edge cases
- Debug without hints
- Prove mastery through application, not reproduction`,
  };
  
  return phaseRequirements[phase] || phaseRequirements[4];
}

/**
 * Get concept escalation requirements based on domain.
 */
function getDomainEscalation(domain: LearningDomain, weekNumber: number, totalWeeks: number): string {
  const phase = Math.ceil((weekNumber / totalWeeks) * 4);
  
  const escalations: Record<LearningDomain, Record<number, string>> = {
    technical: {
      1: 'Syntax, variables, basic operations',
      2: 'Control flow, functions, data structures',
      3: 'File I/O, error handling, debugging, testing',
      4: 'Design patterns, refactoring, real projects',
    },
    creative: {
      1: 'Basic techniques, simple elements, copying masters',
      2: 'Combining techniques, personal variations',
      3: 'Original compositions, critique response, collaboration',
      4: 'Personal style, complex works, teaching others',
    },
    language: {
      1: 'Core vocabulary, pronunciation, basic phrases',
      2: 'Grammar patterns, conversations, cultural context',
      3: 'Complex sentences, native media, spontaneous speech',
      4: 'Nuance, humor, professional contexts, teaching',
    },
    physical: {
      1: 'Basic movements, form, body awareness',
      2: 'Sequences, transitions, endurance',
      3: 'Complex variations, flow, recovery from mistakes',
      4: 'Personal style, teaching, competition scenarios',
    },
    knowledge: {
      1: 'Key facts, frameworks, terminology',
      2: 'Connections between concepts, cause/effect',
      3: 'Analysis, evaluation, primary sources',
      4: 'Original arguments, debate, teaching',
    },
    professional: {
      1: 'Core skills, basic templates, observation',
      2: 'Adaptation, feedback, real scenarios',
      3: 'Complex negotiations, crisis handling, mentoring',
      4: 'Strategic thinking, leadership, innovation',
    },
  };
  
  return escalations[domain]?.[phase] || escalations[domain]?.[4] || '';
}

/**
 * Build integration requirements based on previous weeks.
 */
function buildIntegrationRequirements(
  weekNumber: number, 
  previousSkills: string[]
): string {
  if (weekNumber === 1 || previousSkills.length === 0) {
    return '';
  }
  
  return `
INTEGRATION REQUIREMENTS (Week ${weekNumber} must use previous skills):
${previousSkills.map((skill, i) => `- Week ${i + 1}: "${skill}" — MUST appear in at least one drill`).join('\n')}

Day 5 PROVE must require ALL previous skills combined, not just this week's skill.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LLM PROMPTS
// ═══════════════════════════════════════════════════════════════════════════════

function buildSystemPrompt(domain: LearningDomain, topic: string): string {
  const profile = DOMAIN_PROFILES[domain];
  
  return `You are designing a practical curriculum for: "${topic}"

═══════════════════════════════════════════════════════════════════════════════
ABSOLUTE RULES (violating these = rejected output):
1. EVERY drill must be directly about "${topic}" — NEVER switch to unrelated subjects
2. "skill" field MUST be 5+ words describing a SPECIFIC ability
   ✗ WRONG: "Write" or "Build" or "Project" (too vague)
   ✓ RIGHT: "Write clear topic sentences that hook readers"
   ✓ RIGHT: "Execute a golf swing with proper grip and follow-through"
3. Each week title MUST be unique and specific to what's being learned
   ✗ WRONG: "Building Blocks" (generic, meaningless)
   ✓ RIGHT: "Breath Control for Sustained Volume" (specific)
4. givenMaterial must contain ACTUAL content (real code, real steps, real examples)
═══════════════════════════════════════════════════════════════════════════════

DOMAIN: ${domain} | ARTIFACT: ${profile.artifactType} | PROOF: ${profile.proofType}

THE 5-DAY E/S/C/F/P PATTERN:

Day 1 - ENCOUNTER: First exposure with maximum scaffolding
  - Learner copies exactly, sees it work
  - Full reference access, low cognitive load
  - MUST include givenMaterial (code, text, steps to copy)
  - Introduce NEW concepts for this week

Day 2 - STRUGGLE: Attempt WITHOUT aids (desirable difficulty)
  - Learner recreates Day 1 from memory FIRST
  - Reference only after 5-minute failed attempt
  - High cognitive load (where encoding happens)
  - NO givenMaterial — that's the point

Day 3 - CONNECT: Link to prior knowledge + variation
  - Apply concept in a DIFFERENT context
  - Combine with skills from PREVIOUS weeks
  - Require self-explanation
  - Full reference access

Day 4 - FAIL: Intentional failure → diagnosis → repair
  - Provide BROKEN material with subtle errors
  - Learner must FIND and FIX the problem
  - For later weeks: multiple bugs, edge cases
  - MUST include givenMaterial (broken code/content)

Day 5 - PROVE: Demonstrate competence with ZERO aids
  - Test conditions: no reference, no hints
  - Binary pass/fail outcome
  - Must require ALL skills learned so far
  - NO givenMaterial, NO resources

CRITICAL QUALITY REQUIREMENTS:

DO field:
- MUST start with action verb (Write, Build, Create, Fix, Implement)
- Specific and completable in session
- Length: 50-200 characters

DONE field (most important):
- MUST be binary (yes/no verifiable)
- BANNED words: understand, learn, know, feel, comfortable, familiar, grasp
- Observable and measurable: "Terminal prints X", "File contains Y", "Recording shows Z"
- NOT achievable by copying — requires actual understanding

STUCK field:
- MUST be specific error/problem (not "common mistakes")
- Include exact error messages for technical domains
- Describe what the learner will actually see/experience
- Length: 30-150 characters

UNSTUCK field:
- MUST start with action verb
- BANNED: "read the docs", "google it", "try again", "review"
- Single specific action that fixes THIS problem
- Length: 30-150 characters

WHY field:
- Connect to bigger picture or real-world use
- Length: 30-100 characters

REFLECT field:
- Self-explanation prompt (triggers generation effect)
- Question format that requires synthesis, not recall

resourceTopics field:
- Array of 2-3 keywords for finding resources
- e.g., ["python functions", "return values", "parameters"]

OUTPUT FORMAT (JSON only, no markdown):
{
  "weekNumber": N,
  "title": "Week N: [Specific Title]",
  "theme": "[Human-friendly theme]",
  "skill": "[Verb-first: ONE skill for the week]",
  "competenceProof": "[Day 5 PROVE criteria - binary, observable, requires all prior skills]",
  "drills": [
    {
      "dayType": "encounter",
      "do": "[Action verb: Copy/Follow/Run this code...]",
      "done": "[Binary success: Terminal prints X / File contains Y]",
      "stuck": "[Specific error: SyntaxError: ... / TypeError: ...]",
      "unstuck": "[Action verb: Add/Remove/Change the X...]",
      "why": "[Motivation: This is needed because...]",
      "reflect": "[Question: What would happen if...?]",
      "givenMaterial": "[Code/text to copy - REQUIRED for encounter/fail days]",
      "givenMaterialType": "code",
      "resourceTopics": ["keyword1", "keyword2"]
    },
    {"dayType": "struggle", "do": "...", "done": "...", "stuck": "...", "unstuck": "...", "why": "...", "reflect": "...", "givenMaterial": null, "givenMaterialType": null, "resourceTopics": [...]},
    {"dayType": "connect", "do": "...", ...},
    {"dayType": "fail", "do": "...", "givenMaterial": "[BROKEN code/content]", ...},
    {"dayType": "prove", "do": "...", "givenMaterial": null, ...}
  ]
}

CRITICAL: Each drill MUST have these exact field names: do, done, stuck, unstuck, why, reflect, givenMaterial, givenMaterialType, resourceTopics`;
}

function buildWeekPrompt(
  context: GenerationContext,
  domain: LearningDomain,
  weekNumber: number,
  previousWeeks: Array<{ title: string; skill: string }>,
  totalWeeks: number
): string {
  const focusContext = context.focus ? `\nFOCUS: ${context.focus}` : '';
  const motivationContext = context.motivation ? `\nMOTIVATION: ${context.motivation}` : '';
  const priorContext = context.priorKnowledge ? `\nPRIOR KNOWLEDGE: ${context.priorKnowledge}` : '';
  
  const progressPercent = Math.round((weekNumber / totalWeeks) * 100);
  
  // Build phase guidance without generic domain concepts
  let phaseGuidance: string;
  if (weekNumber === 1) {
    phaseGuidance = `PHASE: FOUNDATIONS (0-25%)
- Teach the most basic element of "${context.topic}"
- Assume zero prior knowledge
- One simple concept, done correctly`;
  } else if (progressPercent <= 40) {
    phaseGuidance = `PHASE: CORE SKILLS (25-40%)
- Build directly on Week ${weekNumber - 1}
- Add ONE new aspect of "${context.topic}"
- Still single-concept focus`;
  } else if (progressPercent <= 70) {
    phaseGuidance = `PHASE: INTEGRATION (40-70%)
- Combine multiple "${context.topic}" skills together
- Add real-world complexity or variation
- Day 3 CONNECT should use skills from Weeks 1-${weekNumber - 1}`;
  } else {
    phaseGuidance = `PHASE: MASTERY (70-100%)
- Apply all "${context.topic}" skills to a real challenge
- Handle edge cases and unexpected situations
- Day 5 should require everything learned so far`;
  }

  // Previous weeks context (enforce uniqueness)
  const previousContext = previousWeeks.length > 0
    ? `\n\nPREVIOUS WEEKS (DO NOT REPEAT these titles or skills):
${previousWeeks.map((w, i) => `Week ${i + 1}: "${w.title}" → Skill: "${w.skill}"`).join('\n')}`
    : '';

  // Integration requirements for later weeks
  const integrationReq = weekNumber > 1
    ? `\n\nINTEGRATION REQUIREMENT: Day 3 and Day 5 must use skills from previous weeks.`
    : '';

  return `Generate Week ${weekNumber} of ${totalWeeks} for: "${context.topic}"

LEVEL: ${context.level || 'beginner'}
DAILY TIME: ${context.minutesPerDay || 30} minutes${focusContext}${motivationContext}${priorContext}

═══════════════════════════════════════════════════════════════════════════════
${phaseGuidance}
${previousContext}
${integrationReq}
═══════════════════════════════════════════════════════════════════════════════

CHECKLIST (all must be true):
☐ Every drill is specifically about "${context.topic}" (not generic programming/learning)
☐ "skill" field has 5+ words (not "Write" or "Build" alone)
☐ Week title is unique and describes what's actually being learned
☐ Day 1 (encounter) has givenMaterial with ACTUAL content to copy
☐ Day 4 (fail) has givenMaterial with BROKEN content to fix
☐ Day 2, 3, 5 have givenMaterial: null
☐ resourceTopics include "${context.topic}" keywords

Return ONLY valid JSON. No markdown. No explanation.`;
}

function getDomainExamples(domain: LearningDomain, weekNumber: number): string {
  // Only include examples for first week and on retries
  if (weekNumber > 1) {
    return ''; // Later weeks should be creative based on progression
  }
  
  const examples: Record<LearningDomain, string> = {
    technical: `
EXAMPLE (Technical - Week 1):
{
  "weekNumber": 1,
  "title": "Week 1: Hello World & Variables",
  "theme": "First steps with Python",
  "skill": "Store and display values using variables",
  "competenceProof": "Write a 5-line program that stores your name, age, and a greeting in variables, then prints a formatted sentence using all three — no syntax errors, output matches expected format",
  "drills": [
    {
      "dayType": "encounter" (LOWERCASE fields required),
      "do": "Copy this code exactly into a file called hello.py and run it with 'python hello.py'",
      "givenMaterial": "name = \\"Alice\\"\\nage = 25\\ngreeting = \\"Hello\\"\\nprint(f\\"{greeting}, {name}! You are {age} years old.\\")",
      "givenMaterialType": "code",
      "done": "Terminal prints: Hello, Alice! You are 25 years old.",
      "stuck": "SyntaxError: invalid syntax near the f-string",
      "unstuck": "Check that quotes match (all double or all single) and f is directly before the opening quote",
      "why": "f-strings are the modern way to combine variables with text in Python",
      "reflect": "What does the 'f' before the string do?",
      "resourceTopics": ["python f-strings", "python variables"]
    },
    {
      "dayType": "struggle",
      "do": "Without looking at Day 1, write a program that stores your actual name and age, then prints a greeting",
      "givenMaterial": null,
      "givenMaterialType": null,
      "done": "Program runs without errors and prints your personalized greeting",
      "stuck": "NameError: name 'name' is not defined",
      "unstuck": "Variables must be assigned before use — add 'name = ...' line before the print",
      "why": "Recalling syntax from memory strengthens the neural pathways",
      "reflect": "Which part did you have to think about most?",
      "resourceTopics": ["python variables", "python print"]
    }
  ]
}`,
    creative: `
EXAMPLE (Creative - Week 1):
{
  "weekNumber": 1,
  "title": "Week 1: Your First Chord",
  "theme": "G major and clean technique",
  "skill": "Play the G chord with all strings ringing clearly",
  "competenceProof": "Record yourself playing the G chord 4 times, strumming all 6 strings — each strum has no buzzing or muted strings",
  "drills": [...]
}`,
    language: `
EXAMPLE (Language - Week 1):
{
  "weekNumber": 1,
  "title": "Week 1: Essential Greetings",
  "theme": "Hello, goodbye, and please",
  "skill": "Greet someone and say goodbye in the target language",
  "competenceProof": "Complete a 30-second greeting conversation with correct pronunciation — recorded and self-evaluated",
  "drills": [...]
}`,
    physical: `
EXAMPLE (Physical - Week 1):
{
  "weekNumber": 1,
  "title": "Week 1: Foundation Stance",
  "theme": "Balance and alignment basics",
  "skill": "Hold the basic stance for 60 seconds with correct alignment",
  "competenceProof": "Video yourself in stance for 60 seconds — check against the 4-point alignment checklist",
  "drills": [...]
}`,
    knowledge: `
EXAMPLE (Knowledge - Week 1):
{
  "weekNumber": 1,
  "title": "Week 1: Key Terms & Framework",
  "theme": "Building the vocabulary foundation",
  "skill": "Define and connect the 5 key terms of the subject",
  "competenceProof": "Write all 5 terms with definitions from memory, then draw a concept map showing their relationships",
  "drills": [...]
}`,
    professional: `
EXAMPLE (Professional - Week 1):
{
  "weekNumber": 1,
  "title": "Week 1: Core Technique Observation",
  "theme": "Watch, imitate, reflect",
  "skill": "Identify the 3 key elements of effective [skill]",
  "competenceProof": "Watch a recording of yourself and identify all 3 elements, noting timestamps",
  "drills": [...]
}`,
  };
  
  return examples[domain] || examples.technical;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATOR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class QualityGenerator {
  private readonly config: QualityGeneratorConfig;
  private readonly openai: OpenAI | null;
  private readonly domainDetector: DomainDetector;

  constructor(config?: Partial<QualityGeneratorConfig>) {
    this.config = {
      openaiApiKey: config?.openaiApiKey ?? process.env.OPENAI_API_KEY,
      model: config?.model ?? 'gpt-4o-mini',
      maxRetries: config?.maxRetries ?? 3,
      strictValidation: config?.strictValidation ?? false,
    };

    this.openai = this.config.openaiApiKey 
      ? new OpenAI({ apiKey: this.config.openaiApiKey })
      : null;
    
    this.domainDetector = createDomainDetector({
      openaiApiKey: this.config.openaiApiKey,
    });
  }

  /**
   * Generate a complete lesson plan with progressive curriculum.
   */
  async generate(context: GenerationContext): AsyncAppResult<GeneratedLessonPlan> {
    if (!this.openai) {
      return err(appError('CONFIG_ERROR', 'OpenAI API key not configured'));
    }

    // Detect domain
    const domainResult = await this.domainDetector.detect(context.topic);
    if (!domainResult.ok) {
      return err(domainResult.error);
    }
    const domain = domainResult.value.domain;
    console.log(`[QUALITY_GEN] Detected domain: ${domain} (${domainResult.value.confidence})`);

    // Generate weeks with progression tracking
    const weeks: GeneratedWeek[] = [];
    const previousWeeks: Array<{ title: string; skill: string }> = [];
    let previousWeekLastDrill: DrillContent | null = null;
    let globalDayOffset = 0;

    for (let weekNum = 1; weekNum <= context.totalWeeks; weekNum++) {
      console.log(`[QUALITY_GEN] Generating week ${weekNum}/${context.totalWeeks}`);
      
      const weekResult = await this.generateWeek(
        context,
        domain,
        weekNum,
        previousWeeks,
        previousWeekLastDrill,
        globalDayOffset
      );

      if (!weekResult.ok) {
        return err(weekResult.error);
      }

      weeks.push(weekResult.value);
      previousWeeks.push({ title: weekResult.value.title, skill: weekResult.value.skill });
      
      // Get last drill for prime linking
      const rawDrills = weekResult.value.drills.map(d => ({
        dayType: d.dayType,
        do: d.do,
        done: d.done,
        stuck: d.stuck,
        unstuck: d.unstuck,
        why: d.why,
        reflect: d.reflect,
        givenMaterial: d.givenMaterial,
        resourceTopics: d.resourceTopics,
      }));
      previousWeekLastDrill = rawDrills[rawDrills.length - 1] ?? null;
      globalDayOffset += 5;
    }

    return ok({
      topic: context.topic,
      domain,
      totalWeeks: context.totalWeeks,
      weeks,
    });
  }

  /**
   * Generate a single week with validation and retry.
   */
  private async generateWeek(
    context: GenerationContext,
    domain: LearningDomain,
    weekNumber: number,
    previousWeeks: Array<{ title: string; skill: string }>,
    previousWeekLastDrill: DrillContent | null,
    globalDayOffset: number
  ): AsyncAppResult<GeneratedWeek> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      const result = await this.callLlm(
        context,
        domain,
        weekNumber,
        previousWeeks,
        previousWeekLastDrill,
        globalDayOffset,
        attempt > 1 // Include examples on retry
      );

      if (result.ok) {
        // Validate skill is not too short (must be 3+ words)
        const skillWords = result.value.skill.trim().split(/\s+/);
        if (skillWords.length < 3) {
          console.warn(`[QUALITY_GEN] Week ${weekNumber} skill too short (${skillWords.length} words): "${result.value.skill}"`);
          lastError = new Error(`Skill too short: ${result.value.skill}`);
          if (attempt < this.config.maxRetries) {
            console.log(`[QUALITY_GEN] Retrying week ${weekNumber} (attempt ${attempt + 1}/${this.config.maxRetries})`);
          }
          continue;
        }

        // Validate title is unique
        const titleLower = result.value.title.toLowerCase();
        const isDuplicateTitle = previousWeeks.some(w => {
          const prevLower = w.title.toLowerCase();
          return prevLower === titleLower || 
                 (titleLower.includes('building blocks') && prevLower.includes('building blocks')) ||
                 (titleLower.includes('synthesis') && prevLower.includes('synthesis'));
        });
        if (isDuplicateTitle) {
          console.warn(`[QUALITY_GEN] Week ${weekNumber} has duplicate/generic title: "${result.value.title}"`);
          lastError = new Error(`Duplicate title: ${result.value.title}`);
          if (attempt < this.config.maxRetries) {
            console.log(`[QUALITY_GEN] Retrying week ${weekNumber} (attempt ${attempt + 1}/${this.config.maxRetries})`);
          }
          continue;
        }

        // Validate drills
        const enhancedDrills = result.value.drills.map(d => ({
          dayType: d.dayType,
          globalDayNumber: d.globalDayNumber,
          prime: d.prime,
          primeAnswer: d.primeAnswer,
          do: d.do,
          givenMaterial: d.givenMaterial,
          givenMaterialType: d.givenMaterialType ?? null,
          done: d.done,
          stuck: d.stuck,
          unstuck: d.unstuck,
          why: d.why,
          reflect: d.reflect,
          resourceTopics: d.resourceTopics,
          resourcePolicy: d.resourcePolicy ?? 'available' as const,
        }));

        const validation = validateWeek(
          result.value.skill,
          result.value.competenceProof,
          enhancedDrills,
          weekNumber,
          domain
        );

        if (validation.isValid || !this.config.strictValidation) {
          if (!validation.isValid) {
            console.warn(`[QUALITY_GEN] Week ${weekNumber} has warnings:`, formatValidationResult(validation));
          }
          return ok(result.value);
        }

        console.warn(`[QUALITY_GEN] Week ${weekNumber} validation failed:`, formatValidationResult(validation));
        lastError = new Error(`Validation failed: ${validation.totalErrors} errors`);
      } else {
        lastError = new Error(result.error.message);
      }

      if (attempt < this.config.maxRetries) {
        console.log(`[QUALITY_GEN] Retrying week ${weekNumber} (attempt ${attempt + 1}/${this.config.maxRetries})`);
      }
    }

    return err(appError(
      'GENERATION_FAILED',
      `Failed to generate valid week ${weekNumber} after ${this.config.maxRetries} attempts`,
      { cause: lastError ?? undefined }
    ));
  }

  /**
   * Call LLM to generate week content.
   */
  private async callLlm(
    context: GenerationContext,
    domain: LearningDomain,
    weekNumber: number,
    previousWeeks: Array<{ title: string; skill: string }>,
    previousWeekLastDrill: DrillContent | null,
    globalDayOffset: number,
    includeExamples: boolean
  ): AsyncAppResult<GeneratedWeek> {
    try {
      const systemPrompt = buildSystemPrompt(domain, context.topic);
      const weekPrompt = buildWeekPrompt(context, domain, weekNumber, previousWeeks, context.totalWeeks);
      const examples = includeExamples ? getDomainExamples(domain, weekNumber) : '';

      const response = await this.openai!.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt + examples },
          { role: 'user', content: weekPrompt },
        ],
        temperature: 0.7,
        max_tokens: 4000,
      });

      const content = response.choices[0]?.message?.content?.trim() ?? '';
      
      // Parse JSON
      const parsed = this.parseWeekResponse(content);
      if (!parsed.ok) {
        return err(parsed.error);
      }

      // Convert to DrillContent format (handle various field names from LLM)
      const drillContents: DrillContent[] = parsed.value.drills.map((d: any) => ({
        dayType: (d.dayType || d.daytype || d.day_type) as DrillDayType,
        do: d.do || d.DO || d.action || d.ACTION || d.task || '',
        done: d.done || d.DONE || d.success || d.completed || '',
        stuck: d.stuck || d.STUCK || d.error || d.problem || '',
        unstuck: d.unstuck || d.UNSTUCK || d.fix || d.solution || '',
        why: d.why || d.WHY || d.reason || d.motivation || '',
        reflect: d.reflect || d.REFLECT || d.reflection || d.question || '',
        givenMaterial: d.givenMaterial || d.GIVENMATERIAL || d.given_material || d.material || null,
        resourceTopics: d.resourceTopics || d.RESOURCETOPICS || d.resource_topics || d.topics || [],
      }));

      // Create week content for prime linking
      const weekContent: WeekContent = {
        weekNumber,
        skill: parsed.value.skill,
        drills: drillContents,
      };

      // Link primes
      const linkedDrills = linkWeekPrimes(
        weekContent,
        previousWeekLastDrill,
        domain,
        globalDayOffset
      );

      // Add resource policy and material type
      const finalDrills: LinkedDrillContent[] = linkedDrills.map((d, i) => {
        const rawDrill = parsed.value.drills[i];
        const dayConfig = DAY_TYPE_CONFIGS[d.dayType];
        
        return {
          ...d,
          givenMaterialType: rawDrill?.givenMaterialType as GivenMaterialType ?? null,
          resourcePolicy: dayConfig.resourcePolicy as ResourcePolicy,
        };
      });

      return ok({
        weekNumber,
        title: parsed.value.title,
        theme: parsed.value.theme,
        skill: parsed.value.skill,
        competenceProof: parsed.value.competenceProof,
        domain,
        drills: finalDrills,
      });
    } catch (error) {
      console.error('[QUALITY_GEN] LLM call failed:', error);
      return err(appError(
        'LLM_ERROR',
        'Failed to generate week content',
        { cause: error instanceof Error ? error : undefined }
      ));
    }
  }

  /**
   * Parse LLM response as JSON.
   */
  private parseWeekResponse(content: string): AppResult<any> {
    try {
      // Remove markdown code blocks if present
      let json = content;
      if (json.startsWith('```')) {
        json = json.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      console.log("[QUALITY_GEN] Raw LLM response:", json.substring(0, 500));
      const parsed = JSON.parse(json);
      
      // Validate basic structure
      if (!parsed.skill || !parsed.competenceProof || !Array.isArray(parsed.drills)) {
        console.error('[QUALITY_GEN] Missing fields. Got:', Object.keys(parsed));
        return err(appError('PARSE_ERROR', 'Missing required fields in response'));
      }
      
      if (parsed.drills.length !== 5) {
        console.error('[QUALITY_GEN] Wrong drill count:', parsed.drills?.length);
        return err(appError('PARSE_ERROR', `Expected 5 drills, got ${parsed.drills.length}`));
      }

      return ok(parsed);
    } catch (error) {
      console.error('[QUALITY_GEN] JSON parse error:', error, '\nContent:', json.substring(0, 300));
      return err(appError('PARSE_ERROR', 'Failed to parse JSON response', { cause: error instanceof Error ? error : undefined }));
    }
  }
}

/**
 * Create a quality generator instance.
 */
export function createQualityGenerator(
  config?: Partial<QualityGeneratorConfig>
): QualityGenerator {
  return new QualityGenerator(config);
}
