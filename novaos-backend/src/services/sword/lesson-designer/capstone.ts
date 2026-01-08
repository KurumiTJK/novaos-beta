// ═══════════════════════════════════════════════════════════════════════════════
// CAPSTONE GENERATION
// Phase 2a: Define end capability
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  DesignerSession,
  ExplorationData,
  CapstoneData,
} from '../types.js';
import { updateSessionPhase, updatePhaseData } from './session.js';
import { SwordGateLLM } from '../llm/swordgate-llm.js';
import {
  CAPSTONE_SYSTEM_PROMPT,
  buildCapstoneUserMessage,
  parseLLMJson,
  type CapstoneOutput,
} from '../llm/prompts/define-goal.js';

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

  // Generate via LLM
  const capstoneData = await generateCapstoneWithLLM(exploration);

  // Update session with capstone data
  await updateSessionPhase(session.id, 'capstone', capstoneData);

  return capstoneData;
}

/**
 * LLM-based capstone generation
 */
async function generateCapstoneWithLLM(
  exploration: ExplorationData
): Promise<CapstoneData> {
  // Debug: Log exploration data
  console.log('[CAPSTONE] Exploration data:', JSON.stringify(exploration, null, 2));
  
  // Safety check for missing learningGoal
  if (!exploration.learningGoal) {
    console.error('[CAPSTONE] Missing learningGoal in exploration data!');
    throw new Error('Learning goal is required. Please complete exploration first.');
  }
  
  const userMessage = buildCapstoneUserMessage({
    learningGoal: exploration.learningGoal,
    priorKnowledge: exploration.priorKnowledge || null,
    context: exploration.context || null,
    constraints: exploration.constraints || [],
  });

  console.log('[CAPSTONE] Generating with LLM...');

  const response = await SwordGateLLM.generate(
    CAPSTONE_SYSTEM_PROMPT,
    userMessage,
    { thinkingLevel: 'high' }
  );

  let parsed: CapstoneOutput;
  try {
    parsed = parseLLMJson<CapstoneOutput>(response);
  } catch (error) {
    console.error('[CAPSTONE] Failed to parse LLM response:', error);
    console.error('[CAPSTONE] Raw response:', response);
    // Fallback to template
    return generateFallbackCapstone(exploration);
  }

  // Validate and transform
  if (!parsed.statement || !parsed.successCriteria?.length) {
    console.warn('[CAPSTONE] Incomplete response, using fallback');
    return generateFallbackCapstone(exploration);
  }

  console.log('[CAPSTONE] Generated:', parsed.title);

  return {
    title: parsed.title || 'Learning Goal',
    capstoneStatement: parsed.statement,
    successCriteria: parsed.successCriteria,
    estimatedTime: parsed.estimatedTime || 'To be determined',
    impliedNodeTypes: estimateNodeTypes(parsed.successCriteria),
  };
}

/**
 * Fallback capstone when LLM fails
 */
function generateFallbackCapstone(exploration: ExplorationData): CapstoneData {
  const goalLower = exploration.learningGoal.toLowerCase();
  
  // Estimate node distribution
  let impliedNodeTypes = { recall: 3, practice: 4, build: 2 };
  if (goalLower.includes('understand') || goalLower.includes('learn')) {
    impliedNodeTypes = { recall: 5, practice: 3, build: 1 };
  } else if (goalLower.includes('build') || goalLower.includes('create')) {
    impliedNodeTypes = { recall: 2, practice: 4, build: 4 };
  }

  return {
    title: truncateToWords(exploration.learningGoal, 5),
    capstoneStatement: `The learner will be able to ${exploration.learningGoal} under real-world conditions with access to reference materials.`,
    successCriteria: [
      'Complete a practical project demonstrating core skills',
      'Explain key concepts without reference materials',
      'Debug common issues independently',
      'Apply knowledge to novel situations',
    ],
    estimatedTime: '4-8 weeks at 20-30 minutes per day',
    impliedNodeTypes,
  };
}

/**
 * Estimate node type distribution from success criteria
 */
function estimateNodeTypes(criteria: string[]): { recall: number; practice: number; build: number } {
  let recall = 0, practice = 0, build = 0;
  
  const text = criteria.join(' ').toLowerCase();
  
  // Count indicators
  if (text.includes('explain') || text.includes('describe') || text.includes('understand')) {
    recall += 2;
  }
  if (text.includes('perform') || text.includes('execute') || text.includes('apply')) {
    practice += 2;
  }
  if (text.includes('create') || text.includes('build') || text.includes('produce') || text.includes('project')) {
    build += 2;
  }
  
  // Ensure minimums
  return {
    recall: Math.max(2, recall),
    practice: Math.max(3, practice),
    build: Math.max(1, build),
  };
}

/**
 * Truncate text to N words
 */
function truncateToWords(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ');
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
  if (!statement.toLowerCase().includes('can') && !statement.toLowerCase().includes('will be able to')) {
    issues.push('Capstone should describe what the learner CAN do');
  }

  if (statement.length < 20) {
    issues.push('Capstone is too vague - needs more specificity');
  }

  if (statement.length > 300) {
    issues.push('Capstone is too long - should be one clear sentence');
  }

  // Check for measurability indicators
  const measurableWords = ['create', 'build', 'write', 'solve', 'explain', 'implement', 'design', 'analyze', 'play', 'perform'];
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

  if (!session.explorationData) {
    throw new Error('Exploration data required');
  }

  const refinementPrompt = `${CAPSTONE_SYSTEM_PROMPT}

══════════════════════════════════════════════════════════════════════
REFINEMENT REQUEST
══════════════════════════════════════════════════════════════════════

The current capstone needs adjustment based on user feedback.

Current capstone:
Title: ${session.capstoneData.title}
Statement: ${session.capstoneData.capstoneStatement}
Criteria: ${session.capstoneData.successCriteria.join(', ')}

User feedback: ${feedback}

Generate an improved capstone that addresses this feedback.`;

  const userMessage = buildCapstoneUserMessage({
    learningGoal: session.explorationData.learningGoal,
    priorKnowledge: session.explorationData.priorKnowledge || null,
    context: session.explorationData.context || null,
    constraints: session.explorationData.constraints || [],
  });

  console.log('[CAPSTONE] Refining with feedback...');

  const response = await SwordGateLLM.generate(
    refinementPrompt,
    userMessage,
    { thinkingLevel: 'high' }
  );

  let parsed: CapstoneOutput;
  try {
    parsed = parseLLMJson<CapstoneOutput>(response);
  } catch (error) {
    console.error('[CAPSTONE] Failed to parse refinement response:', error);
    // Return existing capstone unchanged
    return session.capstoneData;
  }

  const refined: CapstoneData = {
    title: parsed.title || session.capstoneData.title,
    capstoneStatement: parsed.statement || session.capstoneData.capstoneStatement,
    successCriteria: parsed.successCriteria || session.capstoneData.successCriteria,
    estimatedTime: parsed.estimatedTime || session.capstoneData.estimatedTime,
    impliedNodeTypes: session.capstoneData.impliedNodeTypes,
  };

  await updatePhaseData(session.id, 'capstone', refined);

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
