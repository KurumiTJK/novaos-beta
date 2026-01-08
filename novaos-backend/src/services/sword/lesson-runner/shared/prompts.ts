// ═══════════════════════════════════════════════════════════════════════════════
// LLM PROMPTS — Full Personalization for Lesson Runner
// System prompts and message builders for all generation tasks
// ═══════════════════════════════════════════════════════════════════════════════

import type { PlanSubskill, LessonPlan, Route } from '../../types.js';
import type { Gap, SessionOutline, SessionSummary } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// FULL GENERATION CONTEXT
// ─────────────────────────────────────────────────────────────────────────────────

export interface FullGenerationContext {
  // From Plan
  planTitle: string;
  capstoneStatement?: string;
  successCriteria: string[];
  difficulty: string;
  dailyMinutes: number;
  
  // From Subskill
  subskillTitle: string;
  subskillDescription?: string;
  subskillType: string;
  route: Route;
  complexity: 1 | 2 | 3;
  
  // Position & Progress
  subskillIndex: number;
  totalSubskills: number;
  sessionNumber: number;
  totalSessions: number;
  overallProgress: number;
  
  // History (Full personalization)
  previousSummaries: SessionSummary[];
  previousScores: number[];
  weakAreas: string[];
  learningVelocity: 'slow' | 'normal' | 'fast';
}

/**
 * Build full context for LLM generation
 */
export function buildFullContext(
  subskill: PlanSubskill,
  plan: LessonPlan,
  sessionNumber: number,
  totalSessions: number,
  previousSummaries: SessionSummary[] = [],
  previousScores: number[] = [],
  weakAreas: string[] = []
): FullGenerationContext {
  // Calculate learning velocity based on session completion rate
  // Use safe access for optional plan properties
  const sessionsCompleted = (plan as any).sessionsCompleted ?? 0;
  const weeklyCadence = (plan as any).weeklyCadence ?? 5;
  
  const createdAt = plan.createdAt instanceof Date ? plan.createdAt : new Date(plan.createdAt || Date.now());
  const actualWeeks = Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000)));
  const actualRate = sessionsCompleted / actualWeeks;
  
  let learningVelocity: 'slow' | 'normal' | 'fast' = 'normal';
  if (actualRate < weeklyCadence * 0.6) learningVelocity = 'slow';
  else if (actualRate > weeklyCadence * 1.3) learningVelocity = 'fast';
  
  return {
    planTitle: plan.title,
    capstoneStatement: plan.capstoneStatement,
    successCriteria: plan.successCriteria || [],
    difficulty: plan.difficulty || 'intermediate',
    dailyMinutes: plan.dailyMinutes || 30,
    
    subskillTitle: subskill.title,
    subskillDescription: subskill.description,
    subskillType: subskill.subskillType || 'concept',
    route: subskill.route,
    complexity: subskill.complexity || 2,
    
    subskillIndex: subskill.order || 1,
    totalSubskills: plan.totalSubskills || 1,
    sessionNumber,
    totalSessions,
    overallProgress: plan.progress || 0,
    
    previousSummaries,
    previousScores,
    weakAreas,
    learningVelocity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON PLAN GENERATION (HIGH thinking)
// ─────────────────────────────────────────────────────────────────────────────────

export const LESSON_PLAN_SYSTEM_PROMPT = `You are an expert instructional designer creating personalized lesson plans.

Your task is to create a structured, pedagogically-sound lesson plan for a specific subskill within a larger learning journey. The plan should be tailored to the learner's goals, context, and available time.

## Output Format
Respond with JSON only (no markdown, no explanation):
{
  "learningObjectives": [
    "Specific, measurable objective 1",
    "Specific, measurable objective 2",
    "Specific, measurable objective 3"
  ],
  "prerequisites": [
    "Prerequisite knowledge 1",
    "Prerequisite knowledge 2"
  ],
  "sessionOutline": [
    {
      "sessionNumber": 1,
      "title": "Descriptive Session Title",
      "focus": "What this session specifically covers",
      "objectives": ["Session-specific objective 1", "Session-specific objective 2"],
      "estimatedMinutes": 20
    }
  ]
}

## Guidelines
- Create 3-7 sessions based on complexity and route type
- Each session should be completable within the daily time budget
- The FINAL session is always reserved for the knowledge check (mastery test)
- Learning objectives should be specific, measurable, and achievable
- Session progression should follow the learning route's pedagogy:
  * recall → exposure → encoding → retrieval → spacing
  * practice → demonstration → guided → independent → fluency
  * diagnose → observation → classification → detection → judgment
  * apply → transfer → variation → novel problems → integration
  * build → planning → foundation → development → polish
  * refine → critique → standards → revision → validation
  * plan → assessment → strategy → organization → review
- Reference the capstone goal to show how this subskill contributes
- Adapt complexity based on the learner's pace (slow/normal/fast)`;

export function buildLessonPlanUserMessage(
  subskill: PlanSubskill,
  plan: LessonPlan,
  context: FullGenerationContext,
  isRemediation: boolean = false,
  gaps?: Gap[]
): string {
  let message = `Create a comprehensive lesson plan for this subskill:

## SUBSKILL DETAILS
Title: ${subskill.title}
${subskill.description ? `Description: ${subskill.description}` : ''}
Type: ${subskill.subskillType}
Route: ${subskill.route} (determines learning approach)
Complexity: ${subskill.complexity}/3

## LEARNING PLAN CONTEXT
Plan Title: ${plan.title}
${plan.capstoneStatement ? `Capstone Goal: "${plan.capstoneStatement}"` : ''}
${plan.successCriteria?.length ? `Success Criteria:\n${plan.successCriteria.map(c => `- ${c}`).join('\n')}` : ''}
Difficulty Level: ${plan.difficulty}
Daily Time Budget: ${plan.dailyMinutes || 30} minutes per session

## LEARNER PROGRESS
Position: Subskill ${context.subskillIndex} of ${context.totalSubskills}
Overall Plan Progress: ${Math.round(context.overallProgress * 100)}%
Learning Velocity: ${context.learningVelocity}`;

  if (context.previousSummaries.length > 0) {
    message += `\n\n## PREVIOUS LEARNING (for continuity)`;
    for (const summary of context.previousSummaries.slice(-3)) {
      message += `\n- ${summary.summary}`;
    }
  }

  if (context.weakAreas.length > 0) {
    message += `\n\n## AREAS NEEDING ATTENTION\n${context.weakAreas.map(a => `- ${a}`).join('\n')}`;
  }

  if (isRemediation && gaps && gaps.length > 0) {
    message += `\n\n## REMEDIATION FOCUS (This is a targeted remediation plan)
The learner took a diagnostic and showed gaps in:`;
    for (const gap of gaps) {
      message += `\n- ${gap.area} (${gap.priority} priority): ${gap.suggestedFocus}`;
    }
    message += `\n\nFocus the lesson plan specifically on addressing these gaps.`;
  }

  message += `\n\n## ROUTE-SPECIFIC GUIDANCE
${getRouteGuidance(subskill.route)}`;

  return message;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DAILY LESSON GENERATION (HIGH thinking)
// ─────────────────────────────────────────────────────────────────────────────────

export const DAILY_LESSON_SYSTEM_PROMPT = `You are an expert tutor creating rich, engaging daily lesson content.

Your task is to generate a complete learning session that the student can work through independently. The content should be educational, engaging, and practical.

## Output Format
Respond with JSON only (no markdown, no explanation):
{
  "sessionGoal": "Clear, motivating statement of what learner will achieve today",
  "content": [
    {
      "title": "Section Title",
      "content": "Detailed explanation with examples. Use clear language. Include code examples where appropriate using backticks for inline code or triple backticks for blocks.",
      "bulletPoints": ["Key point 1", "Key point 2", "Key point 3"]
    }
  ],
  "activities": [
    // SEE ACTIVITY FORMAT BELOW - each type has different required fields
  ],
  "keyPoints": [
    "Key takeaway 1 - something memorable and actionable",
    "Key takeaway 2 - a concept to remember",
    "Key takeaway 3 - a practical tip"
  ],
  "reflectionPrompt": "A thought-provoking question connecting this to their goals"
}

## ACTIVITY TYPES - Use the correct format for each type:

### READ Activity (knowledge intake, NO tasks)
{
  "id": "a1",
  "type": "read",
  "title": "Understanding [Topic]",
  "estimatedMinutes": 8,
  "explanation": "A comprehensive explanation (3-5 paragraphs) covering the concept. Include:
    - What it is and why it matters
    - How it works (with examples)
    - Common patterns or use cases
    - Code examples if relevant (use markdown code blocks)",
  "articleSearchQuery": "search terms to find a good article"
}

### WATCH Activity (video learning, NO tasks)
{
  "id": "a2",
  "type": "watch",
  "title": "Watch: [Topic] Explained",
  "estimatedMinutes": 10,
  "videoSearchQuery": "specific search query for YouTube",
  "focusPoints": [
    "Pay attention to how they explain X",
    "Notice the pattern they use for Y",
    "Watch for the common mistake at Z"
  ]
}

### EXERCISE Activity (bounded task, small output)
{
  "id": "a3",
  "type": "exercise",
  "title": "Exercise: [Action]",
  "estimatedMinutes": 10,
  "prompt": "Clear description of what to do. Be specific about:
    - The exact task
    - Any constraints or requirements
    - What 'done' looks like",
  "expectedOutcome": "What a correct solution looks like or achieves",
  "hints": ["Hint 1 if stuck", "Hint 2 for next step"],
  "solution": "The example solution or approach (revealed after attempt)"
}

### PRACTICE Activity (procedural repetition, no new theory)
{
  "id": "a4",
  "type": "practice",
  "title": "Practice: [Procedure]",
  "estimatedMinutes": 12,
  "steps": [
    "Step 1: Do this first...",
    "Step 2: Then do this...",
    "Step 3: Verify by checking..."
  ],
  "checklist": [
    "✓ Completed step 1",
    "✓ Verified step 2 output",
    "✓ Final result matches expected"
  ],
  "tips": ["Pro tip for faster execution", "Common mistake to avoid"]
}

### BUILD Activity (create an artifact)
{
  "id": "a5",
  "type": "build",
  "title": "Build: [What to Create]",
  "estimatedMinutes": 15,
  "objective": "What you're building and why",
  "requirements": [
    "Requirement 1: Must have X",
    "Requirement 2: Should handle Y",
    "Requirement 3: Nice to have Z"
  ],
  "guidance": [
    "Start by setting up...",
    "Then implement the core...",
    "Finally, add error handling..."
  ]
}

### QUIZ Activity (test knowledge)
{
  "id": "a6",
  "type": "quiz",
  "title": "Quick Check: [Topic]",
  "estimatedMinutes": 5,
  "questions": [
    {
      "id": "q1",
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Why A is correct"
    }
  ]
}

## ACTIVITY SELECTION RULES:
- Match activities to the learning route:
  * recall → READ + WATCH + QUIZ (understanding focus)
  * practice → WATCH + PRACTICE + EXERCISE (procedural focus)
  * build → READ + BUILD + PRACTICE (creation focus)
  * diagnose → READ + EXERCISE + QUIZ (analysis focus)
  * apply → READ + EXERCISE + BUILD (application focus)
  * refine → READ + PRACTICE + EXERCISE (improvement focus)
  * plan → READ + BUILD + QUIZ (strategy focus)
- Include 2-4 activities per session
- Total activity time should match the daily time budget
- Always include at least one active activity (exercise, practice, or build)

## CONTENT GUIDELINES:
- Create 3-4 content sections with substantive explanations
- Include real examples, code snippets, or concrete illustrations
- Each content section should have 2-4 bullet points summarizing key ideas
- The reflection prompt should connect learning to the capstone goal
- Reference previous sessions to build continuity
- Adjust depth based on learner's velocity (give more support if slow)`;

export function buildDailyLessonUserMessage(
  subskill: PlanSubskill,
  plan: LessonPlan,
  context: FullGenerationContext,
  sessionOutline?: SessionOutline,
  previousSummaries: SessionSummary[] = []
): string {
  let message = `Create rich lesson content for today's session:

## SESSION INFO
Session: ${context.sessionNumber} of ${context.totalSessions}
Subskill: ${subskill.title}
Route: ${subskill.route}
Time Budget: ${plan.dailyMinutes || 30} minutes

## CAPSTONE CONTEXT
Plan: ${plan.title}
${plan.capstoneStatement ? `Goal: "${plan.capstoneStatement}"` : ''}`;

  if (sessionOutline) {
    message += `

## SESSION OUTLINE (from lesson plan)
Title: ${sessionOutline.title}
Focus: ${sessionOutline.focus}
Objectives:
${sessionOutline.objectives.map(o => `- ${o}`).join('\n')}`;
  }

  if (previousSummaries.length > 0) {
    message += `

## WHAT WE'VE COVERED (build on this)`;
    for (const summary of previousSummaries.slice(-2)) {
      message += `
Session ${summary.sessionNumber}: ${summary.summary}
Key concepts: ${summary.keyConcepts.join(', ')}`;
    }
  }

  message += `

## LEARNER CONTEXT
Complexity: ${subskill.complexity}/3
Difficulty: ${plan.difficulty}
Velocity: ${context.learningVelocity}
Progress: ${Math.round(context.overallProgress * 100)}% through plan`;

  if (context.weakAreas.length > 0) {
    message += `

## AREAS TO REINFORCE
${context.weakAreas.map(a => `- ${a}`).join('\n')}`;
  }

  message += `

## ROUTE-SPECIFIC GUIDANCE
${getRouteGuidance(subskill.route)}

Create educational content that helps the learner master "${subskill.title}" while connecting it to their ultimate goal.`;

  return message;
}

// ─────────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE CHECK GENERATION (HIGH thinking)
// ─────────────────────────────────────────────────────────────────────────────────

export const KNOWLEDGE_CHECK_SYSTEM_PROMPT = `You are an expert assessment designer creating mastery tests.

Your task is to create questions that verify a learner has achieved mastery of a subskill. Questions should test understanding and application, not just recall.

## Output Format
Respond with JSON only (no markdown, no explanation):
{
  "questions": [
    {
      "id": "q1",
      "question": "Clear, specific question text",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Why this is correct and why others are wrong",
      "relatedConcept": "The concept this tests"
    },
    {
      "id": "q2",
      "question": "True/false question text",
      "type": "true_false",
      "options": ["True", "False"],
      "correctAnswer": "True",
      "explanation": "Why this is true/false",
      "relatedConcept": "Concept being tested"
    }
  ]
}

## Guidelines
- Create 10-15 questions
- Mix question types: primarily multiple_choice (70%), some true_false (30%)
- Questions should test APPLICATION and UNDERSTANDING, not just memorization
- Every question must have a clear, educational explanation
- Distribute questions across all key concepts from the sessions
- Difficulty should match the subskill complexity:
  * Complexity 1: straightforward application
  * Complexity 2: moderate scenarios requiring judgment
  * Complexity 3: complex scenarios, edge cases, deeper understanding
- Wrong answers (distractors) should be plausible but clearly incorrect
- Passing threshold is 70% - questions should differentiate mastery
- Each question's relatedConcept should map to session content`;

export function buildKnowledgeCheckUserMessage(
  subskill: PlanSubskill,
  plan: LessonPlan,
  summaries: SessionSummary[],
  context: FullGenerationContext
): string {
  let message = `Create a mastery test for:

## SUBSKILL
Title: ${subskill.title}
${subskill.description ? `Description: ${subskill.description}` : ''}
Route: ${subskill.route}
Complexity: ${subskill.complexity}/3

## CAPSTONE CONTEXT
${plan.capstoneStatement ? `Goal: "${plan.capstoneStatement}"` : `Plan: ${plan.title}`}`;

  if (summaries.length > 0) {
    message += `

## KEY CONCEPTS COVERED (test these)`;
    const allConcepts = new Set<string>();
    const allSummaries: string[] = [];
    
    for (const summary of summaries) {
      allSummaries.push(`Session ${summary.sessionNumber}: ${summary.summary}`);
      for (const concept of summary.keyConcepts) {
        allConcepts.add(concept);
      }
    }
    
    message += `\n\nSession summaries:\n${allSummaries.join('\n')}`;
    message += `\n\nKey concepts to test:\n${Array.from(allConcepts).map(c => `- ${c}`).join('\n')}`;
  }

  if (context.weakAreas.length > 0) {
    message += `

## INCLUDE QUESTIONS ON THESE WEAK AREAS
${context.weakAreas.map(a => `- ${a}`).join('\n')}`;
  }

  message += `

## REQUIREMENTS
- Test understanding and application, not just recall
- Questions should verify the learner can actually USE this skill
- Include scenarios that connect to the capstone goal where possible
- Create questions that a learner who truly understands would pass
- Passing requires 70% correct`;

  return message;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION SUMMARY GENERATION (LOW thinking)
// ─────────────────────────────────────────────────────────────────────────────────

export const SESSION_SUMMARY_SYSTEM_PROMPT = `You are summarizing a completed learning session for future reference.

The summary will be used to:
1. Remind the learner what they covered
2. Inform future session content
3. Generate refresh content after gaps
4. Create knowledge check questions

## Output Format
Respond with JSON only:
{
  "summary": "2-3 sentence summary of what was learned and accomplished",
  "keyConcepts": ["concept1", "concept2", "concept3", "concept4", "concept5"]
}

## Guidelines
- Summary should be concise but capture the main learning
- Focus on what the learner CAN NOW DO, not just what they read
- Key concepts should be specific and memorable (3-5 concepts)
- Use terminology the learner encountered in the session
- Make concepts concrete enough to generate quiz questions from`;

export function buildSessionSummaryUserMessage(
  subskill: PlanSubskill,
  sessionNumber: number,
  sessionGoal: string,
  keyPoints: string[],
  activitiesCompleted: string[]
): string {
  return `Summarize this completed session:

## SESSION INFO
Subskill: ${subskill.title}
Session: ${sessionNumber}
Goal: ${sessionGoal}

## KEY POINTS COVERED
${keyPoints.map(p => `- ${p}`).join('\n')}

## ACTIVITIES COMPLETED
${activitiesCompleted.map(a => `- ${a}`).join('\n')}

Summarize what the learner accomplished and extract the key concepts they should remember.`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// REFRESH CONTENT GENERATION (LOW thinking)
// ─────────────────────────────────────────────────────────────────────────────────

export const REFRESH_SYSTEM_PROMPT = `You are helping a learner refresh their memory after a break from studying.

Your task is to create a brief review that reactivates their knowledge before continuing.

## Output Format
Respond with JSON only:
{
  "summary": "Warm, encouraging welcome-back message that briefly recaps what they learned",
  "recallQuestions": [
    "Question that prompts active recall of concept 1",
    "Question that prompts active recall of concept 2",
    "Question that prompts active recall of concept 3"
  ],
  "quickTips": [
    "Brief tip to remember concept 1",
    "Brief tip to remember concept 2"
  ],
  "estimatedMinutes": 5
}

## Guidelines
- Keep it brief (5 minutes max)
- Be encouraging - they're coming back, that's good!
- Focus on active recall (questions they answer mentally)
- Quick tips should be memorable mnemonics or key insights
- Reference their progress and goal to re-motivate
- Don't overwhelm - just reactivate, don't re-teach`;

export function buildRefreshUserMessage(
  subskill: PlanSubskill,
  plan: LessonPlan,
  summaries: SessionSummary[],
  gapDays: number
): string {
  let message = `Create refresh content for a learner returning after ${gapDays} days:

## CONTEXT
Subskill: ${subskill.title}
Plan: ${plan.title}
${plan.capstoneStatement ? `Goal: "${plan.capstoneStatement}"` : ''}`;

  if (summaries.length > 0) {
    message += `

## WHAT THEY PREVIOUSLY LEARNED`;
    for (const summary of summaries) {
      message += `
Session ${summary.sessionNumber}: ${summary.summary}
Concepts: ${summary.keyConcepts.join(', ')}`;
    }
  }

  message += `

## TASK
Create a brief (~5 min) refresh to reactivate their knowledge before they continue.
Be warm and encouraging - returning after ${gapDays} days shows commitment!`;

  return message;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC TEST GENERATION (HIGH thinking)
// ─────────────────────────────────────────────────────────────────────────────────

export const DIAGNOSTIC_SYSTEM_PROMPT = `You are an expert assessment designer creating diagnostic tests.

Your task is to create questions that accurately assess a learner's CURRENT knowledge level before they study a topic. This helps determine if they can skip ahead or need to learn from scratch.

## Output Format
Respond with JSON only:
{
  "questions": [
    {
      "id": "q1",
      "area": "Concept Area Being Tested",
      "question": "Question text",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": "Option A",
      "explanation": "Why this is correct",
      "difficulty": 1
    }
  ]
}

## Guidelines
- Create 8-12 questions
- Mix difficulty levels: 1=basic (30%), 2=intermediate (50%), 3=advanced (20%)
- Cover different concept areas within the subskill
- Each question should test understanding, not just terminology
- Difficulty 1: Can they recognize the concept?
- Difficulty 2: Can they apply it in standard situations?
- Difficulty 3: Can they handle edge cases and complex scenarios?
- Results will determine: skip (>85%), targeted remediation (50-85%), or full learning (<50%)`;

export function buildDiagnosticUserMessage(
  subskill: PlanSubskill,
  plan: LessonPlan
): string {
  return `Create a diagnostic test for:

## SUBSKILL
Title: ${subskill.title}
${subskill.description ? `Description: ${subskill.description}` : ''}
Type: ${subskill.subskillType}
Route: ${subskill.route}
Complexity: ${subskill.complexity}/3

## PLAN CONTEXT
Plan: ${plan.title}
${plan.capstoneStatement ? `Goal: "${plan.capstoneStatement}"` : ''}
Difficulty: ${plan.difficulty}

## PURPOSE
This diagnostic determines if the learner:
- Already knows this (>85%) → can skip
- Knows some (50-85%) → targeted remediation on gaps
- Needs to learn (<50%) → full learning path

Create questions that accurately assess their current knowledge across different aspects of "${subskill.title}".`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Parse LLM response to extract JSON with error handling
 */
export function parseLLMJson<T>(response: string): T {
  // Remove markdown code blocks if present
  let cleaned = response
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();
  
  // Try to find JSON object in the response
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('[PROMPTS] No JSON found in response:', response.slice(0, 200));
    throw new Error('No JSON found in LLM response');
  }
  
  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch (e) {
    console.error('[PROMPTS] Failed to parse JSON:', jsonMatch[0].slice(0, 200));
    throw new Error(`Failed to parse JSON from LLM response: ${e}`);
  }
}

/**
 * Safe JSON parse with fallback
 */
export function parseLLMJsonSafe<T>(response: string, fallback: T): T {
  try {
    return parseLLMJson<T>(response);
  } catch (e) {
    console.error('[PROMPTS] Using fallback due to parse error:', e);
    return fallback;
  }
}

/**
 * Get route-specific pedagogical guidance
 */
export function getRouteGuidance(route: Route): string {
  const guidance: Record<Route, string> = {
    recall: `RECALL ROUTE - Memory & Retrieval Focus
- Use spaced repetition techniques
- Progress: exposure → encoding → retrieval → spacing
- Activities: flashcard-style, fill-in-blank, term matching
- Test: Can they recall without prompts?`,
    
    practice: `PRACTICE ROUTE - Procedural Skill Focus
- Use worked examples progressing to independence
- Progress: demonstration → guided → independent → fluency
- Activities: follow-along exercises, practice problems, timed drills
- Test: Can they execute the procedure correctly?`,
    
    diagnose: `DIAGNOSE ROUTE - Pattern Recognition Focus
- Build classification and error-detection skills
- Progress: observation → classification → detection → judgment
- Activities: spot-the-error, categorization, comparison tasks
- Test: Can they identify issues and patterns?`,
    
    apply: `APPLY ROUTE - Transfer & Adaptation Focus
- Present novel situations requiring adapted solutions
- Progress: transfer → variation → novel problems → integration
- Activities: case studies, scenario analysis, problem variations
- Test: Can they handle unfamiliar situations?`,
    
    build: `BUILD ROUTE - Creation & Synthesis Focus
- Guide through project creation process
- Progress: planning → foundation → development → polish
- Activities: project milestones, integration tasks, review checkpoints
- Test: Can they create a working artifact?`,
    
    refine: `REFINE ROUTE - Quality & Improvement Focus
- Develop critique and revision skills
- Progress: critique → standards → revision → validation
- Activities: rubric application, peer review simulation, iteration
- Test: Can they improve work to meet standards?`,
    
    plan: `PLAN ROUTE - Organization & Strategy Focus
- Build planning and resource management skills
- Progress: assessment → strategy → organization → review
- Activities: concept mapping, resource planning, timeline creation
- Test: Can they create effective plans?`,
  };
  
  return guidance[route] || 'Focus on understanding and practical application.';
}

/**
 * Get complexity-appropriate depth guidance
 */
export function getComplexityGuidance(complexity: 1 | 2 | 3): string {
  switch (complexity) {
    case 1:
      return 'COMPLEXITY 1: Keep explanations straightforward. Focus on core concepts. Use simple examples.';
    case 2:
      return 'COMPLEXITY 2: Include moderate detail. Cover common variations. Use realistic examples.';
    case 3:
      return 'COMPLEXITY 3: Go deep. Cover edge cases and nuances. Use complex, real-world examples.';
    default:
      return '';
  }
}
