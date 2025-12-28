// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE DISPLAY TESTS — Phase 19F Enhanced Chat Response Formats
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

import type {
  TodayDrillDisplay,
  WeekSummaryDisplay,
  GoalProgressDisplay,
  MilestoneDisplay,
  DrillSectionDisplay,
} from '../practice-display-types.js';

import {
  SKILL_TYPE_EMOJI,
  SKILL_TYPE_LABEL,
  SKILL_STATUS_EMOJI,
  SKILL_MASTERY_EMOJI,
  MILESTONE_STATUS_EMOJI,
  MILESTONE_STATUS_LABEL,
} from '../practice-display-types.js';

import {
  formatDrillForChat,
  formatWeekForChat,
  formatProgressForChat,
  formatMilestoneForChat,
  formatDrillCompact,
  formatProgressCompact,
  formatWeekCompact,
} from '../practice-response-formatter.js';

import {
  buildTodayDrillDisplay,
  buildWeekSummaryDisplay,
  buildGoalProgressDisplay,
  buildMilestoneDisplay,
} from '../practice-display-builder.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TEST FIXTURES
// ═══════════════════════════════════════════════════════════════════════════════

const createMockDrillDisplay = (overrides?: Partial<TodayDrillDisplay>): TodayDrillDisplay => ({
  drillId: 'drill-001',
  goalId: 'goal-001',
  goalTitle: 'Learn Python',
  questId: 'quest-001',
  questTitle: 'Python Basics',
  skillId: 'skill-001',
  skillTitle: 'Write a for loop',
  skillType: 'foundation',
  skillTypeLabel: 'Foundation',
  mastery: 'practicing',
  scheduledDate: '2025-01-15',
  dayNumber: 3,
  dayInWeek: 3,
  dayInQuest: 3,
  weekNumber: 1,
  status: 'pending',
  main: {
    type: 'main',
    title: 'Main Practice',
    action: 'Write a for loop that iterates through a list of numbers',
    estimatedMinutes: 20,
    isOptional: false,
    passSignal: 'Loop prints all numbers correctly',
    isFromPreviousQuest: false,
  },
  action: 'Write a for loop that iterates through a list of numbers',
  passSignal: 'Loop prints all numbers correctly',
  lockedVariables: ['syntax'],
  totalMinutes: 25,
  mainMinutes: 20,
  isRetry: false,
  retryCount: 0,
  isCompound: false,
  ...overrides,
});

const createMockWeekDisplay = (overrides?: Partial<WeekSummaryDisplay>): WeekSummaryDisplay => ({
  weekPlanId: 'week-001',
  goalId: 'goal-001',
  goalTitle: 'Learn Python',
  questId: 'quest-001',
  questTitle: 'Python Basics',
  weekNumber: 1,
  weekInQuest: 1,
  isFirstWeekOfQuest: true,
  isLastWeekOfQuest: false,
  theme: 'Introduction to Loops',
  weeklyCompetence: 'Write basic for loops with confidence',
  startDate: '2025-01-13',
  endDate: '2025-01-17',
  status: 'active',
  days: [
    {
      dayNumber: 1,
      dayInQuest: 1,
      scheduledDate: '2025-01-13',
      dayName: 'Monday',
      skillTitle: 'Understand loop syntax',
      skillType: 'foundation',
      skillTypeEmoji: '🧱',
      status: 'completed',
      outcome: 'pass',
      isToday: false,
    },
    {
      dayNumber: 2,
      dayInQuest: 2,
      scheduledDate: '2025-01-14',
      dayName: 'Tuesday',
      skillTitle: 'Write simple for loops',
      skillType: 'foundation',
      skillTypeEmoji: '🧱',
      status: 'completed',
      outcome: 'pass',
      isToday: false,
    },
    {
      dayNumber: 3,
      dayInQuest: 3,
      scheduledDate: '2025-01-15',
      dayName: 'Wednesday',
      skillTitle: 'Loop with conditionals',
      skillType: 'building',
      skillTypeEmoji: '🔨',
      status: 'today',
      isToday: true,
    },
  ],
  currentDayInWeek: 3,
  drillsCompleted: 2,
  drillsTotal: 5,
  drillsPassed: 2,
  drillsFailed: 0,
  drillsSkipped: 0,
  passRate: 1.0,
  progressPercent: 40,
  skillTypes: {
    foundation: 2,
    building: 2,
    compound: 1,
    synthesis: 0,
  },
  skillsMastered: 1,
  reviewsFromQuests: [],
  buildsOnSkills: [],
  carryForwardSkills: [],
  ...overrides,
});

const createMockProgressDisplay = (overrides?: Partial<GoalProgressDisplay>): GoalProgressDisplay => ({
  goalId: 'goal-001',
  goalTitle: 'Learn Python',
  goalStatus: 'active',
  percentComplete: 35,
  daysCompleted: 7,
  daysTotal: 20,
  currentWeek: 2,
  totalWeeks: 4,
  onTrack: true,
  daysBehind: 0,
  estimatedCompletionDate: '2025-02-15',
  skillsTotal: 15,
  skillsMastered: 5,
  skillsPracticing: 3,
  skillsAttempting: 2,
  skillsNotStarted: 3,
  skillsLocked: 2,
  skillTypeBreakdown: {
    foundation: { total: 5, mastered: 4 },
    building: { total: 5, mastered: 1 },
    compound: { total: 3, mastered: 0 },
    synthesis: { total: 2, mastered: 0 },
  },
  currentStreak: 5,
  longestStreak: 7,
  overallPassRate: 0.85,
  quests: [
    {
      questId: 'quest-001',
      title: 'Python Basics',
      order: 1,
      durationLabel: 'Week 1',
      skillsTotal: 5,
      skillsMastered: 4,
      percentComplete: 80,
      isCurrent: false,
      milestoneStatus: 'completed',
      milestoneTitle: 'Build a Calculator',
    },
    {
      questId: 'quest-002',
      title: 'Data Structures',
      order: 2,
      durationLabel: 'Weeks 2-3',
      skillsTotal: 6,
      skillsMastered: 1,
      percentComplete: 20,
      isCurrent: true,
      milestoneStatus: 'locked',
      milestoneTitle: 'Build a Todo App',
    },
  ],
  suggestedActions: ['Continue with today\'s practice'],
  ...overrides,
});

const createMockMilestoneDisplay = (overrides?: Partial<MilestoneDisplay>): MilestoneDisplay => ({
  questId: 'quest-001',
  questTitle: 'Python Basics',
  questOrder: 1,
  title: 'Build a Calculator',
  description: 'Create a command-line calculator that performs basic arithmetic',
  artifact: 'A working Python script that takes user input and performs calculations',
  acceptanceCriteria: [
    'Handles addition, subtraction, multiplication, division',
    'Gracefully handles invalid input',
    'Displays results clearly',
  ],
  estimatedMinutes: 45,
  status: 'available',
  statusEmoji: '🎯',
  statusLabel: 'Ready to Start',
  isUnlocked: true,
  isCompleted: false,
  requiredMasteryPercent: 80,
  currentMasteryPercent: 85,
  skillsMastered: 4,
  skillsTotal: 5,
  skillsNeededToUnlock: 0,
  ...overrides,
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANT TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Practice Display Constants', () => {
  describe('SKILL_TYPE_EMOJI', () => {
    it('should have emoji for all skill types', () => {
      expect(SKILL_TYPE_EMOJI.foundation).toBe('🧱');
      expect(SKILL_TYPE_EMOJI.building).toBe('🔨');
      expect(SKILL_TYPE_EMOJI.compound).toBe('🔗');
      expect(SKILL_TYPE_EMOJI.synthesis).toBe('⭐');
    });
  });

  describe('SKILL_TYPE_LABEL', () => {
    it('should have labels for all skill types', () => {
      expect(SKILL_TYPE_LABEL.foundation).toBe('Foundation');
      expect(SKILL_TYPE_LABEL.building).toBe('Building');
      expect(SKILL_TYPE_LABEL.compound).toBe('Compound');
      expect(SKILL_TYPE_LABEL.synthesis).toBe('Synthesis');
    });
  });

  describe('SKILL_STATUS_EMOJI', () => {
    it('should have emoji for all statuses', () => {
      expect(SKILL_STATUS_EMOJI.locked).toBe('🔒');
      expect(SKILL_STATUS_EMOJI.available).toBe('🔓');
      expect(SKILL_STATUS_EMOJI.in_progress).toBe('🔄');
      expect(SKILL_STATUS_EMOJI.mastered).toBe('✅');
    });
  });

  describe('MILESTONE_STATUS_EMOJI', () => {
    it('should have emoji for all milestone statuses', () => {
      expect(MILESTONE_STATUS_EMOJI.locked).toBe('🔒');
      expect(MILESTONE_STATUS_EMOJI.available).toBe('🎯');
      expect(MILESTONE_STATUS_EMOJI.in_progress).toBe('🚀');
      expect(MILESTONE_STATUS_EMOJI.completed).toBe('🏆');
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DRILL FORMATTER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatDrillForChat', () => {
  it('should format basic drill with header', () => {
    const drill = createMockDrillDisplay();
    const result = formatDrillForChat(drill);

    expect(result).toContain("📚 **Today's Practice**");
    expect(result).toContain('Day 3, Week 1');
  });

  it('should include skill info with type badge', () => {
    const drill = createMockDrillDisplay();
    const result = formatDrillForChat(drill);

    expect(result).toContain('**Skill:** Write a for loop');
    expect(result).toContain('🧱');
    expect(result).toContain('*Foundation*');
  });

  it('should include main section with action and pass signal', () => {
    const drill = createMockDrillDisplay();
    const result = formatDrillForChat(drill);

    expect(result).toContain('🎯 **Main Practice**');
    expect(result).toContain('Write a for loop that iterates through a list of numbers');
    expect(result).toContain('**Success Signal:**');
    expect(result).toContain('Loop prints all numbers correctly');
  });

  it('should include warmup section when present', () => {
    const drill = createMockDrillDisplay({
      warmup: {
        type: 'warmup',
        title: 'Warmup',
        action: 'Review variable assignment from yesterday',
        estimatedMinutes: 5,
        isOptional: false,
        isFromPreviousQuest: false,
      },
      warmupMinutes: 5,
      totalMinutes: 30,
    });
    const result = formatDrillForChat(drill);

    expect(result).toContain('🔥 **Warmup**');
    expect(result).toContain('Review variable assignment');
  });

  it('should include stretch section when present', () => {
    const drill = createMockDrillDisplay({
      stretch: {
        type: 'stretch',
        title: 'Stretch Challenge',
        action: 'Implement a nested loop',
        estimatedMinutes: 10,
        isOptional: true,
        isFromPreviousQuest: false,
      },
      stretchMinutes: 10,
      totalMinutes: 35,
    });
    const result = formatDrillForChat(drill);

    expect(result).toContain('⚡ **Stretch Challenge**');
    expect(result).toContain('Implement a nested loop');
    expect(result).toContain('optional');
  });

  it('should show retry context for retry drills', () => {
    const drill = createMockDrillDisplay({
      isRetry: true,
      retryCount: 1,
    });
    const result = formatDrillForChat(drill);

    expect(result).toContain('🔄');
    expect(result).toContain('Retry');
  });

  it('should show compound skill context', () => {
    const drill = createMockDrillDisplay({
      skillType: 'compound',
      skillTypeLabel: 'Compound',
      isCompound: true,
      buildsOnQuests: ['Python Basics', 'Control Flow'],
    });
    const result = formatDrillForChat(drill);

    expect(result).toContain('🔗');
    expect(result).toContain('Builds on:');
  });

  it('should include time estimate and completion instructions', () => {
    const drill = createMockDrillDisplay();
    const result = formatDrillForChat(drill);

    expect(result).toContain('~25 min');
    expect(result).toContain('"I\'m done"');
    expect(result).toContain('"Skip today"');
  });

  it('should include resilience info when present', () => {
    const drill = createMockDrillDisplay({
      adversarialElement: 'Off-by-one errors in loop bounds',
      failureMode: 'Prints wrong number of items',
    });
    const result = formatDrillForChat(drill);

    expect(result).toContain('💡 **Learning Edge**');
    expect(result).toContain('Off-by-one errors');
  });
});

describe('formatDrillCompact', () => {
  it('should produce short one-line summary', () => {
    const drill = createMockDrillDisplay();
    const result = formatDrillCompact(drill);

    expect(result).toContain('🧱');
    expect(result).toContain('Write a for loop');
    expect(result).toContain('min');
    expect(result.length).toBeLessThan(100);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// WEEK FORMATTER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatWeekForChat', () => {
  it('should format week header with theme', () => {
    const week = createMockWeekDisplay();
    const result = formatWeekForChat(week);

    expect(result).toContain('📅 **Week 1**');
    expect(result).toContain('Introduction to Loops');
  });

  it('should include weekly competence goal', () => {
    const week = createMockWeekDisplay();
    const result = formatWeekForChat(week);

    expect(result).toContain('🎯 **Goal:**');
    expect(result).toContain('Write basic for loops with confidence');
  });

  it('should show progress bar and percentage', () => {
    const week = createMockWeekDisplay();
    const result = formatWeekForChat(week);

    expect(result).toContain('**Progress:**');
    expect(result).toContain('40%');
    expect(result).toMatch(/[█░]+/); // Progress bar characters
  });

  it('should list days with status', () => {
    const week = createMockWeekDisplay();
    const result = formatWeekForChat(week);

    expect(result).toContain('**Monday**');
    expect(result).toContain('**Tuesday**');
    expect(result).toContain('**Wednesday**');
    expect(result).toContain('✅'); // Completed days
    expect(result).toContain('← TODAY');
  });

  it('should show skill type breakdown', () => {
    const week = createMockWeekDisplay();
    const result = formatWeekForChat(week);

    expect(result).toContain('**Skill Focus:**');
    expect(result).toContain('🧱');
    expect(result).toContain('🔨');
  });

  it('should show milestone info for last week of quest', () => {
    const week = createMockWeekDisplay({
      isLastWeekOfQuest: true,
      milestone: {
        title: 'Build a Calculator',
        status: 'locked',
        requiredMasteryPercent: 80,
        currentMasteryPercent: 60,
        isUnlocked: false,
      },
    });
    const result = formatWeekForChat(week);

    expect(result).toContain('**Milestone:**');
    expect(result).toContain('Build a Calculator');
  });
});

describe('formatWeekCompact', () => {
  it('should produce short summary', () => {
    const week = createMockWeekDisplay();
    const result = formatWeekCompact(week);

    expect(result).toContain('Week 1');
    expect(result).toContain('40%');
    expect(result).toContain('2/5');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS FORMATTER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatProgressForChat', () => {
  it('should format header with goal title', () => {
    const progress = createMockProgressDisplay();
    const result = formatProgressForChat(progress);

    expect(result).toContain('📊 **Progress: Learn Python**');
  });

  it('should show overall progress with bar', () => {
    const progress = createMockProgressDisplay();
    const result = formatProgressForChat(progress);

    expect(result).toContain('**Overall:**');
    expect(result).toContain('35%');
    expect(result).toMatch(/[█░]+/);
  });

  it('should show week and day progress', () => {
    const progress = createMockProgressDisplay();
    const result = formatProgressForChat(progress);

    expect(result).toContain('📅 Week 2 of 4');
    expect(result).toContain('📝 Day 7 of 20');
  });

  it('should show skills breakdown', () => {
    const progress = createMockProgressDisplay();
    const result = formatProgressForChat(progress);

    expect(result).toContain('**Skills:**');
    expect(result).toContain('✅ Mastered: 5');
    expect(result).toContain('📝 Practicing: 3');
    expect(result).toContain('🔄 Attempting: 2');
    expect(result).toContain('**Total:** 15');
  });

  it('should show skill type breakdown', () => {
    const progress = createMockProgressDisplay();
    const result = formatProgressForChat(progress);

    expect(result).toContain('**By Type:**');
    expect(result).toContain('🧱 Foundation: 4/5');
    expect(result).toContain('🔨 Building: 1/5');
  });

  it('should show streak and pass rate', () => {
    const progress = createMockProgressDisplay();
    const result = formatProgressForChat(progress);

    expect(result).toContain('🔥 **Streak:** 5 days');
    expect(result).toContain('📈 **Pass Rate:** 85%');
  });

  it('should show quest progress', () => {
    const progress = createMockProgressDisplay();
    const result = formatProgressForChat(progress);

    expect(result).toContain('**Quests:**');
    expect(result).toContain('Python Basics');
    expect(result).toContain('Data Structures');
    expect(result).toContain('← *current*');
  });

  it('should show days behind when not on track', () => {
    const progress = createMockProgressDisplay({
      onTrack: false,
      daysBehind: 3,
    });
    const result = formatProgressForChat(progress);

    expect(result).toContain('⚠️ 3 days behind');
  });
});

describe('formatProgressCompact', () => {
  it('should produce short summary', () => {
    const progress = createMockProgressDisplay();
    const result = formatProgressCompact(progress);

    expect(result).toContain('35%');
    expect(result).toContain('5/15');
    expect(result).toContain('5 day streak');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// MILESTONE FORMATTER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('formatMilestoneForChat', () => {
  it('should format milestone header', () => {
    const milestone = createMockMilestoneDisplay();
    const result = formatMilestoneForChat(milestone);

    expect(result).toContain('🎯 **Milestone: Build a Calculator**');
    expect(result).toContain('*Python Basics*');
  });

  it('should show artifact description', () => {
    const milestone = createMockMilestoneDisplay();
    const result = formatMilestoneForChat(milestone);

    expect(result).toContain('📦 **Deliverable:**');
    expect(result).toContain('working Python script');
  });

  it('should show acceptance criteria', () => {
    const milestone = createMockMilestoneDisplay();
    const result = formatMilestoneForChat(milestone);

    expect(result).toContain('✅ **Acceptance Criteria:**');
    expect(result).toContain('addition, subtraction');
    expect(result).toContain('invalid input');
  });

  it('should show mastery progress', () => {
    const milestone = createMockMilestoneDisplay();
    const result = formatMilestoneForChat(milestone);

    expect(result).toContain('**Quest Mastery:**');
    expect(result).toContain('85%');
    expect(result).toContain('4/5 mastered');
  });

  it('should show unlock message when ready', () => {
    const milestone = createMockMilestoneDisplay({
      isUnlocked: true,
      isCompleted: false,
    });
    const result = formatMilestoneForChat(milestone);

    expect(result).toContain('🎯 **Ready to attempt!**');
  });

  it('should show blocking skills when locked', () => {
    const milestone = createMockMilestoneDisplay({
      isUnlocked: false,
      status: 'locked',
      statusEmoji: '🔒',
      statusLabel: 'Locked',
      blockingSkills: [
        { title: 'Nested loops', mastery: 'practicing', passCount: 1, passesNeeded: 3 },
        { title: 'Error handling', mastery: 'attempting', passCount: 0, passesNeeded: 3 },
      ],
      skillsNeededToUnlock: 2,
    });
    const result = formatMilestoneForChat(milestone);

    expect(result).toContain('🔒 **Skills to Master:**');
    expect(result).toContain('Nested loops');
    expect(result).toContain('Master 2 more skills');
  });

  it('should show completion message when completed', () => {
    const milestone = createMockMilestoneDisplay({
      isCompleted: true,
      status: 'completed',
      statusEmoji: '🏆',
      statusLabel: 'Completed',
      completedAt: '2025-01-20T10:00:00Z',
    });
    const result = formatMilestoneForChat(milestone);

    expect(result).toContain('🏆 **Congratulations!**');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DISPLAY BUILDER TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('buildTodayDrillDisplay', () => {
  it('should build display from drill and skill', () => {
    const drill: any = {
      id: 'drill-001',
      action: 'Write a for loop',
      passSignal: 'Loop works correctly',
      estimatedMinutes: 20,
      scheduledDate: '2025-01-15',
      dayNumber: 3,
      status: 'pending',
      retryCount: 0,
      skillId: 'skill-001',
      questId: 'quest-001',
      lockedVariables: [],
    };

    const skill: any = {
      id: 'skill-001',
      action: 'Write basic for loops',
      skillType: 'foundation',
      mastery: 'practicing',
      status: 'in_progress',
    };

    const result = buildTodayDrillDisplay({
      drill,
      skill,
      weekPlan: null,
      goal: { id: 'goal-001', title: 'Learn Python' } as any,
      quest: { id: 'quest-001', title: 'Python Basics' } as any,
    });

    expect(result.drillId).toBe('drill-001');
    expect(result.skillTitle).toBe('Write basic for loops');
    expect(result.skillType).toBe('foundation');
    expect(result.goalTitle).toBe('Learn Python');
    expect(result.questTitle).toBe('Python Basics');
    expect(result.isRetry).toBe(false);
    expect(result.main).toBeDefined();
    expect(result.main.action).toBe('Write a for loop');
  });

  it('should handle retry drills', () => {
    const drill: any = {
      id: 'drill-002',
      action: 'Write a for loop (retry)',
      passSignal: 'Loop works correctly',
      estimatedMinutes: 20,
      scheduledDate: '2025-01-16',
      dayNumber: 4,
      status: 'pending',
      retryCount: 2,
      isRetry: true,
      skillId: 'skill-001',
      lockedVariables: [],
    };

    const skill: any = {
      id: 'skill-001',
      action: 'Write basic for loops',
      skillType: 'foundation',
      mastery: 'attempting',
      status: 'in_progress',
    };

    const result = buildTodayDrillDisplay({
      drill,
      skill,
      weekPlan: null,
      goal: null,
      quest: null,
    });

    expect(result.isRetry).toBe(true);
    expect(result.retryCount).toBe(2);
  });
});

describe('buildWeekSummaryDisplay', () => {
  it('should build display from week plan', () => {
    const weekPlan: any = {
      id: 'week-001',
      goalId: 'goal-001',
      questId: 'quest-001',
      weekNumber: 1,
      weekInQuest: 1,
      theme: 'Getting Started',
      weeklyCompetence: 'Learn the basics',
      startDate: '2025-01-13',
      status: 'active',
      skillIds: ['skill-001', 'skill-002'],
    };

    const skills: any[] = [
      { id: 'skill-001', action: 'Skill One', skillType: 'foundation', mastery: 'mastered' },
      { id: 'skill-002', action: 'Skill Two', skillType: 'building', mastery: 'practicing' },
    ];

    const result = buildWeekSummaryDisplay({
      weekPlan,
      goal: { id: 'goal-001', title: 'Learn Python' } as any,
      quest: { id: 'quest-001', title: 'Python Basics' } as any,
      skills,
      drills: [],
      today: '2025-01-15',
    });

    expect(result.weekNumber).toBe(1);
    expect(result.theme).toBe('Getting Started');
    expect(result.skillTypes.foundation).toBe(1);
    expect(result.skillTypes.building).toBe(1);
    expect(result.skillsMastered).toBe(1);
  });
});

describe('buildGoalProgressDisplay', () => {
  it('should build display from progress data', () => {
    const goal: any = {
      id: 'goal-001',
      title: 'Learn Python',
      status: 'active',
      createdAt: '2025-01-01T00:00:00Z',
    };

    const progress: any = {
      goalId: 'goal-001',
      daysCompleted: 10,
      totalDays: 20,
      skillsTotal: 15,
      skillsMastered: 5,
      skillsPracticing: 3,
      skillsNotStarted: 7,
      currentStreak: 5,
      overallPassRate: 0.8,
      currentWeek: 2,
    };

    const result = buildGoalProgressDisplay({
      goal,
      progress,
      quests: [],
      questProgress: [],
    });

    expect(result.goalTitle).toBe('Learn Python');
    expect(result.skillsTotal).toBe(15);
    expect(result.skillsMastered).toBe(5);
    expect(result.currentStreak).toBe(5);
    expect(result.overallPassRate).toBe(0.8);
  });
});

describe('buildMilestoneDisplay', () => {
  it('should build display from milestone data', () => {
    const milestone: any = {
      title: 'Build a Calculator',
      description: 'Create a CLI calculator',
      artifact: 'A Python script',
      acceptanceCriteria: ['Works correctly', 'Handles errors'],
      status: 'available',
      requiredMasteryPercent: 80,
      estimatedMinutes: 45,
    };

    const quest: any = {
      id: 'quest-001',
      title: 'Python Basics',
      order: 1,
    };

    const skills: any[] = [
      { id: 's1', mastery: 'mastered' },
      { id: 's2', mastery: 'mastered' },
      { id: 's3', mastery: 'mastered' },
      { id: 's4', mastery: 'mastered' },
      { id: 's5', mastery: 'practicing' },
    ];

    const result = buildMilestoneDisplay({
      milestone,
      quest,
      skills,
    });

    expect(result.title).toBe('Build a Calculator');
    expect(result.questTitle).toBe('Python Basics');
    expect(result.skillsMastered).toBe(4);
    expect(result.skillsTotal).toBe(5);
    expect(result.currentMasteryPercent).toBe(80);
    expect(result.isUnlocked).toBe(true);
  });
});
