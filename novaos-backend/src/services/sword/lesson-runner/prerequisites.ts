// ═══════════════════════════════════════════════════════════════════════════════
// PREREQUISITES
// Hard lock enforcement for node access
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';
import type { PrerequisiteCheck } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PREREQUISITE CHECKING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if all prerequisites for a node are met
 * This is a HARD LOCK - user cannot proceed without completing prereqs
 */
export async function checkPrerequisites(
  userId: string,
  nodeId: string
): Promise<PrerequisiteCheck> {
  if (!isSupabaseInitialized()) {
    return { met: true, missing: [] }; // Fail open if DB unavailable
  }

  const supabase = getSupabase();

  // Get all prerequisites for this node
  const { data: prereqs, error: prereqError } = await supabase
    .from('node_prerequisites')
    .select(`
      prereq_node_id,
      prereq_node:nodes!prereq_node_id(id, title)
    `)
    .eq('node_id', nodeId);

  if (prereqError) {
    console.error(`[Prerequisites] Error fetching: ${prereqError.message}`);
    return { met: true, missing: [] }; // Fail open
  }

  // No prerequisites = all met
  if (!prereqs || prereqs.length === 0) {
    return { met: true, missing: [] };
  }

  // Check completion status of each prerequisite
  const prereqIds = prereqs.map((p: any) => p.prereq_node_id);

  const { data: progress, error: progressError } = await supabase
    .from('node_progress')
    .select('node_id, status')
    .eq('user_id', userId)
    .in('node_id', prereqIds);

  if (progressError) {
    console.error(`[Prerequisites] Error checking progress: ${progressError.message}`);
    return { met: true, missing: [] }; // Fail open
  }

  // Build set of completed node IDs
  const completedSet = new Set(
    (progress || [])
      .filter((p: any) => p.status === 'completed')
      .map((p: any) => p.node_id)
  );

  // Find missing prerequisites
  const missing = prereqs
    .filter((p: any) => !completedSet.has(p.prereq_node_id))
    .map((p: any) => (p.prereq_node as any)?.title || 'Unknown');

  return {
    met: missing.length === 0,
    missing,
  };
}

/**
 * Get all prerequisites for a node (with details)
 */
export async function getPrerequisiteDetails(
  userId: string,
  nodeId: string
): Promise<Array<{
  nodeId: string;
  title: string;
  completed: boolean;
  progress: number;
}>> {
  if (!isSupabaseInitialized()) return [];

  const supabase = getSupabase();

  // Get prerequisites with node details
  const { data: prereqs } = await supabase
    .from('node_prerequisites')
    .select(`
      prereq_node_id,
      prereq_node:nodes!prereq_node_id(
        id,
        title,
        estimated_sessions
      )
    `)
    .eq('node_id', nodeId);

  if (!prereqs || prereqs.length === 0) return [];

  // Get progress for each
  const prereqIds = prereqs.map((p: any) => p.prereq_node_id);

  const { data: progress } = await supabase
    .from('node_progress')
    .select('node_id, status, sessions_completed')
    .eq('user_id', userId)
    .in('node_id', prereqIds);

  const progressMap = new Map(
    (progress || []).map((p: any) => [p.node_id, p])
  );

  return prereqs.map((p: any) => {
    const node = p.prereq_node as any;
    const prog = progressMap.get(p.prereq_node_id);
    const completed = prog?.status === 'completed';
    const sessionsCompleted = prog?.sessions_completed || 0;
    const totalSessions = node?.estimated_sessions || 1;

    return {
      nodeId: p.prereq_node_id,
      title: node?.title || 'Unknown',
      completed,
      progress: completed ? 1 : sessionsCompleted / totalSessions,
    };
  });
}

/**
 * Get nodes that depend on a given node
 */
export async function getDependentNodes(
  nodeId: string
): Promise<Array<{ nodeId: string; title: string }>> {
  if (!isSupabaseInitialized()) return [];

  const supabase = getSupabase();

  const { data } = await supabase
    .from('node_prerequisites')
    .select(`
      node_id,
      node:nodes!node_id(title)
    `)
    .eq('prereq_node_id', nodeId);

  return (data || []).map((d: any) => ({
    nodeId: d.node_id,
    title: (d.node as any)?.title || 'Unknown',
  }));
}

/**
 * Validate that adding a prerequisite won't create a cycle
 */
export async function wouldCreateCycle(
  nodeId: string,
  prereqNodeId: string
): Promise<boolean> {
  if (!isSupabaseInitialized()) return false;

  const supabase = getSupabase();

  // Check if prereqNodeId depends on nodeId (directly or indirectly)
  const visited = new Set<string>();
  const queue = [prereqNodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (current === nodeId) {
      return true; // Would create cycle
    }

    if (visited.has(current)) continue;
    visited.add(current);

    // Get dependencies of current node
    const { data } = await supabase
      .from('node_prerequisites')
      .select('prereq_node_id')
      .eq('node_id', current);

    if (data) {
      for (const d of data) {
        if (!visited.has(d.prereq_node_id)) {
          queue.push(d.prereq_node_id);
        }
      }
    }
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GRAPH VISUALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get prerequisite graph for a plan
 */
export async function getPrerequisiteGraph(
  planId: string
): Promise<{
  nodes: Array<{ id: string; title: string; route: string }>;
  edges: Array<{ from: string; to: string }>;
}> {
  if (!isSupabaseInitialized()) {
    return { nodes: [], edges: [] };
  }

  const supabase = getSupabase();

  // Get all nodes
  const { data: nodesData } = await supabase
    .from('nodes')
    .select('id, title, route')
    .eq('plan_id', planId);

  // Get all edges
  const nodeIds = (nodesData || []).map(n => n.id);
  
  const { data: edgesData } = await supabase
    .from('node_prerequisites')
    .select('node_id, prereq_node_id')
    .in('node_id', nodeIds);

  return {
    nodes: (nodesData || []).map(n => ({
      id: n.id,
      title: n.title,
      route: n.route,
    })),
    edges: (edgesData || []).map(e => ({
      from: e.prereq_node_id,
      to: e.node_id,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const Prerequisites = {
  check: checkPrerequisites,
  getDetails: getPrerequisiteDetails,
  getDependents: getDependentNodes,
  wouldCreateCycle,
  getGraph: getPrerequisiteGraph,
};
