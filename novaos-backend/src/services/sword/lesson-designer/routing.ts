// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE ASSIGNMENT
// Phase 2c: Assign routes + learn/skip/assess status via LLM
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  DesignerSession,
  SubskillsData,
  RoutingData,
  Subskill,
  SubskillType,
  Route,
  RouteStatus,
} from '../types.js';
import { SUBSKILL_TO_ROUTE } from '../types.js';
import { updateSessionPhase, updatePhaseData } from './session.js';
import { SwordGateLLM } from '../llm/swordgate-llm.js';
import {
  ROUTING_SYSTEM_PROMPT,
  buildRoutingUserMessage,
  parseLLMJson,
  type RoutingOutput,
  type RouteAssignment,
} from '../llm/prompts/define-goal.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTING RULES (DETERMINISTIC FALLBACK)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Route assignment rules - NO AMBIGUITY
 * 
 * | Subskill Type     | Route    | Rationale                           |
 * |-------------------|----------|-------------------------------------|
 * | concepts          | recall   | Facts, vocab, definitions           |
 * | procedures        | practice | Step-by-step execution              |
 * | judgments         | diagnose | Recognize, classify, choose         |
 * | outputs           | build    | Create artifacts                    |
 * | tool_setup        | practice | Configure, install (procedural)     |
 * | tool_management   | plan     | Organize, select resources          |
 */
export function getRouteForSubskill(subskillType: SubskillType): Route {
  return SUBSKILL_TO_ROUTE[subskillType];
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN ROUTING FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Assign routes and status to all subskills via LLM
 */
export async function assignRoutes(
  session: DesignerSession
): Promise<RoutingData> {
  if (!session.subskillsData) {
    throw new Error('Subskills data required before route assignment');
  }

  const { subskills } = session.subskillsData;
  const priorKnowledge = session.explorationData?.priorKnowledge || null;
  const context = session.explorationData?.context || null;

  // Try LLM-based routing
  const routingData = await generateRoutingWithLLM(subskills, priorKnowledge, context);

  // Update session
  await updateSessionPhase(session.id, 'routing', routingData);

  return routingData;
}

/**
 * LLM-based routing generation
 */
async function generateRoutingWithLLM(
  subskills: Subskill[],
  priorKnowledge: string | null,
  context: string | null
): Promise<RoutingData> {
  const userMessage = buildRoutingUserMessage({
    subskills: subskills.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      subskillType: s.subskillType,
      estimatedComplexity: s.estimatedComplexity,
      order: s.order || 0,
    })),
    priorKnowledge,
    context,
  });

  console.log('[ROUTING] Generating with LLM...');

  const response = await SwordGateLLM.generate(
    ROUTING_SYSTEM_PROMPT,
    userMessage,
    { thinkingLevel: 'high' }
  );

  let parsed: RoutingOutput;
  try {
    parsed = parseLLMJson<RoutingOutput>(response);
  } catch (error) {
    console.error('[ROUTING] Failed to parse LLM response:', error);
    console.error('[ROUTING] Raw response:', response);
    // Fallback to deterministic routing
    return generateFallbackRouting(subskills);
  }

  // Validate structure
  if (!parsed.assignments?.length) {
    console.warn('[ROUTING] Empty response, using fallback');
    return generateFallbackRouting(subskills);
  }

  // Ensure all subskills have assignments
  const assignmentMap = new Map(
    parsed.assignments.map(a => [a.subskillId, a])
  );

  const assignments = subskills.map(subskill => {
    const existing = assignmentMap.get(subskill.id);
    if (existing) {
      return {
        subskillId: subskill.id,
        route: validateRoute(existing.route) || getRouteForSubskill(subskill.subskillType),
        status: validateStatus(existing.status) || 'learn',
        reason: existing.reason || 'LLM assigned',
      };
    }
    // Missing assignment - use fallback
    return {
      subskillId: subskill.id,
      route: getRouteForSubskill(subskill.subskillType),
      status: 'learn' as RouteStatus,
      reason: 'Default assignment',
    };
  });

  console.log(`[ROUTING] Generated ${assignments.length} assignments`);

  return { assignments };
}

/**
 * Validate route value
 */
function validateRoute(route: string): Route | null {
  const validRoutes: Route[] = ['recall', 'practice', 'diagnose', 'apply', 'build', 'refine', 'plan'];
  if (validRoutes.includes(route as Route)) {
    return route as Route;
  }
  return null;
}

/**
 * Validate status value
 */
function validateStatus(status: string): RouteStatus | null {
  const validStatuses: RouteStatus[] = ['learn', 'skip', 'assess'];
  if (validStatuses.includes(status as RouteStatus)) {
    return status as RouteStatus;
  }
  return null;
}

/**
 * Fallback routing when LLM fails - deterministic
 */
function generateFallbackRouting(subskills: Subskill[]): RoutingData {
  const assignments = subskills.map(subskill => ({
    subskillId: subskill.id,
    route: getRouteForSubskill(subskill.subskillType),
    status: 'learn' as RouteStatus,
    reason: 'Default assignment based on subskill type',
  }));

  return { assignments };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REGENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Regenerate routing with optional guidance
 */
export async function regenerateRouting(
  session: DesignerSession,
  guidance?: string
): Promise<RoutingData> {
  if (!session.subskillsData) {
    throw new Error('Subskills data required');
  }

  const systemPrompt = guidance
    ? `${ROUTING_SYSTEM_PROMPT}\n\nADDITIONAL GUIDANCE: ${guidance}`
    : ROUTING_SYSTEM_PROMPT;

  const userMessage = buildRoutingUserMessage({
    subskills: session.subskillsData.subskills.map(s => ({
      id: s.id,
      title: s.title,
      description: s.description,
      subskillType: s.subskillType,
      estimatedComplexity: s.estimatedComplexity,
      order: s.order || 0,
    })),
    priorKnowledge: session.explorationData?.priorKnowledge || null,
    context: session.explorationData?.context || null,
  });

  console.log('[ROUTING] Regenerating with guidance...');

  const response = await SwordGateLLM.generate(
    systemPrompt,
    userMessage,
    { thinkingLevel: 'high' }
  );

  let parsed: RoutingOutput;
  try {
    parsed = parseLLMJson<RoutingOutput>(response);
  } catch (error) {
    console.error('[ROUTING] Failed to parse regeneration response:', error);
    throw new Error('Failed to regenerate routing');
  }

  // Ensure all subskills have assignments
  const assignmentMap = new Map(
    parsed.assignments.map(a => [a.subskillId, a])
  );

  const assignments = session.subskillsData.subskills.map(subskill => {
    const existing = assignmentMap.get(subskill.id);
    if (existing) {
      return {
        subskillId: subskill.id,
        route: validateRoute(existing.route) || getRouteForSubskill(subskill.subskillType),
        status: validateStatus(existing.status) || 'learn',
        reason: existing.reason || 'LLM assigned',
      };
    }
    return {
      subskillId: subskill.id,
      route: getRouteForSubskill(subskill.subskillType),
      status: 'learn' as RouteStatus,
      reason: 'Default assignment',
    };
  });

  const routingData: RoutingData = { assignments };
  await updatePhaseData(session.id, 'routing', routingData);

  return routingData;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MANUAL OVERRIDES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Override status for a single subskill
 */
export async function overrideStatus(
  session: DesignerSession,
  subskillId: string,
  status: RouteStatus,
  reason?: string
): Promise<RoutingData> {
  if (!session.routingData) {
    throw new Error('No routing data to update');
  }

  const assignments = session.routingData.assignments.map(a => {
    if (a.subskillId === subskillId) {
      return {
        ...a,
        status,
        reason: reason || `User set to ${status}`,
      };
    }
    return a;
  });

  const routingData: RoutingData = { assignments };
  await updatePhaseData(session.id, 'routing', routingData);
  return routingData;
}

/**
 * Override route for a single subskill
 */
export async function overrideRoute(
  session: DesignerSession,
  subskillId: string,
  route: Route,
  reason?: string
): Promise<RoutingData> {
  if (!session.routingData) {
    throw new Error('No routing data to update');
  }

  const assignments = session.routingData.assignments.map(a => {
    if (a.subskillId === subskillId) {
      return {
        ...a,
        route,
        reason: reason || `User changed route to ${route}`,
      };
    }
    return a;
  });

  const routingData: RoutingData = { assignments };
  await updatePhaseData(session.id, 'routing', routingData);
  return routingData;
}

/**
 * Set all subskills to "learn"
 */
export async function learnAll(session: DesignerSession): Promise<RoutingData> {
  if (!session.routingData) {
    throw new Error('No routing data to update');
  }

  const assignments = session.routingData.assignments.map(a => ({
    ...a,
    status: 'learn' as RouteStatus,
    reason: 'User set all to learn',
  }));

  const routingData: RoutingData = { assignments };
  await updatePhaseData(session.id, 'routing', routingData);
  return routingData;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate routing data
 */
export function validateRouting(
  routingData: RoutingData,
  subskills: Subskill[]
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check all subskills have assignments
  const assignedIds = new Set(routingData.assignments.map(a => a.subskillId));
  const missingAssignments = subskills.filter(s => !assignedIds.has(s.id));
  
  if (missingAssignments.length > 0) {
    issues.push(`Missing routing for ${missingAssignments.length} subskills`);
  }

  // Check for valid routes and statuses
  routingData.assignments.forEach(a => {
    if (!validateRoute(a.route)) {
      issues.push(`Invalid route "${a.route}" for subskill ${a.subskillId}`);
    }
    if (!validateStatus(a.status)) {
      issues.push(`Invalid status "${a.status}" for subskill ${a.subskillId}`);
    }
  });

  return { valid: issues.length === 0, issues };
}

/**
 * Get routing summary
 */
export function getRoutingSummary(routingData: RoutingData): {
  byStatus: Record<RouteStatus, number>;
  byRoute: Record<Route, number>;
} {
  const byStatus: Record<RouteStatus, number> = { learn: 0, skip: 0, assess: 0 };
  const byRoute: Record<Route, number> = {
    recall: 0, practice: 0, diagnose: 0, apply: 0, build: 0, refine: 0, plan: 0
  };

  for (const a of routingData.assignments) {
    byStatus[a.status]++;
    byRoute[a.route]++;
  }

  return { byStatus, byRoute };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get route distribution from subskills
 */
export function analyzeRouteDistribution(subskills: Subskill[]): {
  byRoute: Record<Route, number>;
  byType: Record<SubskillType, Route>;
  balance: 'good' | 'heavy_theory' | 'heavy_practice' | 'missing_variety';
} {
  const byRoute: Record<Route, number> = {
    recall: 0,
    practice: 0,
    diagnose: 0,
    apply: 0,
    build: 0,
    refine: 0,
    plan: 0,
  };

  const byType: Record<SubskillType, Route> = { ...SUBSKILL_TO_ROUTE };

  // Count routes
  subskills.forEach(subskill => {
    const route = getRouteForSubskill(subskill.subskillType);
    byRoute[route]++;
  });

  // Analyze balance
  const total = subskills.length;
  const theoryRoutes = byRoute.recall + byRoute.plan;
  const practiceRoutes = byRoute.practice + byRoute.diagnose + byRoute.apply;
  const createRoutes = byRoute.build + byRoute.refine;

  let balance: 'good' | 'heavy_theory' | 'heavy_practice' | 'missing_variety';

  if (theoryRoutes / total > 0.5) {
    balance = 'heavy_theory';
  } else if (practiceRoutes / total > 0.7) {
    balance = 'heavy_practice';
  } else if (createRoutes === 0) {
    balance = 'missing_variety';
  } else {
    balance = 'good';
  }

  return { byRoute, byType, balance };
}

/**
 * Get recommendations for improving route balance
 */
export function getBalanceRecommendations(
  analysis: ReturnType<typeof analyzeRouteDistribution>
): string[] {
  const recommendations: string[] = [];

  if (analysis.balance === 'heavy_theory') {
    recommendations.push('Consider adding more practical exercises or projects');
    recommendations.push('Include hands-on tasks to reinforce theoretical concepts');
  }

  if (analysis.balance === 'heavy_practice') {
    recommendations.push('Add foundational concept explanations');
    recommendations.push('Include reflective activities to deepen understanding');
  }

  if (analysis.balance === 'missing_variety') {
    recommendations.push('Add a capstone project to integrate learned skills');
    recommendations.push('Include refinement activities for quality improvement');
  }

  if (analysis.byRoute.diagnose === 0) {
    recommendations.push('Consider adding diagnostic exercises (spot errors, make choices)');
  }

  if (analysis.byRoute.apply === 0) {
    recommendations.push('Add application exercises to transfer knowledge to new contexts');
  }

  return recommendations;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTE DESCRIPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export const ROUTE_INFO: Record<Route, {
  name: string;
  description: string;
  verb: string;
  typicalOutputs: string[];
}> = {
  recall: {
    name: 'Recall',
    description: 'Remember and explain facts, vocabulary, and frameworks',
    verb: 'remember',
    typicalOutputs: ['Active-recall prompts', 'Short-answer quiz', 'Spaced review', 'Summary from memory'],
  },
  practice: {
    name: 'Practice',
    description: 'Execute procedures through repetition',
    verb: 'do',
    typicalOutputs: ['Worked examples', 'Guided problems', 'Independent problems', 'Immediate checking'],
  },
  diagnose: {
    name: 'Diagnose',
    description: 'Recognize patterns, debug issues, make judgments',
    verb: 'recognize',
    typicalOutputs: ['Classify examples', 'Spot-the-error', 'Compare/contrast', 'Confidence calibration'],
  },
  apply: {
    name: 'Apply',
    description: 'Transfer knowledge to new and unfamiliar contexts',
    verb: 'adapt',
    typicalOutputs: ['Novel problems', 'Case scenarios', 'Same concept, different surface', 'Constraint adaptation'],
  },
  build: {
    name: 'Build',
    description: 'Create artifacts that integrate multiple skills',
    verb: 'create',
    typicalOutputs: ['Mini-project spec', 'Milestones', 'Acceptance criteria', 'Demo/test'],
  },
  refine: {
    name: 'Refine',
    description: 'Improve quality through critique and revision',
    verb: 'improve',
    typicalOutputs: ['Rubric assessment', 'Exemplar comparisons', 'Revision passes', 'Before/after diffs'],
  },
  plan: {
    name: 'Plan',
    description: 'Map learning, review progress, adjust approach',
    verb: 'organize',
    typicalOutputs: ['Concept map', 'Prerequisite check', 'Study plan', 'Error-log analysis'],
  },
};

/**
 * Get human-readable info about a route
 */
export function getRouteInfo(route: Route) {
  return ROUTE_INFO[route];
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const RouteAssigner = {
  getRoute: getRouteForSubskill,
  assignAll: assignRoutes,
  regenerate: regenerateRouting,
  overrideStatus,
  overrideRoute,
  learnAll,
  validate: validateRouting,
  getSummary: getRoutingSummary,
  analyze: analyzeRouteDistribution,
  getRecommendations: getBalanceRecommendations,
  getInfo: getRouteInfo,
  ROUTE_INFO,
};

// Alias for backward compatibility
export { assignRoutes as generateRouting };

export const RoutingGenerator = {
  generate: assignRoutes,
  regenerate: regenerateRouting,
  overrideStatus,
  overrideRoute,
  learnAll,
  validate: validateRouting,
  getSummary: getRoutingSummary,
};
