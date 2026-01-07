// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS SERVICE
// Track completion of sessions, assets, and sparks
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';
import type {
  NodeProgress,
  NodeProgressRow,
  LessonPlan,
} from '../types.js';
import { mapNodeProgress } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION PROGRESS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Start a session on a node
 */
export async function startSession(
  userId: string,
  nodeId: string
): Promise<NodeProgress> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('node_progress')
    .update({
      status: 'in_progress',
      current_session: 1,
      started_at: now,
      last_session_at: now,
      needs_refresh: false,
    } as any)
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to start session: ${error.message}`);
  }

  return mapNodeProgress(data as NodeProgressRow);
}

/**
 * Complete a session (not the whole node)
 */
export async function completeSession(
  userId: string,
  nodeId: string,
  sessionNumber: number
): Promise<NodeProgress> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('node_progress')
    .update({
      sessions_completed: sessionNumber,
      current_session: sessionNumber + 1,
      last_session_at: now,
    } as any)
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete session: ${error.message}`);
  }

  // Update plan session counters
  await updatePlanSessionCounters(userId);

  return mapNodeProgress(data as NodeProgressRow);
}

/**
 * Complete refresh session
 */
export async function completeRefreshSession(
  userId: string,
  nodeId: string
): Promise<NodeProgress> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('node_progress')
    .update({
      needs_refresh: false,
      refresh_completed_at: now,
      last_session_at: now,
    } as any)
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete refresh: ${error.message}`);
  }

  return mapNodeProgress(data as NodeProgressRow);
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASSET PROGRESS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Complete an asset
 */
export async function completeAsset(
  userId: string,
  dailyPlanId: string,
  assetId: string,
  score?: number
): Promise<void> {
  if (!isSupabaseInitialized()) {
    return;
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();

  await supabase
    .from('asset_progress')
    .upsert({
      user_id: userId,
      daily_plan_id: dailyPlanId,
      asset_id: assetId,
      completed: true,
      completed_at: now,
      score: score,
      attempts: 1,
    } as any, { onConflict: 'user_id,daily_plan_id,asset_id' });
}

/**
 * Complete the spark
 */
export async function completeSpark(
  userId: string,
  dailyPlanId: string
): Promise<void> {
  // Spark is just an asset with id 'spark_N'
  return completeAsset(userId, dailyPlanId, 'spark');
}

/**
 * Check if all assets in a session are complete
 */
export async function checkAllAssetsComplete(
  userId: string,
  dailyPlanId: string,
  totalAssets: number
): Promise<boolean> {
  if (!isSupabaseInitialized()) {
    return false;
  }

  const supabase = getSupabase();

  const { count } = await supabase
    .from('asset_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('daily_plan_id', dailyPlanId)
    .eq('completed', true);

  return (count || 0) >= totalAssets;
}

// ─────────────────────────────────────────────────────────────────────────────────
// NODE COMPLETION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Complete a node (after mastery verification)
 */
export async function completeNode(
  userId: string,
  nodeId: string,
  masteryReflection: string
): Promise<NodeProgress> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('node_progress')
    .update({
      status: 'completed',
      all_assets_completed: true,
      mastery_reflection: masteryReflection,
      mastery_achieved: true,
      completed_at: now,
      last_session_at: now,
    } as any)
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to complete node: ${error.message}`);
  }

  // Update plan progress
  await updatePlanProgress(userId, nodeId);

  return mapNodeProgress(data as NodeProgressRow);
}

// ─────────────────────────────────────────────────────────────────────────────────
// PLAN PROGRESS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Update plan session counters
 */
async function updatePlanSessionCounters(userId: string): Promise<void> {
  if (!isSupabaseInitialized()) {
    return;
  }

  const supabase = getSupabase();

  // Get active plan
  const { data: plan } = await supabase
    .from('lesson_plans')
    .select('id, sessions_completed, sessions_since_method_node')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!plan) return;

  // Increment counters
  await supabase
    .from('lesson_plans')
    .update({
      sessions_completed: (plan.sessions_completed || 0) + 1,
      sessions_since_method_node: (plan.sessions_since_method_node || 0) + 1,
    } as any)
    .eq('id', plan.id);
}

/**
 * Reset method node counter (after method node completion)
 */
export async function resetMethodNodeCounter(userId: string): Promise<void> {
  if (!isSupabaseInitialized()) {
    return;
  }

  const supabase = getSupabase();

  await supabase
    .from('lesson_plans')
    .update({
      sessions_since_method_node: 0,
    } as any)
    .eq('user_id', userId)
    .eq('status', 'active');
}

/**
 * Update plan progress after node completion
 */
async function updatePlanProgress(userId: string, nodeId: string): Promise<void> {
  if (!isSupabaseInitialized()) {
    return;
  }

  const supabase = getSupabase();

  // Get node's plan ID
  const { data: node } = await supabase
    .from('nodes')
    .select('plan_id')
    .eq('id', nodeId)
    .single();

  if (!node) return;

  // Calculate new progress
  const progress = await supabase.rpc('calculate_plan_progress', {
    p_user_id: userId,
    p_plan_id: node.plan_id,
  });

  // Update plan
  await supabase
    .from('lesson_plans')
    .update({
      progress: progress.data || 0,
      completed_at: progress.data >= 1.0 ? new Date().toISOString() : null,
      status: progress.data >= 1.0 ? 'completed' : 'active',
    } as any)
    .eq('id', node.plan_id);
}

// ─────────────────────────────────────────────────────────────────────────────────
// STATISTICS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get user's learning statistics
 */
export async function getLearningStats(userId: string): Promise<{
  totalNodesCompleted: number;
  totalSessionsCompleted: number;
  currentStreak: number;
  sparksCompletedToday: number;
}> {
  if (!isSupabaseInitialized()) {
    return {
      totalNodesCompleted: 0,
      totalSessionsCompleted: 0,
      currentStreak: 0,
      sparksCompletedToday: 0,
    };
  }

  const supabase = getSupabase();

  // Get completed nodes count
  const { count: nodesCompleted } = await supabase
    .from('node_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');

  // Get sessions from active plan
  const { data: plan } = await supabase
    .from('lesson_plans')
    .select('sessions_completed')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  // Get today's spark completions
  const today = new Date().toISOString().split('T')[0];
  const { count: sparksToday } = await supabase
    .from('asset_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .like('asset_id', 'spark%')
    .eq('completed', true)
    .gte('completed_at', `${today}T00:00:00Z`);

  // Calculate streak (simplified - would need more complex query for accuracy)
  // TODO: Implement proper streak calculation

  return {
    totalNodesCompleted: nodesCompleted || 0,
    totalSessionsCompleted: plan?.sessions_completed || 0,
    currentStreak: 0, // TODO
    sparksCompletedToday: sparksToday || 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const ProgressService = {
  startSession,
  completeSession,
  completeRefreshSession,
  completeAsset,
  completeSpark,
  checkAllAssetsComplete,
  completeNode,
  resetMethodNodeCounter,
  getLearningStats,
};
