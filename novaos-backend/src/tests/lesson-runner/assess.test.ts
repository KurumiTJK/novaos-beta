// ═══════════════════════════════════════════════════════════════════════════════
// ASSESS HANDLER TESTS
// Tests for diagnostic assessment flow, scoring, and routing
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
} from './setup';

// Import the module under test
import { AssessmentHandler } from '@services/sword/lesson-runner/router/assess';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST DATA
// ─────────────────────────────────────────────────────────────────────────────────

const testUser = createTestUser({ id: 'user-123', externalId: 'user_ext_123' });

const testPlan = createTestLessonPlan({
  id: 'plan-123',
  userId: 'user-123',
  title: 'Learn TypeScript',
});

const testSubskill = {
  ...createTestPlanSubskill({
    id: 'subskill-123',
    planId: 'plan-123',
    title: 'TypeScript Generics',
    route: 'recall',
    status: 'assess',
  }),
  route_status: 'assess',
};

const mockDiagnosticQuestions = [
  {
    id: 'q1',
    area: 'Core Concepts',
    question: 'What is a generic type in TypeScript?',
    type: 'multiple_choice',
    options: ['A type that works with any type', 'A specific type', 'A number type', 'A string type'],
    correctAnswer: 'A type that works with any type',
    explanation: 'Generics allow types to be parameterized.',
    difficulty: 1,
  },
  {
    id: 'q2',
    area: 'Core Concepts',
    question: 'What syntax is used for generics?',
    type: 'multiple_choice',
    options: ['<T>', '[T]', '{T}', '(T)'],
    correctAnswer: '<T>',
    explanation: 'Angle brackets are used for generic type parameters.',
    difficulty: 1,
  },
  {
    id: 'q3',
    area: 'Application',
    question: 'When should you use generics?',
    type: 'multiple_choice',
    options: ['When you need type-safe reusable code', 'Never', 'Only for arrays', 'Only for functions'],
    correctAnswer: 'When you need type-safe reusable code',
    explanation: 'Generics provide type safety with flexibility.',
    difficulty: 2,
  },
  {
    id: 'q4',
    area: 'Application',
    question: 'Can generics have constraints?',
    type: 'multiple_choice',
    options: ['Yes, using extends', 'No', 'Only in classes', 'Only in interfaces'],
    correctAnswer: 'Yes, using extends',
    explanation: 'The extends keyword constrains generic types.',
    difficulty: 2,
  },
  {
    id: 'q5',
    area: 'Integration',
    question: 'How do generics work with interfaces?',
    type: 'multiple_choice',
    options: ['Interfaces can be generic', 'They cannot be combined', 'Only classes support generics', 'Interfaces must be concrete'],
    correctAnswer: 'Interfaces can be generic',
    explanation: 'Interfaces support generic type parameters.',
    difficulty: 3,
  },
];

const mockAssessmentRow = {
  id: 'assessment-123',
  subskill_id: 'subskill-123',
  user_id: 'user-123',
  questions: mockDiagnosticQuestions,
  answers: null,
  score: null,
  area_results: null,
  gaps: null,
  strengths: null,
  recommendation: null,
  started_at: new Date().toISOString(),
  completed_at: null,
};

// ─────────────────────────────────────────────────────────────────────────────────
// HANDLE ASSESS FLOW TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('AssessmentHandler.handle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return existing incomplete assessment if found', async () => {
    const mockQuery = createMockSupabaseQuery();
    mockQuery.single.mockResolvedValue({ data: mockAssessmentRow, error: null });
    mockSupabaseClient.from.mockReturnValue(mockQuery);

    const result = await AssessmentHandler.handle(
      'user_ext_123',
      {
        id: 'subskill-123',
        planId: 'plan-123',
        title: 'TypeScript Generics',
        route: 'recall',
        complexity: 2,
        order: 1,
        status: 'assess',
      } as any,
      testPlan as any
    );

    expect(result.routeType).toBe('assess');
    expect(result.assessment).toBeDefined();
    expect(result.assessment?.id).toBe('assessment-123');
  });

  it('should generate new assessment if none exists', async () => {
    // First query returns no existing assessment
    const mockQuery1 = createMockSupabaseQuery();
    mockQuery1.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

    // Insert returns new assessment
    const mockQuery2 = createMockSupabaseQuery();
    mockQuery2.single.mockResolvedValue({ data: mockAssessmentRow, error: null });

    let callCount = 0;
    mockSupabaseClient.from.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockQuery1 : mockQuery2;
    });

    // Mock LLM response
    setMockLLMResponse('diagnostic', JSON.stringify({ questions: mockDiagnosticQuestions }));

    const result = await AssessmentHandler.handle(
      'user_ext_123',
      {
        id: 'subskill-123',
        planId: 'plan-123',
        title: 'TypeScript Generics',
        route: 'recall',
        complexity: 2,
        order: 1,
        status: 'assess',
      } as any,
      testPlan as any
    );

    expect(result.routeType).toBe('assess');
    expect(result.assessment).toBeDefined();
  });

  it('should use template questions when LLM fails', async () => {
    const mockQuery1 = createMockSupabaseQuery();
    mockQuery1.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

    const mockQuery2 = createMockSupabaseQuery();
    mockQuery2.single.mockResolvedValue({ data: mockAssessmentRow, error: null });

    let callCount = 0;
    mockSupabaseClient.from.mockImplementation(() => {
      callCount++;
      return callCount === 1 ? mockQuery1 : mockQuery2;
    });

    // Mock LLM to fail
    mockSwordGateLLM.generate.mockRejectedValueOnce(new Error('LLM unavailable'));

    const result = await AssessmentHandler.handle(
      'user_ext_123',
      {
        id: 'subskill-123',
        planId: 'plan-123',
        title: 'TypeScript Generics',
        route: 'recall',
        complexity: 2,
        order: 1,
        status: 'assess',
      } as any,
      testPlan as any
    );

    expect(result.routeType).toBe('assess');
    expect(result.assessment).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SCORING TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('AssessmentHandler.score', () => {
  it('should calculate correct score for all correct answers', () => {
    const answers = mockDiagnosticQuestions.map(q => ({
      questionId: q.id,
      answer: q.correctAnswer,
    }));

    const result = AssessmentHandler.score(mockDiagnosticQuestions, answers);

    expect(result.score).toBe(100);
    expect(result.gaps).toHaveLength(0);
    expect(result.strengths).toContain('Core Concepts');
    expect(result.strengths).toContain('Application');
    expect(result.strengths).toContain('Integration');
  });

  it('should calculate correct score for all wrong answers', () => {
    const answers = mockDiagnosticQuestions.map(q => ({
      questionId: q.id,
      answer: 'Wrong answer',
    }));

    const result = AssessmentHandler.score(mockDiagnosticQuestions, answers);

    expect(result.score).toBe(0);
    expect(result.gaps.length).toBeGreaterThan(0);
    expect(result.strengths).toHaveLength(0);
  });

  it('should calculate correct score for partial answers', () => {
    // Answer 3 out of 5 correctly (60%)
    const answers = [
      { questionId: 'q1', answer: 'A type that works with any type' }, // Correct
      { questionId: 'q2', answer: '<T>' }, // Correct
      { questionId: 'q3', answer: 'When you need type-safe reusable code' }, // Correct
      { questionId: 'q4', answer: 'Wrong' }, // Wrong
      { questionId: 'q5', answer: 'Wrong' }, // Wrong
    ];

    const result = AssessmentHandler.score(mockDiagnosticQuestions, answers);

    expect(result.score).toBe(60);
  });

  it('should identify gaps correctly', () => {
    // Miss all Application questions
    const answers = [
      { questionId: 'q1', answer: 'A type that works with any type' }, // Core - Correct
      { questionId: 'q2', answer: '<T>' }, // Core - Correct
      { questionId: 'q3', answer: 'Wrong' }, // Application - Wrong
      { questionId: 'q4', answer: 'Wrong' }, // Application - Wrong
      { questionId: 'q5', answer: 'Interfaces can be generic' }, // Integration - Correct
    ];

    const result = AssessmentHandler.score(mockDiagnosticQuestions, answers);

    const applicationGap = result.gaps.find(g => g.area === 'Application');
    expect(applicationGap).toBeDefined();
    expect(applicationGap?.status).toBe('gap');
  });

  it('should handle case-insensitive answers', () => {
    const answers = [
      { questionId: 'q1', answer: 'a type that works with any type' }, // lowercase
      { questionId: 'q2', answer: '<T>' },
      { questionId: 'q3', answer: 'WHEN YOU NEED TYPE-SAFE REUSABLE CODE' }, // uppercase
      { questionId: 'q4', answer: 'Yes, using extends' },
      { questionId: 'q5', answer: 'Interfaces can be generic' },
    ];

    const result = AssessmentHandler.score(mockDiagnosticQuestions, answers);

    expect(result.score).toBe(100);
  });

  it('should handle missing answers as wrong', () => {
    const answers = [
      { questionId: 'q1', answer: 'A type that works with any type' },
      // Missing q2, q3, q4, q5
    ];

    const result = AssessmentHandler.score(mockDiagnosticQuestions, answers);

    expect(result.score).toBe(20); // 1 out of 5
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SUBMIT TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('AssessmentHandler.submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return autopass recommendation for score >= 85', async () => {
    const mockQuery = createMockSupabaseQuery();
    
    // Get assessment
    mockQuery.single
      .mockResolvedValueOnce({ data: mockAssessmentRow, error: null })
      // Update assessment
      .mockResolvedValueOnce({ 
        data: { ...mockAssessmentRow, score: 100, recommendation: 'autopass', completed_at: new Date().toISOString() }, 
        error: null 
      })
      // Get subskill
      .mockResolvedValueOnce({ data: testSubskill, error: null })
      // Get plan
      .mockResolvedValueOnce({ data: testPlan, error: null })
      // Update subskill (mastered)
      .mockResolvedValueOnce({ data: testSubskill, error: null })
      // Get next subskill
      .mockResolvedValueOnce({ data: null, error: null });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    const answers = mockDiagnosticQuestions.map(q => ({
      questionId: q.id,
      answer: q.correctAnswer,
    }));

    const result = await AssessmentHandler.submit('user_ext_123', 'assessment-123', answers);

    expect(result.recommendation).toBe('autopass');
    expect(result.nextAction).toBe('autopass');
  });

  it('should return targeted recommendation for score 50-84', async () => {
    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: mockAssessmentRow, error: null })
      .mockResolvedValueOnce({ 
        data: { ...mockAssessmentRow, score: 60, recommendation: 'targeted', completed_at: new Date().toISOString() }, 
        error: null 
      })
      .mockResolvedValueOnce({ data: testSubskill, error: null })
      .mockResolvedValueOnce({ data: testPlan, error: null })
      .mockResolvedValueOnce({ data: testSubskill, error: null })
      .mockResolvedValueOnce({ data: { id: 'lesson-plan-123' }, error: null });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    // 3 correct out of 5 = 60%
    const answers = [
      { questionId: 'q1', answer: 'A type that works with any type' },
      { questionId: 'q2', answer: '<T>' },
      { questionId: 'q3', answer: 'When you need type-safe reusable code' },
      { questionId: 'q4', answer: 'Wrong' },
      { questionId: 'q5', answer: 'Wrong' },
    ];

    const result = await AssessmentHandler.submit('user_ext_123', 'assessment-123', answers);

    expect(result.recommendation).toBe('targeted');
    expect(result.nextAction).toBe('start_remediation');
  });

  it('should return convert_learn recommendation for score < 50', async () => {
    const mockQuery = createMockSupabaseQuery();
    
    mockQuery.single
      .mockResolvedValueOnce({ data: mockAssessmentRow, error: null })
      .mockResolvedValueOnce({ 
        data: { ...mockAssessmentRow, score: 20, recommendation: 'convert_learn', completed_at: new Date().toISOString() }, 
        error: null 
      })
      .mockResolvedValueOnce({ data: testSubskill, error: null })
      .mockResolvedValueOnce({ data: testPlan, error: null })
      .mockResolvedValueOnce({ data: testSubskill, error: null })
      .mockResolvedValueOnce({ data: { id: 'lesson-plan-123' }, error: null });

    mockSupabaseClient.from.mockReturnValue(mockQuery);

    // Only 1 correct = 20%
    const answers = [
      { questionId: 'q1', answer: 'A type that works with any type' },
      { questionId: 'q2', answer: 'Wrong' },
      { questionId: 'q3', answer: 'Wrong' },
      { questionId: 'q4', answer: 'Wrong' },
      { questionId: 'q5', answer: 'Wrong' },
    ];

    const result = await AssessmentHandler.submit('user_ext_123', 'assessment-123', answers);

    expect(result.recommendation).toBe('convert_learn');
    expect(result.nextAction).toBe('start_learning');
  });

  it('should throw error if assessment not found', async () => {
    const mockQuery = createMockSupabaseQuery();
    mockQuery.single.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
    mockSupabaseClient.from.mockReturnValue(mockQuery);

    await expect(
      AssessmentHandler.submit('user_ext_123', 'nonexistent', [])
    ).rejects.toThrow('Assessment not found');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// GET FOR USER TESTS (strips correct answers)
// ─────────────────────────────────────────────────────────────────────────────────

describe('AssessmentHandler.getForUser', () => {
  it('should strip correct answers from questions', () => {
    const assessment = {
      id: 'assessment-123',
      subskillId: 'subskill-123',
      userId: 'user-123',
      questions: mockDiagnosticQuestions,
      startedAt: new Date(),
    };

    const result = AssessmentHandler.getForUser(assessment as any);

    expect(result.id).toBe('assessment-123');
    expect(result.questions).toHaveLength(5);
    
    // Verify correct answers are stripped
    result.questions.forEach(q => {
      expect(q).not.toHaveProperty('correctAnswer');
      expect(q).not.toHaveProperty('explanation');
      expect(q).toHaveProperty('id');
      expect(q).toHaveProperty('question');
      expect(q).toHaveProperty('type');
      expect(q).toHaveProperty('options');
    });
  });

  it('should preserve question metadata', () => {
    const assessment = {
      id: 'assessment-123',
      subskillId: 'subskill-123',
      userId: 'user-123',
      questions: mockDiagnosticQuestions,
      startedAt: new Date(),
    };

    const result = AssessmentHandler.getForUser(assessment as any);

    expect(result.questions[0].area).toBe('Core Concepts');
    expect(result.questions[0].difficulty).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// GET RESULTS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('AssessmentHandler.getResults', () => {
  it('should return detailed results for completed assessment', () => {
    const completedAssessment = {
      id: 'assessment-123',
      subskillId: 'subskill-123',
      userId: 'user-123',
      questions: mockDiagnosticQuestions,
      answers: [
        { questionId: 'q1', answer: 'A type that works with any type' },
        { questionId: 'q2', answer: '<T>' },
        { questionId: 'q3', answer: 'Wrong' },
        { questionId: 'q4', answer: 'Wrong' },
        { questionId: 'q5', answer: 'Wrong' },
      ],
      score: 40,
      areaResults: [
        { area: 'Core Concepts', questionsTotal: 2, questionsCorrect: 2, score: 100, status: 'strong' },
        { area: 'Application', questionsTotal: 2, questionsCorrect: 0, score: 0, status: 'gap' },
        { area: 'Integration', questionsTotal: 1, questionsCorrect: 0, score: 0, status: 'gap' },
      ],
      gaps: [{ area: 'Application', score: 0, status: 'gap', priority: 'high' }],
      strengths: ['Core Concepts'],
      recommendation: 'convert_learn',
      startedAt: new Date(),
      completedAt: new Date(),
    };

    const result = AssessmentHandler.getResults(completedAssessment as any);

    expect(result.score).toBe(40);
    expect(result.recommendation).toBe('convert_learn');
    expect(result.questionResults).toHaveLength(5);
    expect(result.questionResults[0].isCorrect).toBe(true);
    expect(result.questionResults[2].isCorrect).toBe(false);
  });

  it('should throw error for incomplete assessment', () => {
    const incompleteAssessment = {
      id: 'assessment-123',
      subskillId: 'subskill-123',
      userId: 'user-123',
      questions: mockDiagnosticQuestions,
      startedAt: new Date(),
      completedAt: undefined, // Not completed
    };

    expect(() => AssessmentHandler.getResults(incompleteAssessment as any)).toThrow('Assessment not completed');
  });
});
