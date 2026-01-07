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
import { updateSessionPhase } from './session.js';

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
  const subskillsData = await generateSubskillsWithLLM(capstone);

  // Validate count
  if (subskillsData.subskills.length < MIN_SUBSKILLS) {
    throw new Error(`Need at least ${MIN_SUBSKILLS} subskills, got ${subskillsData.subskills.length}`);
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
 * 
 * @stub - Implement with actual LLM call
 */
async function generateSubskillsWithLLM(
  capstone: CapstoneData
): Promise<SubskillsData> {
  // ═══════════════════════════════════════════════════════════════════════════
  // TODO: Implement LLM call
  // 
  // Prompt structure:
  // ```
  // Given the learning capstone:
  // "${capstone.capstoneStatement}"
  // 
  // Success criteria:
  // ${capstone.successCriteria.map((c, i) => `${i+1}. ${c}`).join('\n')}
  // 
  // Decompose this into 8-20 discrete subskills. For each subskill, provide:
  // 1. title: Brief name (3-6 words)
  // 2. description: What this subskill enables (1-2 sentences)
  // 3. subskillType: One of:
  //    - "concepts" (facts, vocabulary, mental models to know)
  //    - "procedures" (step-by-step processes to execute)
  //    - "judgments" (decisions, diagnoses, pattern recognition)
  //    - "outputs" (artifacts to produce)
  //    - "tool_setup" (environment, tool configuration)
  //    - "tool_management" (resource organization, workflow)
  // 4. estimatedComplexity: 1 (simple), 2 (moderate), or 3 (complex)
  // 
  // Output as JSON array.
  // ```
  // ═══════════════════════════════════════════════════════════════════════════

  // STUB: Generate placeholder subskills based on capstone
  const subskills: Subskill[] = [
    // Concepts (recall)
    {
      id: generateId(),
      title: 'Core Terminology',
      description: 'Understand fundamental vocabulary and definitions used in the field.',
      subskillType: 'concepts',
      estimatedComplexity: 1,
    },
    {
      id: generateId(),
      title: 'Mental Models',
      description: 'Internalize key frameworks and ways of thinking about problems.',
      subskillType: 'concepts',
      estimatedComplexity: 2,
    },

    // Procedures (practice)
    {
      id: generateId(),
      title: 'Basic Operations',
      description: 'Execute fundamental procedures and operations correctly.',
      subskillType: 'procedures',
      estimatedComplexity: 1,
    },
    {
      id: generateId(),
      title: 'Standard Workflows',
      description: 'Follow established step-by-step workflows for common tasks.',
      subskillType: 'procedures',
      estimatedComplexity: 2,
    },
    {
      id: generateId(),
      title: 'Advanced Techniques',
      description: 'Apply sophisticated methods for complex scenarios.',
      subskillType: 'procedures',
      estimatedComplexity: 3,
    },

    // Judgments (diagnose)
    {
      id: generateId(),
      title: 'Problem Identification',
      description: 'Recognize when something is wrong and categorize the issue.',
      subskillType: 'judgments',
      estimatedComplexity: 2,
    },
    {
      id: generateId(),
      title: 'Solution Selection',
      description: 'Choose the appropriate approach for a given situation.',
      subskillType: 'judgments',
      estimatedComplexity: 2,
    },

    // Outputs (build)
    {
      id: generateId(),
      title: 'Small Deliverables',
      description: 'Create focused artifacts demonstrating specific skills.',
      subskillType: 'outputs',
      estimatedComplexity: 2,
    },
    {
      id: generateId(),
      title: 'Integration Project',
      description: 'Build a comprehensive project combining multiple skills.',
      subskillType: 'outputs',
      estimatedComplexity: 3,
    },

    // Tools (practice/plan)
    {
      id: generateId(),
      title: 'Environment Setup',
      description: 'Configure tools and environment for effective work.',
      subskillType: 'tool_setup',
      estimatedComplexity: 1,
    },
    {
      id: generateId(),
      title: 'Resource Management',
      description: 'Organize and manage learning resources and references.',
      subskillType: 'tool_management',
      estimatedComplexity: 1,
    },
  ];

  return { subskills };
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
  return `subskill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const SubskillsGenerator = {
  generate: generateSubskills,
  validate: validateSubskills,
  getDistribution: getTypeDistribution,
  estimateSessions: estimateTotalSessions,
  MIN_SUBSKILLS,
  MAX_SUBSKILLS,
};
