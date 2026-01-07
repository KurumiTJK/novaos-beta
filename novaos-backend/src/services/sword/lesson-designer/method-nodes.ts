// ═══════════════════════════════════════════════════════════════════════════════
// METHOD NODES
// Phase 4c: Adaptive insertion of review/practice nodes
// Session-based triggers (every 8-12 sessions, not nodes)
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  DesignerSession,
  SequencingData,
  MethodNodesData,
  MethodNodeType,
  NodesData,
  Node,
  LessonPlan,
} from '../types.js';
import { updateSessionPhase } from './session.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

const METHOD_NODE_SESSION_THRESHOLD = {
  min: 8,  // Start considering after 8 sessions
  max: 12, // Force insert by 12 sessions
};

const METHOD_NODE_DEFINITIONS: Record<MethodNodeType, {
  title: string;
  objective: string;
  description: string;
  route: 'plan' | 'apply' | 'recall';
}> = {
  error_review: {
    title: 'Error Review & Reflection',
    objective: 'Identify and learn from mistakes made in recent sessions',
    description: 'Review errors, analyze patterns, and develop strategies to avoid them',
    route: 'plan',
  },
  mixed_practice: {
    title: 'Mixed Practice Challenge',
    objective: 'Apply multiple skills together in varied contexts',
    description: 'Interleave practice from different topics to strengthen connections',
    route: 'apply',
  },
  spaced_review: {
    title: 'Spaced Review',
    objective: 'Reinforce retention of previously learned material',
    description: 'Test recall of concepts from earlier in the learning journey',
    route: 'recall',
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// DESIGN-TIME INSERTION (placeholder positions)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Plan method node insertions during design phase
 * These are placeholders - actual insertion happens at runtime
 */
export async function planMethodNodes(
  session: DesignerSession
): Promise<MethodNodesData> {
  if (!session.nodesData || !session.sequencingData) {
    throw new Error('Nodes and sequencing data required for method node planning');
  }

  const { nodes } = session.nodesData;
  const { modules, orderedNodeIds } = session.sequencingData;

  const insertions: MethodNodesData['insertions'] = [];

  // Rule 1: Before any Build node
  orderedNodeIds.forEach((nodeId, index) => {
    const parts = nodeId.split('_');
    const nodeIndexStr = parts[1];
    if (!nodeIndexStr) return;
    
    const nodeIndex = parseInt(nodeIndexStr);
    const node = nodes[nodeIndex];
    if (!node) return;

    if (node.route === 'build' && index > 0) {
      const prevNodeId = orderedNodeIds[index - 1];
      if (prevNodeId) {
        insertions.push({
          afterNodeId: prevNodeId,
          methodNodeType: 'mixed_practice',
          reason: 'before_build',
        });
      }
    }
  });

  // Rule 2: At module boundaries (except last)
  modules.forEach((module, moduleIndex) => {
    if (moduleIndex < modules.length - 1 && module.nodeIds.length > 0) {
      const lastNodeInModule = module.nodeIds[module.nodeIds.length - 1];
      if (!lastNodeInModule) return;
      
      // Don't duplicate if already inserting before a build
      const alreadyInserted = insertions.some(i => i.afterNodeId === lastNodeInModule);
      
      if (!alreadyInserted) {
        insertions.push({
          afterNodeId: lastNodeInModule,
          methodNodeType: 'spaced_review',
          reason: 'module_boundary',
        });
      }
    }
  });

  const methodNodesData: MethodNodesData = { insertions };

  // Update session
  await updateSessionPhase(session.id, 'method_nodes', methodNodesData);

  return methodNodesData;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RUNTIME TRIGGERS
// ─────────────────────────────────────────────────────────────────────────────────

export interface MethodNodeCheck {
  shouldInsert: boolean;
  type?: MethodNodeType;
  reason?: 'session_count' | 'before_build' | 'module_boundary';
}

/**
 * Check if method node should be inserted at runtime
 * Based on SESSIONS completed, not nodes
 */
export function checkMethodNodeTrigger(
  plan: LessonPlan,
  currentNode: Omit<Node, 'id' | 'planId' | 'createdAt'> | Node,
  nextNode: Omit<Node, 'id' | 'planId' | 'createdAt'> | Node | null
): MethodNodeCheck {
  const { sessionsSinceMethodNode } = plan;

  // Trigger 1: Session count threshold
  if (sessionsSinceMethodNode >= METHOD_NODE_SESSION_THRESHOLD.min) {
    // Probabilistic between min and max
    const range = METHOD_NODE_SESSION_THRESHOLD.max - METHOD_NODE_SESSION_THRESHOLD.min;
    const progress = (sessionsSinceMethodNode - METHOD_NODE_SESSION_THRESHOLD.min) / range;
    
    // Probability increases linearly from 0 at min to 1 at max
    const shouldTrigger = 
      Math.random() < progress || 
      sessionsSinceMethodNode >= METHOD_NODE_SESSION_THRESHOLD.max;

    if (shouldTrigger) {
      return {
        shouldInsert: true,
        type: selectMethodNodeType(plan.sessionsCompleted),
        reason: 'session_count',
      };
    }
  }

  // Trigger 2: Before any Build node
  if (nextNode?.route === 'build') {
    return {
      shouldInsert: true,
      type: 'mixed_practice',
      reason: 'before_build',
    };
  }

  // Trigger 3: Module boundary (detected by module number change)
  if (nextNode && 'moduleNumber' in currentNode && 'moduleNumber' in nextNode) {
    if (currentNode.moduleNumber !== nextNode.moduleNumber) {
      return {
        shouldInsert: true,
        type: 'spaced_review',
        reason: 'module_boundary',
      };
    }
  }

  return { shouldInsert: false };
}

/**
 * Select method node type based on rotation
 */
function selectMethodNodeType(sessionsCompleted: number): MethodNodeType {
  const types: MethodNodeType[] = ['error_review', 'mixed_practice', 'spaced_review'];
  return types[sessionsCompleted % types.length] ?? 'mixed_practice';
}

// ─────────────────────────────────────────────────────────────────────────────────
// METHOD NODE GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate a method node for insertion
 */
export function generateMethodNode(
  type: MethodNodeType,
  afterNode: Node,
  moduleNumber: number
): Omit<Node, 'id' | 'planId' | 'createdAt'> {
  const definition = METHOD_NODE_DEFINITIONS[type];

  return {
    title: definition.title,
    objective: definition.objective,
    route: definition.route,
    subskillType: 'concepts', // Method nodes don't have a real subskill type
    sequenceOrder: afterNode.sequenceOrder + 0.5, // Insert between
    moduleNumber,
    masteryCheck: 'Complete all review exercises',
    masteryReflectionPrompt: 'What patterns did you notice in your learning so far?',
    estimatedSessions: 1, // Method nodes are single-session
    isMethodNode: true,
    methodNodeType: type,
    practiceAssetSpecs: [],
    canonicalSources: [],
    fallbackAssets: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get method node definition
 */
export function getMethodNodeDefinition(type: MethodNodeType) {
  return METHOD_NODE_DEFINITIONS[type];
}

/**
 * Estimate additional sessions from method nodes
 */
export function estimateMethodNodeSessions(
  totalContentSessions: number
): number {
  // Roughly one method node per 10 sessions
  return Math.floor(totalContentSessions / 10);
}

/**
 * Check if a node is a method node
 */
export function isMethodNode(node: Node | Omit<Node, 'id' | 'planId' | 'createdAt'>): boolean {
  return node.isMethodNode === true;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const MethodNodes = {
  plan: planMethodNodes,
  checkTrigger: checkMethodNodeTrigger,
  generate: generateMethodNode,
  getDefinition: getMethodNodeDefinition,
  estimateSessions: estimateMethodNodeSessions,
  isMethodNode,
  DEFINITIONS: METHOD_NODE_DEFINITIONS,
  SESSION_THRESHOLD: METHOD_NODE_SESSION_THRESHOLD,
};

// Alias for runtime usage
export { checkMethodNodeTrigger as checkRuntimeMethodNodeTrigger };
