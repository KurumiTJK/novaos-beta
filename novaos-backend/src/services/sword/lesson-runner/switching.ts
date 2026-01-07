// ═══════════════════════════════════════════════════════════════════════════════
// NODE SWITCHING
// Allow switching with warning, preserve progress
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';
import type {
  Node,
  NodeProgress,
  SwitchCheck,
  PrerequisiteCheck,
} from '../types.js';
import { mapNode, mapNodeProgress } from '../types.js';
import { checkPrerequisites } from './prerequisites.js';
import { startNode } from './nodes.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SWITCH CHECKING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if user can switch to a different node
 * 
 * Rules:
 * 1. Prerequisites must be met (hard lock)
 * 2. If another node is in-progress, warn but allow
 * 3. Progress on current node is preserved
 */
export async function checkNodeSwitch(
  userId: string,
  targetNodeId: string
): Promise<SwitchCheck> {
  if (!isSupabaseInitialized()) {
    return { canSwitch: false, hasInProgress: false };
  }

  const supabase = getSupabase();

  // First, check prerequisites
  const prereqCheck = await checkPrerequisites(userId, targetNodeId);
  
  if (!prereqCheck.met) {
    return {
      canSwitch: false,
      hasInProgress: false,
      warning: `Prerequisites not met. Complete first: ${prereqCheck.missing.join(', ')}`,
    };
  }

  // Find any in-progress node (excluding target)
  const { data: inProgress } = await supabase
    .from('node_progress')
    .select(`
      *,
      node:nodes(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .neq('node_id', targetNodeId)
    .limit(1)
    .single();

  if (!inProgress) {
    return { canSwitch: true, hasInProgress: false };
  }

  const node = (inProgress as any).node;

  return {
    canSwitch: true, // Always allow if prereqs met
    hasInProgress: true,
    inProgressNode: {
      id: node.id,
      title: node.title,
      sessionNumber: inProgress.current_session,
      totalSessions: node.estimated_sessions,
    },
    warning: `You have "${node.title}" in progress (session ${inProgress.current_session}/${node.estimated_sessions}). Your progress will be saved if you switch.`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SWITCH EXECUTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Execute node switch
 * 
 * 1. Validate prerequisites
 * 2. Don't change status of old node (preserve in_progress)
 * 3. Start new node if available
 */
export async function executeNodeSwitch(
  userId: string,
  targetNodeId: string
): Promise<{
  success: boolean;
  newProgress: NodeProgress | null;
  error?: string;
}> {
  // Check switch is allowed
  const check = await checkNodeSwitch(userId, targetNodeId);
  
  if (!check.canSwitch) {
    return {
      success: false,
      newProgress: null,
      error: check.warning || 'Cannot switch to this node',
    };
  }

  if (!isSupabaseInitialized()) {
    return { success: false, newProgress: null, error: 'Database unavailable' };
  }

  const supabase = getSupabase();

  // Get target node progress
  const { data: targetProgress } = await supabase
    .from('node_progress')
    .select('*')
    .eq('user_id', userId)
    .eq('node_id', targetNodeId)
    .single();

  if (!targetProgress) {
    return { success: false, newProgress: null, error: 'Node not found' };
  }

  // If target is already in_progress, just return it
  if (targetProgress.status === 'in_progress') {
    return {
      success: true,
      newProgress: mapNodeProgress(targetProgress),
    };
  }

  // If target is available, start it
  if (targetProgress.status === 'available') {
    const newProgress = await startNode(userId, targetNodeId);
    return { success: true, newProgress };
  }

  // Target is locked or completed
  if (targetProgress.status === 'locked') {
    return {
      success: false,
      newProgress: null,
      error: 'Node is locked. Complete prerequisites first.',
    };
  }

  if (targetProgress.status === 'completed') {
    return {
      success: false,
      newProgress: null,
      error: 'Node is already completed.',
    };
  }

  return { success: false, newProgress: null, error: 'Unknown status' };
}

// ─────────────────────────────────────────────────────────────────────────────────
// AVAILABLE NODES FOR SWITCHING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get all nodes user can switch to
 */
export async function getAvailableForSwitch(
  userId: string,
  planId: string,
  currentNodeId?: string
): Promise<Array<{
  node: Node;
  progress: NodeProgress;
  canSwitch: boolean;
  reason?: string;
}>> {
  if (!isSupabaseInitialized()) return [];

  const supabase = getSupabase();

  // Get all nodes and progress
  const { data: nodesWithProgress } = await supabase
    .from('node_progress')
    .select(`
      *,
      node:nodes(*)
    `)
    .eq('user_id', userId)
    .in('status', ['available', 'in_progress']);

  if (!nodesWithProgress) return [];

  const results: Array<{
    node: Node;
    progress: NodeProgress;
    canSwitch: boolean;
    reason?: string;
  }> = [];

  for (const row of nodesWithProgress) {
    const node = mapNode((row as any).node);
    const progress = mapNodeProgress(row);

    // Skip nodes from other plans
    if (node.planId !== planId) continue;

    // Skip current node
    if (currentNodeId && node.id === currentNodeId) continue;

    // Skip completed
    if (progress.status === 'completed') continue;

    // Check if can switch
    const prereqCheck = await checkPrerequisites(userId, node.id);

    results.push({
      node,
      progress,
      canSwitch: prereqCheck.met,
      reason: prereqCheck.met ? undefined : `Missing: ${prereqCheck.missing.join(', ')}`,
    });
  }

  // Sort by sequence order
  results.sort((a, b) => a.node.sequenceOrder - b.node.sequenceOrder);

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PAUSE AND RESUME
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get paused nodes (in_progress but not active)
 */
export async function getPausedNodes(
  userId: string,
  activeNodeId: string
): Promise<Array<{ node: Node; progress: NodeProgress }>> {
  if (!isSupabaseInitialized()) return [];

  const supabase = getSupabase();

  const { data } = await supabase
    .from('node_progress')
    .select(`
      *,
      node:nodes(*)
    `)
    .eq('user_id', userId)
    .eq('status', 'in_progress')
    .neq('node_id', activeNodeId);

  return (data || []).map((row: any) => ({
    node: mapNode(row.node),
    progress: mapNodeProgress(row),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const SwitchingService = {
  check: checkNodeSwitch,
  execute: executeNodeSwitch,
  getAvailable: getAvailableForSwitch,
  getPaused: getPausedNodes,
};
