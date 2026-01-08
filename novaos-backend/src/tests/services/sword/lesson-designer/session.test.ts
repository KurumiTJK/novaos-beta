// ═══════════════════════════════════════════════════════════════════════════════
// DESIGNER SESSION TESTS
// Tests for session CRUD and phase management
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockSupabaseClient,
  createTestUser,
  createTestDesignerSession,
} from '../../../setup';

// ─────────────────────────────────────────────────────────────────────────────────
// PHASE CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const PHASE_MAPPING = {
  exploration: 'exploration',
  capstone: 'define_goal',
  subskills: 'define_goal',
  routing: 'define_goal',
  review: 'review',
} as const;

const INTERNAL_PHASE_ORDER = [
  'exploration',
  'capstone',
  'subskills',
  'routing',
  'review',
] as const;

type InternalPhase = typeof INTERNAL_PHASE_ORDER[number];
type VisiblePhase = 'exploration' | 'define_goal' | 'review';

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION HELPERS (mirroring session.ts)
// ─────────────────────────────────────────────────────────────────────────────────

function isValidPhaseTransition(
  currentPhase: InternalPhase,
  targetPhase: InternalPhase
): boolean {
  const currentIndex = INTERNAL_PHASE_ORDER.indexOf(currentPhase);
  const targetIndex = INTERNAL_PHASE_ORDER.indexOf(targetPhase);
  return targetIndex === currentIndex || targetIndex === currentIndex + 1;
}

function getNextInternalPhase(currentPhase: InternalPhase): InternalPhase | null {
  const index = INTERNAL_PHASE_ORDER.indexOf(currentPhase);
  if (index < 0 || index >= INTERNAL_PHASE_ORDER.length - 1) {
    return null;
  }
  return INTERNAL_PHASE_ORDER[index + 1] ?? null;
}

function getPhaseRequirements(phase: InternalPhase): string[] {
  switch (phase) {
    case 'exploration':
      return [];
    case 'capstone':
      return ['exploration_data'];
    case 'subskills':
      return ['capstone_data'];
    case 'routing':
      return ['subskills_data'];
    case 'review':
      return ['routing_data'];
    default:
      return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Phase Mapping', () => {
  it('should map exploration to exploration', () => {
    expect(PHASE_MAPPING.exploration).toBe('exploration');
  });

  it('should map capstone, subskills, routing to define_goal', () => {
    expect(PHASE_MAPPING.capstone).toBe('define_goal');
    expect(PHASE_MAPPING.subskills).toBe('define_goal');
    expect(PHASE_MAPPING.routing).toBe('define_goal');
  });

  it('should map review to review', () => {
    expect(PHASE_MAPPING.review).toBe('review');
  });
});

describe('isValidPhaseTransition', () => {
  it('should allow staying at current phase', () => {
    expect(isValidPhaseTransition('exploration', 'exploration')).toBe(true);
    expect(isValidPhaseTransition('capstone', 'capstone')).toBe(true);
    expect(isValidPhaseTransition('review', 'review')).toBe(true);
  });

  it('should allow moving to next phase', () => {
    expect(isValidPhaseTransition('exploration', 'capstone')).toBe(true);
    expect(isValidPhaseTransition('capstone', 'subskills')).toBe(true);
    expect(isValidPhaseTransition('subskills', 'routing')).toBe(true);
    expect(isValidPhaseTransition('routing', 'review')).toBe(true);
  });

  it('should reject skipping phases', () => {
    expect(isValidPhaseTransition('exploration', 'subskills')).toBe(false);
    expect(isValidPhaseTransition('exploration', 'routing')).toBe(false);
    expect(isValidPhaseTransition('capstone', 'review')).toBe(false);
  });

  it('should reject moving backwards', () => {
    expect(isValidPhaseTransition('capstone', 'exploration')).toBe(false);
    expect(isValidPhaseTransition('routing', 'subskills')).toBe(false);
    expect(isValidPhaseTransition('review', 'exploration')).toBe(false);
  });
});

describe('getNextInternalPhase', () => {
  it('should return next phase for each phase', () => {
    expect(getNextInternalPhase('exploration')).toBe('capstone');
    expect(getNextInternalPhase('capstone')).toBe('subskills');
    expect(getNextInternalPhase('subskills')).toBe('routing');
    expect(getNextInternalPhase('routing')).toBe('review');
  });

  it('should return null for final phase', () => {
    expect(getNextInternalPhase('review')).toBeNull();
  });
});

describe('getPhaseRequirements', () => {
  it('should return empty for exploration', () => {
    expect(getPhaseRequirements('exploration')).toEqual([]);
  });

  it('should require exploration_data for capstone', () => {
    expect(getPhaseRequirements('capstone')).toEqual(['exploration_data']);
  });

  it('should require capstone_data for subskills', () => {
    expect(getPhaseRequirements('subskills')).toEqual(['capstone_data']);
  });

  it('should require subskills_data for routing', () => {
    expect(getPhaseRequirements('routing')).toEqual(['subskills_data']);
  });

  it('should require routing_data for review', () => {
    expect(getPhaseRequirements('review')).toEqual(['routing_data']);
  });
});

describe('Session CRUD (Mock)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveSession', () => {
    it('should return null when no active session', async () => {
      mockSupabaseClient._mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const mockGetActive = async (userId: string) => {
        const { data, error } = await mockSupabaseClient
          .from('designer_sessions')
          .select('*')
          .eq('user_id', userId)
          .is('completed_at', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (error?.code === 'PGRST116' || !data) return null;
        return data;
      };

      const result = await mockGetActive('user_123');
      expect(result).toBeNull();
    });

    it('should return session when exists', async () => {
      const testSession = createTestDesignerSession({
        id: 'session-123',
        userId: 'user-456',
        visiblePhase: 'exploration',
        internalPhase: 'exploration',
      });

      mockSupabaseClient._mockQuery.single.mockResolvedValueOnce({
        data: testSession,
        error: null,
      });

      const mockGetActive = async () => {
        const { data, error } = await mockSupabaseClient
          .from('designer_sessions')
          .select('*')
          .single();

        if (error || !data) return null;
        return data;
      };

      const result = await mockGetActive();
      expect(result).not.toBeNull();
      expect(result.id).toBe('session-123');
    });
  });

  describe('startSession', () => {
    it('should create new session', async () => {
      const newSession = createTestDesignerSession({
        id: 'new-session-123',
        visiblePhase: 'exploration',
        internalPhase: 'exploration',
      });

      mockSupabaseClient._mockQuery.single.mockResolvedValueOnce({
        data: newSession,
        error: null,
      });

      const mockStart = async (userId: string, topic?: string) => {
        const explorationData = topic ? { learningGoal: topic, readyForCapstone: true } : null;

        const { data, error } = await mockSupabaseClient
          .from('designer_sessions')
          .insert({
            user_id: userId,
            visible_phase: 'exploration',
            internal_phase: 'exploration',
            exploration_data: explorationData,
          })
          .select()
          .single();

        if (error) throw new Error(error.message);
        return data;
      };

      const result = await mockStart('user_123', 'Python');
      expect(result).not.toBeNull();
      expect(result.visible_phase).toBe('exploration');
    });

    it('should include topic in exploration_data if provided', async () => {
      const mockInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: createTestDesignerSession({
              explorationData: { learningGoal: 'Python', readyForCapstone: true },
            }),
            error: null,
          }),
        }),
      });

      const mockClient = { from: vi.fn().mockReturnValue({ insert: mockInsert }) };

      const topic = 'Python';
      const explorationData = { learningGoal: topic, readyForCapstone: true };

      await mockClient.from('designer_sessions').insert({
        user_id: 'user_123',
        exploration_data: explorationData,
      }).select().single();

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          exploration_data: { learningGoal: 'Python', readyForCapstone: true },
        })
      );
    });
  });

  describe('updateSessionPhase', () => {
    it('should update phase and data', async () => {
      const updatedSession = createTestDesignerSession({
        internalPhase: 'capstone',
        visiblePhase: 'define_goal',
        capstoneData: { title: 'Test Capstone' },
      });

      mockSupabaseClient._mockQuery.single.mockResolvedValueOnce({
        data: updatedSession,
        error: null,
      });

      const mockUpdate = async (sessionId: string, phase: string, data: any) => {
        const { data: result, error } = await mockSupabaseClient
          .from('designer_sessions')
          .update({
            internal_phase: phase,
            visible_phase: PHASE_MAPPING[phase as InternalPhase],
            capstone_data: data,
          })
          .eq('id', sessionId)
          .select()
          .single();

        if (error) throw new Error(error.message);
        return result;
      };

      const result = await mockUpdate('session-123', 'capstone', { title: 'Test' });
      expect(result.internal_phase).toBe('capstone');
      expect(result.visible_phase).toBe('define_goal');
    });
  });

  describe('cancelSession', () => {
    it('should delete active session', async () => {
      const mockDelete = vi.fn().mockResolvedValue({ error: null, count: 1 });
      
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            is: mockDelete,
          }),
        }),
      });

      await mockSupabaseClient
        .from('designer_sessions')
        .delete()
        .eq('user_id', 'user-123')
        .is('completed_at', null);

      expect(mockDelete).toHaveBeenCalled();
    });
  });
});

describe('Session Phase Progression', () => {
  it('should follow correct progression path', () => {
    const phases: InternalPhase[] = [];
    let currentPhase: InternalPhase | null = 'exploration';

    while (currentPhase) {
      phases.push(currentPhase);
      currentPhase = getNextInternalPhase(currentPhase);
    }

    expect(phases).toEqual([
      'exploration',
      'capstone',
      'subskills',
      'routing',
      'review',
    ]);
  });

  it('should have valid transitions for entire path', () => {
    for (let i = 0; i < INTERNAL_PHASE_ORDER.length - 1; i++) {
      const current = INTERNAL_PHASE_ORDER[i];
      const next = INTERNAL_PHASE_ORDER[i + 1];
      expect(isValidPhaseTransition(current, next)).toBe(true);
    }
  });
});

describe('Visible Phase Info', () => {
  const VISIBLE_PHASE_ORDER = ['exploration', 'define_goal', 'review'] as const;

  const getVisiblePhaseInfo = (visiblePhase: VisiblePhase) => {
    const stepNumber = VISIBLE_PHASE_ORDER.indexOf(visiblePhase) + 1;

    const info: Record<VisiblePhase, { title: string; description: string }> = {
      exploration: {
        title: 'Exploration',
        description: 'Tell me what you want to learn',
      },
      define_goal: {
        title: 'Define Goal',
        description: "Let's define what success looks like",
      },
      review: {
        title: 'Review',
        description: "Here's your personalized learning plan",
      },
    };

    return {
      ...info[visiblePhase],
      stepNumber,
      totalSteps: VISIBLE_PHASE_ORDER.length,
    };
  };

  it('should return correct info for exploration', () => {
    const info = getVisiblePhaseInfo('exploration');
    expect(info.title).toBe('Exploration');
    expect(info.stepNumber).toBe(1);
    expect(info.totalSteps).toBe(3);
  });

  it('should return correct info for define_goal', () => {
    const info = getVisiblePhaseInfo('define_goal');
    expect(info.title).toBe('Define Goal');
    expect(info.stepNumber).toBe(2);
  });

  it('should return correct info for review', () => {
    const info = getVisiblePhaseInfo('review');
    expect(info.title).toBe('Review');
    expect(info.stepNumber).toBe(3);
  });
});
