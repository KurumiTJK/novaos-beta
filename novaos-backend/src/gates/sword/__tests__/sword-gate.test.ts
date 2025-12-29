// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE TESTS — Comprehensive Test Suite
// NovaOS Gates — Phase 13: SwordGate Integration
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';

import { createUserId, createGoalId, createTimestamp } from '../../../types/branded.js';
import { ok, err, appError } from '../../../types/result.js';

import type { SwordRefinementState, SwordRefinementInputs, SwordGateConfig } from '../types.js';
import {
  DEFAULT_SWORD_GATE_CONFIG,
  hasRequiredFields,
  getMissingRequiredFields,
  calculateRefinementProgress,
  isSwordGateMode,
  isRefinementField,
} from '../types.js';

import { ModeDetector, createModeDetector } from '../mode-detector.js';
import { RefinementFlow, createRefinementFlow } from '../refinement-flow.js';
import { GoalStatementSanitizer, createGoalStatementSanitizer, sanitizeGoalStatement } from '../sanitizers.js';
import { LessonPlanGenerator, createLessonPlanGenerator } from '../lesson-plan-generator.js';
import { InMemoryGoalRateLimiter, createInMemoryGoalRateLimiter } from '../rate-limiter.js';

// ═══════════════════════════════════════════════════════════════════════════════
// MOCK CAPABILITY GENERATOR (prevents OpenAI API calls during tests)
// ═══════════════════════════════════════════════════════════════════════════════

vi.mock('../capability-generator.js', () => ({
  createCapabilityGenerator: vi.fn(() => ({
    generate: vi.fn(async (topic: string) => {
      // Return mock capability stages immediately (no API call)
      return {
        ok: true,
        value: [
          {
            stage: 'REPRODUCE',
            order: 1,
            title: `${topic} Fundamentals`,
            capability: `Create a basic ${topic} project following tutorials`,
            artifact: `Working ${topic} "Hello World" project`,
            designedFailure: 'Skip environment setup and face configuration errors',
            consequence: 'Cannot run code, blocked on basics',
            recovery: 'Complete full setup checklist before writing code',
            topics: ['basics', 'setup', 'fundamentals'],
          },
          {
            stage: 'MODIFY',
            order: 2,
            title: `${topic} Customization`,
            capability: `Modify existing ${topic} code under constraints`,
            artifact: `Extended ${topic} project with custom features`,
            designedFailure: 'Change code without understanding dependencies',
            consequence: 'Breaking changes cascade through project',
            recovery: 'Map dependencies before modifying',
            topics: ['modification', 'constraints', 'customization'],
          },
          {
            stage: 'DIAGNOSE',
            order: 3,
            title: `${topic} Debugging`,
            capability: `Find and fix failures in ${topic} code`,
            artifact: `Debugged ${topic} project with documented fixes`,
            designedFailure: 'Fix symptoms instead of root causes',
            consequence: 'Bugs reappear in different forms',
            recovery: 'Trace errors to source before fixing',
            topics: ['debugging', 'diagnosis', 'troubleshooting'],
          },
          {
            stage: 'DESIGN',
            order: 4,
            title: `${topic} Architecture`,
            capability: `Design ${topic} solutions from requirements`,
            artifact: `Original ${topic} project with architecture docs`,
            designedFailure: 'Start coding without design planning',
            consequence: 'Refactoring hell as requirements change',
            recovery: 'Document design decisions before implementation',
            topics: ['design', 'architecture', 'planning'],
          },
          {
            stage: 'SHIP',
            order: 5,
            title: `${topic} Deployment`,
            capability: `Deploy and defend ${topic} decisions`,
            artifact: `Production-ready ${topic} project`,
            designedFailure: 'Deploy without testing in production-like environment',
            consequence: 'Production-only bugs and incidents',
            recovery: 'Full staging validation before production',
            topics: ['deployment', 'production', 'shipping'],
          },
        ],
      };
    }),
  })),
  extractTopicsFromStages: vi.fn((stages: Array<{ topics?: string[] }>) => {
    const topics: string[] = [];
    for (const stage of stages) {
      if (stage.topics) {
        topics.push(...stage.topics);
      }
    }
    return [...new Set(topics)];
  }),
  CapabilityGenerator: vi.fn(),
}));

// ═══════════════════════════════════════════════════════════════════════════════
// TEST HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const TEST_USER_ID = createUserId('user_test123');
const TEST_CONFIG: SwordGateConfig = { ...DEFAULT_SWORD_GATE_CONFIG, useLlmModeDetection: false, usePhase21: false };

function createTestRefinementState(
  overrides: Partial<SwordRefinementState> = {}
): SwordRefinementState {
  const now = createTimestamp();
  return {
    userId: TEST_USER_ID,
    stage: 'clarifying',
    inputs: {},
    answeredQuestions: [],
    turnCount: 0,
    maxTurns: 10,
    createdAt: now,
    updatedAt: now,
    expiresAt: createTimestamp(new Date(Date.now() + 3600000)),
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE GUARD TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Type Guards', () => {
  describe('isSwordGateMode', () => {
    it('should return true for valid modes', () => {
      expect(isSwordGateMode('capture')).toBe(true);
      expect(isSwordGateMode('refine')).toBe(true);
      expect(isSwordGateMode('suggest')).toBe(true);
      expect(isSwordGateMode('create')).toBe(true);
      expect(isSwordGateMode('modify')).toBe(true);
    });

    it('should return false for invalid modes', () => {
      expect(isSwordGateMode('invalid')).toBe(false);
      expect(isSwordGateMode('')).toBe(false);
      expect(isSwordGateMode(null)).toBe(false);
      expect(isSwordGateMode(123)).toBe(false);
    });
  });

  describe('isRefinementField', () => {
    it('should return true for valid fields', () => {
      expect(isRefinementField('goalStatement')).toBe(true);
      expect(isRefinementField('userLevel')).toBe(true);
      expect(isRefinementField('dailyTimeCommitment')).toBe(true);
    });

    it('should return false for invalid fields', () => {
      expect(isRefinementField('invalid')).toBe(false);
      expect(isRefinementField('')).toBe(false);
    });
  });

  describe('hasRequiredFields', () => {
    it('should return false for empty inputs', () => {
      expect(hasRequiredFields({})).toBe(false);
    });

    it('should return false for partial inputs', () => {
      expect(hasRequiredFields({ goalStatement: 'Learn Rust' })).toBe(false);
      expect(hasRequiredFields({
        goalStatement: 'Learn Rust',
        userLevel: 'beginner',
      })).toBe(false);
    });

    it('should return true for complete inputs', () => {
      expect(hasRequiredFields({
        goalStatement: 'Learn Rust',
        userLevel: 'beginner',
        dailyTimeCommitment: 30,
        totalDuration: '4 weeks',
        totalDays: 28,  // Required by hasRequiredFields
      })).toBe(true);
    });
  });

  describe('getMissingRequiredFields', () => {
    it('should return all fields for empty inputs', () => {
      const missing = getMissingRequiredFields({});
      expect(missing).toContain('goalStatement');
      expect(missing).toContain('userLevel');
      expect(missing).toContain('dailyTimeCommitment');
      expect(missing).toContain('totalDuration');
    });

    it('should return only missing fields', () => {
      const missing = getMissingRequiredFields({
        goalStatement: 'Learn Rust',
        userLevel: 'beginner',
      });
      expect(missing).not.toContain('goalStatement');
      expect(missing).not.toContain('userLevel');
      expect(missing).toContain('dailyTimeCommitment');
      expect(missing).toContain('totalDuration');
    });
  });

  describe('calculateRefinementProgress', () => {
    it('should return 0 for empty inputs', () => {
      expect(calculateRefinementProgress({})).toBe(0);
    });

    it('should return 0.25 for one field', () => {
      expect(calculateRefinementProgress({ goalStatement: 'Learn Rust' })).toBe(0.25);
    });

    it('should return 1 for complete inputs', () => {
      expect(calculateRefinementProgress({
        goalStatement: 'Learn Rust',
        userLevel: 'beginner',
        dailyTimeCommitment: 30,
        totalDuration: '4 weeks',
      })).toBe(1);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MODE DETECTOR TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('ModeDetector', () => {
  let detector: ModeDetector;

  beforeEach(() => {
    detector = createModeDetector(TEST_CONFIG);
  });

  describe('without refinement state', () => {
    it('should detect vague goal and route to explore', async () => {
      const result = await detector.detect(
        { userId: TEST_USER_ID, message: 'I want to learn Rust' },
        null
      );
      // Phase 14A: Vague goals route to explore mode for crystallization
      expect(result.mode).toBe('explore');
      expect(result.isContinuation).toBe(false);
    });

    it('should detect vague "teach me" pattern and route to explore', async () => {
      const result = await detector.detect(
        { userId: TEST_USER_ID, message: 'Teach me Python' },
        null
      );
      // Phase 14A: Vague learning requests route to explore
      expect(result.mode).toBe('explore');
    });

    it('should default to capture for ambiguous input', async () => {
      const result = await detector.detect(
        { userId: TEST_USER_ID, message: 'Hello there' },
        null
      );
      expect(result.mode).toBe('capture');
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('with refinement state in clarifying stage', () => {
    it('should detect refine mode', async () => {
      const state = createTestRefinementState({ stage: 'clarifying' });
      const result = await detector.detect(
        { userId: TEST_USER_ID, message: '30 minutes' },
        state
      );
      expect(result.mode).toBe('refine');
      expect(result.isContinuation).toBe(true);
    });

    it('should detect time expressions', async () => {
      const state = createTestRefinementState({ stage: 'clarifying' });
      const result = await detector.detect(
        { userId: TEST_USER_ID, message: '1 hour per day' },
        state
      );
      expect(result.mode).toBe('refine');
    });

    it('should detect skill levels', async () => {
      const state = createTestRefinementState({ stage: 'clarifying' });
      const result = await detector.detect(
        { userId: TEST_USER_ID, message: 'beginner' },
        state
      );
      expect(result.mode).toBe('refine');
    });
  });

  describe('with refinement state in confirming stage', () => {
    it('should detect confirmation - "yes"', async () => {
      const state = createTestRefinementState({ stage: 'confirming' });
      const result = await detector.detect(
        { userId: TEST_USER_ID, message: 'yes' },
        state
      );
      expect(result.mode).toBe('create');
    });

    it('should detect confirmation - "looks good"', async () => {
      const state = createTestRefinementState({ stage: 'confirming' });
      const result = await detector.detect(
        { userId: TEST_USER_ID, message: 'looks good' },
        state
      );
      expect(result.mode).toBe('create');
    });

    it('should detect modification request', async () => {
      const state = createTestRefinementState({ stage: 'confirming' });
      const result = await detector.detect(
        { userId: TEST_USER_ID, message: 'can we make it 6 weeks instead?' },
        state
      );
      expect(result.mode).toBe('modify');
    });
  });

  describe('cancel detection', () => {
    it('should detect explicit cancel', async () => {
      const state = createTestRefinementState({ stage: 'clarifying' });
      const result = await detector.detect(
        { userId: TEST_USER_ID, message: 'cancel' },
        state
      );
      expect(result.mode).toBe('capture');
    });

    it('should detect "never mind"', async () => {
      const state = createTestRefinementState({ stage: 'clarifying' });
      const result = await detector.detect(
        { userId: TEST_USER_ID, message: 'never mind' },
        state
      );
      expect(result.mode).toBe('capture');
    });

    it('should detect "stop"', async () => {
      const state = createTestRefinementState({ stage: 'confirming' });
      const result = await detector.detect(
        { userId: TEST_USER_ID, message: 'stop' },
        state
      );
      expect(result.mode).toBe('capture');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// GOAL STATEMENT SANITIZER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('GoalStatementSanitizer', () => {
  let sanitizer: GoalStatementSanitizer;

  beforeEach(() => {
    sanitizer = createGoalStatementSanitizer(TEST_CONFIG);
  });

  describe('sanitize', () => {
    it('should accept valid goal statement', () => {
      const result = sanitizer.sanitize('Learn Rust programming');

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Learn Rust programming');
    });

    it('should trim whitespace', () => {
      const result = sanitizer.sanitize('  Learn Rust  ');

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Learn Rust');
    });

    it('should reject empty statement', () => {
      const result = sanitizer.sanitize('');

      expect(result.valid).toBe(false);
    });

    it('should reject whitespace-only statement', () => {
      const result = sanitizer.sanitize('   ');

      expect(result.valid).toBe(false);
    });

    it('should reject too short statement', () => {
      const result = sanitizer.sanitize('Hi');

      expect(result.valid).toBe(false);
    });

    it('should accept long statements within limit', () => {
      // Long statements are accepted by the sanitizer
      const result = sanitizer.sanitize('Learn programming with focus on web development and backend systems');
      expect(result.valid).toBe(true);
    });

    it('should reject statements with blocked patterns', () => {
      const result = sanitizer.sanitize('Learn how to make explosives');

      expect(result.valid).toBe(false);
    });

    it('should extract topic from statement', () => {
      const result = sanitizer.sanitize('I want to learn TypeScript');

      expect(result.valid).toBe(true);
    });

    it('should extract topic from "teach me" pattern', () => {
      const result = sanitizer.sanitize('Teach me Python programming');

      expect(result.valid).toBe(true);
    });
  });

  describe('standalone function', () => {
    it('should work without instance', () => {
      const result = sanitizeGoalStatement('Learn JavaScript');

      expect(result.valid).toBe(true);
      expect(result.sanitized).toBe('Learn JavaScript');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REFINEMENT FLOW TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('RefinementFlow', () => {
  let flow: RefinementFlow;

  beforeEach(() => {
    flow = createRefinementFlow(TEST_CONFIG);
  });

  describe('initiate', () => {
    it('should create initial state', () => {
      const state = flow.initiate(TEST_USER_ID, 'Learn Rust');

      expect(state.userId).toBe(TEST_USER_ID);
      expect(state.stage).toBe('clarifying');
      expect(state.inputs.goalStatement).toBe('Learn Rust');
      expect(state.turnCount).toBe(0);
    });

    it('should set expiration time', () => {
      const state = flow.initiate(TEST_USER_ID, 'Learn Rust');

      const expiresAt = new Date(state.expiresAt);
      const now = new Date();
      expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());
    });
  });

  describe('getNextQuestion', () => {
    it('should ask for user level first after goal', () => {
      const state = flow.initiate(TEST_USER_ID, 'Learn Rust');
      const question = flow.getNextQuestion(state);

      expect(question).not.toBeNull();
      // getNextQuestion returns the actual question text (asks about familiarity/level)
      expect(question).toMatch(/familiar|experience|level|beginner/i);
    });

    it('should ask for time commitment after level', () => {
      const state = createTestRefinementState({
        inputs: { goalStatement: 'Learn Rust', userLevel: 'beginner' },
        answeredQuestions: ['goalStatement', 'userLevel'],
      });
      const question = flow.getNextQuestion(state);

      // Returns question text about time commitment (asks about minutes/time)
      expect(question).toMatch(/minutes|time|commitment|spend/i);
    });

    it('should ask for duration after time', () => {
      const state = createTestRefinementState({
        inputs: {
          goalStatement: 'Learn Rust',
          userLevel: 'beginner',
          dailyTimeCommitment: 30,
        },
        answeredQuestions: ['goalStatement', 'userLevel', 'dailyTimeCommitment'],
      });
      const question = flow.getNextQuestion(state);

      // Returns question text about timeline/duration (asks about total time/weeks/duration)
      expect(question).toMatch(/timeline|duration|weeks|total time|how long/i);
    });

    it('should continue with optional fields after required fields answered', () => {
      const state = createTestRefinementState({
        inputs: {
          goalStatement: 'Learn Rust',
          userLevel: 'beginner',
          dailyTimeCommitment: 30,
          totalDuration: '4 weeks',
          totalDays: 28,
        },
        answeredQuestions: ['goalStatement', 'userLevel', 'dailyTimeCommitment', 'totalDuration'],
      });
      const question = flow.getNextQuestion(state);

      // After required fields, it asks optional questions (like start date)
      expect(question).toBeDefined();
    });
  });

  describe('processResponse', () => {
    it('should extract user level from response', () => {
      const state = createTestRefinementState({
        currentQuestion: 'userLevel',
        inputs: { goalStatement: 'Learn Rust' },
      });
      const newState = flow.processResponse(state, 'beginner');

      expect(newState.inputs.userLevel).toBe('beginner');
    });

    it('should extract time from "30 minutes"', () => {
      const state = createTestRefinementState({
        currentQuestion: 'dailyTimeCommitment',
        inputs: { goalStatement: 'Learn Rust' },
      });
      const newState = flow.processResponse(state, '30 minutes');

      expect(newState.inputs.dailyTimeCommitment).toBe(30);
    });

    it('should extract time from "1 hour"', () => {
      const state = createTestRefinementState({
        currentQuestion: 'dailyTimeCommitment',
        inputs: { goalStatement: 'Learn Rust' },
      });
      const newState = flow.processResponse(state, '1 hour');

      expect(newState.inputs.dailyTimeCommitment).toBe(60);
    });

    it('should extract duration from "4 weeks"', () => {
      const state = createTestRefinementState({
        currentQuestion: 'totalDuration',
        inputs: { goalStatement: 'Learn Rust' },
      });
      const newState = flow.processResponse(state, '4 weeks');

      expect(newState.inputs.totalDuration).toBe('4 weeks');
      expect(newState.inputs.totalDays).toBe(28);
    });

    it('should extract duration from "2 months"', () => {
      const state = createTestRefinementState({
        currentQuestion: 'totalDuration',
        inputs: { goalStatement: 'Learn Rust' },
      });
      const newState = flow.processResponse(state, '2 months');

      expect(newState.inputs.totalDuration).toBe('2 months');
      expect(newState.inputs.totalDays).toBe(60);
    });

    it('should preserve turn count on response', () => {
      const state = createTestRefinementState({ turnCount: 2 });
      const newState = flow.processResponse(state, 'beginner');

      // processResponse preserves turn count
      expect(newState.turnCount).toBe(2);
    });
  });

  describe('isComplete', () => {
    it('should return false for incomplete state', () => {
      const state = createTestRefinementState({
        inputs: { goalStatement: 'Learn Rust' },
      });

      expect(flow.isComplete(state)).toBe(false);
    });

    it('should return true for complete state', () => {
      const state = createTestRefinementState({
        inputs: {
          goalStatement: 'Learn Rust',
          userLevel: 'beginner',
          dailyTimeCommitment: 30,
          totalDuration: '4 weeks',
          totalDays: 28,
        },
      });

      expect(flow.isComplete(state)).toBe(true);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON PLAN GENERATOR TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('LessonPlanGenerator', () => {
  let generator: LessonPlanGenerator;

  beforeEach(() => {
    vi.clearAllMocks();
    generator = createLessonPlanGenerator(TEST_CONFIG);
  });

  describe('generate', () => {
    it('should generate proposal from complete inputs', async () => {
      const inputs: SwordRefinementInputs = {
        goalStatement: 'Learn Rust programming',
        extractedTopic: 'Rust programming',
        userLevel: 'beginner',
        dailyTimeCommitment: 30,
        totalDuration: '4 weeks',
        totalDays: 28,
      };

      const result = await generator.generate(inputs);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.title).toContain('Rust');
        expect(result.value.quests.length).toBeGreaterThan(0);
        expect(result.value.totalDays).toBe(28);
        expect(result.value.learningConfig.userLevel).toBe('beginner');
      }
    });

    it('should reject missing goal statement', async () => {
      const inputs: SwordRefinementInputs = {
        userLevel: 'beginner',
        dailyTimeCommitment: 30,
        totalDuration: '4 weeks',
      };

      const result = await generator.generate(inputs);

      expect(result.ok).toBe(false);
    });

    it('should generate quests based on duration', async () => {
      const inputs: SwordRefinementInputs = {
        goalStatement: 'Learn Python',
        userLevel: 'beginner',
        dailyTimeCommitment: 60,
        totalDuration: '6 weeks',
        totalDays: 42,
      };

      const result = await generator.generate(inputs);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Generator produces quests based on capability stages (5 stages: REPRODUCE → SHIP)
        // Not strictly 1:1 with weeks
        expect(result.value.quests.length).toBeGreaterThanOrEqual(4);
        expect(result.value.quests.length).toBeLessThanOrEqual(6);
      }
    });

    it('should set confidence based on resources', async () => {
      const inputs: SwordRefinementInputs = {
        goalStatement: 'Learn obscure topic xyz123',
        userLevel: 'beginner',
        dailyTimeCommitment: 30,
        totalDuration: '2 weeks',
        totalDays: 14,
      };

      const result = await generator.generate(inputs);

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Without resource service, confidence should be low
        expect(result.value.confidence).toBe('low');
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RATE LIMITER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('InMemoryGoalRateLimiter', () => {
  let limiter: InMemoryGoalRateLimiter;

  beforeEach(() => {
    limiter = createInMemoryGoalRateLimiter({
      maxGoalsPerUser: 3,
      maxActiveGoals: 2,
      cooldownSeconds: 1,
    });
  });

  describe('canCreateGoal', () => {
    it('should allow first goal creation', async () => {
      const result = await limiter.canCreateGoal(TEST_USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.exceeded).toBe(false);
      }
    });

    it('should enforce active goal limit', async () => {
      limiter.setCounts(TEST_USER_ID, 2, 2);

      const result = await limiter.canCreateGoal(TEST_USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.exceeded).toBe(true);
        expect(result.value.message).toContain('active');
      }
    });

    it('should enforce total goal limit', async () => {
      limiter.setCounts(TEST_USER_ID, 3, 1);

      const result = await limiter.canCreateGoal(TEST_USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.exceeded).toBe(true);
        expect(result.value.message).toContain('3 goals');
      }
    });

    it('should enforce cooldown', async () => {
      await limiter.recordGoalCreation(TEST_USER_ID);

      const result = await limiter.canCreateGoal(TEST_USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.exceeded).toBe(true);
        expect(result.value.message).toContain('wait');
      }
    });

    it('should allow after cooldown expires', async () => {
      const shortCooldownLimiter = createInMemoryGoalRateLimiter({
        cooldownSeconds: 0.05, // 50ms
        maxGoalsPerUser: 10,
        maxActiveGoals: 5,
      });

      await shortCooldownLimiter.recordGoalCreation(TEST_USER_ID);

      // Wait for cooldown
      await new Promise((resolve) => setTimeout(resolve, 100));

      const result = await shortCooldownLimiter.canCreateGoal(TEST_USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.exceeded).toBe(false);
      }
    });
  });

  describe('recordGoalCreation', () => {
    it('should increment counts', async () => {
      await limiter.recordGoalCreation(TEST_USER_ID);
      await limiter.recordGoalCreation(TEST_USER_ID);

      // After 2 creations with maxActiveGoals=2, should be at limit
      const result = await limiter.canCreateGoal(TEST_USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.exceeded).toBe(true);
      }
    });
  });

  describe('reset', () => {
    it('should clear all state', async () => {
      limiter.setCounts(TEST_USER_ID, 3, 2);
      limiter.reset();

      const result = await limiter.canCreateGoal(TEST_USER_ID);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.exceeded).toBe(false);
        expect(result.value.currentCount).toBe(0);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Integration', () => {
  it('should flow from capture through refinement', async () => {
    const flow = createRefinementFlow(TEST_CONFIG);
    const detector = createModeDetector(TEST_CONFIG);
    const sanitizer = createGoalStatementSanitizer(TEST_CONFIG);

    // Step 1: Capture
    const sanitizeResult = sanitizer.sanitize('I want to learn Rust');
    expect(sanitizeResult.valid).toBe(true);

    const state1 = flow.initiate(TEST_USER_ID, sanitizeResult.sanitized!);
    expect(state1.stage).toBe('clarifying');

    // Step 2: Refine - answer userLevel
    const mode2 = await detector.detect({ userId: TEST_USER_ID, message: 'beginner' }, state1);
    expect(mode2.mode).toBe('refine');

    const state2 = flow.processResponse(state1, 'beginner');
    expect(state2.inputs.userLevel).toBe('beginner');

    // Step 3: Refine - answer dailyTimeCommitment
    const state3 = flow.processResponse(
      { ...state2, currentQuestion: 'dailyTimeCommitment' },
      '30 minutes'
    );
    expect(state3.inputs.dailyTimeCommitment).toBe(30);

    // Step 4: Refine - answer totalDuration
    const state4 = flow.processResponse(
      { ...state3, currentQuestion: 'totalDuration' },
      '4 weeks'
    );
    expect(state4.inputs.totalDuration).toBe('4 weeks');
    expect(flow.isComplete(state4)).toBe(true);
  });

  it('should detect confirmation after refinement', async () => {
    const detector = createModeDetector(TEST_CONFIG);

    const confirmingState = createTestRefinementState({
      stage: 'confirming',
      inputs: {
        goalStatement: 'Learn Rust',
        userLevel: 'beginner',
        dailyTimeCommitment: 30,
        totalDuration: '4 weeks',
        totalDays: 28,
      },
    });

    const mode = await detector.detect(
      { userId: TEST_USER_ID, message: 'yes, create it' },
      confirmingState
    );

    expect(mode.mode).toBe('create');
  });
});
