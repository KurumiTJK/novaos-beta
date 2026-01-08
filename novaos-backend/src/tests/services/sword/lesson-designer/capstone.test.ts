// ═══════════════════════════════════════════════════════════════════════════════
// CAPSTONE TESTS
// Tests for capstone generation with LLM and fallback
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

interface CapstoneInput {
  learningGoal: string;
  priorKnowledge: string | null;
  context: string | null;
  constraints: string[];
}

interface CapstoneOutput {
  title: string;
  statement: string;
  successCriteria: string[];
  estimatedTime: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function validateCapstone(capstone: CapstoneOutput): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!capstone.title || capstone.title.length < 3) {
    errors.push('Title must be at least 3 characters');
  }
  if (capstone.title && capstone.title.length > 100) {
    errors.push('Title must be under 100 characters');
  }
  if (!capstone.statement || capstone.statement.length < 20) {
    errors.push('Statement must be at least 20 characters');
  }
  if (!capstone.successCriteria || capstone.successCriteria.length < 1) {
    errors.push('Must have at least 1 success criterion');
  }
  if (capstone.successCriteria && capstone.successCriteria.length > 10) {
    errors.push('Must have at most 10 success criteria');
  }
  if (!capstone.estimatedTime) {
    errors.push('Estimated time is required');
  }

  return { valid: errors.length === 0, errors };
}

function parseEstimatedTime(estimatedTime: string): { weeks: number; minutesPerDay: number } | null {
  // Parse formats like "4 weeks at 30 minutes per day" or "6 weeks at 1 hour per day"
  const match = estimatedTime.match(/(\d+)\s*weeks?\s+at\s+(\d+)\s*(minutes?|hours?|min|hr)/i);
  if (!match) return null;

  const weeks = parseInt(match[1], 10);
  let minutesPerDay = parseInt(match[2], 10);
  
  if (match[3].toLowerCase().startsWith('hour') || match[3].toLowerCase() === 'hr') {
    minutesPerDay *= 60;
  }

  return { weeks, minutesPerDay };
}

function generateFallbackCapstone(input: CapstoneInput): CapstoneOutput {
  const goal = input.learningGoal || 'this skill';
  
  return {
    title: `Learn ${goal.slice(0, 50)}`,
    statement: `The learner will be able to demonstrate foundational competency in ${goal} through practical application.`,
    successCriteria: [
      `Can explain core concepts of ${goal}`,
      `Can complete basic exercises independently`,
      `Can identify when to apply learned skills`,
    ],
    estimatedTime: '4 weeks at 30 minutes per day',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Capstone Validation', () => {
  describe('validateCapstone', () => {
    it('should accept valid capstone', () => {
      const capstone: CapstoneOutput = {
        title: 'Python Basics',
        statement: 'The learner will be able to build a working web scraper that extracts data from websites.',
        successCriteria: ['Scrape 3 sites', 'Handle errors', 'Store in JSON'],
        estimatedTime: '4 weeks at 30 minutes per day',
      };

      const result = validateCapstone(capstone);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short title', () => {
      const capstone: CapstoneOutput = {
        title: 'Py',
        statement: 'A valid statement that is long enough for validation.',
        successCriteria: ['Criterion 1'],
        estimatedTime: '4 weeks at 30 minutes per day',
      };

      const result = validateCapstone(capstone);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title must be at least 3 characters');
    });

    it('should reject long title', () => {
      const capstone: CapstoneOutput = {
        title: 'A'.repeat(101),
        statement: 'A valid statement that is long enough for validation.',
        successCriteria: ['Criterion 1'],
        estimatedTime: '4 weeks at 30 minutes per day',
      };

      const result = validateCapstone(capstone);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title must be under 100 characters');
    });

    it('should reject short statement', () => {
      const capstone: CapstoneOutput = {
        title: 'Valid Title',
        statement: 'Too short',
        successCriteria: ['Criterion 1'],
        estimatedTime: '4 weeks at 30 minutes per day',
      };

      const result = validateCapstone(capstone);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Statement must be at least 20 characters');
    });

    it('should reject empty success criteria', () => {
      const capstone: CapstoneOutput = {
        title: 'Valid Title',
        statement: 'A valid statement that is long enough for validation.',
        successCriteria: [],
        estimatedTime: '4 weeks at 30 minutes per day',
      };

      const result = validateCapstone(capstone);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Must have at least 1 success criterion');
    });

    it('should reject too many success criteria', () => {
      const capstone: CapstoneOutput = {
        title: 'Valid Title',
        statement: 'A valid statement that is long enough for validation.',
        successCriteria: Array(11).fill('Criterion'),
        estimatedTime: '4 weeks at 30 minutes per day',
      };

      const result = validateCapstone(capstone);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Must have at most 10 success criteria');
    });

    it('should reject missing estimated time', () => {
      const capstone: CapstoneOutput = {
        title: 'Valid Title',
        statement: 'A valid statement that is long enough for validation.',
        successCriteria: ['Criterion 1'],
        estimatedTime: '',
      };

      const result = validateCapstone(capstone);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Estimated time is required');
    });
  });
});

describe('parseEstimatedTime', () => {
  it('should parse weeks with minutes', () => {
    const result = parseEstimatedTime('4 weeks at 30 minutes per day');
    expect(result).toEqual({ weeks: 4, minutesPerDay: 30 });
  });

  it('should parse weeks with hours', () => {
    const result = parseEstimatedTime('6 weeks at 1 hour per day');
    expect(result).toEqual({ weeks: 6, minutesPerDay: 60 });
  });

  it('should parse abbreviated formats', () => {
    expect(parseEstimatedTime('8 weeks at 45 min per day')).toEqual({ weeks: 8, minutesPerDay: 45 });
    expect(parseEstimatedTime('2 weeks at 2 hr per day')).toEqual({ weeks: 2, minutesPerDay: 120 });
  });

  it('should handle singular week', () => {
    const result = parseEstimatedTime('1 week at 60 minutes per day');
    expect(result).toEqual({ weeks: 1, minutesPerDay: 60 });
  });

  it('should return null for invalid format', () => {
    expect(parseEstimatedTime('about a month')).toBeNull();
    expect(parseEstimatedTime('30 days')).toBeNull();
    expect(parseEstimatedTime('')).toBeNull();
  });
});

describe('Fallback Capstone', () => {
  it('should generate fallback from learning goal', () => {
    const input: CapstoneInput = {
      learningGoal: 'Python programming',
      priorKnowledge: null,
      context: null,
      constraints: [],
    };

    const result = generateFallbackCapstone(input);

    expect(result.title).toContain('Python');
    expect(result.statement).toContain('Python');
    expect(result.successCriteria.length).toBeGreaterThanOrEqual(1);
    expect(result.estimatedTime).toBeTruthy();
  });

  it('should truncate long learning goals in title', () => {
    const input: CapstoneInput = {
      learningGoal: 'A very long learning goal that exceeds the maximum title length limit',
      priorKnowledge: null,
      context: null,
      constraints: [],
    };

    const result = generateFallbackCapstone(input);

    expect(result.title.length).toBeLessThanOrEqual(60);
  });

  it('should use default when no learning goal', () => {
    const input: CapstoneInput = {
      learningGoal: '',
      priorKnowledge: null,
      context: null,
      constraints: [],
    };

    const result = generateFallbackCapstone(input);

    expect(result.title).toContain('this skill');
    expect(result.statement).toContain('this skill');
  });
});

describe('Capstone Generation (Mock LLM)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockLLMResponses();
  });

  it('should generate capstone from LLM response', async () => {
    const mockResponse: CapstoneOutput = {
      title: 'Python Web Scraping',
      statement: 'The learner will be able to build automated web scrapers that extract structured data from multiple websites.',
      successCriteria: [
        'Can scrape static HTML pages',
        'Can handle pagination',
        'Can store data in JSON format',
      ],
      estimatedTime: '6 weeks at 45 minutes per day',
    };

    setMockLLMResponse('PYTHON', JSON.stringify(mockResponse));

    const generateCapstone = async (input: CapstoneInput): Promise<CapstoneOutput> => {
      try {
        const response = await mockSwordGateLLM.generate('system', `Generate for: ${input.learningGoal.toUpperCase()}`);
        const parsed = JSON.parse(response) as CapstoneOutput;
        
        const validation = validateCapstone(parsed);
        if (!validation.valid) {
          throw new Error(`Invalid capstone: ${validation.errors.join(', ')}`);
        }
        
        return parsed;
      } catch {
        return generateFallbackCapstone(input);
      }
    };

    const result = await generateCapstone({
      learningGoal: 'Python',
      priorKnowledge: null,
      context: null,
      constraints: [],
    });

    expect(result.title).toBe('Python Web Scraping');
    expect(result.successCriteria).toHaveLength(3);
  });

  it('should use fallback on LLM error', async () => {
    mockSwordGateLLM.generate.mockRejectedValueOnce(new Error('API error'));

    const generateCapstone = async (input: CapstoneInput): Promise<CapstoneOutput> => {
      try {
        await mockSwordGateLLM.generate('system', input.learningGoal);
        throw new Error('Should not reach here');
      } catch {
        return generateFallbackCapstone(input);
      }
    };

    const result = await generateCapstone({
      learningGoal: 'Guitar',
      priorKnowledge: null,
      context: null,
      constraints: [],
    });

    expect(result.title).toContain('Guitar');
    expect(result.estimatedTime).toBe('4 weeks at 30 minutes per day');
  });

  it('should use fallback on invalid LLM response', async () => {
    setMockLLMResponse('invalid', 'not valid json');

    const generateCapstone = async (input: CapstoneInput): Promise<CapstoneOutput> => {
      try {
        const response = await mockSwordGateLLM.generate('system', 'invalid');
        JSON.parse(response); // Will throw
        throw new Error('Should not reach here');
      } catch {
        return generateFallbackCapstone(input);
      }
    };

    const result = await generateCapstone({
      learningGoal: 'Cooking',
      priorKnowledge: null,
      context: null,
      constraints: [],
    });

    expect(result.title).toContain('Cooking');
  });

  it('should use fallback when validation fails', async () => {
    const invalidCapstone = {
      title: 'X', // Too short
      statement: 'Too short',
      successCriteria: [],
      estimatedTime: '',
    };

    setMockLLMResponse('FAIL', JSON.stringify(invalidCapstone));

    const generateCapstone = async (input: CapstoneInput): Promise<CapstoneOutput> => {
      try {
        const response = await mockSwordGateLLM.generate('system', 'FAIL');
        const parsed = JSON.parse(response) as CapstoneOutput;
        
        const validation = validateCapstone(parsed);
        if (!validation.valid) {
          throw new Error('Validation failed');
        }
        
        return parsed;
      } catch {
        return generateFallbackCapstone(input);
      }
    };

    const result = await generateCapstone({
      learningGoal: 'Chess',
      priorKnowledge: null,
      context: null,
      constraints: [],
    });

    expect(result.title).toContain('Chess');
    expect(validateCapstone(result).valid).toBe(true);
  });
});

describe('Estimated Time Constraints', () => {
  it('should enforce 15-90 minute daily limit', () => {
    const validateTimeConstraints = (parsed: { weeks: number; minutesPerDay: number }) => {
      if (parsed.minutesPerDay < 15) return { valid: false, error: 'Minimum 15 minutes per day' };
      if (parsed.minutesPerDay > 90) return { valid: false, error: 'Maximum 90 minutes per day' };
      return { valid: true, error: null };
    };

    expect(validateTimeConstraints({ weeks: 4, minutesPerDay: 10 }).valid).toBe(false);
    expect(validateTimeConstraints({ weeks: 4, minutesPerDay: 15 }).valid).toBe(true);
    expect(validateTimeConstraints({ weeks: 4, minutesPerDay: 90 }).valid).toBe(true);
    expect(validateTimeConstraints({ weeks: 4, minutesPerDay: 120 }).valid).toBe(false);
  });

  it('should calculate total hours correctly', () => {
    const calculateTotalHours = (weeks: number, minutesPerDay: number, daysPerWeek: number = 5) => {
      const totalMinutes = weeks * daysPerWeek * minutesPerDay;
      return Math.round(totalMinutes / 60);
    };

    // 4 weeks, 30 min/day, 5 days/week = 10 hours
    expect(calculateTotalHours(4, 30, 5)).toBe(10);
    
    // 8 weeks, 60 min/day, 5 days/week = 40 hours
    expect(calculateTotalHours(8, 60, 5)).toBe(40);
    
    // 6 weeks, 45 min/day, 7 days/week = 31.5 hours ≈ 32
    expect(calculateTotalHours(6, 45, 7)).toBe(32);
  });
});
