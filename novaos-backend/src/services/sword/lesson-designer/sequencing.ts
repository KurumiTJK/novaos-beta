// ═══════════════════════════════════════════════════════════════════════════════
// SEQUENCING SERVICE
// Phase 4b: Order nodes and define prerequisites
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  DesignerSession,
  NodesData,
  SequencingData,
  Node,
  Route,
} from '../types.js';
import { updateSessionPhase } from './session.js';

// ─────────────────────────────────────────────────────────────────────────────────
// SEQUENCING RULES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Sequencing rules (from pedagogical framework):
 * 1. Start with Plan + minimal Recall foundations
 * 2. Alternate: Practice → Recall → Diagnose
 * 3. End modules with: Apply → Build → Refine
 */

const ROUTE_PRIORITY: Record<Route, number> = {
  plan: 1,      // Start with planning
  recall: 2,    // Then foundations
  practice: 3,  // Build ability
  diagnose: 4,  // Avoid brittle knowledge
  apply: 5,     // Transfer
  build: 6,     // Integration
  refine: 7,    // Quality (last)
};

const NODES_PER_MODULE = 6;

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN SEQUENCING FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Sequence nodes and define prerequisites
 */
export async function sequenceNodes(
  session: DesignerSession
): Promise<SequencingData> {
  if (!session.nodesData) {
    throw new Error('Nodes data required for sequencing');
  }

  const { nodes } = session.nodesData;

  // Step 1: Sort by pedagogical order
  const sorted = sortByPedagogicalOrder(nodes);

  // Step 2: Assign to modules
  const modules = assignToModules(sorted);

  // Step 3: Determine prerequisites
  const prerequisites = determinePrerequisites(sorted, modules);

  // Step 4: Generate final order
  const orderedNodeIds = sorted.map((_, index) => `node_${index}`);

  const sequencingData: SequencingData = {
    orderedNodeIds,
    prerequisites,
    modules,
  };

  // Update session
  await updateSessionPhase(session.id, 'sequencing', sequencingData);

  return sequencingData;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SORTING
// ─────────────────────────────────────────────────────────────────────────────────

type NodeWithIndex = Omit<Node, 'id' | 'planId' | 'createdAt'> & { originalIndex: number };

/**
 * Sort nodes by pedagogical progression
 */
function sortByPedagogicalOrder(
  nodes: NodesData['nodes']
): NodeWithIndex[] {
  // Add original indices
  const indexed: NodeWithIndex[] = nodes.map((node, index) => ({
    ...node,
    originalIndex: index,
  }));

  // Group by route priority
  const groups = new Map<number, NodeWithIndex[]>();
  
  indexed.forEach(node => {
    const priority = ROUTE_PRIORITY[node.route];
    if (!groups.has(priority)) {
      groups.set(priority, []);
    }
    groups.get(priority)!.push(node);
  });

  // Build sequence following pedagogical rules
  const sequence: NodeWithIndex[] = [];

  // 1. Start with Plan nodes
  const planNodes = groups.get(ROUTE_PRIORITY.plan) || [];
  sequence.push(...planNodes.slice(0, 1)); // Just one initial plan node

  // 2. Add foundational Recall
  const recallNodes = groups.get(ROUTE_PRIORITY.recall) || [];
  const foundationRecall = recallNodes.slice(0, Math.ceil(recallNodes.length / 2));
  sequence.push(...foundationRecall);

  // 3. Interleave Practice, remaining Recall, and Diagnose
  const practiceNodes = groups.get(ROUTE_PRIORITY.practice) || [];
  const remainingRecall = recallNodes.slice(Math.ceil(recallNodes.length / 2));
  const diagnoseNodes = groups.get(ROUTE_PRIORITY.diagnose) || [];

  const interleaved = interleaveNodes([
    practiceNodes,
    remainingRecall,
    diagnoseNodes,
  ]);
  sequence.push(...interleaved);

  // 4. Add any remaining Plan nodes
  sequence.push(...planNodes.slice(1));

  // 5. End with Apply → Build → Refine
  const applyNodes = groups.get(ROUTE_PRIORITY.apply) || [];
  const buildNodes = groups.get(ROUTE_PRIORITY.build) || [];
  const refineNodes = groups.get(ROUTE_PRIORITY.refine) || [];

  sequence.push(...applyNodes);
  sequence.push(...buildNodes);
  sequence.push(...refineNodes);

  // Update sequence order
  return sequence.map((node, index) => ({
    ...node,
    sequenceOrder: index + 1,
  }));
}

/**
 * Interleave multiple node arrays
 */
function interleaveNodes(arrays: NodeWithIndex[][]): NodeWithIndex[] {
  const result: NodeWithIndex[] = [];
  const maxLength = Math.max(...arrays.map(a => a.length));

  for (let i = 0; i < maxLength; i++) {
    for (const array of arrays) {
      const item = array[i];
      if (item !== undefined) {
        result.push(item);
      }
    }
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MODULE ASSIGNMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Assign nodes to modules
 */
function assignToModules(
  nodes: NodeWithIndex[]
): SequencingData['modules'] {
  const modules: SequencingData['modules'] = [];
  let currentModule: string[] = [];
  let moduleNumber = 1;

  nodes.forEach((node, index) => {
    const nodeId = `node_${node.originalIndex}`;
    currentModule.push(nodeId);

    // Check if module should end
    const shouldEndModule = 
      currentModule.length >= NODES_PER_MODULE ||
      node.route === 'build' || // Build nodes end modules
      node.route === 'refine' || // Refine nodes end modules
      index === nodes.length - 1; // Last node

    if (shouldEndModule) {
      modules.push({
        number: moduleNumber,
        nodeIds: [...currentModule],
      });
      currentModule = [];
      moduleNumber++;
    }
  });

  // Handle any remaining nodes
  if (currentModule.length > 0) {
    modules.push({
      number: moduleNumber,
      nodeIds: currentModule,
    });
  }

  return modules;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PREREQUISITES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Determine prerequisites based on sequence and modules
 */
function determinePrerequisites(
  nodes: NodeWithIndex[],
  modules: SequencingData['modules']
): SequencingData['prerequisites'] {
  const prerequisites: SequencingData['prerequisites'] = [];

  // Create module lookup
  const nodeToModule = new Map<string, number>();
  modules.forEach(module => {
    module.nodeIds.forEach(nodeId => {
      nodeToModule.set(nodeId, module.number);
    });
  });

  // Rules for prerequisites:
  // 1. First node of each module requires last node of previous module
  // 2. Build/Apply nodes require all Practice nodes in same module
  // 3. Refine nodes require Build nodes in same module

  nodes.forEach((node, index) => {
    const nodeId = `node_${node.originalIndex}`;
    const prereqIds: string[] = [];
    const currentModuleNum = nodeToModule.get(nodeId);
    if (currentModuleNum === undefined) return;

    // Rule 1: First node of module (except module 1)
    if (currentModuleNum > 1) {
      const currentModule = modules.find(m => m.number === currentModuleNum);
      if (currentModule && currentModule.nodeIds[0] === nodeId) {
        // Require last node of previous module
        const prevModule = modules.find(m => m.number === currentModuleNum - 1);
        if (prevModule && prevModule.nodeIds.length > 0) {
          const lastNodePrevModule = prevModule.nodeIds[prevModule.nodeIds.length - 1];
          if (lastNodePrevModule) {
            prereqIds.push(lastNodePrevModule);
          }
        }
      }
    }

    // Rule 2: Build/Apply requires Practice nodes
    if (node.route === 'build' || node.route === 'apply') {
      const currentModule = modules.find(m => m.number === currentModuleNum);
      if (currentModule) {
        currentModule.nodeIds.forEach(modNodeId => {
          if (modNodeId === nodeId) return; // Skip self
          
          // Find the node
          const modNode = nodes.find(n => `node_${n.originalIndex}` === modNodeId);
          if (modNode?.route === 'practice') {
            prereqIds.push(modNodeId);
          }
        });
      }
    }

    // Rule 3: Refine requires Build
    if (node.route === 'refine') {
      const currentModule = modules.find(m => m.number === currentModuleNum);
      if (currentModule) {
        currentModule.nodeIds.forEach(modNodeId => {
          if (modNodeId === nodeId) return;
          
          const modNode = nodes.find(n => `node_${n.originalIndex}` === modNodeId);
          if (modNode?.route === 'build') {
            prereqIds.push(modNodeId);
          }
        });
      }
    }

    // Simple sequential prerequisite for first few nodes
    if (index > 0 && index < 3 && prereqIds.length === 0) {
      const prevNode = nodes[index - 1];
      if (prevNode) {
        prereqIds.push(`node_${prevNode.originalIndex}`);
      }
    }

    if (prereqIds.length > 0) {
      prerequisites.push({
        nodeId,
        prereqIds: [...new Set(prereqIds)], // Remove duplicates
      });
    }
  });

  return prerequisites;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VISUALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate a text-based visualization of the sequence
 */
export function visualizeSequence(
  nodes: NodesData['nodes'],
  sequencing: SequencingData
): string {
  const lines: string[] = [];
  
  lines.push('=== Learning Sequence ===\n');

  sequencing.modules.forEach(module => {
    lines.push(`Module ${module.number}:`);
    
    module.nodeIds.forEach(nodeId => {
      const indexStr = nodeId.split('_')[1];
      if (!indexStr) return;
      
      const index = parseInt(indexStr, 10);
      const node = nodes[index];
      if (!node) return;
      
      const prereqs = sequencing.prerequisites.find(p => p.nodeId === nodeId);
      const prereqStr = prereqs ? ` (requires: ${prereqs.prereqIds.join(', ')})` : '';
      
      lines.push(`  ${nodeId}: [${node.route.toUpperCase()}] ${node.title}${prereqStr}`);
    });
    
    lines.push('');
  });

  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const Sequencer = {
  sequence: sequenceNodes,
  sortByPedagogicalOrder,
  assignToModules,
  determinePrerequisites,
  visualize: visualizeSequence,
  ROUTE_PRIORITY,
  NODES_PER_MODULE,
};
