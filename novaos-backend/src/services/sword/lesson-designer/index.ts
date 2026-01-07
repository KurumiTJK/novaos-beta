// ═══════════════════════════════════════════════════════════════════════════════
// LESSON DESIGNER
// Complete design flow: Exploration → Goal → Research → Review
// User sees 4 phases, system does 8
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// LOCAL IMPORTS (for use in this file)
// ─────────────────────────────────────────────────────────────────────────────────

import type { DesignerSession, LessonPlan, Subskill, Route, Resource } from '../types.js';
import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';

// Session imports
import {
  DesignerSessionManager,
  getActiveSession,
  getSessionById,
  startSession,
  updateSessionPhase,
  updatePhaseData,
  linkSessionToPlan,
  completeSession,
  cancelSession,
  isValidPhaseTransition,
  getNextInternalPhase,
  getPhaseRequirements,
  canProceedToPhase,
  getVisiblePhaseInfo,
} from './session.js';

// Phase imports
import { generateCapstone, CapstoneGenerator, refineCapstone, validateCapstoneStatement, validateSuccessCriteria } from './capstone.js';
import { generateSubskills, SubskillsGenerator, validateSubskills, getTypeDistribution, estimateTotalSessions } from './subskills.js';
import { assignRoutes, RouteAssigner, getRouteForSubskill, analyzeRouteDistribution, getBalanceRecommendations, getRouteInfo, ROUTE_INFO } from './routing.js';
import { runResearch, ResearchService } from './research.js';
import { generateNodes, NodeGenerator } from './node-generation.js';
import { sequenceNodes, Sequencer, visualizeSequence } from './sequencing.js';
import { planMethodNodes, MethodNodes, checkMethodNodeTrigger, generateMethodNode, getMethodNodeDefinition, estimateMethodNodeSessions, isMethodNode } from './method-nodes.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORTS (for external use)
// ─────────────────────────────────────────────────────────────────────────────────

// Session Management
export {
  DesignerSessionManager,
  getActiveSession,
  getSessionById,
  startSession,
  updateSessionPhase,
  updatePhaseData,
  linkSessionToPlan,
  completeSession,
  cancelSession,
  isValidPhaseTransition,
  getNextInternalPhase,
  getPhaseRequirements,
  canProceedToPhase,
  getVisiblePhaseInfo,
};

// Phase 2a: Capstone
export {
  CapstoneGenerator,
  generateCapstone,
  refineCapstone,
  validateCapstoneStatement,
  validateSuccessCriteria,
};

// Phase 2b: Subskills
export {
  SubskillsGenerator,
  generateSubskills,
  validateSubskills,
  getTypeDistribution,
  estimateTotalSessions,
};

// Phase 2c: Routing
export {
  RouteAssigner,
  getRouteForSubskill,
  assignRoutes,
  analyzeRouteDistribution,
  getBalanceRecommendations,
  getRouteInfo,
  ROUTE_INFO,
};

// Phase 3: Research
export {
  ResearchService,
  runResearch,
};

// Phase 4a: Node Generation
export {
  NodeGenerator,
  generateNodes,
};

// Phase 4b: Sequencing
export {
  Sequencer,
  sequenceNodes,
  visualizeSequence,
};

// Phase 4c: Method Nodes
export {
  MethodNodes,
  planMethodNodes,
  checkMethodNodeTrigger,
  generateMethodNode,
  getMethodNodeDefinition,
  estimateMethodNodeSessions,
  isMethodNode,
};

// ─────────────────────────────────────────────────────────────────────────────────
// COMPLETE DESIGN FLOW
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Run the "Define Goal" phase (user phase 2)
 * Covers internal phases: capstone, subskills, routing
 */
async function runDefineGoalPhase(
  sessionId: string,
  _explorationData?: {
    topic?: string;
    goal?: string;
    context?: string;
  }
): Promise<DesignerSession> {
  // Fetch the session first
  let session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // 1. Generate capstone from exploration (pass full session object)
  await generateCapstone(session);
  
  // Refresh session after update
  session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found after capstone');
  }

  // 2. Decompose into subskills
  await generateSubskills(session);
  
  // Refresh session after update
  session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found after subskills');
  }

  // 3. Assign routes
  await assignRoutes(session);
  
  // Return final session state
  const finalSession = await getSessionById(sessionId);
  if (!finalSession) {
    throw new Error('Session not found after routing');
  }

  return finalSession;
}

/**
 * Run the "Research" phase (user phase 3)
 * Covers internal phase: research
 */
async function runResearchPhase(sessionId: string): Promise<DesignerSession> {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (!session.routingData?.assignments) {
    throw new Error('Routing data not found');
  }

  await runResearch(session);
  
  const updatedSession = await getSessionById(sessionId);
  if (!updatedSession) {
    throw new Error('Session not found after research');
  }

  return updatedSession;
}

/**
 * Run the "Review" phase (user phase 4)
 * Covers internal phases: node_generation, sequencing, method_nodes
 */
async function runReviewPhase(sessionId: string): Promise<DesignerSession> {
  let session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  
  if (!session.researchData?.resources) {
    throw new Error('Research data not found');
  }

  // 1. Generate nodes
  await generateNodes(session);
  
  // Refresh session
  session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found after node generation');
  }

  // 2. Sequence nodes
  await sequenceNodes(session);
  
  // Refresh session
  session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found after sequencing');
  }

  // 3. Plan method nodes
  await planMethodNodes(session);
  
  const updatedSession = await getSessionById(sessionId);
  if (!updatedSession) {
    throw new Error('Session not found after method nodes');
  }

  return updatedSession;
}

/**
 * Create a lesson plan from completed session
 */
async function createPlanFromSession(sessionId: string): Promise<LessonPlan> {
  if (!isSupabaseInitialized()) {
    throw new Error('Database not initialized');
  }

  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  // Verify all phases complete
  if (session.internalPhase !== 'method_nodes') {
    throw new Error('Session not complete');
  }

  const supabase = getSupabase();
  
  // Calculate estimated sessions
  const subskills = session.subskillsData?.subskills || [];
  const subskillSessions = estimateTotalSessions(subskills);
  const methodNodeCount = session.methodNodesData?.insertions?.length || 0;
  const totalSessions = subskillSessions + methodNodeCount;
  const nodes = session.nodesData?.nodes || [];

  // Create plan
  const { data: plan, error: planError } = await supabase
    .from('lesson_plans')
    .insert({
      user_id: session.userId,
      title: session.explorationData?.learningGoal || 'Untitled Plan',
      capstone_statement: session.capstoneData?.capstoneStatement,
      success_criteria: session.capstoneData?.successCriteria || [],
      difficulty: 'intermediate',
      daily_minutes: 20,
      weekly_cadence: 5,
      total_nodes: nodes.length,
      total_sessions: totalSessions,
      estimated_weeks: Math.ceil(totalSessions / 5),
      status: 'active',
      progress: 0,
      sessions_completed: 0,
      sessions_since_method_node: 0,
    } as any)
    .select()
    .single();

  if (planError) {
    throw new Error(`Failed to create plan: ${planError.message}`);
  }

  // Create nodes in database
  const nodeInserts = nodes.map((node, index) => ({
    plan_id: plan.id,
    title: node.title,
    objective: node.objective,
    route: node.route,
    subskill_type: node.subskillType,
    sequence_order: node.sequenceOrder ?? index,
    module_number: node.moduleNumber ?? 1,
    mastery_check: node.masteryCheck,
    mastery_reflection_prompt: node.masteryReflectionPrompt,
    estimated_sessions: node.estimatedSessions ?? 1,
    is_method_node: node.isMethodNode ?? false,
    method_node_type: node.methodNodeType || null,
    practice_asset_specs: node.practiceAssetSpecs || [],
    canonical_sources: node.canonicalSources || [],
    fallback_assets: node.fallbackAssets || [],
  }));

  if (nodeInserts.length > 0) {
    const { error: nodesError } = await supabase
      .from('nodes')
      .insert(nodeInserts as any);

    if (nodesError) {
      throw new Error(`Failed to create nodes: ${nodesError.message}`);
    }

    // Fetch the inserted nodes to get their IDs
    const { data: insertedNodes, error: fetchError } = await supabase
      .from('nodes')
      .select('id, sequence_order')
      .eq('plan_id', plan.id)
      .order('sequence_order', { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch nodes: ${fetchError.message}`);
    }

    // Create node_progress records for each node
    // First node is 'available', rest are 'locked'
    if (insertedNodes && insertedNodes.length > 0) {
      const progressInserts = insertedNodes.map((node: any) => ({
        user_id: session.userId,
        node_id: node.id,
        status: node.sequence_order === 1 ? 'available' : 'locked',
        sessions_completed: 0,
        current_session: 0,
        all_assets: false,
        mastery_achieved: false,
      }));

      const { error: progressError } = await supabase
        .from('node_progress')
        .insert(progressInserts as any);

      if (progressError) {
        console.error('[DESIGNER] Failed to create node_progress:', progressError.message);
        // Don't throw - plan is still usable, we can recover
      }
    }
  }

  // Link session to plan and complete it
  await linkSessionToPlan(sessionId, plan.id);
  await completeSession(sessionId);

  return {
    id: plan.id,
    userId: session.userId,
    title: plan.title,
    description: plan.description || undefined,
    capstoneStatement: plan.capstone_statement || undefined,
    successCriteria: plan.success_criteria || [],
    difficulty: plan.difficulty || 'intermediate',
    dailyMinutes: plan.daily_minutes || 20,
    weeklyCadence: plan.weekly_cadence || 5,
    totalNodes: nodes.length,
    totalSessions: totalSessions,
    estimatedWeeks: Math.ceil(totalSessions / 5),
    status: 'active',
    progress: 0,
    sessionsCompleted: 0,
    sessionsSinceMethodNode: 0,
    createdAt: new Date(plan.created_at),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const LessonDesigner = {
  // Session
  getActiveSession,
  startSession,
  cancelSession,
  
  // Phases
  runDefineGoal: runDefineGoalPhase,
  runResearch: runResearchPhase,
  runReview: runReviewPhase,
  
  // Create
  createPlan: createPlanFromSession,
};
