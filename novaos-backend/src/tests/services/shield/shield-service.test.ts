// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD SERVICE TESTS — Protection Layer Unit Tests
// NovaOS Shield System
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShieldService, getShieldService, resetShieldService } from '../../../services/shield/shield-service.js';
import type { RiskAssessment, PendingMessage } from '../../../services/shield/types.js';
import type { IntentSummary } from '../../../types/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCKS
// ─────────────────────────────────────────────────────────────────────────────────

// Mock database
vi.mock('../../../db/index.js', () => ({
  isSupabaseInitialized: vi.fn(() => true),
  getSupabase: vi.fn(() => mockSupabase),
}));

// Mock storage (Redis)
const mockStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../../../storage/index.js', () => ({
  getStore: () => mockStore,
}));

// Mock LLM engine
vi.mock('../../../pipeline/llm_engine.js', () => ({
  generateWithModelLLM: vi.fn(),
}));

// Mock risk assessor
vi.mock('../../../services/shield/risk-assessor.js', () => ({
  assessRisk: vi.fn(),
}));

// Mock crisis session manager
vi.mock('../../../services/shield/crisis-session.js', () => ({
  getActiveCrisisSession: vi.fn(),
  createCrisisSession: vi.fn(),
  resolveCrisisSession: vi.fn(),
  getCrisisSession: vi.fn(),
}));

// Supabase mock
const mockSupabase = {
  from: vi.fn(() => mockSupabase),
  select: vi.fn(() => mockSupabase),
  insert: vi.fn(() => mockSupabase),
  update: vi.fn(() => mockSupabase),
  eq: vi.fn(() => mockSupabase),
  single: vi.fn(),
};

// Import mocked modules to access their mock functions
import { generateWithModelLLM } from '../../../pipeline/llm_engine.js';
import { assessRisk } from '../../../services/shield/risk-assessor.js';
import {
  getActiveCrisisSession,
  createCrisisSession,
  resolveCrisisSession,
  getCrisisSession,
} from '../../../services/shield/crisis-session.js';
import { isSupabaseInitialized } from '../../../db/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

const mockRiskAssessment: RiskAssessment = {
  domain: 'financial',
  riskExplanation: 'This involves significant financial risk',
  consequences: ['Loss of savings', 'Debt'],
  alternatives: ['Invest smaller amount', 'Consult advisor'],
  question: 'Have you considered the downside?',
};

const mockIntentSummary: IntentSummary = {
  primary_route: 'SAY',
  stance: 'SHIELD',
  safety_signal: 'medium',
  urgency: 'medium',
  live_data: false,
  external_tool: false,
  learning_intent: false,
};

const mockPendingMessage: PendingMessage = {
  activationId: 'activation_123',
  userId: 'user_123',
  message: 'I want to invest my savings in crypto',
  conversationId: 'conv_123',
  timestamp: Date.now(),
  domain: 'financial',
  warningMessage: 'This involves significant financial risk. Are you sure?',
  intentResult: mockIntentSummary,
};

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ShieldService', () => {
  let service: ShieldService;

  beforeEach(() => {
    vi.clearAllMocks();
    resetShieldService();
    service = getShieldService();
    
    // Default mock returns
    vi.mocked(getActiveCrisisSession).mockResolvedValue(null);
    vi.mocked(assessRisk).mockResolvedValue(mockRiskAssessment);
    vi.mocked(generateWithModelLLM).mockResolvedValue('This involves significant risk. Are you sure?');
    mockStore.get.mockResolvedValue(null);
    mockStore.set.mockResolvedValue(undefined);
    mockStore.delete.mockResolvedValue(undefined);
    
    // Supabase mock for activation creation
    mockSupabase.single.mockResolvedValue({
      data: { id: 'activation_123' },
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SINGLETON PATTERN
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('singleton pattern', () => {
    it('should return same instance on multiple calls', () => {
      const instance1 = getShieldService();
      const instance2 = getShieldService();
      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', () => {
      const instance1 = getShieldService();
      resetShieldService();
      const instance2 = getShieldService();
      expect(instance1).not.toBe(instance2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // checkCrisisBlock
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('checkCrisisBlock', () => {
    it('should return blocked: false when no active crisis session', async () => {
      vi.mocked(getActiveCrisisSession).mockResolvedValue(null);

      const result = await service.checkCrisisBlock('user_123');

      expect(result.blocked).toBe(false);
      expect(result.sessionId).toBeUndefined();
    });

    it('should return blocked: true with sessionId when crisis session exists', async () => {
      vi.mocked(getActiveCrisisSession).mockResolvedValue({
        id: 'crisis_session_123',
        userId: 'user_123',
        activationId: 'activation_123',
        status: 'active',
        createdAt: new Date(),
      });

      const result = await service.checkCrisisBlock('user_123');

      expect(result.blocked).toBe(true);
      expect(result.sessionId).toBe('crisis_session_123');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // evaluate
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('evaluate', () => {
    describe('none/low safety signal', () => {
      it('should skip for safety_signal: none', async () => {
        const result = await service.evaluate(
          'user_123',
          'Hello, how are you?',
          'none',
          'low',
          'conv_123'
        );

        expect(result.action).toBe('skip');
        expect(result.safetySignal).toBe('none');
        expect(vi.mocked(assessRisk)).not.toHaveBeenCalled();
      });

      it('should skip for safety_signal: low', async () => {
        const result = await service.evaluate(
          'user_123',
          'I am feeling a bit stressed',
          'low',
          'low',
          'conv_123'
        );

        expect(result.action).toBe('skip');
        expect(result.safetySignal).toBe('low');
      });
    });

    describe('medium safety signal', () => {
      it('should return warn action with risk assessment', async () => {
        const result = await service.evaluate(
          'user_123',
          'I want to put my savings into crypto',
          'medium',
          'medium',
          'conv_123',
          mockIntentSummary
        );

        expect(result.action).toBe('warn');
        expect(result.safetySignal).toBe('medium');
        expect(result.riskAssessment).toEqual(mockRiskAssessment);
        expect(result.warningMessage).toBeDefined();
      });

      it('should call assessRisk with correct parameters', async () => {
        await service.evaluate(
          'user_123',
          'I want to quit my job',
          'medium',
          'high',
          'conv_123'
        );

        expect(vi.mocked(assessRisk)).toHaveBeenCalledWith(
          'I want to quit my job',
          'medium',
          'high'
        );
      });

      it('should store pending message with intent result', async () => {
        await service.evaluate(
          'user_123',
          'I want to invest everything',
          'medium',
          'medium',
          'conv_123',
          mockIntentSummary
        );

        expect(mockStore.set).toHaveBeenCalledWith(
          'pending:activation_123',
          expect.stringContaining('"intentResult"'),
          900 // TTL
        );
      });

      it('should include activationId in response', async () => {
        const result = await service.evaluate(
          'user_123',
          'Risky message',
          'medium',
          'medium',
          'conv_123'
        );

        expect(result.activationId).toBe('activation_123');
      });
    });

    describe('high safety signal', () => {
      beforeEach(() => {
        vi.mocked(createCrisisSession).mockResolvedValue({
          id: 'crisis_session_456',
          userId: 'user_123',
          activationId: 'activation_123',
          status: 'active',
          createdAt: new Date(),
        });
      });

      it('should return crisis action', async () => {
        const result = await service.evaluate(
          'user_123',
          'I want to end it all',
          'high',
          'high',
          'conv_123'
        );

        expect(result.action).toBe('crisis');
        expect(result.safetySignal).toBe('high');
      });

      it('should create crisis session', async () => {
        await service.evaluate(
          'user_123',
          'I feel like hurting myself',
          'high',
          'high',
          'conv_123'
        );

        expect(vi.mocked(createCrisisSession)).toHaveBeenCalledWith(
          'user_123',
          'activation_123'
        );
      });

      it('should return sessionId from crisis session', async () => {
        const result = await service.evaluate(
          'user_123',
          'Crisis message',
          'high',
          'high',
          'conv_123'
        );

        expect(result.sessionId).toBe('crisis_session_456');
      });

      it('should NOT store pending message for high signals', async () => {
        await service.evaluate(
          'user_123',
          'Crisis message',
          'high',
          'high',
          'conv_123'
        );

        // Should not call store.set for pending message
        expect(mockStore.set).not.toHaveBeenCalled();
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // confirmAcceptanceAndGetMessage
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('confirmAcceptanceAndGetMessage', () => {
    it('should return pending message and delete from store', async () => {
      mockStore.get.mockResolvedValue(JSON.stringify(mockPendingMessage));

      const result = await service.confirmAcceptanceAndGetMessage('activation_123');

      expect(result.success).toBe(true);
      expect(result.pendingMessage).toEqual(mockPendingMessage);
      expect(mockStore.delete).toHaveBeenCalledWith('pending:activation_123');
    });

    it('should return success with undefined pendingMessage when not found', async () => {
      mockStore.get.mockResolvedValue(null);

      const result = await service.confirmAcceptanceAndGetMessage('nonexistent');

      expect(result.success).toBe(true);
      expect(result.pendingMessage).toBeUndefined();
    });

    it('should include cached intentResult in pending message', async () => {
      mockStore.get.mockResolvedValue(JSON.stringify(mockPendingMessage));

      const result = await service.confirmAcceptanceAndGetMessage('activation_123');

      expect(result.pendingMessage?.intentResult).toEqual(mockIntentSummary);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // confirmSafety
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('confirmSafety', () => {
    beforeEach(() => {
      vi.mocked(getCrisisSession).mockResolvedValue({
        id: 'crisis_session_123',
        userId: 'user_123',
        activationId: 'activation_123',
        status: 'active',
        createdAt: new Date(),
      });
      vi.mocked(resolveCrisisSession).mockResolvedValue(true);
    });

    it('should resolve crisis session for valid user', async () => {
      const result = await service.confirmSafety('user_123', 'crisis_session_123');

      expect(result).toBe(true);
      expect(vi.mocked(resolveCrisisSession)).toHaveBeenCalledWith('crisis_session_123');
    });

    it('should return false if session not found', async () => {
      vi.mocked(getCrisisSession).mockResolvedValue(null);

      const result = await service.confirmSafety('user_123', 'nonexistent');

      expect(result).toBe(false);
    });

    it('should return false if session belongs to different user', async () => {
      vi.mocked(getCrisisSession).mockResolvedValue({
        id: 'crisis_session_123',
        userId: 'different_user',
        activationId: 'activation_123',
        status: 'active',
        createdAt: new Date(),
      });

      const result = await service.confirmSafety('user_123', 'crisis_session_123');

      expect(result).toBe(false);
      expect(vi.mocked(resolveCrisisSession)).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // getStatus
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('getStatus', () => {
    it('should return inCrisis: false when no active session', async () => {
      vi.mocked(getActiveCrisisSession).mockResolvedValue(null);

      const result = await service.getStatus('user_123');

      expect(result.inCrisis).toBe(false);
      expect(result.sessionId).toBeUndefined();
    });

    it('should return inCrisis: true with session details when active', async () => {
      const createdAt = new Date();
      vi.mocked(getActiveCrisisSession).mockResolvedValue({
        id: 'crisis_session_123',
        userId: 'user_123',
        activationId: 'activation_123',
        status: 'active',
        createdAt,
      });

      const result = await service.getStatus('user_123');

      expect(result.inCrisis).toBe(true);
      expect(result.sessionId).toBe('crisis_session_123');
      expect(result.createdAt).toEqual(createdAt);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // PENDING MESSAGE STORAGE
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('pending message storage', () => {
    describe('storePendingMessage', () => {
      it('should store message with correct key and TTL', async () => {
        await service['storePendingMessage'](
          'activation_123',
          'user_123',
          'Test message',
          'conv_123',
          'financial',
          'Warning message',
          mockIntentSummary
        );

        expect(mockStore.set).toHaveBeenCalledWith(
          'pending:activation_123',
          expect.any(String),
          900
        );
      });

      it('should include all fields in stored message', async () => {
        await service['storePendingMessage'](
          'activation_123',
          'user_123',
          'Test message',
          'conv_123',
          'financial',
          'Warning message',
          mockIntentSummary
        );

        const storedData = JSON.parse(mockStore.set.mock.calls[0][1]);
        expect(storedData.activationId).toBe('activation_123');
        expect(storedData.userId).toBe('user_123');
        expect(storedData.message).toBe('Test message');
        expect(storedData.conversationId).toBe('conv_123');
        expect(storedData.domain).toBe('financial');
        expect(storedData.warningMessage).toBe('Warning message');
        expect(storedData.intentResult).toEqual(mockIntentSummary);
      });
    });

    describe('getPendingMessage', () => {
      it('should return parsed message when found', async () => {
        mockStore.get.mockResolvedValue(JSON.stringify(mockPendingMessage));

        const result = await service['getPendingMessage']('activation_123');

        expect(result).toEqual(mockPendingMessage);
      });

      it('should return null when not found', async () => {
        mockStore.get.mockResolvedValue(null);

        const result = await service['getPendingMessage']('nonexistent');

        expect(result).toBeNull();
      });

      it('should return null on parse error', async () => {
        mockStore.get.mockResolvedValue('invalid json');

        const result = await service['getPendingMessage']('activation_123');

        expect(result).toBeNull();
      });
    });

    describe('deletePendingMessage', () => {
      it('should delete message with correct key', async () => {
        await service['deletePendingMessage']('activation_123');

        expect(mockStore.delete).toHaveBeenCalledWith('pending:activation_123');
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // SHORT WARNING GENERATION
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('generateShortWarning', () => {
    it('should call LLM with formatted prompt', async () => {
      await service['generateShortWarning']('Test message', mockRiskAssessment);

      expect(vi.mocked(generateWithModelLLM)).toHaveBeenCalledWith(
        expect.stringContaining('Test message'),
        'Test message',
        { temperature: 0.3, max_tokens: 150 }
      );
    });

    it('should return LLM response when valid', async () => {
      vi.mocked(generateWithModelLLM).mockResolvedValue(
        'This is a valid warning message. Are you sure?'
      );

      const result = await service['generateShortWarning']('Test', mockRiskAssessment);

      expect(result).toBe('This is a valid warning message. Are you sure?');
    });

    it('should return fallback when LLM returns empty', async () => {
      vi.mocked(generateWithModelLLM).mockResolvedValue('');

      const result = await service['generateShortWarning']('Test', mockRiskAssessment);

      expect(result).toContain('financial risk');
    });

    it('should return fallback when LLM returns null', async () => {
      vi.mocked(generateWithModelLLM).mockResolvedValue(null as any);

      const result = await service['generateShortWarning']('Test', mockRiskAssessment);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(10);
    });

    it('should return fallback when no risk assessment', async () => {
      const result = await service['generateShortWarning']('Test', null);

      expect(result).toBe(
        'This decision may have significant consequences. Are you sure you want to proceed?'
      );
    });

    it('should clean up quoted responses', async () => {
      vi.mocked(generateWithModelLLM).mockResolvedValue(
        '"This is a warning with quotes."'
      );

      const result = await service['generateShortWarning']('Test', mockRiskAssessment);

      expect(result).toBe('This is a warning with quotes.');
    });

    it('should return domain-specific fallback', async () => {
      const careerAssessment: RiskAssessment = {
        ...mockRiskAssessment,
        domain: 'career',
      };
      vi.mocked(generateWithModelLLM).mockResolvedValue('');

      const result = await service['generateShortWarning']('Test', careerAssessment);

      expect(result).toContain('professional reputation');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // DATABASE UNAVAILABLE SCENARIOS
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('database unavailable', () => {
    beforeEach(() => {
      vi.mocked(isSupabaseInitialized).mockReturnValue(false);
    });

    it('should skip activation creation when Supabase not initialized', async () => {
      const result = await service.evaluate(
        'user_123',
        'Risky message',
        'medium',
        'medium',
        'conv_123'
      );

      expect(result.action).toBe('warn');
      expect(result.activationId).toBeUndefined();
    });

    it('should still return risk assessment without database', async () => {
      const result = await service.evaluate(
        'user_123',
        'Risky message',
        'medium',
        'medium',
        'conv_123'
      );

      expect(result.riskAssessment).toEqual(mockRiskAssessment);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // EDGE CASES
  // ═══════════════════════════════════════════════════════════════════════════════

  describe('edge cases', () => {
    it('should handle empty message', async () => {
      const result = await service.evaluate(
        'user_123',
        '',
        'medium',
        'medium',
        'conv_123'
      );

      expect(result.action).toBe('warn');
    });

    it('should handle very long message', async () => {
      const longMessage = 'A'.repeat(10000);
      
      const result = await service.evaluate(
        'user_123',
        longMessage,
        'medium',
        'medium',
        'conv_123'
      );

      expect(result.action).toBe('warn');
    });

    it('should handle missing conversationId', async () => {
      const result = await service.evaluate(
        'user_123',
        'Risky message',
        'medium',
        'medium',
        undefined
      );

      expect(result.action).toBe('warn');
      // Should not store pending message without conversationId
      expect(mockStore.set).not.toHaveBeenCalled();
    });

    it('should handle assessRisk returning null', async () => {
      vi.mocked(assessRisk).mockResolvedValue(null);

      const result = await service.evaluate(
        'user_123',
        'Risky message',
        'medium',
        'medium',
        'conv_123'
      );

      expect(result.action).toBe('warn');
      expect(result.riskAssessment).toBeUndefined();
    });
  });
});
