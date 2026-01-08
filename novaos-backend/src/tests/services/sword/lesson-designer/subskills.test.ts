// ═══════════════════════════════════════════════════════════════════════════════
// SUBSKILLS TESTS
// Tests for subskill decomposition (8-20 subskills)
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

type SubskillType = 'concepts' | 'procedures' | 'judgments' | 'outputs' | 'tool_setup' | 'tool_management';

interface Subskill {
  id: string;
  title: string;
  description: string;
  subskillType: SubskillType;
  estimatedComplexity: 1 | 2 | 3;
  order: number;
}

interface CapstoneData {
  title: string;
  statement: string;
  successCriteria: string[];
  estimatedTime: string;
}

interface SubskillsInput {
  capstone: CapstoneData;
  priorKnowledge: string | null;
  context: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

const VALID_SUBSKILL_TYPES: SubskillType[] = [
  'concepts',
  'procedures',
  'judgments',
  'outputs',
  'tool_setup',
  'tool_management',
];

function validateSubskill(subskill: Subskill): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!subskill.title || subskill.title.length < 3) {
    errors.push('Title must be at least 3 characters');
  }
  if (subskill.title && subskill.title.length > 100) {
    errors.push('Title must be under 100 characters');
  }
  if (!subskill.description || subskill.description.length < 10) {
    errors.push('Description must be at least 10 characters');
  }
  if (!VALID_SUBSKILL_TYPES.includes(subskill.subskillType)) {
    errors.push(`Invalid subskill type: ${subskill.subskillType}`);
  }
  if (![1, 2, 3].includes(subskill.estimatedComplexity)) {
    errors.push(`Invalid complexity: ${subskill.estimatedComplexity}`);
  }
  if (subskill.order < 1) {
    errors.push('Order must be positive');
  }

  return { valid: errors.length === 0, errors };
}

function validateSubskillSet(subskills: Subskill[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Count validation (8-20)
  if (subskills.length < 8) {
    errors.push(`Too few subskills: ${subskills.length} (minimum 8)`);
  }
  if (subskills.length > 20) {
    errors.push(`Too many subskills: ${subskills.length} (maximum 20)`);
  }

  // Type mix validation
  const types = new Set(subskills.map(s => s.subskillType));
  if (types.size < 2) {
    errors.push('Should have at least 2 different subskill types');
  }

  // Must have at least one outputs type
  if (!subskills.some(s => s.subskillType === 'outputs')) {
    errors.push('Should have at least one "outputs" subskill for the capstone');
  }

  // Order validation
  const orders = subskills.map(s => s.order).sort((a, b) => a - b);
  const uniqueOrders = new Set(orders);
  if (uniqueOrders.size !== orders.length) {
    errors.push('Subskills have duplicate order values');
  }

  // Validate each subskill
  for (const subskill of subskills) {
    const validation = validateSubskill(subskill);
    if (!validation.valid) {
      errors.push(`Subskill "${subskill.title}": ${validation.errors.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function generateSubskillId(): string {
  return `ss_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function generateFallbackSubskills(capstone: CapstoneData): Subskill[] {
  const goal = capstone.title || 'this skill';
  
  return [
    {
      id: generateSubskillId(),
      title: 'Core Vocabulary',
      description: `Learn essential terminology for ${goal}`,
      subskillType: 'concepts',
      estimatedComplexity: 1,
      order: 1,
    },
    {
      id: generateSubskillId(),
      title: 'Foundational Concepts',
      description: `Understand the basic principles underlying ${goal}`,
      subskillType: 'concepts',
      estimatedComplexity: 2,
      order: 2,
    },
    {
      id: generateSubskillId(),
      title: 'Tool Setup',
      description: `Set up the environment and tools needed for ${goal}`,
      subskillType: 'tool_setup',
      estimatedComplexity: 1,
      order: 3,
    },
    {
      id: generateSubskillId(),
      title: 'Basic Procedures',
      description: `Learn step-by-step processes for ${goal}`,
      subskillType: 'procedures',
      estimatedComplexity: 2,
      order: 4,
    },
    {
      id: generateSubskillId(),
      title: 'Intermediate Techniques',
      description: `Build on basics with more advanced methods`,
      subskillType: 'procedures',
      estimatedComplexity: 2,
      order: 5,
    },
    {
      id: generateSubskillId(),
      title: 'Pattern Recognition',
      description: `Learn to identify common patterns and issues`,
      subskillType: 'judgments',
      estimatedComplexity: 2,
      order: 6,
    },
    {
      id: generateSubskillId(),
      title: 'Problem Diagnosis',
      description: `Develop ability to diagnose and fix problems`,
      subskillType: 'judgments',
      estimatedComplexity: 3,
      order: 7,
    },
    {
      id: generateSubskillId(),
      title: 'Capstone Project',
      description: `Apply all skills to complete ${capstone.statement || 'the final project'}`,
      subskillType: 'outputs',
      estimatedComplexity: 3,
      order: 8,
    },
  ];
}

function assignIds(subskills: Omit<Subskill, 'id'>[]): Subskill[] {
  return subskills.map(s => ({
    ...s,
    id: generateSubskillId(),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Subskill Validation', () => {
  describe('validateSubskill', () => {
    it('should accept valid subskill', () => {
      const subskill: Subskill = {
        id: 'ss_123',
        title: 'Core Concepts',
        description: 'Learn the fundamental concepts of the topic',
        subskillType: 'concepts',
        estimatedComplexity: 2,
        order: 1,
      };

      const result = validateSubskill(subskill);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject short title', () => {
      const subskill: Subskill = {
        id: 'ss_123',
        title: 'Ab',
        description: 'A valid description that is long enough',
        subskillType: 'concepts',
        estimatedComplexity: 2,
        order: 1,
      };

      const result = validateSubskill(subskill);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Title must be at least 3 characters');
    });

    it('should reject invalid subskill type', () => {
      const subskill = {
        id: 'ss_123',
        title: 'Valid Title',
        description: 'A valid description that is long enough',
        subskillType: 'invalid_type' as SubskillType,
        estimatedComplexity: 2 as const,
        order: 1,
      };

      const result = validateSubskill(subskill);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid subskill type'))).toBe(true);
    });

    it('should reject invalid complexity', () => {
      const subskill = {
        id: 'ss_123',
        title: 'Valid Title',
        description: 'A valid description that is long enough',
        subskillType: 'concepts' as SubskillType,
        estimatedComplexity: 5 as 1 | 2 | 3,
        order: 1,
      };

      const result = validateSubskill(subskill);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Invalid complexity'))).toBe(true);
    });

    it('should reject non-positive order', () => {
      const subskill: Subskill = {
        id: 'ss_123',
        title: 'Valid Title',
        description: 'A valid description that is long enough',
        subskillType: 'concepts',
        estimatedComplexity: 2,
        order: 0,
      };

      const result = validateSubskill(subskill);
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Order must be positive');
    });
  });

  describe('validateSubskillSet', () => {
    it('should accept valid set of 8-20 subskills', () => {
      const subskills = generateFallbackSubskills({
        title: 'Test',
        statement: 'Test statement',
        successCriteria: ['Criterion'],
        estimatedTime: '4 weeks',
      });

      const result = validateSubskillSet(subskills);
      expect(result.valid).toBe(true);
    });

    it('should reject fewer than 8 subskills', () => {
      const subskills: Subskill[] = [
        {
          id: 'ss_1',
          title: 'Only One',
          description: 'Only one subskill which is not enough',
          subskillType: 'outputs',
          estimatedComplexity: 2,
          order: 1,
        },
      ];

      const result = validateSubskillSet(subskills);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Too few subskills'))).toBe(true);
    });

    it('should reject more than 20 subskills', () => {
      const subskills: Subskill[] = Array(21).fill(null).map((_, i) => ({
        id: `ss_${i}`,
        title: `Subskill ${i + 1}`,
        description: 'A valid description that is long enough',
        subskillType: i === 20 ? 'outputs' as SubskillType : 'concepts' as SubskillType,
        estimatedComplexity: 2 as const,
        order: i + 1,
      }));

      const result = validateSubskillSet(subskills);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Too many subskills'))).toBe(true);
    });

    it('should reject set without outputs type', () => {
      const subskills: Subskill[] = Array(8).fill(null).map((_, i) => ({
        id: `ss_${i}`,
        title: `Subskill ${i + 1}`,
        description: 'A valid description that is long enough',
        subskillType: 'concepts' as SubskillType,
        estimatedComplexity: 2 as const,
        order: i + 1,
      }));

      const result = validateSubskillSet(subskills);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('outputs'))).toBe(true);
    });

    it('should reject duplicate order values', () => {
      const subskills = generateFallbackSubskills({
        title: 'Test',
        statement: 'Test',
        successCriteria: ['Test'],
        estimatedTime: '4 weeks',
      });
      
      // Create duplicate order
      subskills[1].order = subskills[0].order;

      const result = validateSubskillSet(subskills);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('duplicate order'))).toBe(true);
    });
  });
});

describe('Subskill ID Generation', () => {
  it('should generate unique IDs', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateSubskillId());
    }
    expect(ids.size).toBe(100);
  });

  it('should start with ss_ prefix', () => {
    const id = generateSubskillId();
    expect(id).toMatch(/^ss_/);
  });
});

describe('Fallback Subskills', () => {
  it('should generate exactly 8 subskills', () => {
    const result = generateFallbackSubskills({
      title: 'Python',
      statement: 'Build a web scraper',
      successCriteria: ['Criterion'],
      estimatedTime: '4 weeks',
    });

    expect(result).toHaveLength(8);
  });

  it('should have sequential order', () => {
    const result = generateFallbackSubskills({
      title: 'Test',
      statement: 'Test',
      successCriteria: [],
      estimatedTime: '4 weeks',
    });

    const orders = result.map(s => s.order);
    expect(orders).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('should include multiple subskill types', () => {
    const result = generateFallbackSubskills({
      title: 'Test',
      statement: 'Test',
      successCriteria: [],
      estimatedTime: '4 weeks',
    });

    const types = new Set(result.map(s => s.subskillType));
    expect(types.size).toBeGreaterThanOrEqual(4);
  });

  it('should include outputs type', () => {
    const result = generateFallbackSubskills({
      title: 'Test',
      statement: 'Test',
      successCriteria: [],
      estimatedTime: '4 weeks',
    });

    expect(result.some(s => s.subskillType === 'outputs')).toBe(true);
  });

  it('should pass validation', () => {
    const result = generateFallbackSubskills({
      title: 'Test',
      statement: 'Test statement',
      successCriteria: ['Criterion'],
      estimatedTime: '4 weeks',
    });

    const validation = validateSubskillSet(result);
    expect(validation.valid).toBe(true);
  });
});

describe('Subskill Generation (Mock LLM)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearMockLLMResponses();
  });

  it('should generate subskills from LLM response', async () => {
    const mockSubskills = [
      { title: 'Python Basics', description: 'Learn syntax and data types', subskillType: 'concepts', estimatedComplexity: 1, order: 1 },
      { title: 'Control Flow', description: 'Understand conditionals and loops', subskillType: 'concepts', estimatedComplexity: 1, order: 2 },
      { title: 'Functions', description: 'Write reusable functions', subskillType: 'procedures', estimatedComplexity: 2, order: 3 },
      { title: 'File I/O', description: 'Read and write files', subskillType: 'procedures', estimatedComplexity: 2, order: 4 },
      { title: 'HTTP Requests', description: 'Make web requests with requests library', subskillType: 'procedures', estimatedComplexity: 2, order: 5 },
      { title: 'HTML Parsing', description: 'Parse HTML with BeautifulSoup', subskillType: 'procedures', estimatedComplexity: 2, order: 6 },
      { title: 'Error Handling', description: 'Debug and handle exceptions', subskillType: 'judgments', estimatedComplexity: 2, order: 7 },
      { title: 'Build Scraper', description: 'Create complete web scraper project', subskillType: 'outputs', estimatedComplexity: 3, order: 8 },
    ];

    setMockLLMResponse('CAPSTONE', JSON.stringify({ subskills: mockSubskills }));

    const generateSubskills = async (input: SubskillsInput): Promise<Subskill[]> => {
      try {
        const response = await mockSwordGateLLM.generate('system', `CAPSTONE: ${input.capstone.title}`);
        const parsed = JSON.parse(response) as { subskills: Omit<Subskill, 'id'>[] };
        
        const withIds = assignIds(parsed.subskills);
        const validation = validateSubskillSet(withIds);
        
        if (!validation.valid) {
          throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
        }
        
        return withIds;
      } catch {
        return generateFallbackSubskills(input.capstone);
      }
    };

    const result = await generateSubskills({
      capstone: {
        title: 'Python Web Scraping',
        statement: 'Build a web scraper',
        successCriteria: ['Scrape 3 sites'],
        estimatedTime: '6 weeks',
      },
      priorKnowledge: null,
      context: null,
    });

    expect(result).toHaveLength(8);
    expect(result[0].title).toBe('Python Basics');
    expect(result.every(s => s.id.startsWith('ss_'))).toBe(true);
  });

  it('should use fallback on LLM error', async () => {
    mockSwordGateLLM.generate.mockRejectedValueOnce(new Error('API error'));

    const generateSubskills = async (input: SubskillsInput): Promise<Subskill[]> => {
      try {
        await mockSwordGateLLM.generate('system', input.capstone.title);
        throw new Error('Should not reach here');
      } catch {
        return generateFallbackSubskills(input.capstone);
      }
    };

    const result = await generateSubskills({
      capstone: {
        title: 'Guitar',
        statement: 'Play songs',
        successCriteria: ['Play 5 songs'],
        estimatedTime: '8 weeks',
      },
      priorKnowledge: null,
      context: null,
    });

    expect(result).toHaveLength(8);
    expect(validateSubskillSet(result).valid).toBe(true);
  });

  it('should use fallback when LLM returns too few subskills', async () => {
    const tooFewSubskills = [
      { title: 'One', description: 'Only one subskill', subskillType: 'outputs', estimatedComplexity: 2, order: 1 },
    ];

    setMockLLMResponse('FEW', JSON.stringify({ subskills: tooFewSubskills }));

    const generateSubskills = async (input: SubskillsInput): Promise<Subskill[]> => {
      try {
        const response = await mockSwordGateLLM.generate('system', 'FEW');
        const parsed = JSON.parse(response) as { subskills: Omit<Subskill, 'id'>[] };
        
        const withIds = assignIds(parsed.subskills);
        const validation = validateSubskillSet(withIds);
        
        if (!validation.valid) {
          throw new Error('Validation failed');
        }
        
        return withIds;
      } catch {
        return generateFallbackSubskills(input.capstone);
      }
    };

    const result = await generateSubskills({
      capstone: {
        title: 'Test',
        statement: 'Test statement',
        successCriteria: ['Test'],
        estimatedTime: '4 weeks',
      },
      priorKnowledge: null,
      context: null,
    });

    expect(result).toHaveLength(8); // Fallback generates 8
  });
});

describe('Complexity Distribution', () => {
  it('should have varied complexity levels', () => {
    const subskills = generateFallbackSubskills({
      title: 'Test',
      statement: 'Test',
      successCriteria: [],
      estimatedTime: '4 weeks',
    });

    const complexities = subskills.map(s => s.estimatedComplexity);
    const uniqueComplexities = new Set(complexities);
    
    expect(uniqueComplexities.size).toBeGreaterThanOrEqual(2);
  });

  it('should generally increase complexity over order', () => {
    const subskills = generateFallbackSubskills({
      title: 'Test',
      statement: 'Test',
      successCriteria: [],
      estimatedTime: '4 weeks',
    });

    // First half average complexity should be <= second half
    const firstHalf = subskills.slice(0, 4);
    const secondHalf = subskills.slice(4);

    const avgFirst = firstHalf.reduce((sum, s) => sum + s.estimatedComplexity, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, s) => sum + s.estimatedComplexity, 0) / secondHalf.length;

    expect(avgSecond).toBeGreaterThanOrEqual(avgFirst);
  });
});
