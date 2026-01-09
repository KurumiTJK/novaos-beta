// ═══════════════════════════════════════════════════════════════════════════════
// SPARK GENERATOR
// Generates quick actionable tasks (~5 min) based on today's learning context
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../../../db/index.js';
import { SwordGateLLM } from '../llm/swordgate-llm.js';
import { ProgressTracker } from '../lesson-runner/progress/tracker.js';
import type { Spark, SparkRow, GenerateSparkResult } from './types.js';
import { mapSpark } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PROMPTS
// ─────────────────────────────────────────────────────────────────────────────────

const SPARK_SYSTEM_PROMPT = `You are a learning assistant that creates "Sparks" - quick, actionable micro-tasks that take 5 minutes or less.

A good Spark:
- Is immediately actionable (can start right now)
- Takes ~5 minutes or less
- Reinforces today's learning
- Has a clear completion criteria
- Feels achievable and motivating

A bad Spark:
- Is vague or requires planning
- Takes too long (>10 min)
- Is unrelated to current learning
- Has unclear success criteria
- Feels like a chore

ALWAYS respond with valid JSON in this exact format:
{
  "task": "The specific task to complete",
  "context": "Brief context on why this helps (1 sentence)",
  "estimatedMinutes": 5
}`;

function buildSparkUserMessage(
  subskillTitle: string,
  sessionGoal?: string,
  keyPoints?: string[],
  sessionNumber?: number,
  totalSessions?: number
): string {
  let message = `Generate a Spark for someone learning "${subskillTitle}".`;
  
  if (sessionGoal) {
    message += `\n\nToday's session goal: ${sessionGoal}`;
  }
  
  if (keyPoints && keyPoints.length > 0) {
    message += `\n\nKey concepts from today:\n${keyPoints.map(k => `- ${k}`).join('\n')}`;
  }
  
  if (sessionNumber && totalSessions) {
    message += `\n\nProgress: Session ${sessionNumber} of ${totalSessions}`;
  }
  
  message += `\n\nCreate a quick (~5 min) task that reinforces this learning.`;
  
  return message;
}

interface SparkLLMResponse {
  task: string;
  context: string;
  estimatedMinutes: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATOR
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate a spark based on today's learning context
 * Returns null if no active plan
 */
export async function generateSpark(userId: string): Promise<GenerateSparkResult | null> {
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
  
  // Get today's state
  const today = await ProgressTracker.getToday(userId);
  
  // No active plan → return null
  if (!today) {
    console.log('[SPARK] No active plan, returning null');
    return null;
  }
  
  const { plan, currentSubskill, sessionNumber, totalSessions } = today;
  
  // Try to get today's daily lesson for more context
  let sessionGoal: string | undefined;
  let keyPoints: string[] | undefined;
  let dailyLessonId: string | undefined;
  
  const { data: dailyLesson } = await supabase
    .from('daily_lessons')
    .select('id, session_goal, key_points')
    .eq('subskill_id', currentSubskill.id)
    .eq('user_id', internalUserId)
    .eq('session_number', sessionNumber)
    .single();
  
  if (dailyLesson) {
    dailyLessonId = dailyLesson.id;
    sessionGoal = dailyLesson.session_goal || undefined;
    keyPoints = dailyLesson.key_points || undefined;
  }
  
  // Generate spark with LLM
  const userMessage = buildSparkUserMessage(
    currentSubskill.title,
    sessionGoal,
    keyPoints,
    sessionNumber,
    totalSessions
  );
  
  console.log('[SPARK] Generating with LLM for:', currentSubskill.title);
  
  let sparkContent: SparkLLMResponse;
  
  try {
    const response = await SwordGateLLM.generate(
      SPARK_SYSTEM_PROMPT,
      userMessage,
      { thinkingLevel: 'low' }
    );
    
    // Parse JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    sparkContent = JSON.parse(jsonMatch[0]);
    
    // Validate
    if (!sparkContent.task || typeof sparkContent.task !== 'string') {
      throw new Error('Invalid task in response');
    }
    
    // Ensure reasonable time
    sparkContent.estimatedMinutes = Math.min(10, Math.max(1, sparkContent.estimatedMinutes || 5));
    
  } catch (error) {
    console.error('[SPARK] LLM failed, using fallback:', error);
    sparkContent = generateFallbackSpark(currentSubskill.title, sessionGoal);
  }
  
  // Store spark in DB
  // Note: sparkContent.task is guaranteed to be a string here (validated above or from fallback)
  const { data: row, error } = await supabase
    .from('sparks')
    .insert({
      user_id: internalUserId,
      plan_id: plan.id,
      subskill_id: currentSubskill.id,
      daily_lesson_id: dailyLessonId || null,
      session_number: sessionNumber,
      task: sparkContent.task ?? 'Complete a quick review task',
      context: sparkContent.context || null,
      estimated_minutes: sparkContent.estimatedMinutes,
      status: 'active',
    })
    .select()
    .single();
  
  if (error || !row) {
    throw new Error(`Failed to create spark: ${error?.message}`);
  }
  
  console.log('[SPARK] Created:', row.id);
  
  return {
    spark: mapSpark(row as SparkRow),
    subskillTitle: currentSubskill.title,
    sessionGoal,
  };
}

/**
 * Fallback spark when LLM fails
 */
function generateFallbackSpark(subskillTitle: string, sessionGoal?: string): SparkLLMResponse {
  const tasks = [
    `Write down 3 key things you learned about ${subskillTitle} today.`,
    `Explain ${subskillTitle} in one sentence as if teaching a friend.`,
    `Find one real-world example of ${subskillTitle} in action.`,
    `List 2 questions you still have about ${subskillTitle}.`,
    `Sketch a quick diagram or mind map of ${subskillTitle} concepts.`,
  ];
  
  const task = tasks[Math.floor(Math.random() * tasks.length)] ?? tasks[0]!;
  
  return {
    task,
    context: sessionGoal || `Reinforces your learning of ${subskillTitle}`,
    estimatedMinutes: 5,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CRUD OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get current active spark for user
 */
export async function getCurrentSpark(userId: string): Promise<Spark | null> {
  const supabase = getSupabase();
  
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) return null;
  
  const { data: row } = await supabase
    .from('sparks')
    .select('*')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  if (!row) return null;
  
  return mapSpark(row as SparkRow);
}

/**
 * Complete a spark
 */
export async function completeSpark(userId: string, sparkId: string): Promise<Spark> {
  const supabase = getSupabase();
  
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  
  const { data: row, error } = await supabase
    .from('sparks')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sparkId)
    .eq('user_id', user.id)
    .select()
    .single();
  
  if (error || !row) {
    throw new Error(`Failed to complete spark: ${error?.message}`);
  }
  
  console.log('[SPARK] Completed:', sparkId);
  
  return mapSpark(row as SparkRow);
}

/**
 * Skip a spark
 */
export async function skipSpark(userId: string, sparkId: string, reason?: string): Promise<Spark> {
  const supabase = getSupabase();
  
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  
  const { data: row, error } = await supabase
    .from('sparks')
    .update({
      status: 'skipped',
      skip_reason: reason || null,
    })
    .eq('id', sparkId)
    .eq('user_id', user.id)
    .select()
    .single();
  
  if (error || !row) {
    throw new Error(`Failed to skip spark: ${error?.message}`);
  }
  
  console.log('[SPARK] Skipped:', sparkId, reason ? `(${reason})` : '');
  
  return mapSpark(row as SparkRow);
}

/**
 * Get all sparks for user
 */
export async function getUserSparks(
  userId: string,
  limit: number = 20,
  status?: 'active' | 'completed' | 'skipped'
): Promise<Spark[]> {
  const supabase = getSupabase();
  
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) return [];
  
  let query = supabase
    .from('sparks')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  
  if (status) {
    query = query.eq('status', status);
  }
  
  const { data: rows } = await query;
  
  return (rows || []).map(row => mapSpark(row as SparkRow));
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const SparkGenerator = {
  generate: generateSpark,
  getCurrent: getCurrentSpark,
  complete: completeSpark,
  skip: skipSpark,
  getAll: getUserSparks,
};

export default SparkGenerator;
