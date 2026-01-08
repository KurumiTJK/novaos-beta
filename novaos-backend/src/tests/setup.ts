// ═══════════════════════════════════════════════════════════════════════════════
// TEST SETUP
// Global mocks and utilities for all tests
// ═══════════════════════════════════════════════════════════════════════════════

import { vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────────
// SUPABASE MOCK - Thenable Query Builder
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Creates a mock Supabase query that:
 * 1. Chains all methods (returns this)
 * 2. Is thenable (can be awaited without .single())
 * 3. Returns { data: defaultData, error: null } when awaited
 */
export function createMockSupabaseQuery(defaultData: any = null) {
  const query: any = {
    // CRUD operations
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),

    // Filters
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    containedBy: vi.fn().mockReturnThis(),
    overlaps: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    rangeGt: vi.fn().mockReturnThis(),
    rangeGte: vi.fn().mockReturnThis(),
    rangeLt: vi.fn().mockReturnThis(),
    rangeLte: vi.fn().mockReturnThis(),
    rangeAdjacent: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    match: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),

    // Modifiers
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    returns: vi.fn().mockReturnThis(),
    count: vi.fn().mockReturnThis(),

    // Terminators - these are mockable per-test
    single: vi.fn().mockResolvedValue({ data: defaultData, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: defaultData, error: null }),

    // Make query thenable (can be awaited directly)
    then: vi.fn().mockImplementation((resolve: any) => {
      return Promise.resolve({ data: defaultData, error: null }).then(resolve);
    }),
  };

  return query;
}

/**
 * Creates a mock Supabase client
 * Supports both old API (_mockQuery) and new table-based API
 */
export function createMockSupabaseClient() {
  // Create a shared mock query for backwards compatibility
  const sharedMockQuery = createMockSupabaseQuery();

  const client: any = {
    // Main entry point - returns the shared query or a table-specific one
    from: vi.fn().mockReturnValue(sharedMockQuery),

    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),

    // BACKWARDS COMPATIBILITY: _mockQuery for old tests
    _mockQuery: sharedMockQuery,

    // Helper to reset all mocks
    _reset: () => {
      vi.clearAllMocks();
      // Reset terminal methods to default
      sharedMockQuery.single.mockResolvedValue({ data: null, error: null });
      sharedMockQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
      sharedMockQuery.then.mockImplementation((resolve: any) => {
        return Promise.resolve({ data: [], error: null }).then(resolve);
      });
    },
  };

  return client;
}

// Global mock client
export const mockSupabaseClient = createMockSupabaseClient();

// Mock the db module - various import path patterns
const dbMock = {
  getSupabase: vi.fn(() => mockSupabaseClient),
  isSupabaseInitialized: vi.fn(() => true),
  initSupabase: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
};

vi.mock('@/db/index', () => dbMock);
vi.mock('@db/index', () => dbMock);
vi.mock('../db/index.js', () => dbMock);
vi.mock('../../db/index.js', () => dbMock);
vi.mock('../../../db/index.js', () => dbMock);
vi.mock('../../../../db/index.js', () => dbMock);

// ─────────────────────────────────────────────────────────────────────────────────
// SWORDGATE LLM MOCK
// ─────────────────────────────────────────────────────────────────────────────────

export const mockLLMResponses: Map<string, string> = new Map();

export function setMockLLMResponse(promptContains: string, response: string) {
  mockLLMResponses.set(promptContains, response);
}

export function clearMockLLMResponses() {
  mockLLMResponses.clear();
}

export const mockSwordGateLLM = {
  chat: vi.fn().mockImplementation(async (messages) => {
    const userMessage = messages.find((m: any) => m.role === 'user')?.content || '';
    
    for (const [key, value] of mockLLMResponses) {
      if (userMessage.toLowerCase().includes(key.toLowerCase())) {
        return { text: value, model: 'mock', thinkingLevel: 'high' };
      }
    }
    
    return { text: '{}', model: 'mock', thinkingLevel: 'high' };
  }),
  
  generate: vi.fn().mockImplementation(async (systemPrompt: string, userMessage: string) => {
    const combined = `${systemPrompt} ${userMessage}`.toLowerCase();
    
    for (const [key, value] of mockLLMResponses) {
      if (combined.includes(key.toLowerCase())) {
        return value;
      }
    }
    return '{}';
  }),
  
  converse: vi.fn().mockImplementation(async (systemPrompt: string, history: any[], newMessage: string) => {
    const combined = `${systemPrompt} ${newMessage}`.toLowerCase();
    
    for (const [key, value] of mockLLMResponses) {
      if (combined.includes(key.toLowerCase())) {
        return value;
      }
    }
    return 'Mock response';
  }),
  
  isAvailable: vi.fn().mockReturnValue(true),
  resetClient: vi.fn(),
};

const llmMock = {
  SwordGateLLM: mockSwordGateLLM,
  default: mockSwordGateLLM,
  isAvailable: vi.fn().mockReturnValue(true),
  resetClient: vi.fn(),
  chat: mockSwordGateLLM.chat,
  generate: mockSwordGateLLM.generate,
  converse: mockSwordGateLLM.converse,
};

vi.mock('../llm/swordgate-llm.js', () => llmMock);
vi.mock('../../llm/swordgate-llm.js', () => llmMock);
vi.mock('../../../llm/swordgate-llm.js', () => llmMock);
vi.mock('../../../../llm/swordgate-llm.js', () => llmMock);

// ─────────────────────────────────────────────────────────────────────────────────
// TEST UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

export function createTestUser(overrides: Partial<{
  id: string;
  externalId: string;
  email: string;
  tier: string;
}> = {}) {
  return {
    id: overrides.id || 'test-uuid-123',
    external_id: overrides.externalId || 'user_test123',
    email: overrides.email || 'test@example.com',
    tier: overrides.tier || 'free',
    created_at: new Date().toISOString(),
  };
}

export function createTestDesignerSession(overrides: Partial<{
  id: string;
  userId: string;
  visiblePhase: string;
  internalPhase: string;
  explorationData: any;
  capstoneData: any;
  subskillsData: any;
  routingData: any;
}> = {}) {
  return {
    id: overrides.id || 'session-uuid-123',
    user_id: overrides.userId || 'test-uuid-123',
    conversation_id: null,
    visible_phase: overrides.visiblePhase || 'exploration',
    internal_phase: overrides.internalPhase || 'exploration',
    exploration_data: overrides.explorationData || null,
    capstone_data: overrides.capstoneData || null,
    subskills_data: overrides.subskillsData || null,
    routing_data: overrides.routingData || null,
    nodes_data: null,
    sequencing_data: null,
    research_data: null,
    method_nodes_data: null,
    plan_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  };
}

export function createTestLessonPlan(overrides: Partial<{
  id: string;
  userId: string;
  title: string;
  status: string;
}> = {}) {
  return {
    id: overrides.id || 'plan-uuid-123',
    user_id: overrides.userId || 'test-uuid-123',
    title: overrides.title || 'Test Plan',
    description: null,
    capstone_statement: 'Test capstone statement',
    success_criteria: ['Criterion 1', 'Criterion 2'],
    difficulty: 'intermediate',
    daily_minutes: 30,
    weekly_cadence: 5,
    total_nodes: 10,
    total_sessions: 20,
    estimated_weeks: 4,
    total_subskills: 5,
    current_subskill_index: 0,
    estimated_sessions: 20,
    estimated_time_display: '4 weeks at 30 minutes per day',
    status: overrides.status || 'designing',
    progress: 0,
    sessions_completed: 0,
    sessions_since_method_node: 0,
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    abandoned_at: null,
  };
}

export function createTestSubskill(overrides: Partial<{
  id: string;
  title: string;
  subskillType: string;
  complexity: number;
  order: number;
}> = {}) {
  return {
    id: overrides.id || `ss_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    title: overrides.title || 'Test Subskill',
    description: 'Test description',
    subskillType: overrides.subskillType || 'procedures',
    estimatedComplexity: overrides.complexity || 2,
    order: overrides.order || 1,
  };
}

export function createTestPlanSubskill(overrides: Partial<{
  id: string;
  planId: string;
  title: string;
  subskillType: string;
  route: string;
  status: string;
  order: number;
  estimatedSessions: number;
  sessionsCompleted: number;
}> = {}) {
  return {
    id: overrides.id || 'subskill-uuid-123',
    plan_id: overrides.planId || 'plan-uuid-123',
    title: overrides.title || 'Test Subskill',
    description: 'Test description',
    subskill_type: overrides.subskillType || 'procedures',
    route: overrides.route || 'practice',
    complexity: 2,
    order: overrides.order ?? 1,
    status: overrides.status || 'pending',
    estimated_sessions: overrides.estimatedSessions ?? 3,
    sessions_completed: overrides.sessionsCompleted ?? 0,
    last_session_date: null,
    mastered_at: null,
    assessment_score: null,
    assessment_data: null,
    assessed_at: null,
    created_at: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON RUNNER FACTORIES (camelCase)
// ─────────────────────────────────────────────────────────────────────────────────

export function createTestSubskillLessonPlan(overrides: Partial<{
  id: string;
  subskillId: string;
  planId: string;
  learningObjectives: string[];
  sessionOutline: any[];
  isRemediationPlan: boolean;
}> = {}) {
  return {
    id: overrides.id || 'lesson-plan-uuid-123',
    subskillId: overrides.subskillId || 'subskill-uuid-123',
    planId: overrides.planId || 'plan-uuid-123',
    learningObjectives: overrides.learningObjectives || [
      'Understand the concept',
      'Apply in practice',
      'Demonstrate mastery',
    ],
    prerequisites: [],
    sessionOutline: overrides.sessionOutline || [
      { sessionNumber: 1, title: 'Introduction', focus: 'Learn basics', objectives: [], estimatedMinutes: 30 },
      { sessionNumber: 2, title: 'Practice', focus: 'Apply concepts', objectives: [], estimatedMinutes: 30 },
      { sessionNumber: 3, title: 'Knowledge Check', focus: 'Test mastery', objectives: [], estimatedMinutes: 30 },
    ],
    isRemediationPlan: overrides.isRemediationPlan || false,
    generatedAt: new Date().toISOString(),
    generationSource: 'llm',
  };
}

export function createTestDailyLesson(overrides: Partial<{
  id: string;
  subskillId: string;
  userId: string;
  sessionNumber: number;
  content: any;
  activities: any[];
}> = {}) {
  return {
    id: overrides.id || 'daily-lesson-uuid-123',
    subskillId: overrides.subskillId || 'subskill-uuid-123',
    userId: overrides.userId || 'user-uuid-123',
    sessionNumber: overrides.sessionNumber || 1,
    sessionGoal: 'Learn the basics',
    content: overrides.content || [
      { title: 'Introduction', content: 'Welcome to today\'s lesson', bulletPoints: [] },
    ],
    activities: overrides.activities || [
      { id: 'a1', type: 'read', title: 'Read Overview', estimatedMinutes: 10, explanation: 'Read this section' },
    ],
    keyPoints: ['Point 1', 'Point 2'],
    reflectionPrompt: 'What did you learn?',
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
}

export function createTestSessionSummary(overrides: Partial<{
  id: string;
  subskillId: string;
  userId: string;
  sessionNumber: number;
  summary: string;
  keyConcepts: string[];
}> = {}) {
  return {
    id: overrides.id || 'summary-uuid-123',
    subskillId: overrides.subskillId || 'subskill-uuid-123',
    userId: overrides.userId || 'user-uuid-123',
    sessionNumber: overrides.sessionNumber || 1,
    summary: overrides.summary || 'Completed session successfully',
    keyConcepts: overrides.keyConcepts || ['Concept 1', 'Concept 2'],
    createdAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  clearMockLLMResponses();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export { vi };
