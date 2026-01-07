// ═══════════════════════════════════════════════════════════════════════════════
// TODAY SERVICE
// GET /sword/today - Main entry point for daily learning
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';
import type {
  TodayResponse,
  LessonPlan,
  LessonPlanRow,
  Node,
  NodeRow,
  NodeProgress,
  NodeProgressRow,
  DailyPlan,
  DailyPlanRow,
  Route,
} from '../types.js';
import {
  mapLessonPlan,
  mapNode,
  mapNodeProgress,
  mapDailyPlan,
} from '../types.js';

import { getUserTimezone, getTodayInTimezone, checkLearningGap } from '../shared/timezone.js';
import { checkNeedsRefresh, generateRefreshSession, RefreshService } from './refresh.js';
import { checkNodeSwitch } from './switching.js';
import { checkRuntimeMethodNodeTrigger } from '../lesson-designer/method-nodes.js';
import { generateDailyPlan } from './daily-plan.js';

// ─────────────────────────────────────────────────────────────────────────────────
// USER ID HELPER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get internal UUID from external user ID (JWT user ID like "user_xxx")
 */
async function getInternalUserId(externalId: string): Promise<string | null> {
  if (!isSupabaseInitialized()) {
    return null;
  }

  const supabase = getSupabase();

  // Try to find existing user by external_id
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', externalId)
    .single();

  if (existing) {
    return existing.id;
  }

  return null; // User doesn't exist
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN TODAY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get today's learning content
 * @param externalUserId - JWT user ID (e.g., "user_xxx")
 */
export async function getToday(externalUserId: string): Promise<TodayResponse | null> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  // Get internal UUID from external ID
  const internalUserId = await getInternalUserId(externalUserId);
  if (!internalUserId) {
    return null; // User doesn't exist
  }

  // Step 1: Get active plan
  const plan = await getActivePlan(internalUserId);
  if (!plan) {
    return null; // No active plan
  }

  // Step 2: Get current node (in-progress or next available)
  const { node, progress } = await getCurrentNode(internalUserId, plan.id);
  if (!node || !progress) {
    return null; // Plan complete or no available nodes
  }

  // Step 3: Check for refresh session (7+ day gap)
  const refreshCheck = await checkNeedsRefresh(progress);
  let dailyPlan: DailyPlan;
  let isRefreshSession = false;
  let refreshReason: string | undefined;

  if (refreshCheck.needsRefresh) {
    // Generate refresh session
    dailyPlan = await generateRefreshSession(internalUserId, node, progress, refreshCheck.gapDays!);
    isRefreshSession = true;
    refreshReason = `${refreshCheck.gapDays} days since last session`;
  } else {
    // Get or generate regular daily plan
    const timezone = await getUserTimezone(internalUserId);
    const today = getTodayInTimezone(timezone);
    
    dailyPlan = await getOrGenerateDailyPlan(
      internalUserId,
      node,
      progress,
      today,
      plan.dailyMinutes
    );
  }

  // Step 4: Check for in-progress warning (FIX #5)
  const switchCheck = await checkNodeSwitch(internalUserId, node.id);

  // Step 5: Check if method node is due (FIX #4)
  const nextNode = await getNextAvailableNode(internalUserId, plan.id, node.id);
  const methodNodeCheck = checkRuntimeMethodNodeTrigger(
    plan,
    node,
    nextNode
  );

  // Step 6: Get graph context
  const graphContext = await getGraphContext(internalUserId, plan.id);

  // Build response
  return {
    plan,
    currentNode: node,
    nodeProgress: progress,
    sessionNumber: progress.currentSession || 1,
    totalSessions: node.estimatedSessions,
    dailyPlan,
    isRefreshSession,
    refreshReason,
    hasOtherInProgress: switchCheck.hasInProgress && switchCheck.inProgressNode ? {
      nodeId: switchCheck.inProgressNode.id,
      nodeTitle: switchCheck.inProgressNode.title,
      sessionNumber: switchCheck.inProgressNode.sessionNumber,
    } : undefined,
    completedNodes: graphContext.completed,
    totalNodes: graphContext.total,
    nextAvailableNodes: graphContext.nextAvailable,
    methodNodeDue: methodNodeCheck.shouldInsert,
    nextMethodNodeType: methodNodeCheck.type,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// DATA FETCHING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get user's active plan
 * @param internalUserId - Internal UUID from users table
 */
async function getActivePlan(internalUserId: string): Promise<LessonPlan | null> {
  const supabase = getSupabase();
  
  const { data, error } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('user_id', internalUserId)
    .eq('status', 'active')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error?.code === 'PGRST116' || !data) {
    return null;
  }

  return mapLessonPlan(data as LessonPlanRow);
}

/**
 * Get current node (in-progress or next available)
 */
async function getCurrentNode(
  userId: string,
  planId: string
): Promise<{ node: Node | null; progress: NodeProgress | null }> {
  const supabase = getSupabase();

  // First check for in-progress node
  const { data: inProgress } = await supabase
    .from('node_progress')
    .select(`
      *,
      node:nodes!inner(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .single();

  if (inProgress?.node) {
    const nodeData = Array.isArray(inProgress.node) ? inProgress.node[0] : inProgress.node;
    if (nodeData) {
      const node = mapNode(nodeData as NodeRow);
      // Verify it belongs to the active plan
      if (node.planId === planId) {
        return {
          node,
          progress: mapNodeProgress(inProgress as NodeProgressRow),
        };
      }
    }
  }

  // Find next available node by sequence order
  const { data: available } = await supabase
    .from('node_progress')
    .select(`
      *,
      node:nodes!inner(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'available')
    .order('node(sequence_order)', { ascending: true })
    .limit(1)
    .single();

  if (!available?.node) {
    return { node: null, progress: null };
  }

  const nodeData = Array.isArray(available.node) ? available.node[0] : available.node;
  if (!nodeData) {
    return { node: null, progress: null };
  }

  const node = mapNode(nodeData as NodeRow);
  if (node.planId !== planId) {
    return { node: null, progress: null };
  }

  return {
    node,
    progress: mapNodeProgress(available as NodeProgressRow),
  };
}

/**
 * Get or generate daily plan
 */
async function getOrGenerateDailyPlan(
  userId: string,
  node: Node,
  progress: NodeProgress,
  date: string,
  dailyMinutes: number
): Promise<DailyPlan> {
  const supabase = getSupabase();
  const sessionNumber = (progress.currentSession || 0) + 1;

  // Check for existing plan
  const { data: existing } = await supabase
    .from('daily_plans')
    .select('*')
    .eq('node_id', node.id)
    .eq('session_number', sessionNumber)
    .eq('plan_date', date)
    .single();

  if (existing) {
    return mapDailyPlan(existing as DailyPlanRow);
  }

  // Generate new plan
  return generateDailyPlan(node, sessionNumber, date, dailyMinutes);
}

/**
 * Get next available node after current
 */
async function getNextAvailableNode(
  userId: string,
  planId: string,
  currentNodeId: string
): Promise<Node | null> {
  const supabase = getSupabase();

  // Get current node's sequence order
  const { data: currentNode } = await supabase
    .from('nodes')
    .select('sequence_order')
    .eq('id', currentNodeId)
    .single();

  if (!currentNode) return null;

  // Find next available
  const { data } = await supabase
    .from('node_progress')
    .select(`
      node:nodes!inner(*)
    `)
    .eq('user_id', userId)
    .in('status', ['available', 'in_progress'])
    .gt('node.sequence_order', currentNode.sequence_order)
    .order('node(sequence_order)', { ascending: true })
    .limit(1)
    .single();

  if (!data?.node) return null;

  // Handle nested query result - could be array or object
  const nodeData = Array.isArray(data.node) ? data.node[0] : data.node;
  if (!nodeData) return null;

  return mapNode(nodeData as NodeRow);
}

/**
 * Get graph context (completed/total nodes, next available)
 */
async function getGraphContext(
  userId: string,
  planId: string
): Promise<{
  completed: number;
  total: number;
  nextAvailable: Array<{ id: string; title: string; route: Route }>;
}> {
  const supabase = getSupabase();

  // Get total count
  const { count: total } = await supabase
    .from('nodes')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', planId);

  // Get completed count
  const { count: completed } = await supabase
    .from('node_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'completed');

  // Get next available nodes (up to 3)
  const { data: available } = await supabase
    .from('node_progress')
    .select(`
      node:nodes!inner(id, title, route, sequence_order)
    `)
    .eq('user_id', userId)
    .eq('status', 'available')
    .order('node(sequence_order)', { ascending: true })
    .limit(3);

  const nextAvailable = (available || []).map((a: any) => {
    const nodeData = Array.isArray(a.node) ? a.node[0] : a.node;
    return {
      id: nodeData?.id ?? '',
      title: nodeData?.title ?? '',
      route: (nodeData?.route ?? 'recall') as Route,
    };
  }).filter(n => n.id !== '');

  return {
    completed: completed || 0,
    total: total || 0,
    nextAvailable,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const TodayService = {
  getToday,
  getActivePlan,
  getCurrentNode,
  getGraphContext,
};
