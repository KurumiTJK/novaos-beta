// ═══════════════════════════════════════════════════════════════════════════════
// REFRESH HANDLER TESTS
// Tests for 7+ day gap detection and refresh content generation
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockSupabaseClient,
  createMockSupabaseQuery,
  setMockLLMResponse,
  createTestUser,
  createTestLessonPlan,
  createTestPlanSubskill,
  mockSwordGateLLM,
  createTestSessionSummary,
} from './setup';

// Import the module under test
import { RefreshHandler } from '@services/sword/lesson-runner/refresh/handler';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────────────────────────────────

const testUser = createTestUser({ id: 'user-123', externalId: 'user_ext_123' });

const testPlan = createTestLessonPlan({
  id: 'plan-123',
  userId: 'user-123',
  title: 'Learn TypeScript',
});

// Subskill with recent activity (no refresh needed)
const recentSubskill = createTestPlanSubskill({
  id: 'subskill-recent',
  planId: 'plan-123',
  title: 'TypeScript Generics',
  route: 'recall',
  status: 'active',
});
// Override last_session_date to be recent
const recentSubskillWithDate = {
  ...recentSubskill,
  last_session_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
};

// Subskill with old activity (refresh needed)
const staleSubskillWithDate = {
  ...recentSubskill,
  id: 'subskill-stale',
  last_session_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
};

const mockRefreshContent = {
  summary: 'Welcome back! Let\'s refresh what you learned about TypeScript Generics.',
  recallQuestions: [
    'What syntax is used for generic types?',
    'How do you constrain a generic type?',
    'What happens to generic types at runtime?',
  ],
  quickTips: [
    'Remember: <T> declares a type parameter',
    'Use extends to add constraints',
  ],
  estimatedMinutes: 5,
};

// ─────────────────────────────────────────────────────────────────────────────────
// CHECK NEEDS REFRESH TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RefreshHandler.check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return needsRefresh=false for recent activity (< 7 days)', async () => {
    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: testUser, error: null })
      .mockResolvedValueOnce({ data: recentSubskillWithDate, error: null });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    const result = await RefreshHandler.check('user_ext_123', 'subskill-recent');

    expect(result.needsRefresh).toBe(false);
    expect(result.gapDays).toBeLessThan(7);
  });

  it('should return needsRefresh=true for stale activity (>= 7 days)', async () => {
    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: testUser, error: null })
      .mockResolvedValueOnce({ data: staleSubskillWithDate, error: null });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    const result = await RefreshHandler.check('user_ext_123', 'subskill-stale');

    expect(result.needsRefresh).toBe(true);
    expect(result.gapDays).toBeGreaterThanOrEqual(7);
  });

  it('should return needsRefresh=false for no last_session_date', async () => {
    const noDateSubskill = { ...recentSubskill, last_session_date: null };
    
    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: testUser, error: null })
      .mockResolvedValueOnce({ data: noDateSubskill, error: null });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    const result = await RefreshHandler.check('user_ext_123', 'subskill-no-date');

    expect(result.needsRefresh).toBe(false);
    expect(result.gapDays).toBe(0);
  });

  it('should return needsRefresh=false for user not found', async () => {
    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    const result = await RefreshHandler.check('nonexistent', 'subskill-123');

    expect(result.needsRefresh).toBe(false);
  });

  it('should calculate exact gap days correctly', async () => {
    // Create subskill with exactly 7 days gap
    const exactlySevenDays = {
      ...recentSubskill,
      last_session_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: testUser, error: null })
      .mockResolvedValueOnce({ data: exactlySevenDays, error: null });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    const result = await RefreshHandler.check('user_ext_123', 'subskill-123');

    expect(result.needsRefresh).toBe(true);
    expect(result.gapDays).toBe(7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// GENERATE REFRESH CONTENT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RefreshHandler.generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate refresh content with LLM', async () => {
    const summaries = [
      createTestSessionSummary({ sessionNumber: 1, summary: 'Learned generic syntax', keyConcepts: ['<T>', 'Type inference'] }),
      createTestSessionSummary({ sessionNumber: 2, summary: 'Practiced constraints', keyConcepts: ['extends', 'keyof'] }),
    ];

    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: testUser, error: null })
      .mockResolvedValueOnce({ data: staleSubskillWithDate, error: null })
      .mockResolvedValueOnce({ data: testPlan, error: null });

    // Summaries query
    mockQuery.order.mockReturnThis();
    mockQuery.limit.mockReturnThis();

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    setMockLLMResponse('refresh content', JSON.stringify(mockRefreshContent));

    const result = await RefreshHandler.generate('user_ext_123', 'subskill-stale');

    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.recallQuestions.length).toBeGreaterThan(0);
    expect(result.estimatedMinutes).toBeLessThanOrEqual(10);
  });

  it('should use fallback when LLM fails', async () => {
    const summaries = [
      createTestSessionSummary({ sessionNumber: 1, summary: 'Learned basics', keyConcepts: ['Generics', 'Types'] }),
    ];

    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: testUser, error: null })
      .mockResolvedValueOnce({ data: staleSubskillWithDate, error: null })
      .mockResolvedValueOnce({ data: testPlan, error: null });

    mockQuery.order.mockReturnThis();
    mockQuery.limit.mockReturnThis();

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    // LLM fails
    mockSwordGateLLM.generate.mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await RefreshHandler.generate('user_ext_123', 'subskill-stale');

    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.recallQuestions.length).toBeGreaterThan(0);
  });

  it('should include previous session summaries', async () => {
    const summaries = [
      createTestSessionSummary({ sessionNumber: 1, summary: 'Session 1 summary' }),
      createTestSessionSummary({ sessionNumber: 2, summary: 'Session 2 summary' }),
    ];

    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: testUser, error: null })
      .mockResolvedValueOnce({ data: staleSubskillWithDate, error: null })
      .mockResolvedValueOnce({ data: testPlan, error: null });

    mockQuery.order.mockReturnThis();
    mockQuery.limit.mockReturnThis();

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    setMockLLMResponse('refresh content', JSON.stringify(mockRefreshContent));

    const result = await RefreshHandler.generate('user_ext_123', 'subskill-stale');

    expect(result.previousSessionsSummary).toBeDefined();
  });

  it('should limit to 5 recall questions', async () => {
    const manyQuestions = {
      ...mockRefreshContent,
      recallQuestions: [
        'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', 'Q7', 'Q8',
      ],
    };

    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: testUser, error: null })
      .mockResolvedValueOnce({ data: staleSubskillWithDate, error: null })
      .mockResolvedValueOnce({ data: testPlan, error: null });

    mockQuery.order.mockReturnThis();
    mockQuery.limit.mockReturnThis();

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    setMockLLMResponse('refresh content', JSON.stringify(manyQuestions));

    const result = await RefreshHandler.generate('user_ext_123', 'subskill-stale');

    expect(result.recallQuestions.length).toBeLessThanOrEqual(5);
  });

  it('should throw error for user not found', async () => {
    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    await expect(
      RefreshHandler.generate('nonexistent', 'subskill-123')
    ).rejects.toThrow('User not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SKIP REFRESH TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RefreshHandler.skip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should allow skipping refresh without error', async () => {
    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single.mockResolvedValueOnce({ data: testUser, error: null });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    // Should not throw
    await expect(
      RefreshHandler.skip('user_ext_123', 'subskill-123')
    ).resolves.not.toThrow();
  });

  it('should handle user not found gracefully', async () => {
    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    // Should not throw even if user not found
    await expect(
      RefreshHandler.skip('nonexistent', 'subskill-123')
    ).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// COMPLETE REFRESH TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RefreshHandler.complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should update last_session_date on complete', async () => {
    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: testUser, error: null })
      .mockResolvedValueOnce({ data: staleSubskillWithDate, error: null });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    await RefreshHandler.complete('user_ext_123', 'subskill-stale');

    // Verify update was called on plan_subskills
    expect(mockSupabaseClient.from).toHaveBeenCalledWith('plan_subskills');
  });

  it('should handle user not found gracefully', async () => {
    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    await expect(
      RefreshHandler.complete('nonexistent', 'subskill-123')
    ).resolves.not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// GAP DAYS CONSTANT TEST
// ─────────────────────────────────────────────────────────────────────────────────

describe('RefreshHandler.GAP_DAYS', () => {
  it('should have correct gap threshold value', () => {
    expect(RefreshHandler.GAP_DAYS).toBe(7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// FALLBACK CONTENT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Refresh Fallback Content', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should generate encouraging message for long gaps (14+ days)', async () => {
    const veryStaleSubskill = {
      ...recentSubskill,
      last_session_date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 days
    };

    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: testUser, error: null })
      .mockResolvedValueOnce({ data: veryStaleSubskill, error: null })
      .mockResolvedValueOnce({ data: testPlan, error: null });

    mockQuery.order.mockReturnThis();
    mockQuery.limit.mockReturnThis();

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    // LLM fails, use fallback
    mockSwordGateLLM.generate.mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await RefreshHandler.generate('user_ext_123', 'subskill-stale');

    expect(result.summary.toLowerCase()).toContain('welcome back');
  });

  it('should include quick tips in fallback', async () => {
    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: testUser, error: null })
      .mockResolvedValueOnce({ data: staleSubskillWithDate, error: null })
      .mockResolvedValueOnce({ data: testPlan, error: null });

    mockQuery.order.mockReturnThis();
    mockQuery.limit.mockReturnThis();

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    mockSwordGateLLM.generate.mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await RefreshHandler.generate('user_ext_123', 'subskill-stale');

    expect(result.quickTips).toBeDefined();
    expect(result.quickTips?.length).toBeGreaterThan(0);
  });
});
