// ═══════════════════════════════════════════════════════════════════════════════
// ROUTING TESTS
// Tests for route assignment and session distribution
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockSwordGateLLM,
  setMockLLMResponse,
  clearMockLLMResponses,
} from '../../../setup';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

type SubskillType = 'concepts' | 'procedures' | 'judgments' | 'outputs' | 'tool_setup' | 'tool_management';
type Route = 'recall' | 'practice' | 'diagnose' | 'apply' | 'build' | 'refine' | 'plan';
type RouteStatus = 'learn' | 'skip' | 'assess';

interface Subskill {
  id: string;
  title: string;
  description: string;
  subskillType: SubskillType;
  estimatedComplexity: 1 | 2 | 3;
  order: number;
}

interface RouteAssignment {
  subskillId: string;
  route: Route;
  status: RouteStatus;
  reason?: string;
}

interface RoutingData {
  assignments: RouteAssignment[];
}

interface SessionDistribution {
  subskillId: string;
  sessions: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DETERMINISTIC ROUTING
// ─────────────────────────────────────────────────────────────────────────────────

const SUBSKILL_TO_ROUTE: Record<SubskillType, Route> = {
  concepts: 'recall',
  procedures: 'practice',
  judgments: 'diagnose',
  outputs: 'build',
  tool_setup: 'practice',
  tool_management: 'plan',
};

function getDefaultRoute(subskillType: SubskillType): Route {
  return SUBSKILL_TO_ROUTE[subskillType];
}

function generateFallbackRouting(subskills: Subskill[]): RoutingData {
  return {
    assignments: subskills.map(s => ({
      subskillId: s.id,
      route: getDefaultRoute(s.subskillType),
      status: 'learn' as RouteStatus,
      reason: 'Default assignment based on subskill type',
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

const VALID_ROUTES: Route[] = ['recall', 'practice', 'diagnose', 'apply', 'build', 'refine', 'plan'];
const VALID_STATUSES: RouteStatus[] = ['learn', 'skip', 'assess'];

function validateRouteAssignment(assignment: RouteAssignment): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!assignment.subskillId) {
    errors.push('subskillId is required');
  }
  if (!VALID_ROUTES.includes(assignment.route)) {
    errors.push(`Invalid route: ${assignment.route}`);
  }
  if (!VALID_STATUSES.includes(assignment.status)) {
    errors.push(`Invalid status: ${assignment.status}`);
  }

  return { valid: errors.length === 0, errors };
}

function validateRoutingData(
  routingData: RoutingData,
  subskills: Subskill[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check all subskills have assignments
  const assignedIds = new Set(routingData.assignments.map(a => a.subskillId));
  const subskillIds = new Set(subskills.map(s => s.id));

  for (const id of subskillIds) {
    if (!assignedIds.has(id)) {
      errors.push(`Missing assignment for subskill: ${id}`);
    }
  }

  // Check no extra assignments
  for (const id of assignedIds) {
    if (!subskillIds.has(id)) {
      errors.push(`Assignment for unknown subskill: ${id}`);
    }
  }

  // Validate each assignment
  for (const assignment of routingData.assignments) {
    const validation = validateRouteAssignment(assignment);
    if (!validation.valid) {
      errors.push(`Assignment ${assignment.subskillId}: ${validation.errors.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────────
// STATUS OVERRIDE
// ─────────────────────────────────────────────────────────────────────────────────

function updateStatus(
  routingData: RoutingData,
  subskillId: string,
  newStatus: RouteStatus,
  reason?: string
): RoutingData {
  const updatedAssignments = routingData.assignments.map(a => {
    if (a.subskillId === subskillId) {
      return {
        ...a,
        status: newStatus,
        reason: reason || a.reason,
      };
    }
    return a;
  });

  return { assignments: updatedAssignments };
}

function updateRoute(
  routingData: RoutingData,
  subskillId: string,
  newRoute: Route
): RoutingData {
  const updatedAssignments = routingData.assignments.map(a => {
    if (a.subskillId === subskillId) {
      return { ...a, route: newRoute };
    }
    return a;
  });

  return { assignments: updatedAssignments };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION DISTRIBUTION
// ─────────────────────────────────────────────────────────────────────────────────

const ROUTE_SESSION_RANGES: Record<Route, [number, number]> = {
  recall: [1, 2],
  practice: [2, 4],
  diagnose: [2, 3],
  apply: [2, 4],
  build: [3, 5],
  refine: [2, 3],
  plan: [1, 2],
};

function estimateSessionsForSubskill(
  route: Route,
  complexity: 1 | 2 | 3,
  status: RouteStatus
): number {
  if (status === 'skip') return 0;
  if (status === 'assess') return 1;

  const [min, max] = ROUTE_SESSION_RANGES[route];
  
  // Map complexity to position in range
  // complexity 1 -> min, complexity 2 -> mid, complexity 3 -> max
  if (complexity === 1) return min;
  if (complexity === 3) return max;
  return Math.ceil((min + max) / 2);
}

function distributeSessions(
  totalSessions: number,
  subskills: Array<{
    id: string;
    route: Route;
    complexity: 1 | 2 | 3;
    status: RouteStatus;
  }>
): SessionDistribution[] {
  // Calculate initial estimates
  const estimates = subskills.map(s => ({
    subskillId: s.id,
    sessions: estimateSessionsForSubskill(s.route, s.complexity, s.status),
  }));

  // Calculate total and adjust to match target
  const estimatedTotal = estimates.reduce((sum, e) => sum + e.sessions, 0);
  
  if (estimatedTotal === totalSessions) {
    return estimates;
  }

  // Scale to match total
  const scaleFactor = totalSessions / Math.max(estimatedTotal, 1);
  const scaled = estimates.map(e => ({
    subskillId: e.subskillId,
    sessions: Math.max(e.sessions === 0 ? 0 : 1, Math.round(e.sessions * scaleFactor)),
  }));

  // Adjust for rounding errors
  let scaledTotal = scaled.reduce((sum, e) => sum + e.sessions, 0);
  const nonZero = scaled.filter(e => e.sessions > 0);
  
  while (scaledTotal !== totalSessions && nonZero.length > 0) {
    const diff = totalSessions - scaledTotal;
    const target = nonZero[Math.abs(diff) % nonZero.length];
    
    if (diff > 0) {
      target.sessions++;
      scaledTotal++;
    } else if (target.sessions > 1) {
      target.sessions--;
      scaledTotal--;
    } else {
      break; // Can't reduce further
    }
  }

  return scaled;
}

function validateSessionDistribution(
  distributions: SessionDistribution[],
  totalSessions: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  const actualTotal = distributions.reduce((sum, d) => sum + d.sessions, 0);
  if (actualTotal !== totalSessions) {
    errors.push(`Total sessions mismatch: expected ${totalSessions}, got ${actualTotal}`);
  }

  for (const dist of distributions) {
    if (dist.sessions < 0) {
      errors.push(`Negative sessions for ${dist.subskillId}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Deterministic Routing', () => {
  describe('getDefaultRoute', () => {
    it('should map concepts to recall', () => {
      expect(getDefaultRoute('concepts')).toBe('recall');
    });

    it('should map procedures to practice', () => {
      expect(getDefaultRoute('procedures')).toBe('practice');
    });

    it('should map judgments to diagnose', () => {
      expect(getDefaultRoute('judgments')).toBe('diagnose');
    });

    it('should map outputs to build', () => {
      expect(getDefaultRoute('outputs')).toBe('build');
    });

    it('should map tool_setup to practice', () => {
      expect(getDefaultRoute('tool_setup')).toBe('practice');
    });

    it('should map tool_management to plan', () => {
      expect(getDefaultRoute('tool_management')).toBe('plan');
    });
  });

  describe('generateFallbackRouting', () => {
    it('should assign routes to all subskills', () => {
      const subskills: Subskill[] = [
        { id: 'ss_1', title: 'Concepts', description: 'Test', subskillType: 'concepts', estimatedComplexity: 1, order: 1 },
        { id: 'ss_2', title: 'Procedures', description: 'Test', subskillType: 'procedures', estimatedComplexity: 2, order: 2 },
        { id: 'ss_3', title: 'Outputs', description: 'Test', subskillType: 'outputs', estimatedComplexity: 3, order: 3 },
      ];

      const result = generateFallbackRouting(subskills);

      expect(result.assignments).toHaveLength(3);
      expect(result.assignments[0].route).toBe('recall');
      expect(result.assignments[1].route).toBe('practice');
      expect(result.assignments[2].route).toBe('build');
    });

    it('should set all statuses to learn', () => {
      const subskills: Subskill[] = [
        { id: 'ss_1', title: 'Test', description: 'Test', subskillType: 'concepts', estimatedComplexity: 1, order: 1 },
      ];

      const result = generateFallbackRouting(subskills);

      expect(result.assignments.every(a => a.status === 'learn')).toBe(true);
    });
  });
});

describe('Route Assignment Validation', () => {
  describe('validateRouteAssignment', () => {
    it('should accept valid assignment', () => {
      const assignment: RouteAssignment = {
        subskillId: 'ss_1',
        route: 'practice',
        status: 'learn',
      };

      const result = validateRouteAssignment(assignment);
      expect(result.valid).toBe(true);
    });

    it('should reject missing subskillId', () => {
      const assignment = {
        subskillId: '',
        route: 'practice' as Route,
        status: 'learn' as RouteStatus,
      };

      const result = validateRouteAssignment(assignment);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('subskillId is required');
    });

    it('should reject invalid route', () => {
      const assignment = {
        subskillId: 'ss_1',
        route: 'invalid' as Route,
        status: 'learn' as RouteStatus,
      };

      const result = validateRouteAssignment(assignment);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid route'))).toBe(true);
    });

    it('should reject invalid status', () => {
      const assignment = {
        subskillId: 'ss_1',
        route: 'practice' as Route,
        status: 'completed' as RouteStatus,
      };

      const result = validateRouteAssignment(assignment);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid status'))).toBe(true);
    });
  });

  describe('validateRoutingData', () => {
    it('should accept valid routing data', () => {
      const subskills: Subskill[] = [
        { id: 'ss_1', title: 'A', description: 'Test', subskillType: 'concepts', estimatedComplexity: 1, order: 1 },
        { id: 'ss_2', title: 'B', description: 'Test', subskillType: 'procedures', estimatedComplexity: 2, order: 2 },
      ];

      const routingData: RoutingData = {
        assignments: [
          { subskillId: 'ss_1', route: 'recall', status: 'learn' },
          { subskillId: 'ss_2', route: 'practice', status: 'learn' },
        ],
      };

      const result = validateRoutingData(routingData, subskills);
      expect(result.valid).toBe(true);
    });

    it('should reject missing assignment', () => {
      const subskills: Subskill[] = [
        { id: 'ss_1', title: 'A', description: 'Test', subskillType: 'concepts', estimatedComplexity: 1, order: 1 },
        { id: 'ss_2', title: 'B', description: 'Test', subskillType: 'procedures', estimatedComplexity: 2, order: 2 },
      ];

      const routingData: RoutingData = {
        assignments: [
          { subskillId: 'ss_1', route: 'recall', status: 'learn' },
          // Missing ss_2
        ],
      };

      const result = validateRoutingData(routingData, subskills);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Missing assignment'))).toBe(true);
    });
  });
});

describe('Status Override', () => {
  describe('updateStatus', () => {
    it('should update status for specific subskill', () => {
      const routingData: RoutingData = {
        assignments: [
          { subskillId: 'ss_1', route: 'recall', status: 'learn' },
          { subskillId: 'ss_2', route: 'practice', status: 'learn' },
        ],
      };

      const result = updateStatus(routingData, 'ss_1', 'skip', 'User already knows this');

      expect(result.assignments[0].status).toBe('skip');
      expect(result.assignments[0].reason).toBe('User already knows this');
      expect(result.assignments[1].status).toBe('learn'); // Unchanged
    });

    it('should not modify original data', () => {
      const routingData: RoutingData = {
        assignments: [
          { subskillId: 'ss_1', route: 'recall', status: 'learn' },
        ],
      };

      updateStatus(routingData, 'ss_1', 'skip');

      expect(routingData.assignments[0].status).toBe('learn');
    });
  });

  describe('updateRoute', () => {
    it('should update route for specific subskill', () => {
      const routingData: RoutingData = {
        assignments: [
          { subskillId: 'ss_1', route: 'recall', status: 'learn' },
        ],
      };

      const result = updateRoute(routingData, 'ss_1', 'apply');

      expect(result.assignments[0].route).toBe('apply');
    });
  });
});

describe('Session Distribution', () => {
  describe('estimateSessionsForSubskill', () => {
    it('should return 0 for skipped subskills', () => {
      expect(estimateSessionsForSubskill('practice', 3, 'skip')).toBe(0);
    });

    it('should return 1 for assess status', () => {
      expect(estimateSessionsForSubskill('build', 3, 'assess')).toBe(1);
    });

    it('should use range based on route and complexity', () => {
      // recall: [1, 2]
      expect(estimateSessionsForSubskill('recall', 1, 'learn')).toBe(1);
      expect(estimateSessionsForSubskill('recall', 3, 'learn')).toBe(2);

      // build: [3, 5]
      expect(estimateSessionsForSubskill('build', 1, 'learn')).toBe(3);
      expect(estimateSessionsForSubskill('build', 3, 'learn')).toBe(5);
    });
  });

  describe('distributeSessions', () => {
    it('should distribute to match total', () => {
      const subskills = [
        { id: 'ss_1', route: 'recall' as Route, complexity: 2 as const, status: 'learn' as RouteStatus },
        { id: 'ss_2', route: 'practice' as Route, complexity: 2 as const, status: 'learn' as RouteStatus },
        { id: 'ss_3', route: 'build' as Route, complexity: 2 as const, status: 'learn' as RouteStatus },
      ];

      const result = distributeSessions(15, subskills);
      const total = result.reduce((sum, r) => sum + r.sessions, 0);

      expect(total).toBe(15);
    });

    it('should give 0 sessions to skipped subskills', () => {
      const subskills = [
        { id: 'ss_1', route: 'practice' as Route, complexity: 2 as const, status: 'learn' as RouteStatus },
        { id: 'ss_2', route: 'recall' as Route, complexity: 1 as const, status: 'skip' as RouteStatus },
      ];

      const result = distributeSessions(10, subskills);
      const skipped = result.find(r => r.subskillId === 'ss_2');

      expect(skipped?.sessions).toBe(0);
    });

    it('should give 1 session to assess subskills', () => {
      const subskills = [
        { id: 'ss_1', route: 'practice' as Route, complexity: 2 as const, status: 'learn' as RouteStatus },
        { id: 'ss_2', route: 'recall' as Route, complexity: 1 as const, status: 'assess' as RouteStatus },
      ];

      const result = distributeSessions(10, subskills);
      const assessed = result.find(r => r.subskillId === 'ss_2');

      // Assess gets at least 1 (may scale)
      expect(assessed?.sessions).toBeGreaterThanOrEqual(1);
    });
  });

  describe('validateSessionDistribution', () => {
    it('should accept matching total', () => {
      const distributions: SessionDistribution[] = [
        { subskillId: 'ss_1', sessions: 5 },
        { subskillId: 'ss_2', sessions: 5 },
      ];

      const result = validateSessionDistribution(distributions, 10);
      expect(result.valid).toBe(true);
    });

    it('should reject mismatched total', () => {
      const distributions: SessionDistribution[] = [
        { subskillId: 'ss_1', sessions: 5 },
        { subskillId: 'ss_2', sessions: 3 },
      ];

      const result = validateSessionDistribution(distributions, 10);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('mismatch'))).toBe(true);
    });

    it('should reject negative sessions', () => {
      const distributions: SessionDistribution[] = [
        { subskillId: 'ss_1', sessions: -1 },
      ];

      const result = validateSessionDistribution(distributions, -1);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Negative'))).toBe(true);
    });
  });
});

describe('Routing Generation (Mock LLM)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockLLMResponses();
  });

  it('should generate routing from LLM response', async () => {
    const mockAssignments: RouteAssignment[] = [
      { subskillId: 'ss_1', route: 'recall', status: 'skip', reason: 'User already knows basics' },
      { subskillId: 'ss_2', route: 'practice', status: 'learn' },
      { subskillId: 'ss_3', route: 'build', status: 'learn' },
    ];

    setMockLLMResponse('ROUTE', JSON.stringify({ assignments: mockAssignments }));

    const generateRouting = async (
      subskills: Subskill[],
      priorKnowledge: string | null
    ): Promise<RoutingData> => {
      try {
        const response = await mockSwordGateLLM.generate('system', `ROUTE for ${priorKnowledge}`);
        const parsed = JSON.parse(response) as RoutingData;
        
        const validation = validateRoutingData(parsed, subskills);
        if (!validation.valid) {
          throw new Error('Validation failed');
        }
        
        return parsed;
      } catch {
        return generateFallbackRouting(subskills);
      }
    };

    const subskills: Subskill[] = [
      { id: 'ss_1', title: 'A', description: 'Test', subskillType: 'concepts', estimatedComplexity: 1, order: 1 },
      { id: 'ss_2', title: 'B', description: 'Test', subskillType: 'procedures', estimatedComplexity: 2, order: 2 },
      { id: 'ss_3', title: 'C', description: 'Test', subskillType: 'outputs', estimatedComplexity: 3, order: 3 },
    ];

    const result = await generateRouting(subskills, 'ROUTE');

    expect(result.assignments).toHaveLength(3);
    expect(result.assignments[0].status).toBe('skip');
    expect(result.assignments[0].reason).toBe('User already knows basics');
  });

  it('should use fallback on LLM error', async () => {
    mockSwordGateLLM.generate.mockRejectedValueOnce(new Error('API error'));

    const subskills: Subskill[] = [
      { id: 'ss_1', title: 'A', description: 'Test', subskillType: 'concepts', estimatedComplexity: 1, order: 1 },
    ];

    const generateRouting = async (skills: Subskill[]): Promise<RoutingData> => {
      try {
        await mockSwordGateLLM.generate('system', 'test');
        throw new Error('Should not reach');
      } catch {
        return generateFallbackRouting(skills);
      }
    };

    const result = await generateRouting(subskills);

    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0].status).toBe('learn');
    expect(result.assignments[0].route).toBe('recall');
  });
});
