// ═══════════════════════════════════════════════════════════════════════════════
// ROUTE ASSIGNMENT
// Phase 2c: Deterministic subskill-to-route mapping
// NO LLM REQUIRED - pure rules
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  DesignerSession,
  SubskillsData,
  RoutingData,
  Subskill,
  SubskillType,
  Route,
} from '../types.js';
import { SUBSKILL_TO_ROUTE } from '../types.js';
import { updateSessionPhase } from './session.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTING RULES (DETERMINISTIC)
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
 * Assign routes to all subskills
 * This is DETERMINISTIC - no LLM needed
 */
export async function assignRoutes(
  session: DesignerSession
): Promise<RoutingData> {
  if (!session.subskillsData) {
    throw new Error('Subskills data required before route assignment');
  }

  const { subskills } = session.subskillsData;

  // Map each subskill to its route
  const assignments = subskills.map(subskill => ({
    subskillId: subskill.id,
    route: getRouteForSubskill(subskill.subskillType),
  }));

  const routingData: RoutingData = { assignments };

  // Update session
  await updateSessionPhase(session.id, 'routing', routingData);

  return routingData;
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
  analyze: analyzeRouteDistribution,
  getRecommendations: getBalanceRecommendations,
  getInfo: getRouteInfo,
  ROUTE_INFO,
};
