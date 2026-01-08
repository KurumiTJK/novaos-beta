// ═══════════════════════════════════════════════════════════════════════════════
// DAILY LESSON GENERATOR — LLM-Powered
// Generates rich per-session content using Gemini 3 Pro
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../../../../db/index.js';
import { SwordGateLLM } from '../../llm/swordgate-llm.js';
import type { PlanSubskill, LessonPlan, Route } from '../../types.js';
import { mapPlanSubskill, mapLessonPlan } from '../../types.js';
import type {
  DailyLesson,
  DailyLessonContext,
  SubskillLessonPlan,
  SessionOutline,
  LessonSection,
  Activity,
  SessionSummary,
  StartSessionResult,
  VideoResource,
  ResourceLink,
} from '../types.js';
import { mapDailyLesson, mapSubskillLessonPlan, mapSessionSummary } from '../types.js';
import { getLessonPlan } from '../lesson-plan/generator.js';
import { fetchBestVideo, fetchBestArticle, generateActivityId } from '../resources/fetcher.js';
import {
  DAILY_LESSON_SYSTEM_PROMPT,
  SESSION_SUMMARY_SYSTEM_PROMPT,
  buildDailyLessonUserMessage,
  buildSessionSummaryUserMessage,
  buildFullContext,
  parseLLMJson,
  parseLLMJsonSafe,
} from '../shared/prompts.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface LLMActivity {
  id: string;
  type: string;
  title: string;
  estimatedMinutes: number;
  
  // Read
  explanation?: string;
  articleSearchQuery?: string;
  
  // Watch
  videoSearchQuery?: string;
  focusPoints?: string[];
  
  // Exercise
  prompt?: string;
  expectedOutcome?: string;
  hints?: string[];
  solution?: string;
  
  // Practice
  steps?: string[];
  checklist?: string[];
  tips?: string[];
  
  // Build
  objective?: string;
  requirements?: string[];
  guidance?: string[];
  
  // Quiz
  questions?: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
  }>;
}

interface DailyLessonLLMResponse {
  sessionGoal: string;
  content: LessonSection[];
  activities: LLMActivity[];
  keyPoints: string[];
  reflectionPrompt?: string;
}

interface SessionSummaryLLMResponse {
  summary: string;
  keyConcepts: string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Start a learning session for a subskill
 */
export async function startSession(
  userId: string,
  subskillId: string
): Promise<StartSessionResult> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) {
    throw new Error('User not found');
  }
  
  const internalUserId = user.id;
  
  // Get subskill
  const { data: subskillRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('id', subskillId)
    .single();
  
  if (!subskillRow) {
    throw new Error(`Subskill not found: ${subskillId}`);
  }
  
  const subskill = mapPlanSubskill(subskillRow);
  const sessionNumber = (subskill.sessionsCompleted || 0) + 1;
  
  console.log(`[DAILY] Starting session ${sessionNumber} for: ${subskill.title}`);
  
  // Check for cached lesson
  const { data: existingRow } = await supabase
    .from('daily_lessons')
    .select('*')
    .eq('subskill_id', subskillId)
    .eq('user_id', internalUserId)
    .eq('session_number', sessionNumber)
    .single();
  
  if (existingRow && existingRow.content) {
    console.log(`[DAILY] Using cached lesson`);
    const dailyLesson = mapDailyLesson(existingRow);
    const previousSummaries = await getPreviousSummaries(subskillId, internalUserId, sessionNumber);
    
    if (!existingRow.started_at) {
      await supabase
        .from('daily_lessons')
        .update({ started_at: new Date().toISOString() })
        .eq('id', existingRow.id);
    }
    
    return { dailyLesson, previousSummaries };
  }
  
  // Get plan and lesson plan for context
  const { data: planRow } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('id', subskill.planId)
    .single();
  
  const plan = mapLessonPlan(planRow);
  const lessonPlan = await getLessonPlan(subskillId);
  
  if (!lessonPlan) {
    throw new Error('Lesson plan not found - start subskill first');
  }
  
  const previousSummaries = await getPreviousSummaries(subskillId, internalUserId, sessionNumber);
  
  // Get weak areas from previous checks
  const weakAreas = await getWeakAreas(internalUserId);
  
  const dailyLesson = await generateDailyLesson(
    internalUserId,
    subskill,
    plan,
    lessonPlan,
    sessionNumber,
    previousSummaries,
    weakAreas
  );
  
  return { dailyLesson, previousSummaries };
}

/**
 * Get a specific session (cached)
 */
export async function getSession(
  userId: string,
  subskillId: string,
  sessionNumber: number
): Promise<DailyLesson | null> {
  const supabase = getSupabase();
  
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) return null;
  
  const { data: row, error } = await supabase
    .from('daily_lessons')
    .select('*')
    .eq('subskill_id', subskillId)
    .eq('user_id', user.id)
    .eq('session_number', sessionNumber)
    .single();
  
  if (error?.code === 'PGRST116' || !row) {
    return null;
  }
  
  return mapDailyLesson(row);
}

/**
 * Regenerate a session
 */
export async function regenerateSession(
  userId: string,
  subskillId: string,
  sessionNumber: number
): Promise<DailyLesson> {
  const supabase = getSupabase();
  
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  
  console.log(`[DAILY] Regenerating session ${sessionNumber}`);
  
  await supabase
    .from('daily_lessons')
    .delete()
    .eq('subskill_id', subskillId)
    .eq('user_id', user.id)
    .eq('session_number', sessionNumber);
  
  const result = await startSession(userId, subskillId);
  return result.dailyLesson;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

async function generateDailyLesson(
  internalUserId: string,
  subskill: PlanSubskill,
  plan: LessonPlan,
  lessonPlan: SubskillLessonPlan,
  sessionNumber: number,
  previousSummaries: SessionSummary[],
  weakAreas: string[]
): Promise<DailyLesson> {
  const supabase = getSupabase();
  
  const sessionOutline = lessonPlan.sessionOutline.find(
    s => s.sessionNumber === sessionNumber
  );
  
  const totalSessions = lessonPlan.sessionOutline.length;
  const context = buildFullContext(
    subskill,
    plan,
    sessionNumber,
    totalSessions,
    previousSummaries,
    [],
    weakAreas
  );
  
  const dailyContext = buildContext(subskill, plan, sessionNumber, totalSessions);
  
  console.log(`[DAILY] Generating session ${sessionNumber}/${totalSessions} with LLM`);
  
  let lessonData: DailyLessonLLMResponse;
  
  try {
    const userMessage = buildDailyLessonUserMessage(
      subskill,
      plan,
      context,
      sessionOutline,
      previousSummaries
    );
    
    const response = await SwordGateLLM.generate(
      DAILY_LESSON_SYSTEM_PROMPT,
      userMessage,
      { thinkingLevel: 'high' }
    );
    
    lessonData = parseLLMJson<DailyLessonLLMResponse>(response);
    
    // Validate response
    if (!lessonData.sessionGoal) {
      throw new Error('Missing session goal');
    }
    if (!lessonData.content?.length) {
      throw new Error('Missing content sections');
    }
    
    console.log(`[DAILY] LLM generated ${lessonData.content.length} sections, ${lessonData.activities?.length || 0} activities`);
    
  } catch (error) {
    console.error('[DAILY] LLM generation failed, using fallback:', error);
    lessonData = generateFallbackLesson(subskill, plan, sessionOutline, previousSummaries);
  }
  
  // Process activities - fetch resources for watch/read types
  const activities = await processActivities(lessonData.activities || [], subskill, plan);
  
  // Save to database
  const { data: row, error } = await supabase
    .from('daily_lessons')
    .insert({
      subskill_id: subskill.id,
      lesson_plan_id: lessonPlan.id,
      user_id: internalUserId,
      session_number: sessionNumber,
      context: dailyContext,
      session_goal: lessonData.sessionGoal,
      content: lessonData.content,
      activities,
      key_points: lessonData.keyPoints || [],
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error || !row) {
    throw new Error(`Failed to create daily lesson: ${error?.message}`);
  }
  
  console.log(`[DAILY] Generated session ${sessionNumber}`);
  
  return mapDailyLesson(row);
}

function buildContext(
  subskill: PlanSubskill,
  plan: LessonPlan,
  sessionNumber: number,
  totalSessions: number
): DailyLessonContext {
  return {
    planId: plan.id,
    planTitle: plan.title,
    capstoneStatement: plan.capstoneStatement,
    subskillId: subskill.id,
    subskillTitle: subskill.title,
    subskillDescription: subskill.description,
    route: subskill.route,
    complexity: subskill.complexity,
    sessionNumber,
    totalSessions,
    dailyMinutes: plan.dailyMinutes || 30,
    overallProgress: plan.progress || 0,
    subskillsCompleted: 0,
    totalSubskills: plan.totalSubskills || 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACTIVITY PROCESSING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Process LLM activities - fetch resources for watch/read types
 * Uses parallel processing for performance
 */
async function processActivities(
  llmActivities: LLMActivity[],
  subskill: PlanSubskill,
  plan: LessonPlan
): Promise<Activity[]> {
  // Process all activities in parallel for better performance
  const activities = await Promise.all(
    llmActivities.map((llmActivity, index) => 
      processActivity(llmActivity, subskill, plan, index)
    )
  );
  
  return activities;
}

async function processActivity(
  llm: LLMActivity,
  subskill: PlanSubskill,
  plan: LessonPlan,
  index: number
): Promise<Activity> {
  const base: Activity = {
    id: llm.id || generateActivityId(),
    type: (llm.type as Activity['type']) || 'practice',
    title: llm.title || `Activity ${index + 1}`,
    estimatedMinutes: llm.estimatedMinutes || 10,
    completed: false,
  };
  
  switch (llm.type) {
    case 'read':
      return processReadActivity(base, llm, subskill, plan);
    
    case 'watch':
      return processWatchActivity(base, llm, subskill, plan);
    
    case 'exercise':
      return {
        ...base,
        prompt: llm.prompt,
        expectedOutcome: llm.expectedOutcome,
        hints: llm.hints,
        solution: llm.solution,
      };
    
    case 'practice':
      return {
        ...base,
        steps: llm.steps,
        checklist: llm.checklist,
        tips: llm.tips,
      };
    
    case 'build':
      return {
        ...base,
        objective: llm.objective,
        requirements: llm.requirements,
        guidance: llm.guidance,
      };
    
    case 'quiz':
      return {
        ...base,
        questions: llm.questions?.map((q, i) => ({
          id: q.id || `q${i + 1}`,
          question: q.question,
          options: q.options || [],
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
        })),
      };
    
    default:
      return base;
  }
}

async function processReadActivity(
  base: Activity,
  llm: LLMActivity,
  subskill: PlanSubskill,
  plan: LessonPlan
): Promise<Activity> {
  // Always include the LLM explanation
  const activity: Activity = {
    ...base,
    explanation: llm.explanation,
  };
  
  // Try to fetch an article if search query provided
  if (llm.articleSearchQuery) {
    try {
      const article = await fetchBestArticle(llm.articleSearchQuery);
      if (article) {
        activity.article = article;
        console.log(`[ACTIVITY] Found article: ${article.title}`);
      }
    } catch (err) {
      console.error('[ACTIVITY] Article fetch failed:', err);
      // Continue without article - explanation is the fallback
    }
  }
  
  return activity;
}

async function processWatchActivity(
  base: Activity,
  llm: LLMActivity,
  subskill: PlanSubskill,
  plan: LessonPlan
): Promise<Activity> {
  const activity: Activity = {
    ...base,
    focusPoints: llm.focusPoints,
  };
  
  // Build search query - use provided or construct from context
  const searchQuery = llm.videoSearchQuery || `${subskill.title} ${plan.title} tutorial`;
  
  try {
    // fetchBestVideo now always returns a VideoResource (with fallback to search link)
    const video = await fetchBestVideo(searchQuery, {
      preferTutorial: true,
      maxDurationMinutes: base.estimatedMinutes ? base.estimatedMinutes + 5 : 20,
      minViewCount: 1000, // Minimum 1k views for quality
    });
    
    activity.video = video;
    
    if (video.url.includes('search_query')) {
      console.log(`[ACTIVITY] Using fallback search link for: ${searchQuery}`);
    } else {
      console.log(`[ACTIVITY] Found video: "${video.title}" (${video.viewCount?.toLocaleString()} views)`);
    }
  } catch (err) {
    console.error('[ACTIVITY] Video fetch failed:', err);
    // Create inline fallback
    activity.video = {
      title: `Search: "${searchQuery}"`,
      url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
      description: 'Click to search YouTube for relevant videos.',
      channel: 'YouTube Search',
    };
  }
  
  return activity;
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMPLETION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Complete a session and generate summary
 */
export async function completeSession(
  userId: string,
  dailyLessonId: string
): Promise<{ subskill: PlanSubskill; sessionCompleted: number; totalSessions: number; isComplete: boolean; isKnowledgeCheckNext: boolean }> {
  const supabase = getSupabase();
  
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  
  const { data: lessonRow, error } = await supabase
    .from('daily_lessons')
    .select('*')
    .eq('id', dailyLessonId)
    .eq('user_id', user.id)
    .single();
  
  if (error || !lessonRow) {
    throw new Error(`Daily lesson not found: ${dailyLessonId}`);
  }
  
  const dailyLesson = mapDailyLesson(lessonRow);
  
  // Mark completed
  await supabase
    .from('daily_lessons')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', dailyLessonId);
  
  // Generate session summary with LLM
  await generateSessionSummary(user.id, dailyLesson);
  
  // Get subskill and update progress
  const { data: subskillRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('id', dailyLesson.subskillId)
    .single();
  
  const subskill = mapPlanSubskill(subskillRow);
  const newSessionCount = dailyLesson.sessionNumber;
  const totalSessions = subskill.estimatedSessions || 3;
  const isKnowledgeCheckNext = newSessionCount === totalSessions - 1;
  const isComplete = newSessionCount >= totalSessions;
  
  await supabase
    .from('plan_subskills')
    .update({
      sessions_completed: newSessionCount,
      current_session: newSessionCount,
      last_session_date: new Date().toISOString(),
    })
    .eq('id', subskill.id);
  
  console.log(`[DAILY] Session ${newSessionCount}/${totalSessions} complete`);
  
  return {
    subskill: { ...subskill, sessionsCompleted: newSessionCount },
    sessionCompleted: newSessionCount,
    totalSessions,
    isComplete,
    isKnowledgeCheckNext,
  };
}

async function generateSessionSummary(
  internalUserId: string,
  dailyLesson: DailyLesson
): Promise<SessionSummary> {
  const supabase = getSupabase();
  
  // Get subskill for context
  const { data: subskillRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('id', dailyLesson.subskillId)
    .single();
  
  const subskill = mapPlanSubskill(subskillRow);
  
  let summaryData: SessionSummaryLLMResponse;
  
  try {
    const activitiesCompleted = (dailyLesson.activities || [])
      .filter(a => a.completed)
      .map(a => a.title);
    
    const userMessage = buildSessionSummaryUserMessage(
      subskill,
      dailyLesson.sessionNumber,
      dailyLesson.sessionGoal || '',
      dailyLesson.keyPoints || [],
      activitiesCompleted.length > 0 ? activitiesCompleted : ['Completed session activities']
    );
    
    const response = await SwordGateLLM.generate(
      SESSION_SUMMARY_SYSTEM_PROMPT,
      userMessage,
      { thinkingLevel: 'low' }
    );
    
    summaryData = parseLLMJson<SessionSummaryLLMResponse>(response);
    
    console.log(`[DAILY] LLM generated summary with ${summaryData.keyConcepts?.length || 0} concepts`);
    
  } catch (error) {
    console.error('[DAILY] Summary generation failed, using fallback:', error);
    summaryData = {
      summary: dailyLesson.keyPoints?.length 
        ? `Covered: ${dailyLesson.keyPoints.slice(0, 2).join(', ')}.`
        : `Completed session ${dailyLesson.sessionNumber} of ${subskill.title}.`,
      keyConcepts: dailyLesson.keyPoints || [],
    };
  }
  
  const { data: row, error } = await supabase
    .from('session_summaries')
    .insert({
      subskill_id: dailyLesson.subskillId,
      daily_lesson_id: dailyLesson.id,
      user_id: internalUserId,
      session_number: dailyLesson.sessionNumber,
      summary: summaryData.summary,
      key_concepts: summaryData.keyConcepts || [],
    })
    .select()
    .single();
  
  if (error || !row) {
    console.error(`Failed to create session summary: ${error?.message}`);
    return {
      id: '',
      subskillId: dailyLesson.subskillId,
      userId: internalUserId,
      sessionNumber: dailyLesson.sessionNumber,
      summary: summaryData.summary,
      keyConcepts: summaryData.keyConcepts || [],
      createdAt: new Date(),
    };
  }
  
  return mapSessionSummary(row);
}

// ─────────────────────────────────────────────────────────────────────────────────
// FALLBACK GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

function generateFallbackLesson(
  subskill: PlanSubskill,
  plan: LessonPlan,
  sessionOutline?: SessionOutline,
  previousSummaries?: SessionSummary[]
): DailyLessonLLMResponse {
  const route = subskill.route;
  const dailyMinutes = plan.dailyMinutes || 30;
  
  const sessionGoal = sessionOutline?.focus || `Learn and practice ${subskill.title}`;
  
  // Generate content sections
  const content: LessonSection[] = [
    {
      title: 'Overview',
      content: sessionOutline?.focus || `Today we'll focus on ${subskill.title}.`,
      bulletPoints: sessionOutline?.objectives || [
        `Understand key concepts of ${subskill.title}`,
        'Practice applying what you learn',
      ],
    },
  ];
  
  // Add route-specific content
  content.push(...generateRouteContent(subskill));
  
  // Add connection to previous if available
  if (previousSummaries && previousSummaries.length > 0) {
    const lastSummary = previousSummaries[previousSummaries.length - 1];
    if (lastSummary) {
      content.push({
        title: 'Building on Previous Learning',
        content: `Last session: ${lastSummary.summary}`,
        bulletPoints: lastSummary.keyConcepts?.slice(0, 3) ?? [],
      });
    }
  }
  
  // Generate activities
  const activities = generateRouteActivities(subskill, dailyMinutes);
  
  // Generate key points
  const keyPoints = sessionOutline?.objectives || [
    `Understand the basics of ${subskill.title}`,
    'Practice applying concepts',
    'Review before moving on',
  ];
  
  return {
    sessionGoal,
    content,
    activities,
    keyPoints,
  };
}

function generateRouteContent(subskill: PlanSubskill): LessonSection[] {
  switch (subskill.route) {
    case 'recall':
      return [
        {
          title: 'Key Concepts',
          content: `The core concepts of ${subskill.title} that you need to remember.`,
          bulletPoints: [
            'Core terminology and definitions',
            'Fundamental principles',
            'Common patterns and frameworks',
          ],
        },
      ];
    case 'practice':
      return [
        {
          title: 'Procedure Overview',
          content: `The step-by-step process for ${subskill.title}.`,
          bulletPoints: [
            'Understand each step before moving on',
            'Start with simple examples',
            'Gradually increase complexity',
          ],
        },
      ];
    case 'build':
      return [
        {
          title: 'Project Focus',
          content: `Building something that demonstrates ${subskill.title}.`,
          bulletPoints: [
            'Start with a clear goal',
            'Break into manageable pieces',
            'Test as you go',
          ],
        },
      ];
    default:
      return [
        {
          title: "Today's Focus",
          content: `Working on ${subskill.title}.`,
          bulletPoints: [
            'Take your time to understand',
            'Practice actively, not passively',
          ],
        },
      ];
  }
}

function generateRouteActivities(subskill: PlanSubskill, dailyMinutes: number): LLMActivity[] {
  const activities: LLMActivity[] = [];
  const route = subskill.route;
  
  switch (route) {
    case 'recall':
      activities.push(
        {
          id: 'a1',
          type: 'read',
          title: 'Review Key Concepts',
          estimatedMinutes: Math.floor(dailyMinutes * 0.33),
          explanation: `Let's review the core concepts of ${subskill.title}. Take your time to understand each concept before moving on.\n\nFocus on:\n- The fundamental principles\n- Key terminology and definitions\n- How these concepts connect to each other`,
          articleSearchQuery: `${subskill.title} fundamentals explained`,
        },
        {
          id: 'a2',
          type: 'exercise',
          title: 'Active Recall Practice',
          estimatedMinutes: Math.floor(dailyMinutes * 0.33),
          prompt: `Without looking at the material, try to recall and write down:\n\n1. The main concepts you just learned about ${subskill.title}\n2. How you would explain each concept to someone else\n3. Any connections between concepts`,
          expectedOutcome: 'You should be able to recall at least 3 key concepts from memory',
          hints: ['Start with the concept that felt most important', 'Think about examples that illustrate each concept'],
        },
        {
          id: 'a3',
          type: 'quiz',
          title: 'Self-Test',
          estimatedMinutes: Math.floor(dailyMinutes * 0.33),
          questions: [
            {
              id: 'q1',
              question: `What is the primary purpose of ${subskill.title}?`,
              options: ['To organize information effectively', 'To solve specific problems', 'To improve performance', 'All of the above'],
              correctAnswer: 'All of the above',
              explanation: 'Understanding the purpose helps you apply the concept correctly.',
            },
          ],
        }
      );
      break;
    
    case 'practice':
      activities.push(
        {
          id: 'a1',
          type: 'watch',
          title: 'Watch: Worked Example',
          estimatedMinutes: Math.floor(dailyMinutes * 0.25),
          videoSearchQuery: `${subskill.title} tutorial step by step`,
          focusPoints: [
            'Pay attention to the order of steps',
            'Notice how errors are handled',
            'Watch for shortcuts or best practices mentioned',
          ],
        },
        {
          id: 'a2',
          type: 'exercise',
          title: 'Guided Practice',
          estimatedMinutes: Math.floor(dailyMinutes * 0.4),
          prompt: `Now it's your turn! Following what you observed:\n\n1. Set up your environment\n2. Attempt the same steps you saw\n3. If you get stuck, refer back to the video`,
          expectedOutcome: 'Complete the exercise with similar results to the demonstration',
          hints: ['Start simple, don\'t add complexity yet', 'It\'s okay to re-watch sections'],
          solution: 'Compare your result with the video demonstration',
        },
        {
          id: 'a3',
          type: 'practice',
          title: 'Independent Practice',
          estimatedMinutes: Math.floor(dailyMinutes * 0.35),
          steps: [
            'Attempt the same task without looking at the video',
            'Try a slight variation of what you learned',
            'Time yourself to build fluency',
          ],
          checklist: ['Completed basic version', 'Tried at least one variation', 'Can do it without reference'],
          tips: ['Speed comes with repetition', 'Focus on accuracy first, then speed'],
        }
      );
      break;
    
    case 'build':
      activities.push(
        {
          id: 'a1',
          type: 'read',
          title: 'Review Project Requirements',
          estimatedMinutes: Math.floor(dailyMinutes * 0.15),
          explanation: `Before building, let's understand what we're creating.\n\n**Today's Goal:** Build a working implementation of ${subskill.title}\n\n**Why this matters:** This hands-on project will solidify your understanding and give you something tangible to show.\n\n**Success looks like:** A functional piece that demonstrates the core concept.`,
        },
        {
          id: 'a2',
          type: 'build',
          title: 'Build Session',
          estimatedMinutes: Math.floor(dailyMinutes * 0.7),
          objective: `Create a working implementation that demonstrates ${subskill.title}`,
          requirements: [
            'Must demonstrate the core concept',
            'Should handle basic use cases',
            'Code should be readable and organized',
          ],
          guidance: [
            'Start with the minimum viable version',
            'Get something working before adding features',
            'Test as you go, don\'t wait until the end',
          ],
        },
        {
          id: 'a3',
          type: 'practice',
          title: 'Test & Verify',
          estimatedMinutes: Math.floor(dailyMinutes * 0.15),
          steps: [
            'Run your implementation',
            'Test with different inputs',
            'Check edge cases',
            'Fix any issues found',
          ],
          checklist: ['Basic functionality works', 'Tested with multiple inputs', 'No obvious errors'],
        }
      );
      break;
    
    default:
      activities.push(
        {
          id: 'a1',
          type: 'read',
          title: `Learn: ${subskill.title}`,
          estimatedMinutes: Math.floor(dailyMinutes * 0.5),
          explanation: `Today we're learning about ${subskill.title}.\n\nTake your time to understand the concepts. Good learning happens when you engage actively with the material - try to explain ideas in your own words as you read.`,
          articleSearchQuery: `${subskill.title} guide tutorial`,
        },
        {
          id: 'a2',
          type: 'practice',
          title: 'Apply What You Learned',
          estimatedMinutes: Math.floor(dailyMinutes * 0.5),
          steps: [
            'Review the key concepts',
            'Try applying one concept',
            'Reflect on what worked',
          ],
          checklist: ['Understood main concepts', 'Applied at least one concept', 'Noted questions for next session'],
        }
      );
  }
  
  return activities;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

async function getPreviousSummaries(
  subskillId: string,
  internalUserId: string,
  currentSession: number
): Promise<SessionSummary[]> {
  const supabase = getSupabase();
  
  const { data: rows, error } = await supabase
    .from('session_summaries')
    .select('*')
    .eq('subskill_id', subskillId)
    .eq('user_id', internalUserId)
    .lt('session_number', currentSession)
    .order('session_number', { ascending: true });
  
  if (error) {
    console.error(`Failed to get summaries: ${error.message}`);
    return [];
  }
  
  return (rows || []).map(mapSessionSummary);
}

async function getWeakAreas(internalUserId: string): Promise<string[]> {
  const supabase = getSupabase();
  
  const { data: checkRows } = await supabase
    .from('knowledge_checks')
    .select('missed_questions')
    .eq('user_id', internalUserId)
    .not('missed_questions', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(3);
  
  const weakAreas: string[] = [];
  for (const check of checkRows || []) {
    if (check.missed_questions) {
      for (const mq of check.missed_questions as any[]) {
        if (mq.relatedConcept && !weakAreas.includes(mq.relatedConcept)) {
          weakAreas.push(mq.relatedConcept);
        }
      }
    }
  }
  
  return weakAreas.slice(0, 5);
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const DailyLessonGenerator = {
  start: startSession,
  get: getSession,
  regenerate: regenerateSession,
  complete: completeSession,
};
