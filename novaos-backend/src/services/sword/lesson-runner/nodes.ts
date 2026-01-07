// ═══════════════════════════════════════════════════════════════════════════════
// NODE QUERIES
// Database operations for nodes and node progress
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';
import type {
  Node,
  NodeRow,
  NodeProgress,
  NodeProgressRow,
  LessonPlan,
  LessonPlanRow,
} from '../types.js';
import { mapNode, mapNodeProgress, mapLessonPlan } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// NODE QUERIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get node by ID
 */
export async function getNodeById(nodeId: string): Promise<Node | null> {
  if (!isSupabaseInitialized()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('id', nodeId)
    .single();

  if (error?.code === 'PGRST116' || !data) return null;
  if (error) throw new Error(`Failed to get node: ${error.message}`);

  return mapNode(data as NodeRow);
}

/**
 * Get all nodes for a plan
 */
export async function getNodesForPlan(planId: string): Promise<Node[]> {
  if (!isSupabaseInitialized()) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('plan_id', planId)
    .order('sequence_order', { ascending: true });

  if (error) throw new Error(`Failed to get nodes: ${error.message}`);

  return (data || []).map(row => mapNode(row as NodeRow));
}

/**
 * Get next node after current (by sequence order)
 */
export async function getNextNode(
  planId: string,
  currentSequenceOrder: number
): Promise<Node | null> {
  if (!isSupabaseInitialized()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('plan_id', planId)
    .gt('sequence_order', currentSequenceOrder)
    .order('sequence_order', { ascending: true })
    .limit(1)
    .single();

  if (error?.code === 'PGRST116' || !data) return null;
  if (error) throw new Error(`Failed to get next node: ${error.message}`);

  return mapNode(data as NodeRow);
}

// ─────────────────────────────────────────────────────────────────────────────────
// NODE PROGRESS QUERIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get progress for a specific node
 */
export async function getNodeProgress(
  userId: string,
  nodeId: string
): Promise<NodeProgress | null> {
  if (!isSupabaseInitialized()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('node_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .single();

  if (error?.code === 'PGRST116' || !data) return null;
  if (error) throw new Error(`Failed to get progress: ${error.message}`);

  return mapNodeProgress(data as NodeProgressRow);
}

/**
 * Get current in-progress node
 */
export async function getCurrentInProgressNode(
  userId: string,
  planId: string
): Promise<{ node: Node; progress: NodeProgress } | null> {
  if (!isSupabaseInitialized()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('node_progress')
    .select(`
      *,
      node:nodes(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .single();

  if (error?.code === 'PGRST116' || !data) return null;
  if (error) throw new Error(`Failed to get in-progress node: ${error.message}`);

  const nodeData = (data as any).node;
  if (!nodeData || nodeData.plan_id !== planId) return null;

  return {
    node: mapNode(nodeData as NodeRow),
    progress: mapNodeProgress(data as NodeProgressRow),
  };
}

/**
 * Get next available node (for starting)
 */
export async function getNextAvailableNode(
  userId: string,
  planId: string
): Promise<{ node: Node; progress: NodeProgress } | null> {
  if (!isSupabaseInitialized()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('node_progress')
    .select(`
      *,
      node:nodes(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'available')
    .order('available_at', { ascending: true })
    .limit(1)
    .single();

  if (error?.code === 'PGRST116' || !data) return null;
  if (error) throw new Error(`Failed to get available node: ${error.message}`);

  const nodeData = (data as any).node;
  if (!nodeData || nodeData.plan_id !== planId) return null;

  return {
    node: mapNode(nodeData as NodeRow),
    progress: mapNodeProgress(data as NodeProgressRow),
  };
}

/**
 * Get all available nodes
 */
export async function getAvailableNodes(
  userId: string,
  planId: string
): Promise<Array<{ node: Node; progress: NodeProgress }>> {
  if (!isSupabaseInitialized()) return [];

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('node_progress')
    .select(`
      *,
      node:nodes(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'available');

  if (error) throw new Error(`Failed to get available nodes: ${error.message}`);

  return (data || [])
    .filter((row: any) => row.node?.plan_id === planId)
    .map((row: any) => ({
      node: mapNode(row.node as NodeRow),
      progress: mapNodeProgress(row as NodeProgressRow),
    }));
}

/**
 * Get completion stats for a plan
 */
export async function getPlanCompletionStats(
  userId: string,
  planId: string
): Promise<{ completed: number; total: number }> {
  if (!isSupabaseInitialized()) return { completed: 0, total: 0 };

  const supabase = getSupabase();
  
  // Get total nodes
  const { count: total } = await supabase
    .from('nodes')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', planId);

  // Get completed
  const { count: completed } = await supabase
    .from('node_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed')
    .in('node_id', (
      await supabase
        .from('nodes')
        .select('id')
        .eq('plan_id', planId)
    ).data?.map(n => n.id) || []);

  return {
    completed: completed || 0,
    total: total || 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// NODE PROGRESS UPDATES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Start a node (set to in_progress)
 */
export async function startNode(
  userId: string,
  nodeId: string
): Promise<NodeProgress> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('node_progress')
    .update({
      status: 'in_progress',
      current_session: 1,
      started_at: new Date().toISOString(),
      last_session_at: new Date().toISOString(),
    } as any)
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .select()
    .single();

  if (error) throw new Error(`Failed to start node: ${error.message}`);

  return mapNodeProgress(data as NodeProgressRow);
}

/**
 * Advance to next session
 */
export async function advanceSession(
  userId: string,
  nodeId: string
): Promise<NodeProgress> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();
  
  // Get current progress
  const current = await getNodeProgress(userId, nodeId);
  if (!current) throw new Error('No progress found for node');

  const { data, error } = await supabase
    .from('node_progress')
    .update({
      current_session: current.currentSession + 1,
      sessions_completed: current.sessionsCompleted + 1,
      last_session_at: new Date().toISOString(),
    } as any)
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .select()
    .single();

  if (error) throw new Error(`Failed to advance session: ${error.message}`);

  return mapNodeProgress(data as NodeProgressRow);
}

/**
 * Complete a node
 */
export async function completeNode(
  userId: string,
  nodeId: string,
  masteryReflection?: string
): Promise<NodeProgress> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('node_progress')
    .update({
      status: 'completed',
      all_assets_completed: true,
      mastery_reflection: masteryReflection,
      mastery_achieved: true,
      completed_at: new Date().toISOString(),
      last_session_at: new Date().toISOString(),
    } as any)
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .select()
    .single();

  if (error) throw new Error(`Failed to complete node: ${error.message}`);

  return mapNodeProgress(data as NodeProgressRow);
}

/**
 * Mark node as needing refresh
 */
export async function markNeedsRefresh(
  userId: string,
  nodeId: string
): Promise<NodeProgress> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('node_progress')
    .update({
      needs_refresh: true,
    } as any)
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .select()
    .single();

  if (error) throw new Error(`Failed to mark refresh: ${error.message}`);

  return mapNodeProgress(data as NodeProgressRow);
}

/**
 * Complete refresh
 */
export async function completeRefresh(
  userId: string,
  nodeId: string
): Promise<NodeProgress> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('node_progress')
    .update({
      needs_refresh: false,
      refresh_completed_at: new Date().toISOString(),
      last_session_at: new Date().toISOString(),
    } as any)
    .eq('user_id', userId)
    .eq('node_id', nodeId)
    .select()
    .single();

  if (error) throw new Error(`Failed to complete refresh: ${error.message}`);

  return mapNodeProgress(data as NodeProgressRow);
}

// ─────────────────────────────────────────────────────────────────────────────────
// PLAN QUERIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get active plan for user
 */
export async function getActivePlan(userId: string): Promise<LessonPlan | null> {
  if (!isSupabaseInitialized()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error?.code === 'PGRST116' || !data) return null;
  if (error) throw new Error(`Failed to get plan: ${error.message}`);

  return mapLessonPlan(data as LessonPlanRow);
}

/**
 * Get plan by ID
 */
export async function getPlanById(planId: string): Promise<LessonPlan | null> {
  if (!isSupabaseInitialized()) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('id', planId)
    .single();

  if (error?.code === 'PGRST116' || !data) return null;
  if (error) throw new Error(`Failed to get plan: ${error.message}`);

  return mapLessonPlan(data as LessonPlanRow);
}

/**
 * Update plan session counters
 */
export async function updatePlanSessionCounters(
  planId: string,
  sessionsCompleted: number,
  sessionsSinceMethodNode: number
): Promise<void> {
  if (!isSupabaseInitialized()) return;

  const supabase = getSupabase();
  await supabase
    .from('lesson_plans')
    .update({
      sessions_completed: sessionsCompleted,
      sessions_since_method_node: sessionsSinceMethodNode,
    } as any)
    .eq('id', planId);
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const NodeQueries = {
  // Nodes
  getById: getNodeById,
  getForPlan: getNodesForPlan,
  getNext: getNextNode,
  
  // Progress
  getProgress: getNodeProgress,
  getCurrentInProgress: getCurrentInProgressNode,
  getNextAvailable: getNextAvailableNode,
  getAvailable: getAvailableNodes,
  getCompletionStats: getPlanCompletionStats,
  
  // Updates
  start: startNode,
  advanceSession,
  complete: completeNode,
  markNeedsRefresh,
  completeRefresh,
  
  // Plans
  getActivePlan,
  getPlanById,
  updatePlanCounters: updatePlanSessionCounters,
};
