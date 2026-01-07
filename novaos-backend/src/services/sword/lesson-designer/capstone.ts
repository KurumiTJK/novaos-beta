// ═══════════════════════════════════════════════════════════════════════════════
// CAPSTONE GENERATION
// Phase 2a: Define end capability
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  DesignerSession,
  ExplorationData,
  CapstoneData,
} from '../types.js';
import { updateSessionPhase } from './session.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CAPSTONE GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate capstone statement from exploration data
 * 
 * Capstone format: "The learner can ___ under ___ constraints."
 * This determines what kinds of nodes we'll need.
 */
export async function generateCapstone(
  session: DesignerSession
): Promise<CapstoneData> {
  if (!session.explorationData) {
    throw new Error('Exploration data required before capstone generation');
  }

  const exploration = session.explorationData;

  // TODO: LLM call to generate capstone
  // For now, return structured template
  const capstoneData = await generateCapstoneWithLLM(exploration);

  // Update session with capstone data
  await updateSessionPhase(session.id, 'capstone', capstoneData);

  return capstoneData;
}

/**
 * LLM-based capstone generation
 * 
 * @stub - Implement with actual LLM call
 */
async function generateCapstoneWithLLM(
  exploration: ExplorationData
): Promise<CapstoneData> {
  // ═══════════════════════════════════════════════════════════════════════════
  // TODO: Implement LLM call
  // 
  // Prompt structure:
  // - Input: learning goal, context, constraints, prior knowledge
  // - Output: capstone statement, success criteria, implied node types
  // 
  // Example prompt:
  // ```
  // Based on the learner's goal: "${exploration.learningGoal}"
  // Context: ${exploration.context}
  // Constraints: ${exploration.constraints.join(', ')}
  // Prior knowledge: ${exploration.priorKnowledge}
  // 
  // Generate a capstone statement in the format:
  // "The learner can [specific capability] under [realistic constraints]."
  // 
  // Also provide:
  // 1. 3-5 measurable success criteria
  // 2. Estimated distribution of node types needed (recall/practice/build)
  // ```
  // ═══════════════════════════════════════════════════════════════════════════

  // STUB: Generate placeholder based on exploration
  const capstoneStatement = `The learner can ${exploration.learningGoal} under real-world time constraints and with access to reference materials.`;

  const successCriteria = [
    'Complete a practical project demonstrating core skills',
    'Explain key concepts without reference materials',
    'Debug common issues independently',
    'Apply knowledge to novel situations',
  ];

  // Estimate node type distribution based on goal keywords
  const goalLower = exploration.learningGoal.toLowerCase();
  let impliedNodeTypes = { recall: 3, practice: 4, build: 2 };

  if (goalLower.includes('understand') || goalLower.includes('learn')) {
    impliedNodeTypes = { recall: 5, practice: 3, build: 1 };
  } else if (goalLower.includes('build') || goalLower.includes('create')) {
    impliedNodeTypes = { recall: 2, practice: 4, build: 4 };
  } else if (goalLower.includes('master') || goalLower.includes('expert')) {
    impliedNodeTypes = { recall: 3, practice: 5, build: 3 };
  }

  return {
    capstoneStatement,
    successCriteria,
    impliedNodeTypes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate capstone statement format
 */
export function validateCapstoneStatement(statement: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check for required format elements
  if (!statement.toLowerCase().includes('can')) {
    issues.push('Capstone should describe what the learner CAN do');
  }

  if (statement.length < 20) {
    issues.push('Capstone is too vague - needs more specificity');
  }

  if (statement.length > 300) {
    issues.push('Capstone is too long - should be one clear sentence');
  }

  // Check for measurability indicators
  const measurableWords = ['create', 'build', 'write', 'solve', 'explain', 'implement', 'design', 'analyze'];
  const hasMeasurable = measurableWords.some(word => statement.toLowerCase().includes(word));
  
  if (!hasMeasurable) {
    issues.push('Capstone should include a measurable action verb');
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Validate success criteria
 */
export function validateSuccessCriteria(criteria: string[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (criteria.length < 2) {
    issues.push('Need at least 2 success criteria');
  }

  if (criteria.length > 7) {
    issues.push('Too many success criteria - focus on 3-5 key outcomes');
  }

  // Check each criterion
  criteria.forEach((criterion, index) => {
    if (criterion.length < 10) {
      issues.push(`Criterion ${index + 1} is too vague`);
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REFINEMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Refine capstone based on user feedback
 */
export async function refineCapstone(
  session: DesignerSession,
  feedback: string
): Promise<CapstoneData> {
  if (!session.capstoneData) {
    throw new Error('No capstone to refine');
  }

  // TODO: LLM call to refine based on feedback
  // For now, return existing with minor modifications

  const refined: CapstoneData = {
    ...session.capstoneData,
    // Would incorporate feedback here
  };

  await updateSessionPhase(session.id, 'capstone', refined);

  return refined;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const CapstoneGenerator = {
  generate: generateCapstone,
  refine: refineCapstone,
  validateStatement: validateCapstoneStatement,
  validateCriteria: validateSuccessCriteria,
};
