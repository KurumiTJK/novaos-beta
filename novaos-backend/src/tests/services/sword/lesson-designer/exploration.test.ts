// ═══════════════════════════════════════════════════════════════════════════════
// EXPLORATION TESTS
// Tests for two-part exploration flow: Orient → Clarify
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mockSupabaseClient,
  mockSwordGateLLM,
  setMockLLMResponse,
  createTestDesignerSession,
} from '../../../setup';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface ExplorationState {
  part: 'orient' | 'clarify';
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  extracted: {
    learningGoal: string | null;
    priorKnowledge: string | null;
    context: string | null;
    constraints: string[];
  };
  fieldSources: Record<string, 'extracted' | 'user_filled' | 'user_edited' | null>;
  missing: string[];
}

interface ExtractedData {
  learningGoal: string | null;
  priorKnowledge: string | null;
  context: string | null;
  constraints: string[];
  confidence: {
    learningGoal: number;
    priorKnowledge: number;
    context: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function getMissingFields(extracted: ExtractedData): string[] {
  const required = ['learningGoal', 'priorKnowledge'] as const;
  return required.filter(field => !extracted[field]);
}

function createInitialState(): ExplorationState {
  return {
    part: 'orient',
    messages: [],
    extracted: {
      learningGoal: null,
      priorKnowledge: null,
      context: null,
      constraints: [],
    },
    fieldSources: {
      learningGoal: null,
      priorKnowledge: null,
      context: null,
    },
    missing: ['learningGoal', 'priorKnowledge'],
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Exploration State', () => {
  describe('Initial State', () => {
    it('should start in orient phase', () => {
      const state = createInitialState();
      expect(state.part).toBe('orient');
    });

    it('should have empty messages', () => {
      const state = createInitialState();
      expect(state.messages).toEqual([]);
    });

    it('should have null extracted fields', () => {
      const state = createInitialState();
      expect(state.extracted.learningGoal).toBeNull();
      expect(state.extracted.priorKnowledge).toBeNull();
      expect(state.extracted.context).toBeNull();
    });

    it('should mark required fields as missing', () => {
      const state = createInitialState();
      expect(state.missing).toContain('learningGoal');
      expect(state.missing).toContain('priorKnowledge');
    });
  });

  describe('getMissingFields', () => {
    it('should return both fields when both null', () => {
      const extracted: ExtractedData = {
        learningGoal: null,
        priorKnowledge: null,
        context: null,
        constraints: [],
        confidence: { learningGoal: 0, priorKnowledge: 0, context: 0 },
      };
      
      expect(getMissingFields(extracted)).toEqual(['learningGoal', 'priorKnowledge']);
    });

    it('should return only priorKnowledge when learningGoal present', () => {
      const extracted: ExtractedData = {
        learningGoal: 'Learn Python',
        priorKnowledge: null,
        context: null,
        constraints: [],
        confidence: { learningGoal: 1, priorKnowledge: 0, context: 0 },
      };
      
      expect(getMissingFields(extracted)).toEqual(['priorKnowledge']);
    });

    it('should return empty when both required fields present', () => {
      const extracted: ExtractedData = {
        learningGoal: 'Learn Python',
        priorKnowledge: 'Complete beginner',
        context: null, // Optional
        constraints: [],
        confidence: { learningGoal: 1, priorKnowledge: 1, context: 0 },
      };
      
      expect(getMissingFields(extracted)).toEqual([]);
    });
  });
});

describe('Orient Phase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('startExploration', () => {
    it('should return hardcoded greeting without topic', async () => {
      const expectedGreeting = `Hi — I'm Nova.
I help break complex topics into clear, achievable learning paths.

What would you like to learn?`;

      // Mock the flow
      const startExploration = async (topic?: string) => {
        const state = createInitialState();
        
        let response: string;
        if (topic) {
          response = await mockSwordGateLLM.generate('system', `User wants to learn: ${topic}`);
          state.messages.push({
            role: 'user',
            content: `I want to learn ${topic}`,
            timestamp: new Date().toISOString(),
          });
        } else {
          response = expectedGreeting;
        }
        
        state.messages.push({
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
        });
        
        return { message: response, state };
      };

      const result = await startExploration();
      
      expect(result.message).toContain("I'm Nova");
      expect(result.message).toContain("What would you like to learn?");
      expect(result.state.part).toBe('orient');
    });

    it('should use LLM for topic-based start', async () => {
      setMockLLMResponse('User wants to learn: Python', 
        'Python is a fantastic choice! It\'s known for its readability. What draws you to Python?');

      const startWithTopic = async (topic: string) => {
        const state = createInitialState();
        
        const response = await mockSwordGateLLM.generate('system', `User wants to learn: ${topic}`);
        
        state.messages.push({
          role: 'user',
          content: `I want to learn ${topic}`,
          timestamp: new Date().toISOString(),
        });
        state.messages.push({
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
        });
        
        return { message: response, state };
      };

      const result = await startWithTopic('Python');
      
      expect(result.state.messages).toHaveLength(2);
      expect(result.state.messages[0].role).toBe('user');
      expect(result.state.messages[0].content).toContain('Python');
    });
  });

  describe('chatInOrient', () => {
    it('should add messages to state', async () => {
      const state = createInitialState();
      state.messages.push({
        role: 'assistant',
        content: 'What would you like to learn?',
        timestamp: new Date().toISOString(),
      });

      setMockLLMResponse('Python', 'Great choice! What\'s your experience with programming?');

      const chatInOrient = async (currentState: ExplorationState, userMessage: string) => {
        currentState.messages.push({
          role: 'user',
          content: userMessage,
          timestamp: new Date().toISOString(),
        });

        const response = await mockSwordGateLLM.generate('system', userMessage);

        currentState.messages.push({
          role: 'assistant',
          content: response,
          timestamp: new Date().toISOString(),
        });

        return { response, state: currentState };
      };

      const result = await chatInOrient(state, 'I want to learn Python');
      
      expect(result.state.messages).toHaveLength(3);
      expect(result.state.messages[1].content).toBe('I want to learn Python');
      expect(result.state.messages[2].role).toBe('assistant');
    });

    it('should maintain conversation history', async () => {
      const state = createInitialState();
      
      // Simulate multiple turns
      state.messages.push({ role: 'assistant', content: 'Welcome!', timestamp: new Date().toISOString() });
      state.messages.push({ role: 'user', content: 'I want to learn guitar', timestamp: new Date().toISOString() });
      state.messages.push({ role: 'assistant', content: 'Great choice!', timestamp: new Date().toISOString() });
      state.messages.push({ role: 'user', content: 'I have 30 min per day', timestamp: new Date().toISOString() });

      expect(state.messages).toHaveLength(4);
      expect(state.messages.filter(m => m.role === 'user')).toHaveLength(2);
    });
  });
});

describe('Orient → Clarify Transition', () => {
  describe('confirmOrient', () => {
    it('should extract data from conversation', async () => {
      const mockExtraction: ExtractedData = {
        learningGoal: 'Learn Python for data science',
        priorKnowledge: 'Some JavaScript experience',
        context: 'Career change',
        constraints: ['30 minutes per day'],
        confidence: {
          learningGoal: 1.0,
          priorKnowledge: 0.9,
          context: 0.8,
        },
      };

      setMockLLMResponse('EXTRACTION', JSON.stringify(mockExtraction));

      const state = createInitialState();
      state.messages = [
        { role: 'assistant', content: 'What would you like to learn?', timestamp: '' },
        { role: 'user', content: 'I want to learn Python for data science', timestamp: '' },
        { role: 'assistant', content: 'Tell me about your background', timestamp: '' },
        { role: 'user', content: 'I have some JavaScript experience', timestamp: '' },
      ];

      const confirmOrient = async (currentState: ExplorationState) => {
        if (currentState.messages.length < 2) {
          throw new Error('Need at least one exchange');
        }

        const response = await mockSwordGateLLM.generate('SORT', 'EXTRACTION');
        const extracted = JSON.parse(response) as ExtractedData;

        currentState.part = 'clarify';
        currentState.extracted = {
          learningGoal: extracted.learningGoal,
          priorKnowledge: extracted.priorKnowledge,
          context: extracted.context,
          constraints: extracted.constraints || [],
        };
        currentState.fieldSources = {
          learningGoal: extracted.learningGoal ? 'extracted' : null,
          priorKnowledge: extracted.priorKnowledge ? 'extracted' : null,
          context: extracted.context ? 'extracted' : null,
        };
        currentState.missing = getMissingFields(extracted);

        return {
          extracted: currentState.extracted,
          missing: currentState.missing,
          fieldSources: currentState.fieldSources,
        };
      };

      const result = await confirmOrient(state);

      expect(state.part).toBe('clarify');
      expect(result.extracted.learningGoal).toBe('Learn Python for data science');
      expect(result.fieldSources.learningGoal).toBe('extracted');
      expect(result.missing).toEqual([]);
    });

    it('should reject if not enough messages', async () => {
      const state = createInitialState();
      state.messages = [
        { role: 'assistant', content: 'Welcome!', timestamp: '' },
      ];

      const confirmOrient = async (currentState: ExplorationState) => {
        if (currentState.messages.length < 2) {
          throw new Error('Need at least one exchange before confirming');
        }
        return currentState;
      };

      await expect(confirmOrient(state)).rejects.toThrow('Need at least one exchange');
    });
  });
});

describe('Clarify Phase', () => {
  describe('updateField', () => {
    it('should update field and mark as user_filled', async () => {
      const state = createInitialState();
      state.part = 'clarify';
      state.extracted.learningGoal = null;

      const updateField = (
        currentState: ExplorationState,
        field: 'learningGoal' | 'priorKnowledge' | 'context',
        value: string
      ) => {
        const wasFilled = currentState.extracted[field] !== null;
        
        currentState.extracted[field] = value || null;
        currentState.fieldSources[field] = wasFilled ? 'user_edited' : 'user_filled';
        
        // Recalculate missing
        currentState.missing = [];
        if (!currentState.extracted.learningGoal) currentState.missing.push('learningGoal');
        if (!currentState.extracted.priorKnowledge) currentState.missing.push('priorKnowledge');

        return {
          extracted: currentState.extracted,
          missing: currentState.missing,
          fieldSources: currentState.fieldSources,
        };
      };

      const result = updateField(state, 'learningGoal', 'Learn Python');

      expect(result.extracted.learningGoal).toBe('Learn Python');
      expect(result.fieldSources.learningGoal).toBe('user_filled');
      expect(result.missing).not.toContain('learningGoal');
    });

    it('should mark as user_edited when modifying existing value', () => {
      const state = createInitialState();
      state.part = 'clarify';
      state.extracted.learningGoal = 'Original value';
      state.fieldSources.learningGoal = 'extracted';

      const updateField = (
        currentState: ExplorationState,
        field: 'learningGoal' | 'priorKnowledge' | 'context',
        value: string
      ) => {
        const wasFilled = currentState.extracted[field] !== null;
        currentState.extracted[field] = value;
        currentState.fieldSources[field] = wasFilled ? 'user_edited' : 'user_filled';
        return currentState;
      };

      updateField(state, 'learningGoal', 'Updated value');

      expect(state.extracted.learningGoal).toBe('Updated value');
      expect(state.fieldSources.learningGoal).toBe('user_edited');
    });
  });

  describe('updateConstraints', () => {
    it('should update constraints array', () => {
      const state = createInitialState();
      state.part = 'clarify';
      state.extracted.constraints = [];

      const updateConstraints = (currentState: ExplorationState, constraints: string[]) => {
        currentState.extracted.constraints = constraints;
        return currentState;
      };

      updateConstraints(state, ['30 min/day', 'No weekends']);

      expect(state.extracted.constraints).toEqual(['30 min/day', 'No weekends']);
    });
  });

  describe('backToOrient', () => {
    it('should reset to orient phase keeping messages', () => {
      const state = createInitialState();
      state.part = 'clarify';
      state.messages = [
        { role: 'assistant', content: 'Welcome!', timestamp: '' },
        { role: 'user', content: 'Python', timestamp: '' },
      ];
      state.extracted = {
        learningGoal: 'Python',
        priorKnowledge: 'Beginner',
        context: null,
        constraints: [],
      };

      const backToOrient = (currentState: ExplorationState) => {
        currentState.part = 'orient';
        currentState.extracted = {
          learningGoal: null,
          priorKnowledge: null,
          context: null,
          constraints: [],
        };
        currentState.fieldSources = {
          learningGoal: null,
          priorKnowledge: null,
          context: null,
        };
        currentState.missing = ['learningGoal', 'priorKnowledge'];
        return currentState;
      };

      const result = backToOrient(state);

      expect(result.part).toBe('orient');
      expect(result.messages).toHaveLength(2); // Messages preserved
      expect(result.extracted.learningGoal).toBeNull();
      expect(result.missing).toContain('learningGoal');
    });
  });
});

describe('Clarify → Define Goal Transition', () => {
  describe('completeExploration', () => {
    it('should return ExplorationData when complete', () => {
      const state = createInitialState();
      state.part = 'clarify';
      state.extracted = {
        learningGoal: 'Learn Python',
        priorKnowledge: 'Complete beginner',
        context: 'Career change',
        constraints: ['30 min/day'],
      };
      state.missing = [];

      const completeExploration = (currentState: ExplorationState) => {
        if (currentState.part !== 'clarify') {
          throw new Error('Not in Clarify phase');
        }
        if (!currentState.extracted.learningGoal) {
          throw new Error('Learning goal is required');
        }
        if (!currentState.extracted.priorKnowledge) {
          throw new Error('Prior knowledge is required');
        }

        return {
          learningGoal: currentState.extracted.learningGoal,
          priorKnowledge: currentState.extracted.priorKnowledge,
          context: currentState.extracted.context || '',
          constraints: currentState.extracted.constraints,
          readyForCapstone: true,
        };
      };

      const result = completeExploration(state);

      expect(result.learningGoal).toBe('Learn Python');
      expect(result.priorKnowledge).toBe('Complete beginner');
      expect(result.readyForCapstone).toBe(true);
    });

    it('should throw if missing required fields', () => {
      const state = createInitialState();
      state.part = 'clarify';
      state.extracted.learningGoal = 'Python';
      state.extracted.priorKnowledge = null; // Missing

      const completeExploration = (currentState: ExplorationState) => {
        if (!currentState.extracted.priorKnowledge) {
          throw new Error('Prior knowledge is required');
        }
        return currentState;
      };

      expect(() => completeExploration(state)).toThrow('Prior knowledge is required');
    });

    it('should throw if not in clarify phase', () => {
      const state = createInitialState();
      state.part = 'orient';

      const completeExploration = (currentState: ExplorationState) => {
        if (currentState.part !== 'clarify') {
          throw new Error('Not in Clarify phase');
        }
        return currentState;
      };

      expect(() => completeExploration(state)).toThrow('Not in Clarify phase');
    });
  });
});
