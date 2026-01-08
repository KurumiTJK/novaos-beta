// ═══════════════════════════════════════════════════════════════════════════════
// SUBSKILLS DECOMPOSITION
// Phase 2b: Break capstone into 8-20 subskills
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  DesignerSession,
  CapstoneData,
  SubskillsData,
  Subskill,
  SubskillType,
} from '../types.js';
import { updateSessionPhase, updatePhaseData } from './session.js';
import { SwordGateLLM } from '../llm/swordgate-llm.js';
import {
  SUBSKILLS_SYSTEM_PROMPT,
  buildSubskillsUserMessage,
  parseLLMJson,
  type SubskillsOutput,
  type SubskillOutput,
} from '../llm/prompts/define-goal.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const MIN_SUBSKILLS = 8;
const MAX_SUBSKILLS = 20;

// ─────────────────────────────────────────────────────────────────────────────────
// SUBSKILL GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Decompose capstone into subskills
 */
export async function generateSubskills(
  session: DesignerSession
): Promise<SubskillsData> {
  if (!session.capstoneData) {
    throw new Error('Capstone data required before subskill decomposition');
  }

  const capstone = session.capstoneData;
  
  // Generate subskills via LLM
  const subskillsData = await generateSubskillsWithLLM(
    capstone, 
    session.explorationData?.priorKnowledge || null,
    session.explorationData?.context || null
  );

  // Validate count
  if (subskillsData.subskills.length < MIN_SUBSKILLS) {
    console.warn(`[SUBSKILLS] Only ${subskillsData.subskills.length} subskills, need ${MIN_SUBSKILLS}+`);
    // Continue anyway - let UI handle this
  }

  if (subskillsData.subskills.length > MAX_SUBSKILLS) {
    // Trim to max, keeping most important
    subskillsData.subskills = subskillsData.subskills.slice(0, MAX_SUBSKILLS);
  }

  // Update session
  await updateSessionPhase(session.id, 'subskills', subskillsData);

  return subskillsData;
}

/**
 * LLM-based subskill generation
 */
async function generateSubskillsWithLLM(
  capstone: CapstoneData,
  priorKnowledge: string | null,
  context: string | null
): Promise<SubskillsData> {
  const userMessage = buildSubskillsUserMessage({
    capstone: {
      title: capstone.title || 'Learning Goal',
      statement: capstone.capstoneStatement,
      successCriteria: capstone.successCriteria,
      estimatedTime: capstone.estimatedTime || 'Not specified',
    },
    priorKnowledge,
    context,
  });

  console.log('[SUBSKILLS] Generating with LLM...');

  const response = await SwordGateLLM.generate(
    SUBSKILLS_SYSTEM_PROMPT,
    userMessage,
    { thinkingLevel: 'high' }
  );

  let parsed: SubskillsOutput;
  try {
    parsed = parseLLMJson<SubskillsOutput>(response);
  } catch (error) {
    console.error('[SUBSKILLS] Failed to parse LLM response:', error);
    console.error('[SUBSKILLS] Raw response:', response);
    // Fallback to template
    return generateFallbackSubskills(capstone);
  }

  // Validate structure
  if (!parsed.subskills?.length) {
    console.warn('[SUBSKILLS] Empty response, using fallback');
    return generateFallbackSubskills(capstone);
  }

  // Transform and add IDs
  const subskills: Subskill[] = parsed.subskills.map((s: SubskillOutput, index: number) => ({
    id: `ss_${Date.now()}_${index}`,
    title: s.title,
    description: s.description,
    subskillType: validateSubskillType(s.subskillType),
    estimatedComplexity: validateComplexity(s.estimatedComplexity),
    order: s.order || index + 1,
  }));

  console.log(`[SUBSKILLS] Generated ${subskills.length} subskills`);

  return { subskills };
}

/**
 * Validate subskill type
 */
function validateSubskillType(type: string): SubskillType {
  const validTypes: SubskillType[] = ['concepts', 'procedures', 'judgments', 'outputs', 'tool_setup', 'tool_management'];
  if (validTypes.includes(type as SubskillType)) {
    return type as SubskillType;
  }
  return 'procedures'; // Default
}

/**
 * Validate complexity
 */
function validateComplexity(complexity: number): 1 | 2 | 3 {
  if (complexity === 1 || complexity === 2 || complexity === 3) {
    return complexity;
  }
  return 2; // Default
}

/**
 * Fallback subskills when LLM fails
 */
function generateFallbackSubskills(capstone: CapstoneData): SubskillsData {
  const subskills: Subskill[] = [
    // Concepts (recall)
    {
      id: generateId(),
      title: 'Core Terminology',
      description: 'Understand fundamental vocabulary and definitions used in the field.',
      subskillType: 'concepts',
      estimatedComplexity: 1,
      order: 1,
    },
    {
      id: generateId(),
      title: 'Mental Models',
      description: 'Internalize key frameworks and ways of thinking about problems.',
      subskillType: 'concepts',
      estimatedComplexity: 2,
      order: 2,
    },

    // Procedures (practice)
    {
      id: generateId(),
      title: 'Basic Operations',
      description: 'Execute fundamental procedures and operations correctly.',
      subskillType: 'procedures',
      estimatedComplexity: 1,
      order: 3,
    },
    {
      id: generateId(),
      title: 'Standard Workflows',
      description: 'Follow established step-by-step workflows for common tasks.',
      subskillType: 'procedures',
      estimatedComplexity: 2,
      order: 4,
    },
    {
      id: generateId(),
      title: 'Advanced Techniques',
      description: 'Apply sophisticated methods for complex scenarios.',
      subskillType: 'procedures',
      estimatedComplexity: 3,
      order: 5,
    },

    // Judgments (diagnose)
    {
      id: generateId(),
      title: 'Problem Identification',
      description: 'Recognize when something is wrong and categorize the issue.',
      subskillType: 'judgments',
      estimatedComplexity: 2,
      order: 6,
    },
    {
      id: generateId(),
      title: 'Solution Selection',
      description: 'Choose the appropriate approach for a given situation.',
      subskillType: 'judgments',
      estimatedComplexity: 2,
      order: 7,
    },

    // Outputs (build)
    {
      id: generateId(),
      title: 'Small Deliverables',
      description: 'Create focused artifacts demonstrating specific skills.',
      subskillType: 'outputs',
      estimatedComplexity: 2,
      order: 8,
    },
    {
      id: generateId(),
      title: 'Integration Project',
      description: 'Build a comprehensive project combining multiple skills.',
      subskillType: 'outputs',
      estimatedComplexity: 3,
      order: 9,
    },

    // Tools (practice/plan)
    {
      id: generateId(),
      title: 'Environment Setup',
      description: 'Configure tools and environment for effective work.',
      subskillType: 'tool_setup',
      estimatedComplexity: 1,
      order: 10,
    },
    {
      id: generateId(),
      title: 'Resource Management',
      description: 'Organize and manage learning resources and references.',
      subskillType: 'tool_management',
      estimatedComplexity: 1,
      order: 11,
    },
  ];

  return { subskills };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REGENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Regenerate subskills with optional guidance
 */
export async function regenerateSubskills(
  session: DesignerSession,
  guidance?: string
): Promise<SubskillsData> {
  if (!session.capstoneData) {
    throw new Error('Capstone data required');
  }

  const systemPrompt = guidance
    ? `${SUBSKILLS_SYSTEM_PROMPT}\n\nADDITIONAL GUIDANCE: ${guidance}`
    : SUBSKILLS_SYSTEM_PROMPT;

  const userMessage = buildSubskillsUserMessage({
    capstone: {
      title: session.capstoneData.title || 'Learning Goal',
      statement: session.capstoneData.capstoneStatement,
      successCriteria: session.capstoneData.successCriteria,
      estimatedTime: session.capstoneData.estimatedTime || 'Not specified',
    },
    priorKnowledge: session.explorationData?.priorKnowledge || null,
    context: session.explorationData?.context || null,
  });

  console.log('[SUBSKILLS] Regenerating with guidance...');

  const response = await SwordGateLLM.generate(
    systemPrompt,
    userMessage,
    { thinkingLevel: 'high' }
  );

  let parsed: SubskillsOutput;
  try {
    parsed = parseLLMJson<SubskillsOutput>(response);
  } catch (error) {
    console.error('[SUBSKILLS] Failed to parse regeneration response:', error);
    throw new Error('Failed to regenerate subskills');
  }

  const subskills: Subskill[] = parsed.subskills.map((s: SubskillOutput, index: number) => ({
    id: `ss_${Date.now()}_${index}`,
    title: s.title,
    description: s.description,
    subskillType: validateSubskillType(s.subskillType),
    estimatedComplexity: validateComplexity(s.estimatedComplexity),
    order: s.order || index + 1,
  }));

  const subskillsData: SubskillsData = { subskills };
  await updatePhaseData(session.id, 'subskills', subskillsData);

  return subskillsData;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EDITING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Add a new subskill
 */
export async function addSubskill(
  session: DesignerSession,
  subskill: Omit<Subskill, 'id'>
): Promise<SubskillsData> {
  if (!session.subskillsData) {
    throw new Error('No subskills data to add to');
  }

  const newSubskill: Subskill = {
    ...subskill,
    id: generateId(),
  };

  const subskillsData: SubskillsData = {
    subskills: [...session.subskillsData.subskills, newSubskill],
  };

  await updatePhaseData(session.id, 'subskills', subskillsData);
  return subskillsData;
}

/**
 * Update a subskill
 */
export async function updateSubskill(
  session: DesignerSession,
  subskillId: string,
  updates: Partial<Omit<Subskill, 'id'>>
): Promise<SubskillsData> {
  if (!session.subskillsData) {
    throw new Error('No subskills data to update');
  }

  const subskills = session.subskillsData.subskills.map(s => {
    if (s.id === subskillId) {
      return { ...s, ...updates };
    }
    return s;
  });

  const subskillsData: SubskillsData = { subskills };
  await updatePhaseData(session.id, 'subskills', subskillsData);
  return subskillsData;
}

/**
 * Remove a subskill
 */
export async function removeSubskill(
  session: DesignerSession,
  subskillId: string
): Promise<SubskillsData> {
  if (!session.subskillsData) {
    throw new Error('No subskills data to remove from');
  }

  const subskills = session.subskillsData.subskills.filter(s => s.id !== subskillId);
  const subskillsData: SubskillsData = { subskills };
  
  await updatePhaseData(session.id, 'subskills', subskillsData);
  return subskillsData;
}

/**
 * Reorder subskills
 */
export async function reorderSubskills(
  session: DesignerSession,
  orderedIds: string[]
): Promise<SubskillsData> {
  if (!session.subskillsData) {
    throw new Error('No subskills data to reorder');
  }

  const subskillMap = new Map(
    session.subskillsData.subskills.map(s => [s.id, s])
  );

  const subskills = orderedIds
    .map((id, index) => {
      const subskill = subskillMap.get(id);
      if (!subskill) return null;
      return { ...subskill, order: index + 1 };
    })
    .filter((s): s is Subskill => s !== null);

  const subskillsData: SubskillsData = { subskills };
  await updatePhaseData(session.id, 'subskills', subskillsData);
  return subskillsData;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate subskills data
 */
export function validateSubskills(subskills: Subskill[]): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check count
  if (subskills.length < MIN_SUBSKILLS) {
    issues.push(`Need at least ${MIN_SUBSKILLS} subskills`);
  }

  if (subskills.length > MAX_SUBSKILLS) {
    issues.push(`Maximum ${MAX_SUBSKILLS} subskills allowed`);
  }

  // Check type distribution
  const typeCounts: Record<SubskillType, number> = {
    concepts: 0,
    procedures: 0,
    judgments: 0,
    outputs: 0,
    tool_setup: 0,
    tool_management: 0,
  };

  subskills.forEach(s => {
    typeCounts[s.subskillType]++;
  });

  // Should have at least some variety
  const typesUsed = Object.values(typeCounts).filter(c => c > 0).length;
  if (typesUsed < 3) {
    issues.push('Subskills should cover at least 3 different types');
  }

  // Check for required types
  if (typeCounts.procedures === 0) {
    issues.push('Should include at least one procedural subskill');
  }

  if (typeCounts.outputs === 0) {
    issues.push('Should include at least one output/build subskill');
  }

  // Check individual subskills
  subskills.forEach((subskill, index) => {
    if (!subskill.title || subskill.title.length < 3) {
      issues.push(`Subskill ${index + 1}: Title too short`);
    }

    if (!subskill.description || subskill.description.length < 10) {
      issues.push(`Subskill ${index + 1}: Description too vague`);
    }

    if (![1, 2, 3].includes(subskill.estimatedComplexity)) {
      issues.push(`Subskill ${index + 1}: Invalid complexity (must be 1, 2, or 3)`);
    }
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}

/**
 * Check if subskills cover success criteria
 */
export function checkCriteriaCoverage(
  subskills: Subskill[],
  successCriteria: string[]
): { covered: boolean; gaps: string[] } {
  // Simple heuristic: check if criteria keywords appear in subskill titles/descriptions
  const subskillText = subskills
    .map(s => `${s.title} ${s.description}`)
    .join(' ')
    .toLowerCase();

  const gaps: string[] = [];
  
  for (const criterion of successCriteria) {
    const keywords = criterion.toLowerCase().split(/\s+/).filter(w => w.length > 4);
    const matched = keywords.some(kw => subskillText.includes(kw));
    
    if (!matched) {
      gaps.push(criterion);
    }
  }

  return {
    covered: gaps.length === 0,
    gaps,
  };
}

/**
 * Get type distribution summary
 */
export function getTypeDistribution(subskills: Subskill[]): Record<SubskillType, number> {
  const distribution: Record<SubskillType, number> = {
    concepts: 0,
    procedures: 0,
    judgments: 0,
    outputs: 0,
    tool_setup: 0,
    tool_management: 0,
  };

  subskills.forEach(s => {
    distribution[s.subskillType]++;
  });

  return distribution;
}

/**
 * Estimate total sessions from subskills
 */
export function estimateTotalSessions(subskills: Subskill[]): number {
  return subskills.reduce((total, subskill) => {
    // Complexity 1 = 1 session, 2 = 2 sessions, 3 = 3 sessions
    return total + subskill.estimatedComplexity;
  }, 0);
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `ss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const SubskillsGenerator = {
  generate: generateSubskills,
  regenerate: regenerateSubskills,
  add: addSubskill,
  update: updateSubskill,
  remove: removeSubskill,
  reorder: reorderSubskills,
  validate: validateSubskills,
  checkCriteriaCoverage,
  getDistribution: getTypeDistribution,
  estimateSessions: estimateTotalSessions,
  MIN_SUBSKILLS,
  MAX_SUBSKILLS,
};
