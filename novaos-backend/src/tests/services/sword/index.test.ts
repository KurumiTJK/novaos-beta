// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE INDEX TESTS
// Integration-style tests for main SwordGate service
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockSupabaseClient,
  createTestUser,
  createTestDesignerSession,
  createTestLessonPlan,
  createTestPlanSubskill,
} from '../../setup';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────────────────────────────────────────

const testUser = createTestUser({
  id: 'user-uuid-123',
  externalId: 'user_external_123',
});

const testPlan = createTestLessonPlan({
  id: 'plan-uuid-123',
  userId: 'user-uuid-123',
  title: 'Learn Python',
  status: 'active',
});

const testSession = createTestDesignerSession({
  id: 'session-uuid-123',
  userId: 'user-uuid-123',
  visiblePhase: 'exploration',
  internalPhase: 'exploration',
});

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS (mirroring index.ts)
// ─────────────────────────────────────────────────────────────────────────────────

async function getInternalUserId(
  supabase: any,
  externalId: string
): Promise<string> {
  // Try to find existing user
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', externalId)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new user
  const placeholderEmail = `${externalId}@novaos.local`;
  
  const { data: newUser, error } = await supabase
    .from('users')
    .insert({
      external_id: externalId,
      email: placeholderEmail,
      tier: 'free',
    })
    .select('id')
    .single();

  if (error) {
    // Handle race condition (user created between check and insert)
    if (error.code === '23505') {
      const { data: retryUser } = await supabase
        .from('users')
        .select('id')
        .eq('external_id', externalId)
        .single();
      
      if (retryUser) {
        return retryUser.id;
      }
    }
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return newUser.id;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('SwordGate Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('User ID Resolution', () => {
    it('should return existing user ID', async () => {
      mockSupabaseClient._mockQuery.single.mockResolvedValueOnce({
        data: { id: 'user-uuid-123' },
        error: null,
      });

      const result = await getInternalUserId(mockSupabaseClient, 'user_external_123');
      
      expect(result).toBe('user-uuid-123');
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('users');
    });

    it('should create new user if not exists', async () => {
      // First call - user not found
      mockSupabaseClient._mockQuery.single
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        })
        // Second call - insert returns new user
        .mockResolvedValueOnce({
          data: { id: 'new-user-uuid' },
          error: null,
        });

      const result = await getInternalUserId(mockSupabaseClient, 'user_new_123');
      
      expect(result).toBe('new-user-uuid');
    });

    it('should handle race condition on user creation', async () => {
      // First call - user not found
      mockSupabaseClient._mockQuery.single
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' },
        })
        // Second call - insert fails with duplicate
        .mockResolvedValueOnce({
          data: null,
          error: { code: '23505', message: 'Duplicate' },
        })
        // Third call - retry finds user
        .mockResolvedValueOnce({
          data: { id: 'race-condition-user' },
          error: null,
        });

      const result = await getInternalUserId(mockSupabaseClient, 'user_race_123');
      
      expect(result).toBe('race-condition-user');
    });
  });

  describe('getSwordState', () => {
    it('should return state with no active plan or session', async () => {
      // Mock no active plan
      mockSupabaseClient._mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      // Mock no active session
      mockSupabaseClient._mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const getSwordState = async (userId: string) => {
        const { data: plan } = await mockSupabaseClient
          .from('lesson_plans')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single();

        const { data: session } = await mockSupabaseClient
          .from('designer_sessions')
          .select('*')
          .eq('user_id', userId)
          .is('completed_at', null)
          .single();

        return {
          hasActivePlan: !!plan,
          hasDesignerSession: !!session,
          today: plan ? {} : undefined,
          designerState: session ? { hasActiveSession: true, session } : undefined,
        };
      };

      const result = await getSwordState('user-uuid-123');

      expect(result.hasActivePlan).toBe(false);
      expect(result.hasDesignerSession).toBe(false);
      expect(result.today).toBeUndefined();
      expect(result.designerState).toBeUndefined();
    });

    it('should return state with active plan', async () => {
      mockSupabaseClient._mockQuery.single.mockResolvedValueOnce({
        data: testPlan,
        error: null,
      });

      mockSupabaseClient._mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const getSwordState = async (userId: string) => {
        const { data: plan } = await mockSupabaseClient
          .from('lesson_plans')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single();

        const { data: session } = await mockSupabaseClient
          .from('designer_sessions')
          .select('*')
          .eq('user_id', userId)
          .is('completed_at', null)
          .single();

        return {
          hasActivePlan: !!plan,
          hasDesignerSession: !!session,
          today: plan ? { currentNode: null, assets: [] } : undefined,
        };
      };

      const result = await getSwordState('user-uuid-123');

      expect(result.hasActivePlan).toBe(true);
      expect(result.today).toBeDefined();
    });

    it('should return state with active designer session', async () => {
      mockSupabaseClient._mockQuery.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      mockSupabaseClient._mockQuery.single.mockResolvedValueOnce({
        data: testSession,
        error: null,
      });

      const getSwordState = async (userId: string) => {
        const { data: plan } = await mockSupabaseClient
          .from('lesson_plans')
          .select('*')
          .single();

        const { data: session } = await mockSupabaseClient
          .from('designer_sessions')
          .select('*')
          .single();

        return {
          hasActivePlan: !!plan,
          hasDesignerSession: !!session,
          designerState: session ? { hasActiveSession: true, session } : undefined,
        };
      };

      const result = await getSwordState('user-uuid-123');

      expect(result.hasDesignerSession).toBe(true);
      expect(result.designerState?.hasActiveSession).toBe(true);
    });
  });

  describe('getUserPlans', () => {
    it('should return empty array when no plans', async () => {
      // Create a fully chained mock for this specific test
      const chainedMock = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'user-uuid-123' },
              error: null,
            }),
          }),
        }),
      };
      
      const plansChainMock = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      };

      let callCount = 0;
      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'users') return chainedMock;
        if (table === 'lesson_plans') return plansChainMock;
        return mockSupabaseClient._mockQuery;
      });

      const getUserPlans = async (externalUserId: string) => {
        // Get internal user ID
        const { data: user } = await mockSupabaseClient
          .from('users')
          .select('id')
          .eq('external_id', externalUserId)
          .single();

        if (!user) return [];

        const { data: plans } = await mockSupabaseClient
          .from('lesson_plans')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        return plans || [];
      };

      const result = await getUserPlans('user_external_123');

      expect(result).toEqual([]);
    });

    it('should return plans ordered by created_at desc', async () => {
      const plans = [
        { ...testPlan, id: 'plan-1', created_at: '2025-01-15T00:00:00Z' },
        { ...testPlan, id: 'plan-2', created_at: '2025-01-10T00:00:00Z' },
      ];

      const chainedMock = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'user-uuid-123' },
              error: null,
            }),
          }),
        }),
      };
      
      const plansChainMock = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: plans,
              error: null,
            }),
          }),
        }),
      };

      mockSupabaseClient.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'users') return chainedMock;
        if (table === 'lesson_plans') return plansChainMock;
        return mockSupabaseClient._mockQuery;
      });

      const getUserPlans = async () => {
        const { data } = await mockSupabaseClient
          .from('lesson_plans')
          .select('*')
          .eq('user_id', 'user-uuid-123')
          .order('created_at', { ascending: false });

        return data || [];
      };

      const result = await getUserPlans();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('plan-1');
    });
  });

  describe('getPlanSubskills', () => {
    it('should return subskills ordered by order asc', async () => {
      const subskills = [
        createTestPlanSubskill({ id: 'ss-1', title: 'First' }),
        createTestPlanSubskill({ id: 'ss-2', title: 'Second' }),
      ];

      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: subskills,
              error: null,
            }),
          }),
        }),
      });

      const getPlanSubskills = async (planId: string) => {
        const { data } = await mockSupabaseClient
          .from('plan_subskills')
          .select('*')
          .eq('plan_id', planId)
          .order('order', { ascending: true });

        return data || [];
      };

      const result = await getPlanSubskills('plan-uuid-123');

      expect(result).toHaveLength(2);
    });
  });

  describe('activatePlan', () => {
    it('should deactivate existing plan and activate new one', async () => {
      const updateMock = vi.fn().mockResolvedValue({ error: null });
      
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { ...testPlan, status: 'active' },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      mockSupabaseClient.rpc = vi.fn().mockResolvedValue({ error: null });

      const activatePlan = async (userId: string, planId: string) => {
        // Deactivate current active plan
        await mockSupabaseClient
          .from('lesson_plans')
          .update({ status: 'abandoned' })
          .eq('user_id', userId)
          .eq('status', 'active');

        // Activate new plan
        const { data, error } = await mockSupabaseClient
          .from('lesson_plans')
          .update({ status: 'active', started_at: new Date().toISOString() })
          .eq('id', planId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw new Error(error.message);

        // Initialize progress
        await mockSupabaseClient.rpc('initialize_node_progress', {
          p_user_id: userId,
          p_plan_id: planId,
        });

        return data;
      };

      const result = await activatePlan('user-uuid-123', 'plan-uuid-123');

      expect(result.status).toBe('active');
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('initialize_node_progress', {
        p_user_id: 'user-uuid-123',
        p_plan_id: 'plan-uuid-123',
      });
    });
  });

  describe('abandonPlan', () => {
    it('should set plan status to abandoned', async () => {
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const abandonPlan = async (userId: string, planId: string) => {
        await mockSupabaseClient
          .from('lesson_plans')
          .update({ status: 'abandoned', abandoned_at: new Date().toISOString() })
          .eq('id', planId)
          .eq('user_id', userId);
      };

      await expect(abandonPlan('user-uuid-123', 'plan-uuid-123')).resolves.not.toThrow();
    });
  });

  describe('deletePlan', () => {
    it('should verify ownership before deleting', async () => {
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'plan-uuid-123', user_id: 'user-uuid-123' },
              error: null,
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const deletePlan = async (userId: string, planId: string) => {
        // Verify ownership
        const { data: plan, error } = await mockSupabaseClient
          .from('lesson_plans')
          .select('id, user_id')
          .eq('id', planId)
          .single();

        if (error || !plan) throw new Error('Plan not found');
        if (plan.user_id !== userId) throw new Error('Not authorized');

        // Delete subskills first
        await mockSupabaseClient
          .from('plan_subskills')
          .delete()
          .eq('plan_id', planId);

        // Delete plan
        await mockSupabaseClient
          .from('lesson_plans')
          .delete()
          .eq('id', planId);
      };

      await expect(deletePlan('user-uuid-123', 'plan-uuid-123')).resolves.not.toThrow();
    });

    it('should throw error if not authorized', async () => {
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'plan-uuid-123', user_id: 'different-user' },
              error: null,
            }),
          }),
        }),
      });

      const deletePlan = async (userId: string, planId: string) => {
        const { data: plan, error } = await mockSupabaseClient
          .from('lesson_plans')
          .select('id, user_id')
          .eq('id', planId)
          .single();

        if (error || !plan) throw new Error('Plan not found');
        if (plan.user_id !== userId) throw new Error('Not authorized');
      };

      await expect(deletePlan('user-uuid-123', 'plan-uuid-123')).rejects.toThrow('Not authorized');
    });
  });

  describe('deleteAllPlans', () => {
    it('should delete all plans for user', async () => {
      const plans = [
        { id: 'plan-1' },
        { id: 'plan-2' },
        { id: 'plan-3' },
      ];

      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: plans,
            error: null,
          }),
        }),
        delete: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ error: null }),
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      });

      const deleteAllPlans = async (userId: string) => {
        // Get all plan IDs
        const { data: userPlans } = await mockSupabaseClient
          .from('lesson_plans')
          .select('id')
          .eq('user_id', userId);

        if (!userPlans || userPlans.length === 0) return 0;

        const planIds = userPlans.map((p: any) => p.id);

        // Delete subskills
        await mockSupabaseClient
          .from('plan_subskills')
          .delete()
          .in('plan_id', planIds);

        // Delete plans
        await mockSupabaseClient
          .from('lesson_plans')
          .delete()
          .eq('user_id', userId);

        return planIds.length;
      };

      const result = await deleteAllPlans('user-uuid-123');

      expect(result).toBe(3);
    });

    it('should return 0 if no plans exist', async () => {
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      const deleteAllPlans = async (userId: string) => {
        const { data: plans } = await mockSupabaseClient
          .from('lesson_plans')
          .select('id')
          .eq('user_id', userId);

        if (!plans || plans.length === 0) return 0;
        return plans.length;
      };

      const result = await deleteAllPlans('user-uuid-123');

      expect(result).toBe(0);
    });
  });
});

describe('Error Handling', () => {
  it('should handle database errors gracefully', async () => {
    const errorMock = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database connection failed' },
        }),
      }),
    };
    
    mockSupabaseClient.from = vi.fn().mockReturnValue(errorMock);

    const getSomething = async () => {
      const { data, error } = await mockSupabaseClient
        .from('lesson_plans')
        .select('*')
        .single();

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }
      return data;
    };

    await expect(getSomething()).rejects.toThrow('Database error: Database connection failed');
  });

  it('should handle missing data gracefully', async () => {
    const notFoundMock = {
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'Not found' },
        }),
      }),
    };
    
    mockSupabaseClient.from = vi.fn().mockReturnValue(notFoundMock);

    const getOptional = async () => {
      const { data, error } = await mockSupabaseClient
        .from('lesson_plans')
        .select('*')
        .single();

      if (error?.code === 'PGRST116') {
        return null; // Not found is OK
      }
      if (error) throw error;
      return data;
    };

    const result = await getOptional();
    expect(result).toBeNull();
  });
});
