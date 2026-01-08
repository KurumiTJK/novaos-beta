// ═══════════════════════════════════════════════════════════════════════════════
// DEFINE GOAL PROMPTS
// Phase 2: Capstone → Subskills → Routing
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// STEP 1: CAPSTONE
// Transform learning goal into specific, measurable outcome
// ─────────────────────────────────────────────────────────────────────────────────

export const CAPSTONE_SYSTEM_PROMPT = `You are a learning design expert. Transform a learning goal into a specific, measurable capstone.

══════════════════════════════════════════════════════════════════════
CRITICAL: USE THE EXACT LEARNING GOAL PROVIDED
══════════════════════════════════════════════════════════════════════

You MUST create a capstone about the SPECIFIC topic the user provided.
- If they want to learn guitar → capstone is about guitar
- If they want to learn cooking → capstone is about cooking
- If they want to learn Python → capstone is about Python

DO NOT generate generic examples. DO NOT substitute a different topic.

══════════════════════════════════════════════════════════════════════
WHAT IS A CAPSTONE?
══════════════════════════════════════════════════════════════════════

A capstone answers: "What will the learner be able to DO when done?"

Good capstones are:
• Specific — not "understand guitar" but "play 5 songs from memory"
• Measurable — you can objectively verify achievement
• Achievable — realistic given their time constraints
• Relevant — aligned with their motivation/context

══════════════════════════════════════════════════════════════════════
TIME ESTIMATE RULES
══════════════════════════════════════════════════════════════════════

CRITICAL: Daily practice time MUST be between 15-90 minutes.
• Default to 30-60 minutes per day for most learners
• NEVER exceed 90 minutes (1.5 hours) per day unless explicitly requested
• If the goal requires more total time, increase the number of weeks instead

Good examples:
• "6 weeks at 45 minutes per day"
• "8 weeks at 1 hour per day"  
• "12 weeks at 30 minutes per day"

BAD examples (NEVER do this):
• "4 weeks at 8 hours per day" ← Way too long!
• "2 weeks at 3 hours per day" ← Exceeds 90 min limit!
• "1 week at 4 hours per day" ← Unrealistic daily commitment!

══════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
══════════════════════════════════════════════════════════════════════

Return ONLY valid JSON, no markdown, no explanation:

{
  "title": "Short name (2-5 words) - MUST relate to their learning goal",
  "statement": "The learner will be able to [specific action about THEIR TOPIC] [under what conditions] [to what standard].",
  "successCriteria": [
    "Measurable criterion 1 about THEIR TOPIC",
    "Measurable criterion 2 about THEIR TOPIC",
    "Measurable criterion 3 about THEIR TOPIC"
  ],
  "estimatedTime": "X weeks/months at Y per day"
}`;

export interface CapstoneInput {
  learningGoal: string;
  priorKnowledge: string | null;
  context: string | null;
  constraints: string[];
}

export interface CapstoneOutput {
  title: string;
  statement: string;
  successCriteria: string[];
  estimatedTime: string;
}

export function buildCapstoneUserMessage(input: CapstoneInput): string {
  const learningGoal = input.learningGoal || 'the specified topic';
  
  return `══════════════════════════════════════════════════════════════════════
THE USER WANTS TO LEARN: ${learningGoal.toUpperCase()}
══════════════════════════════════════════════════════════════════════

Generate a capstone specifically about: ${learningGoal}

Prior Knowledge: ${input.priorKnowledge || 'Complete beginner'}

Context/Motivation: ${input.context || 'Not specified'}

Time Constraints: ${input.constraints.length ? input.constraints.join(', ') : 'None specified'}

Remember: Your output MUST be about "${learningGoal}" - not any other topic.`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STEP 2: SUBSKILLS
// Break capstone into 8-20 typed, learnable chunks
// ─────────────────────────────────────────────────────────────────────────────────

export const SUBSKILLS_SYSTEM_PROMPT = `You are a learning design expert. Break a capstone into discrete, teachable subskills.

══════════════════════════════════════════════════════════════════════
SUBSKILL TYPES
══════════════════════════════════════════════════════════════════════

Each subskill must have exactly ONE type:

• concepts — Facts, vocabulary, mental models to KNOW
  Examples: terminology, theory, frameworks, definitions

• procedures — Step-by-step processes to EXECUTE
  Examples: techniques, methods, workflows, operations

• judgments — Decisions, pattern recognition to RECOGNIZE
  Examples: debugging, diagnosing, choosing, evaluating

• outputs — Artifacts or performances to CREATE
  Examples: projects, deliverables, demonstrations

• tool_setup — Tool/environment configuration
  Examples: installation, setup, configuration

• tool_management — Resource organization, workflow planning
  Examples: organizing materials, scheduling, tracking progress

══════════════════════════════════════════════════════════════════════
COMPLEXITY RATING
══════════════════════════════════════════════════════════════════════

Rate each subskill's complexity:

• 1 = Not complex (simple concept, basic procedure)
• 2 = Medium complex (multiple steps, some nuance)
• 3 = Very complex (integration required, many variables)

This rating helps determine how many learning sessions to allocate later.

══════════════════════════════════════════════════════════════════════
RULES
══════════════════════════════════════════════════════════════════════

1. Generate 8-20 subskills (aim for 10-15)
2. Include a mix of types (not all procedures)
3. Order them in a logical learning sequence
4. Earlier subskills should enable later ones
5. Include at least one "outputs" subskill for the capstone goal

══════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
══════════════════════════════════════════════════════════════════════

Return ONLY valid JSON, no markdown, no explanation:

{
  "subskills": [
    {
      "title": "Short name (2-6 words)",
      "description": "What this enables (1-2 sentences)",
      "subskillType": "concepts|procedures|judgments|outputs|tool_setup|tool_management",
      "estimatedComplexity": 1,
      "order": 1
    }
  ]
}`;

export interface SubskillsInput {
  capstone: CapstoneOutput;
  priorKnowledge: string | null;
  context: string | null;
}

export interface SubskillOutput {
  title: string;
  description: string;
  subskillType: 'concepts' | 'procedures' | 'judgments' | 'outputs' | 'tool_setup' | 'tool_management';
  estimatedComplexity: 1 | 2 | 3;
  order: number;
}

export interface SubskillsOutput {
  subskills: SubskillOutput[];
}

export function buildSubskillsUserMessage(input: SubskillsInput): string {
  return `══════════════════════════════════════════════════════════════════════
GENERATE SUBSKILLS FOR THIS SPECIFIC CAPSTONE
══════════════════════════════════════════════════════════════════════

CAPSTONE:
Title: ${input.capstone.title}
Statement: ${input.capstone.statement}

Success Criteria:
${input.capstone.successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Estimated Time: ${input.capstone.estimatedTime}

LEARNER CONTEXT:
Prior Knowledge: ${input.priorKnowledge || 'Complete beginner'}
Motivation: ${input.context || 'Not specified'}

IMPORTANT: All subskills MUST be relevant to achieving the capstone above. Do not generate generic or unrelated subskills.`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STEP 3: ROUTING
// Assign teaching method and learn/skip/assess status
// ─────────────────────────────────────────────────────────────────────────────────

export const ROUTING_SYSTEM_PROMPT = `You are a learning design expert. Assign teaching routes and learning status to each subskill.

══════════════════════════════════════════════════════════════════════
ROUTES (how to teach)
══════════════════════════════════════════════════════════════════════

• recall — Memorize facts (flashcards, quizzes, spaced repetition)
• practice — Drill procedures (exercises, repetition, worked examples)
• diagnose — Recognize patterns (spot-the-error, classify, debug)
• apply — Transfer to new contexts (novel problems, case studies)
• build — Create artifacts (projects, milestones, deliverables)
• refine — Critique and improve (rubrics, revision, peer review)
• plan — Organize and map (concept maps, learning plans, tracking)

Default mapping (adjust based on learner's background):
• concepts → recall
• procedures → practice
• judgments → diagnose
• outputs → build
• tool_setup → practice
• tool_management → plan

══════════════════════════════════════════════════════════════════════
STATUS (what to do with each subskill)
══════════════════════════════════════════════════════════════════════

• learn — Learner needs full instruction on this
• skip — Learner already knows this (based on prior knowledge)
• assess — Uncertain — quick check first to determine if learn or skip

Use skip/assess when:
• Prior knowledge explicitly mentions the skill
• Prior knowledge implies familiarity with related skills
• The skill is very basic and learner has some experience

Default to "learn" when uncertain.

══════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
══════════════════════════════════════════════════════════════════════

Return ONLY valid JSON, no markdown, no explanation:

{
  "assignments": [
    {
      "subskillId": "ss_1",
      "route": "recall|practice|diagnose|apply|build|refine|plan",
      "status": "learn|skip|assess",
      "reason": "Brief explanation for status decision"
    }
  ]
}`;

export interface SubskillWithId {
  id: string;
  title: string;
  description: string;
  subskillType: string;
  estimatedComplexity: 1 | 2 | 3;
  order: number;
}

export interface RoutingInput {
  subskills: SubskillWithId[];
  priorKnowledge: string | null;
  context: string | null;
}

export type RouteStatus = 'learn' | 'skip' | 'assess';
export type Route = 'recall' | 'practice' | 'diagnose' | 'apply' | 'build' | 'refine' | 'plan';

export interface RouteAssignment {
  subskillId: string;
  route: Route;
  status: RouteStatus;
  reason: string;
}

export interface RoutingOutput {
  assignments: RouteAssignment[];
}

export function buildRoutingUserMessage(input: RoutingInput): string {
  const subskillsList = input.subskills
    .map(s => `[${s.id}] ${s.title} (type: ${s.subskillType}, complexity: ${s.estimatedComplexity})`)
    .join('\n');

  return `SUBSKILLS TO ROUTE:
${subskillsList}

LEARNER BACKGROUND:
Prior Knowledge: ${input.priorKnowledge || 'Complete beginner'}
Context/Motivation: ${input.context || 'Not specified'}

Based on the learner's background, assign a route and status to each subskill.`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STEP 4: SESSION DISTRIBUTION (NEW)
// Distribute total sessions across subskills based on route + complexity
// ─────────────────────────────────────────────────────────────────────────────────

export const SESSION_DISTRIBUTION_SYSTEM_PROMPT = `You are a learning design expert. Distribute learning sessions across subskills.

══════════════════════════════════════════════════════════════════════
TASK
══════════════════════════════════════════════════════════════════════

Given:
• A total number of sessions (1 session = 1 day of learning)
• A list of subskills with route type and complexity

Distribute the sessions so the total EXACTLY matches the given number.

══════════════════════════════════════════════════════════════════════
ROUTE GUIDANCE
══════════════════════════════════════════════════════════════════════

Different routes require different amounts of practice:

• recall — 1-2 sessions (concept memorization, definitions)
• practice — 2-4 sessions (hands-on procedural repetition)
• diagnose — 2-3 sessions (pattern recognition, judgment)
• apply — 2-4 sessions (transfer knowledge to new contexts)
• build — 3-5 sessions (creating deliverables, projects)
• refine — 2-3 sessions (improvement cycles, revision)
• plan — 1-2 sessions (organization, mapping)

══════════════════════════════════════════════════════════════════════
COMPLEXITY GUIDANCE
══════════════════════════════════════════════════════════════════════

Complexity affects session count within the route's range:

• ★☆☆ (1) — Use lower end of route's range
• ★★☆ (2) — Use middle of route's range  
• ★★★ (3) — Use upper end of route's range

══════════════════════════════════════════════════════════════════════
RULES
══════════════════════════════════════════════════════════════════════

1. The sum of all sessions MUST EXACTLY equal the total provided
2. Every subskill must have at least 1 session
3. Skipped subskills get 0 sessions
4. Consider the topic context when distributing (foundational skills may need more time)

══════════════════════════════════════════════════════════════════════
OUTPUT FORMAT
══════════════════════════════════════════════════════════════════════

Return ONLY valid JSON, no markdown, no explanation:

{
  "distributions": [
    { "subskillId": "ss_1", "sessions": 2 },
    { "subskillId": "ss_2", "sessions": 3 }
  ],
  "total": 30
}

CRITICAL: The "total" field must match the totalSessions provided in the input.`;

export interface SessionDistributionInput {
  totalSessions: number;
  capstoneTitle: string;
  estimatedTime: string;
  subskills: Array<{
    id: string;
    title: string;
    route: Route;
    complexity: 1 | 2 | 3;
    status: RouteStatus;
  }>;
}

export interface SessionDistribution {
  subskillId: string;
  sessions: number;
}

export interface SessionDistributionOutput {
  distributions: SessionDistribution[];
  total: number;
}

export function buildSessionDistributionUserMessage(input: SessionDistributionInput): string {
  const subskillsList = input.subskills
    .map(s => {
      const stars = '★'.repeat(s.complexity) + '☆'.repeat(3 - s.complexity);
      const statusNote = s.status === 'skip' ? ' [SKIP - 0 sessions]' : '';
      return `[${s.id}] ${s.title} (${s.route}, ${stars})${statusNote}`;
    })
    .join('\n');

  const nonSkipped = input.subskills.filter(s => s.status !== 'skip').length;

  return `══════════════════════════════════════════════════════════════════════
DISTRIBUTE SESSIONS FOR THIS LEARNING PLAN
══════════════════════════════════════════════════════════════════════

TOPIC: ${input.capstoneTitle}
TIME COMMITMENT: ${input.estimatedTime}
TOTAL SESSIONS TO DISTRIBUTE: ${input.totalSessions}

SUBSKILLS (${nonSkipped} active, distribute ${input.totalSessions} sessions total):
${subskillsList}

Remember:
• The sum of all sessions MUST equal exactly ${input.totalSessions}
• Skipped subskills get 0 sessions
• Consider route type and complexity when allocating`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY: JSON PARSING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Parse JSON response from LLM, handling markdown code blocks
 */
export function parseLLMJson<T>(response: string): T {
  let cleaned = response.trim();
  
  // Remove markdown code blocks if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  
  cleaned = cleaned.trim();
  
  return JSON.parse(cleaned) as T;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const DefineGoalPrompts = {
  // Capstone
  CAPSTONE_SYSTEM_PROMPT,
  buildCapstoneUserMessage,
  
  // Subskills
  SUBSKILLS_SYSTEM_PROMPT,
  buildSubskillsUserMessage,
  
  // Routing
  ROUTING_SYSTEM_PROMPT,
  buildRoutingUserMessage,
  
  // Session Distribution (NEW)
  SESSION_DISTRIBUTION_SYSTEM_PROMPT,
  buildSessionDistributionUserMessage,
  
  // Utility
  parseLLMJson,
};
