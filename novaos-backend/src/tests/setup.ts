// ═══════════════════════════════════════════════════════════════════════════════
// TEST SETUP
// Global mocks and utilities for all tests
// ═══════════════════════════════════════════════════════════════════════════════

import { vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────────
// SUPABASE MOCK
// ─────────────────────────────────────────────────────────────────────────────────

export interface MockSupabaseQuery {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  is: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  rpc: ReturnType<typeof vi.fn>;
}

export function createMockSupabaseQuery(defaultData: any = null): MockSupabaseQuery {
  const query: MockSupabaseQuery = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: defaultData, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: defaultData, error: null }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  
  return query;
}

export function createMockSupabaseClient() {
  const mockQuery = createMockSupabaseQuery();
  
  return {
    from: vi.fn().mockReturnValue(mockQuery),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    _mockQuery: mockQuery,
  };
}

// Global mock client
export const mockSupabaseClient = createMockSupabaseClient();

// Mock the db module
vi.mock('@/db/index', () => ({
  getSupabase: vi.fn(() => mockSupabaseClient),
  isSupabaseInitialized: vi.fn(() => true),
  initSupabase: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../db/index.js', () => ({
  getSupabase: vi.fn(() => mockSupabaseClient),
  isSupabaseInitialized: vi.fn(() => true),
  initSupabase: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../../db/index.js', () => ({
  getSupabase: vi.fn(() => mockSupabaseClient),
  isSupabaseInitialized: vi.fn(() => true),
  initSupabase: vi.fn(),
  testConnection: vi.fn().mockResolvedValue(true),
}));

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
      if (userMessage.includes(key)) {
        return { text: value, model: 'mock', thinkingLevel: 'high' };
      }
    }
    
    return { text: '{}', model: 'mock', thinkingLevel: 'high' };
  }),
  
  generate: vi.fn().mockImplementation(async (systemPrompt, userMessage) => {
    for (const [key, value] of mockLLMResponses) {
      if (userMessage.includes(key) || systemPrompt.includes(key)) {
        return value;
      }
    }
    return '{}';
  }),
  
  converse: vi.fn().mockImplementation(async (systemPrompt, history, newMessage) => {
    for (const [key, value] of mockLLMResponses) {
      if (newMessage.includes(key)) {
        return value;
      }
    }
    return 'Mock response';
  }),
  
  isAvailable: vi.fn().mockReturnValue(true),
  resetClient: vi.fn(),
};

vi.mock('../llm/swordgate-llm.js', () => ({
  SwordGateLLM: mockSwordGateLLM,
  default: mockSwordGateLLM,
  isAvailable: vi.fn().mockReturnValue(true),
  resetClient: vi.fn(),
  chat: mockSwordGateLLM.chat,
  generate: mockSwordGateLLM.generate,
  converse: mockSwordGateLLM.converse,
}));

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
}> = {}) {
  return {
    id: overrides.id || 'subskill-uuid-123',
    plan_id: overrides.planId || 'plan-uuid-123',
    title: overrides.title || 'Test Subskill',
    description: 'Test description',
    subskill_type: overrides.subskillType || 'procedures',
    route: overrides.route || 'practice',
    complexity: 2,
    order: 1,
    status: overrides.status || 'pending',
    estimated_sessions: 3,
    sessions_completed: 0,
    last_session_date: null,
    mastered_at: null,
    assessment_score: null,
    assessment_data: null,
    assessed_at: null,
    created_at: new Date().toISOString(),
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
