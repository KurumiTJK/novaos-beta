// ═══════════════════════════════════════════════════════════════════════════════
// DRILL REMINDER TEMPLATES TESTS — Phase 19G Spark Reminder Integration
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

import {
  generateDrillReminderMessage,
  generateDrillReminderSubject,
  generateRetryReminderMessage,
  generateCompoundSkillMessage,
  generateSynthesisSkillMessage,
  generateAllEscalationMessages,
  type DrillReminderContext,
  type DrillReminderMessage,
  type EscalationLevel,
} from '../drill-reminder-templates.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

const createMockDrill = (overrides?: Partial<any>): any => ({
  id: 'drill-001',
  action: 'Write a for loop that iterates through a list and prints each item',
  passSignal: 'Loop correctly prints all items in the list',
  estimatedMinutes: 20,
  scheduledDate: '2025-01-15',
  dayNumber: 3,
  status: 'pending',
  retryCount: 0,
  skillId: 'skill-001',
  lockedVariables: ['syntax'],
  constraint: 'Use explicit loop syntax, no list comprehensions',
  ...overrides,
});

const createMockSkill = (overrides?: Partial<any>): any => ({
  id: 'skill-001',
  action: 'Write basic for loops',
  skillType: 'foundation',
  mastery: 'practicing',
  status: 'in_progress',
  ...overrides,
});

const createMockContext = (
  escalationLevel: EscalationLevel,
  overrides?: Partial<DrillReminderContext>
): DrillReminderContext => ({
  drill: createMockDrill(overrides?.drill),
  skill: createMockSkill(overrides?.skill),
  goalTitle: 'Learn Python',
  escalationLevel,
  variant: escalationLevel < 2 ? 'full' : escalationLevel === 2 ? 'reduced' : 'minimal',
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════════
// MESSAGE GENERATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateDrillReminderMessage', () => {
  describe('Level 0 (Morning)', () => {
    it('should generate encouraging message with full details', () => {
      const context = createMockContext(0);
      const result = generateDrillReminderMessage(context);

      expect(result.escalationLevel).toBe(0);
      expect(result.variant).toBe('full');
      expect(result.text).toContain('**Learn Python**');
      expect(result.text).toContain('Write basic for loops');
      expect(result.text).toContain('**Your task:**');
      expect(result.text).toContain('Write a for loop');
      expect(result.text).toContain('**Success signal:**');
      expect(result.text).toContain('~20 minutes');
    });

    it('should include user name when provided', () => {
      const context = createMockContext(0, { userName: 'Alex' });
      const result = generateDrillReminderMessage(context);

      expect(result.text).toContain('Alex');
    });

    it('should include streak message for 5+ day streaks', () => {
      const context = createMockContext(0, { currentStreak: 7 });
      const result = generateDrillReminderMessage(context);

      expect(result.text).toContain('🔥');
      expect(result.text).toContain('week');
    });

    it('should produce short text for push notifications', () => {
      const context = createMockContext(0);
      const result = generateDrillReminderMessage(context);

      expect(result.shortText).toBeDefined();
      expect(result.shortText.length).toBeLessThan(100);
      expect(result.shortText).toContain('🧱');
    });
  });

  describe('Level 1 (Midday)', () => {
    it('should generate action-focused nudge', () => {
      const context = createMockContext(1);
      const result = generateDrillReminderMessage(context);

      expect(result.escalationLevel).toBe(1);
      expect(result.variant).toBe('full');
      expect(result.text).toContain('Write basic for loops');
      expect(result.text).toContain('✅ Done when:');
    });

    it('should be more concise than level 0', () => {
      const context0 = createMockContext(0);
      const context1 = createMockContext(1);
      
      const result0 = generateDrillReminderMessage(context0);
      const result1 = generateDrillReminderMessage(context1);

      expect(result1.text.length).toBeLessThan(result0.text.length);
    });
  });

  describe('Level 2 (Afternoon)', () => {
    it('should generate urgent simplified message', () => {
      const context = createMockContext(2);
      const result = generateDrillReminderMessage(context);

      expect(result.escalationLevel).toBe(2);
      expect(result.variant).toBe('reduced');
      expect(result.text).toContain('Quick practice');
      expect(result.text).toContain('~10 min'); // Halved time
    });

    it('should simplify the action text', () => {
      // Use action with a period to test simplification
      const context = createMockContext(2, {
        drill: createMockDrill({
          action: 'Write a for loop. Then add error handling. Finally test it.',
        }),
      });
      const result = generateDrillReminderMessage(context);

      // Should only have first sentence
      expect(result.text).toContain('Write a for loop');
      expect(result.text).not.toContain('Finally test it');
    });
  });

  describe('Level 3 (Evening)', () => {
    it('should generate minimal last-chance message', () => {
      const context = createMockContext(3);
      const result = generateDrillReminderMessage(context);

      expect(result.escalationLevel).toBe(3);
      expect(result.variant).toBe('minimal');
      expect(result.text).toContain('Just do this:');
      expect(result.text).toContain('Any progress counts');
    });

    it('should be very short', () => {
      const context = createMockContext(3);
      const result = generateDrillReminderMessage(context);

      // Level 3 should be the shortest
      const lines = result.text.split('\n').filter(l => l.trim());
      expect(lines.length).toBeLessThan(10);
    });

    it('should mention skip option', () => {
      const context = createMockContext(3);
      const result = generateDrillReminderMessage(context);

      expect(result.text.toLowerCase()).toContain('skip');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUBJECT GENERATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateDrillReminderSubject', () => {
  it('should generate level 0 subject with full action', () => {
    const context = createMockContext(0);
    const subject = generateDrillReminderSubject(context);

    expect(subject).toContain('📚');
    expect(subject).toContain('Today\'s Practice');
    expect(subject.length).toBeLessThan(80);
  });

  it('should generate level 1 subject as reminder', () => {
    const context = createMockContext(1);
    const subject = generateDrillReminderSubject(context);

    expect(subject).toContain('⏰');
    expect(subject).toContain('Reminder');
  });

  it('should generate level 2 subject emphasizing quick time', () => {
    const context = createMockContext(2);
    const subject = generateDrillReminderSubject(context);

    expect(subject).toContain('⚡');
    expect(subject).toContain('Quick');
    expect(subject).toContain('min');
  });

  it('should generate level 3 subject encouraging to just start', () => {
    const context = createMockContext(3);
    const subject = generateDrillReminderSubject(context);

    expect(subject).toContain('🎯');
    expect(subject).toContain('Just Start');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RETRY MESSAGE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateRetryReminderMessage', () => {
  it('should add retry context for first retry', () => {
    const context = createMockContext(0, {
      drill: createMockDrill({ retryCount: 1, isRetry: true }),
    });
    const result = generateRetryReminderMessage(context);

    expect(result.text).toContain('🔄');
    expect(result.text).toContain('Fresh approach');
    expect(result.subject).toContain('Retry');
  });

  it('should mention simplified version for retry 2', () => {
    const context = createMockContext(0, {
      drill: createMockDrill({ retryCount: 2, isRetry: true }),
    });
    const result = generateRetryReminderMessage(context);

    expect(result.text).toContain('Simplified version');
  });

  it('should mention foundation focus for retry 3+', () => {
    const context = createMockContext(0, {
      drill: createMockDrill({ retryCount: 3, isRetry: true }),
    });
    const result = generateRetryReminderMessage(context);

    expect(result.text).toContain('Foundation focus');
    expect(result.text).toContain('basics');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOUND SKILL MESSAGE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateCompoundSkillMessage', () => {
  it('should include component skills info', () => {
    const context = createMockContext(0, {
      skill: createMockSkill({ skillType: 'compound' }),
    });
    const componentTitles = ['Variables', 'Loops', 'Conditionals'];
    const result = generateCompoundSkillMessage(context, componentTitles);

    expect(result.text).toContain('🔗');
    expect(result.text).toContain('Combines:');
    expect(result.text).toContain('Variables');
    expect(result.text).toContain('Loops');
  });

  it('should truncate long component lists', () => {
    const context = createMockContext(0, {
      skill: createMockSkill({ skillType: 'compound' }),
    });
    const componentTitles = ['A', 'B', 'C', 'D', 'E', 'F'];
    const result = generateCompoundSkillMessage(context, componentTitles);

    expect(result.text).toContain('+');
    expect(result.text).toContain('more');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SYNTHESIS SKILL MESSAGE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateSynthesisSkillMessage', () => {
  it('should include milestone reference', () => {
    const context = createMockContext(0, {
      skill: createMockSkill({ skillType: 'synthesis' }),
    });
    const result = generateSynthesisSkillMessage(context, 'Build a Calculator');

    expect(result.text).toContain('⭐');
    expect(result.text).toContain('Milestone Prep');
    expect(result.text).toContain('Build a Calculator');
    expect(result.subject).toContain('Milestone Prep');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH GENERATION TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('generateAllEscalationMessages', () => {
  it('should generate messages for all 4 levels', () => {
    const drill = createMockDrill();
    const skill = createMockSkill();
    const results = generateAllEscalationMessages(drill, skill, 'Learn Python');

    expect(results).toHaveLength(4);
    expect(results[0].escalationLevel).toBe(0);
    expect(results[1].escalationLevel).toBe(1);
    expect(results[2].escalationLevel).toBe(2);
    expect(results[3].escalationLevel).toBe(3);
  });

  it('should use appropriate variants for each level', () => {
    const drill = createMockDrill();
    const skill = createMockSkill();
    const results = generateAllEscalationMessages(drill, skill, 'Learn Python');

    expect(results[0].variant).toBe('full');
    expect(results[1].variant).toBe('full');
    expect(results[2].variant).toBe('reduced');
    expect(results[3].variant).toBe('minimal');
  });

  it('should have decreasing message lengths', () => {
    const drill = createMockDrill();
    const skill = createMockSkill();
    const results = generateAllEscalationMessages(drill, skill, 'Learn Python');

    // Each level should generally be shorter than the previous
    // (with some tolerance for random greetings)
    expect(results[3].text.length).toBeLessThan(results[0].text.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EDGE CASE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Edge Cases', () => {
  it('should handle null skill gracefully', () => {
    const context: DrillReminderContext = {
      drill: createMockDrill(),
      skill: null,
      goalTitle: 'Learn Python',
      escalationLevel: 0,
      variant: 'full',
    };
    const result = generateDrillReminderMessage(context);

    expect(result.text).toBeDefined();
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('should handle very long action text', () => {
    const longAction = 'Write a for loop that '.repeat(20);
    const context = createMockContext(2, {
      drill: createMockDrill({ action: longAction }),
    });
    const result = generateDrillReminderMessage(context);

    // Level 2 should truncate
    expect(result.text.length).toBeLessThan(longAction.length);
  });

  it('should handle missing optional fields', () => {
    const context: DrillReminderContext = {
      drill: {
        id: 'drill-001',
        action: 'Simple action',
        passSignal: 'Done',
        estimatedMinutes: 10,
        scheduledDate: '2025-01-15',
        dayNumber: 1,
        status: 'pending',
        retryCount: 0,
      } as any,
      skill: null,
      goalTitle: 'Goal',
      escalationLevel: 0,
      variant: 'full',
    };
    const result = generateDrillReminderMessage(context);

    expect(result.text).toBeDefined();
    expect(result.subject).toBeDefined();
    expect(result.shortText).toBeDefined();
  });

  it('should handle streak at exactly threshold values', () => {
    for (const streak of [3, 5, 7, 14, 30]) {
      const context = createMockContext(0, { currentStreak: streak });
      const result = generateDrillReminderMessage(context);

      expect(result.text).toContain('🔥');
    }
  });

  it('should not show streak for streaks below 3', () => {
    const context = createMockContext(0, { currentStreak: 2 });
    const result = generateDrillReminderMessage(context);

    // Should not have streak emoji in context of streak display
    const lines = result.text.split('\n');
    const streakLine = lines.find(l => l.includes('streak') || l.includes('days'));
    expect(streakLine?.includes('🔥')).toBeFalsy();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SKILL TYPE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Skill Type Formatting', () => {
  it('should use foundation emoji for foundation skills', () => {
    const context = createMockContext(0, {
      skill: createMockSkill({ skillType: 'foundation' }),
    });
    const result = generateDrillReminderMessage(context);

    expect(result.text).toContain('🧱');
  });

  it('should use building emoji for building skills', () => {
    const context = createMockContext(0, {
      skill: createMockSkill({ skillType: 'building' }),
    });
    const result = generateDrillReminderMessage(context);

    expect(result.text).toContain('🔨');
  });

  it('should use compound emoji for compound skills', () => {
    const context = createMockContext(0, {
      skill: createMockSkill({ skillType: 'compound' }),
    });
    const result = generateDrillReminderMessage(context);

    expect(result.text).toContain('🔗');
  });

  it('should use synthesis emoji for synthesis skills', () => {
    const context = createMockContext(0, {
      skill: createMockSkill({ skillType: 'synthesis' }),
    });
    const result = generateDrillReminderMessage(context);

    expect(result.text).toContain('⭐');
  });
});
