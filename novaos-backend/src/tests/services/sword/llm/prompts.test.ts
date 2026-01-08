// ═══════════════════════════════════════════════════════════════════════════════
// LLM PROMPTS TESTS
// Tests for prompt builders and formatters
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDERS (mirroring define-goal.ts)
// ─────────────────────────────────────────────────────────────────────────────────

interface CapstoneInput {
  learningGoal: string;
  priorKnowledge: string | null;
  context: string | null;
  constraints: string[];
}

function buildCapstoneUserMessage(input: CapstoneInput): string {
  const learningGoal = input.learningGoal || 'the specified topic';
  
  return `══════════════════════════════════════════════════════════════════════
THE USER WANTS TO LEARN: ${learningGoal.toUpperCase()}
══════════════════════════════════════════════════════════════════════

Generate a capstone specifically about: ${learningGoal}

Prior Knowledge: ${input.priorKnowledge || 'Complete beginner'}

Context/Motivation: ${input.context || 'Not specified'}

Time Constraints: ${input.constraints.length ? input.constraints.join(', ') : 'None specified'}

Remember: Your output MUST be about "${learningGoal}" - not any other topic.`;
}

interface SubskillsInput {
  capstone: {
    title: string;
    statement: string;
    successCriteria: string[];
    estimatedTime: string;
  };
  priorKnowledge: string | null;
  context: string | null;
}

function buildSubskillsUserMessage(input: SubskillsInput): string {
  return `══════════════════════════════════════════════════════════════════════
GENERATE SUBSKILLS FOR THIS SPECIFIC CAPSTONE
══════════════════════════════════════════════════════════════════════

CAPSTONE:
Title: ${input.capstone.title}
Statement: ${input.capstone.statement}

Success Criteria:
${input.capstone.successCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}

Estimated Time: ${input.capstone.estimatedTime}

LEARNER CONTEXT:
Prior Knowledge: ${input.priorKnowledge || 'Complete beginner'}
Motivation: ${input.context || 'Not specified'}

IMPORTANT: All subskills MUST be relevant to achieving the capstone above. Do not generate generic or unrelated subskills.`;
}

interface RoutingInput {
  subskills: Array<{
    id: string;
    title: string;
    description: string;
    subskillType: string;
    estimatedComplexity: 1 | 2 | 3;
    order: number;
  }>;
  priorKnowledge: string | null;
  context: string | null;
}

function buildRoutingUserMessage(input: RoutingInput): string {
  const subskillsList = input.subskills
    .map(s => `[${s.id}] ${s.title} (type: ${s.subskillType}, complexity: ${s.estimatedComplexity})`)
    .join('\n');

  return `SUBSKILLS TO ROUTE:
${subskillsList}

LEARNER BACKGROUND:
Prior Knowledge: ${input.priorKnowledge || 'Complete beginner'}
Context/Motivation: ${input.context || 'Not specified'}

Based on the learner's background, assign a route and status to each subskill.`;
}

type Route = 'recall' | 'practice' | 'diagnose' | 'apply' | 'build' | 'refine' | 'plan';
type RouteStatus = 'learn' | 'skip' | 'assess';

interface SessionDistributionInput {
  totalSessions: number;
  capstoneTitle: string;
  estimatedTime: string;
  subskills: Array<{
    id: string;
    title: string;
    route: Route;
    complexity: 1 | 2 | 3;
    status: RouteStatus;
  }>;
}

function buildSessionDistributionUserMessage(input: SessionDistributionInput): string {
  const subskillsList = input.subskills
    .map(s => {
      const stars = '★'.repeat(s.complexity) + '☆'.repeat(3 - s.complexity);
      const statusNote = s.status === 'skip' ? ' [SKIP - 0 sessions]' : '';
      return `[${s.id}] ${s.title} (${s.route}, ${stars})${statusNote}`;
    })
    .join('\n');

  const nonSkipped = input.subskills.filter(s => s.status !== 'skip').length;

  return `══════════════════════════════════════════════════════════════════════
DISTRIBUTE SESSIONS FOR THIS LEARNING PLAN
══════════════════════════════════════════════════════════════════════

TOPIC: ${input.capstoneTitle}
TIME COMMITMENT: ${input.estimatedTime}
TOTAL SESSIONS TO DISTRIBUTE: ${input.totalSessions}

SUBSKILLS (${nonSkipped} active, distribute ${input.totalSessions} sessions total):
${subskillsList}

Remember:
• The sum of all sessions MUST equal exactly ${input.totalSessions}
• Skipped subskills get 0 sessions
• Consider route type and complexity when allocating`;
}

function formatConversationForSort(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): string {
  return messages
    .map(msg => `${msg.role === 'user' ? 'User' : 'Nova'}: ${msg.content}`)
    .join('\n\n');
}

function parseLLMJson<T>(response: string): T {
  let cleaned = response.trim();
  
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  
  cleaned = cleaned.trim();
  
  return JSON.parse(cleaned) as T;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('buildCapstoneUserMessage', () => {
  it('should include learning goal prominently', () => {
    const message = buildCapstoneUserMessage({
      learningGoal: 'Python programming',
      priorKnowledge: null,
      context: null,
      constraints: [],
    });

    expect(message).toContain('PYTHON PROGRAMMING');
    expect(message).toContain('Python programming');
  });

  it('should include prior knowledge', () => {
    const message = buildCapstoneUserMessage({
      learningGoal: 'Guitar',
      priorKnowledge: '2 years of piano',
      context: null,
      constraints: [],
    });

    expect(message).toContain('2 years of piano');
  });

  it('should show "Complete beginner" when no prior knowledge', () => {
    const message = buildCapstoneUserMessage({
      learningGoal: 'Guitar',
      priorKnowledge: null,
      context: null,
      constraints: [],
    });

    expect(message).toContain('Complete beginner');
  });

  it('should include context', () => {
    const message = buildCapstoneUserMessage({
      learningGoal: 'Cooking',
      priorKnowledge: null,
      context: 'Want to impress at dinner parties',
      constraints: [],
    });

    expect(message).toContain('impress at dinner parties');
  });

  it('should join constraints', () => {
    const message = buildCapstoneUserMessage({
      learningGoal: 'Spanish',
      priorKnowledge: null,
      context: null,
      constraints: ['30 minutes per day', 'No in-person classes'],
    });

    expect(message).toContain('30 minutes per day, No in-person classes');
  });

  it('should show "None specified" when no constraints', () => {
    const message = buildCapstoneUserMessage({
      learningGoal: 'Math',
      priorKnowledge: null,
      context: null,
      constraints: [],
    });

    expect(message).toContain('None specified');
  });
});

describe('buildSubskillsUserMessage', () => {
  it('should include capstone details', () => {
    const message = buildSubskillsUserMessage({
      capstone: {
        title: 'Python Basics',
        statement: 'Build a working web scraper',
        successCriteria: ['Scrape 3 sites', 'Handle errors'],
        estimatedTime: '4 weeks',
      },
      priorKnowledge: null,
      context: null,
    });

    expect(message).toContain('Python Basics');
    expect(message).toContain('Build a working web scraper');
    expect(message).toContain('Scrape 3 sites');
    expect(message).toContain('Handle errors');
    expect(message).toContain('4 weeks');
  });

  it('should number success criteria', () => {
    const message = buildSubskillsUserMessage({
      capstone: {
        title: 'Test',
        statement: 'Test statement',
        successCriteria: ['First', 'Second', 'Third'],
        estimatedTime: '1 week',
      },
      priorKnowledge: null,
      context: null,
    });

    expect(message).toContain('1. First');
    expect(message).toContain('2. Second');
    expect(message).toContain('3. Third');
  });

  it('should include learner context', () => {
    const message = buildSubskillsUserMessage({
      capstone: {
        title: 'Test',
        statement: 'Test',
        successCriteria: ['Test'],
        estimatedTime: '1 week',
      },
      priorKnowledge: 'Experienced developer',
      context: 'Career change',
    });

    expect(message).toContain('Experienced developer');
    expect(message).toContain('Career change');
  });
});

describe('buildRoutingUserMessage', () => {
  it('should format subskills with IDs', () => {
    const message = buildRoutingUserMessage({
      subskills: [
        {
          id: 'ss_1',
          title: 'Core Concepts',
          description: 'Learn basics',
          subskillType: 'concepts',
          estimatedComplexity: 2,
          order: 1,
        },
      ],
      priorKnowledge: null,
      context: null,
    });

    expect(message).toContain('[ss_1]');
    expect(message).toContain('Core Concepts');
    expect(message).toContain('type: concepts');
    expect(message).toContain('complexity: 2');
  });

  it('should include multiple subskills', () => {
    const message = buildRoutingUserMessage({
      subskills: [
        { id: 'ss_1', title: 'First', description: '', subskillType: 'concepts', estimatedComplexity: 1, order: 1 },
        { id: 'ss_2', title: 'Second', description: '', subskillType: 'procedures', estimatedComplexity: 2, order: 2 },
        { id: 'ss_3', title: 'Third', description: '', subskillType: 'outputs', estimatedComplexity: 3, order: 3 },
      ],
      priorKnowledge: null,
      context: null,
    });

    expect(message).toContain('[ss_1]');
    expect(message).toContain('[ss_2]');
    expect(message).toContain('[ss_3]');
  });

  it('should include learner background', () => {
    const message = buildRoutingUserMessage({
      subskills: [],
      priorKnowledge: 'Knows JavaScript',
      context: 'Learning TypeScript',
    });

    expect(message).toContain('Knows JavaScript');
    expect(message).toContain('Learning TypeScript');
  });
});

describe('buildSessionDistributionUserMessage', () => {
  it('should include total sessions prominently', () => {
    const message = buildSessionDistributionUserMessage({
      totalSessions: 30,
      capstoneTitle: 'Learn Guitar',
      estimatedTime: '6 weeks at 30 min/day',
      subskills: [],
    });

    expect(message).toContain('TOTAL SESSIONS TO DISTRIBUTE: 30');
    expect(message).toContain('distribute 30 sessions total');
  });

  it('should show complexity stars', () => {
    const message = buildSessionDistributionUserMessage({
      totalSessions: 10,
      capstoneTitle: 'Test',
      estimatedTime: '2 weeks',
      subskills: [
        { id: 'ss_1', title: 'Low', route: 'recall', complexity: 1, status: 'learn' },
        { id: 'ss_2', title: 'Med', route: 'practice', complexity: 2, status: 'learn' },
        { id: 'ss_3', title: 'High', route: 'build', complexity: 3, status: 'learn' },
      ],
    });

    expect(message).toContain('★☆☆'); // Complexity 1
    expect(message).toContain('★★☆'); // Complexity 2
    expect(message).toContain('★★★'); // Complexity 3
  });

  it('should mark skipped subskills', () => {
    const message = buildSessionDistributionUserMessage({
      totalSessions: 10,
      capstoneTitle: 'Test',
      estimatedTime: '2 weeks',
      subskills: [
        { id: 'ss_1', title: 'Active', route: 'practice', complexity: 2, status: 'learn' },
        { id: 'ss_2', title: 'Skipped', route: 'recall', complexity: 1, status: 'skip' },
      ],
    });

    expect(message).toContain('[SKIP - 0 sessions]');
    expect(message).toContain('1 active');
  });

  it('should count non-skipped subskills', () => {
    const message = buildSessionDistributionUserMessage({
      totalSessions: 20,
      capstoneTitle: 'Test',
      estimatedTime: '4 weeks',
      subskills: [
        { id: 'ss_1', title: 'A', route: 'practice', complexity: 2, status: 'learn' },
        { id: 'ss_2', title: 'B', route: 'practice', complexity: 2, status: 'learn' },
        { id: 'ss_3', title: 'C', route: 'practice', complexity: 2, status: 'skip' },
        { id: 'ss_4', title: 'D', route: 'practice', complexity: 2, status: 'assess' },
      ],
    });

    expect(message).toContain('3 active'); // 2 learn + 1 assess
  });
});

describe('formatConversationForSort', () => {
  it('should format user messages', () => {
    const result = formatConversationForSort([
      { role: 'user', content: 'Hello' },
    ]);

    expect(result).toBe('User: Hello');
  });

  it('should format assistant messages as Nova', () => {
    const result = formatConversationForSort([
      { role: 'assistant', content: 'Hi there!' },
    ]);

    expect(result).toBe('Nova: Hi there!');
  });

  it('should join multiple messages with double newlines', () => {
    const result = formatConversationForSort([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
      { role: 'user', content: 'How are you?' },
    ]);

    expect(result).toBe('User: Hello\n\nNova: Hi!\n\nUser: How are you?');
  });

  it('should handle empty array', () => {
    const result = formatConversationForSort([]);
    expect(result).toBe('');
  });
});

describe('parseLLMJson', () => {
  it('should parse clean JSON', () => {
    const result = parseLLMJson<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ name: 'test' });
  });

  it('should strip ```json wrapper', () => {
    const result = parseLLMJson<{ value: number }>('```json\n{"value": 42}\n```');
    expect(result).toEqual({ value: 42 });
  });

  it('should strip ``` wrapper', () => {
    const result = parseLLMJson<{ key: string }>('```\n{"key": "value"}\n```');
    expect(result).toEqual({ key: 'value' });
  });

  it('should handle whitespace', () => {
    const result = parseLLMJson<{ a: number }>('  \n{"a": 1}\n  ');
    expect(result).toEqual({ a: 1 });
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseLLMJson('not json')).toThrow();
    expect(() => parseLLMJson('{invalid}')).toThrow();
    expect(() => parseLLMJson('')).toThrow();
  });

  it('should parse complex nested objects', () => {
    const json = `{
      "subskills": [
        {"id": "ss_1", "title": "Test"}
      ],
      "metadata": {
        "count": 1
      }
    }`;
    
    const result = parseLLMJson<any>(json);
    expect(result.subskills).toHaveLength(1);
    expect(result.subskills[0].id).toBe('ss_1');
    expect(result.metadata.count).toBe(1);
  });
});
