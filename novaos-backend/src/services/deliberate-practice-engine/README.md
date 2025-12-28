# Phase 19A-E: Enhanced Types, Generators & Progression Services

## Overview

Phase 19A introduces enhanced type definitions for the Deliberate Practice Engine that support:

1. **Multi-week quests** - Quests can span 1 day to multiple weeks
2. **Skill trees** - Skills form a tree with prerequisites, not a flat list
3. **Cross-quest dependencies** - Skills can build on ANY previous quest
4. **Compound skills** - Explicitly combine skills from multiple quests
5. **Structured daily drills** - Warmup → Main → Stretch format
6. **Milestones** - End-of-quest proof of competence

## Key Type Enhancements

### QuestDuration

```typescript
interface QuestDuration {
  unit: 'days' | 'weeks';
  value: number;              // e.g., 3 weeks
  practiceDays: number;       // computed: 15 days
  weekStart: number;          // Week 2 of goal
  weekEnd: number;            // Week 4 of goal
  displayLabel: string;       // "Weeks 2-4"
}
```

### SkillType

```typescript
type SkillType = 'foundation' | 'building' | 'compound' | 'synthesis';
```

- **foundation**: Core concept, no prereqs within quest
- **building**: Builds on foundations
- **compound**: Combines 2+ skills (can span quests!)
- **synthesis**: Final skill of quest = milestone

### Enhanced Skill

```typescript
interface Skill {
  // NEW: Skill type & tree structure
  skillType: SkillType;
  depth: number;                         // 0=root, 1=building, 2=compound, 3=synthesis
  
  // NEW: Cross-quest dependencies
  prerequisiteSkillIds: SkillId[];       // CAN reference any quest!
  prerequisiteQuestIds: QuestId[];       // Which quests prereqs come from
  
  // NEW: Compound skill support
  isCompound: boolean;
  componentSkillIds?: SkillId[];         // Skills being combined
  componentQuestIds?: QuestId[];         // Quests the components come from
  combinationContext?: string;           // "Filter items using conditions"
  
  // NEW: Enhanced scheduling
  weekNumber: number;                    // Week 3 of goal
  dayInWeek: number;                     // Day 2 of week
  dayInQuest: number;                    // Day 7 of 15-day quest
  
  // NEW: Unlock status
  status: SkillStatus;                   // 'locked' | 'available' | 'in_progress' | 'mastered'
  unlockedAt?: Timestamp;
  masteredAt?: Timestamp;
  
  // ... existing fields preserved
}
```

### Structured DailyDrill

```typescript
interface DailyDrill {
  // NEW: Structured sections
  warmup?: DrillSection;     // Review prerequisite (from ANY quest)
  main: DrillSection;        // Today's skill practice
  stretch?: DrillSection;    // Optional challenge
  
  // NEW: Cross-quest context
  buildsOnQuestIds: QuestId[];    // Which quests this builds on
  reviewSkillId?: SkillId;        // Warmup skill
  reviewQuestId?: QuestId;        // Where warmup comes from
  
  // NEW: Skill type awareness
  skillType: SkillType;
  isCompoundDrill: boolean;
  componentSkillIds?: SkillId[];
  
  // ... existing fields preserved
}

interface DrillSection {
  type: 'warmup' | 'main' | 'stretch';
  title: string;
  action: string;
  passSignal?: string;
  constraint?: string;
  estimatedMinutes: number;
  isOptional?: boolean;
  isFromPreviousQuest?: boolean;
  sourceQuestId?: QuestId;
}
```

### Enhanced WeekPlan

```typescript
interface WeekPlan {
  // NEW: Multi-week quest tracking
  weekInQuest: number;           // Week 2 of 3-week quest
  isFirstWeekOfQuest: boolean;
  isLastWeekOfQuest: boolean;    // Has milestone
  
  // NEW: Day plans
  days: DayPlan[];               // Structured daily schedule
  
  // NEW: Skill type counts
  foundationCount: number;
  buildingCount: number;
  compoundCount: number;
  hasSynthesis: boolean;
  
  // NEW: Cross-quest context
  reviewsFromQuestIds: QuestId[];
  buildsOnSkillIds: SkillId[];
  
  // ... existing fields preserved
}
```

### QuestMilestone

```typescript
interface QuestMilestone {
  title: string;                     // "Build a Calculator"
  description: string;
  artifact: string;                  // "calculator.py"
  acceptanceCriteria: string[];      // Checkable items
  estimatedMinutes: number;
  requiredMasteryPercent: number;    // 0.75 = 75%
  status: MilestoneStatus;           // 'locked' | 'available' | 'in_progress' | 'completed'
  unlockedAt?: Timestamp;
  completedAt?: Timestamp;
}
```

## New Interfaces

### ISkillTreeGenerator

Generates skill trees with:
- Foundation → Building → Compound → Synthesis progression
- Cross-quest dependency detection
- Compound skill creation
- Synthesis skill (milestone) creation

### IWeekPlanGenerator

Generates week plans for any duration:
- Single-day to multi-week quests
- Skill scheduling respecting dependencies
- Review skill identification
- Synthesis placement in last week

### IDailyDrillEngine

Generates structured drills:
- Warmup section (review from previous quest)
- Main practice section
- Stretch challenge (optional)
- Retry adaptation

### IUnlockService

Handles skill unlocking:
- Prerequisite checking
- Unlock triggering after mastery
- Milestone availability checking

### IMasteryService

Tracks mastery progression:
- Outcome recording
- Mastery level updates
- Unlock triggering
- Cross-quest stats

### IProgressService

Provides progress tracking:
- Goal progress
- Quest progress
- Weekly summaries
- Streak calculation

## Skill Distribution

Default distribution for generated skills:

```typescript
const DEFAULT_SKILL_DISTRIBUTION = {
  foundationPercent: 0.35,   // 35% foundation skills
  buildingPercent: 0.25,     // 25% building skills
  compoundPercent: 0.30,     // 30% compound skills
  synthesisPercent: 0.10,    // 10% synthesis skills
};
```

For a 15-day quest (3 weeks):
- ~5 foundation skills
- ~4 building skills
- ~5 compound skills
- ~1 synthesis skill (the milestone)

## Migration Notes

### Backward Compatibility

All existing fields are preserved. New fields are added alongside:

- `Skill`: Added `skillType`, `depth`, `status`, compound fields, scheduling fields
- `DailyDrill`: Added sections, cross-quest fields, kept legacy `action`/`passSignal`
- `WeekPlan`: Added `days`, `weekInQuest`, skill type counts, cross-quest context

### Store Changes

Store interfaces enhanced with new query methods:

```typescript
// New skill store methods
getByStatus(goalId, status): AsyncAppResult<Skill[]>
getByType(questId, skillType): AsyncAppResult<Skill[]>
getAvailable(goalId): AsyncAppResult<Skill[]>
getLocked(goalId): AsyncAppResult<Skill[]>
updateStatus(skillId, status): AsyncAppResult<Skill>

// New week plan store methods
getByQuest(questId): AsyncAppResult<WeekPlan[]>
getLastWeekOfQuest(questId): AsyncAppResult<WeekPlan | null>
```

## Next Steps

- **Phase 19A**: Enhanced types ✅ COMPLETE
- **Phase 19B**: Skill Tree Generator ✅ COMPLETE
- **Phase 19C**: Week Plan Generator ✅ COMPLETE
- **Phase 19D**: Daily Drill Engine ✅ COMPLETE
- **Phase 19E**: Progression Services ✅ COMPLETE
- **Phase 19F**: Integrate with chat commands
- **Phase 19G**: Update Spark reminders

## Phase 19B: Skill Tree Generator

The `SkillTreeGenerator` creates skill trees from `CapabilityStage` arrays.

### Key Features

1. **Tree Structure Generation**
   - Foundation skills (no prereqs within quest)
   - Building skills (depend on foundations)
   - Compound skills (combine 2+ skills, can span quests!)
   - Synthesis skill (milestone at end)

2. **Cross-Quest Dependencies**
   - `findRelevantPriorSkills()` finds skills with topic overlap
   - Compound skills can reference ANY previous quest
   - Automatically includes mastered skills for review

3. **Smart Distribution**
   ```typescript
   DEFAULT_SKILL_DISTRIBUTION = {
     foundationPercent: 0.35,  // ~35% foundation
     buildingPercent: 0.25,    // ~25% building
     compoundPercent: 0.30,    // ~30% compound
     synthesisPercent: 0.10,   // 1 synthesis (milestone)
   }
   ```

4. **LLM-Powered Generation (Optional)**
   - Uses GPT-4o-mini for smart skill decomposition
   - Falls back to rule-based generation if unavailable
   - Generates actionable, specific skills

### Usage

```typescript
import { createSkillTreeGenerator } from './skill-tree-generator.js';

const generator = createSkillTreeGenerator({
  openaiApiKey: process.env.OPENAI_API_KEY,
  useLLM: true,
});

const result = await generator.generate({
  quest,
  goal,
  stages,                    // CapabilityStage[]
  duration,                  // QuestDuration
  dailyMinutes: 30,
  userLevel: 'beginner',
  previousQuestSkills: [],   // Skill[] from prior quests
  previousQuests: [],
});

if (result.ok) {
  const { 
    skills,              // All generated skills
    rootSkillIds,        // Foundation skill IDs
    synthesisSkillId,    // Milestone skill ID
    crossQuestSkillIds,  // Skills with cross-quest deps
    milestone,           // QuestMilestone
    distribution,        // Actual counts by type
    warnings,            // Any validation warnings
  } = result.value;
}
```

### Compound Skill Creation

```typescript
// Create a compound that combines two skills
const compound = await generator.createCompoundSkill(
  [variablesSkill, loopsSkill],
  context
);

// Result:
{
  skillType: 'compound',
  isCompound: true,
  componentSkillIds: [variablesSkill.id, loopsSkill.id],
  componentQuestIds: ['quest_week1', 'quest_week2'],  // If cross-quest
  combinationContext: 'Variables (Store data...), Loops (Iterate over...)',
}
```

### Validation

All generated skills are validated:
- Action must start with verb
- Success signal ≥ 10 characters
- Must have locked variables
- Must fit daily time budget
- Compounds must have ≥ 2 components

```typescript
const error = generator.validateSkill(skill, dailyMinutes);
if (error) console.warn(error);
```

## Phase 19C: Week Plan Generator

The `WeekPlanGenerator` creates week plans from skills with day-by-day scheduling.

### Key Features

1. **Day-by-Day Scheduling**
   - Respects skill dependencies (topological sort)
   - Foundations first, synthesis last
   - 5 practice days per week (configurable)

2. **Cross-Quest Review**
   - Identifies prerequisite skills from previous quests
   - Assigns review skills to warmup slots
   - Tracks `reviewsFromQuestIds` and `buildsOnSkillIds`

3. **Multi-Week Quest Support**
   - `generateForQuest()` creates all week plans at once
   - Distributes skills evenly across weeks
   - Places synthesis in final week

4. **Carry-Forward Support**
   - Prioritizes carry-forward skills (from failed attempts)
   - Tracks `carryForwardSkillIds` separately

### Usage

```typescript
import { createWeekPlanGenerator } from './week-plan-generator.js';

const generator = createWeekPlanGenerator({
  daysPerWeek: 5,
  maxReviewSkillsPerWeek: 3,
  shuffleReviews: true,
});

// Generate a single week
const result = await generator.generate({
  goal,
  quest,
  duration,
  weekNumber: 1,
  weekInQuest: 1,
  weekSkills: skills,
  previousQuestSkills: priorSkills,
  carryForwardSkills: [],
  startDate: '2025-01-06',
});

if (result.ok) {
  const { weekPlan, dayPlans, reviewSkills, warnings } = result.value;
}

// Generate all weeks for a quest
const allWeeks = await generator.generateForQuest(
  quest,
  duration,
  skills,
  previousQuestSkills,
  goal,
  startWeekNumber,
  startDate
);
```

### Day Plan Structure

```typescript
interface DayPlan {
  dayNumber: number;       // 1-5 within week
  dayInQuest: number;      // 1-15 for 3-week quest
  scheduledDate: string;   // '2025-01-06'
  skillId: SkillId;
  skillType: SkillType;
  skillTitle: string;
  reviewSkillId?: SkillId;  // From previous quest
  reviewQuestId?: QuestId;  // Which quest it's from
  status: 'pending' | 'completed' | 'skipped';
}
```

### Week Plan Properties

```typescript
interface WeekPlan {
  // Position in quest
  weekNumber: number;           // Week 3 of goal
  weekInQuest: number;          // Week 2 of this quest
  isFirstWeekOfQuest: boolean;
  isLastWeekOfQuest: boolean;   // Has milestone
  
  // Skill counts
  foundationCount: number;
  buildingCount: number;
  compoundCount: number;
  hasSynthesis: boolean;
  
  // Cross-quest context
  reviewsFromQuestIds: QuestId[];
  buildsOnSkillIds: SkillId[];
  
  // Progress tracking
  drillsCompleted: number;
  drillsTotal: number;
  drillsPassed: number;
  skillsMastered: number;
}
```

## Phase 19D: Daily Drill Engine

The `DailyDrillEngine` generates structured practice drills with warmup/main/stretch sections.

### Drill Structure

```
┌─────────────────────────────────────────┐
│ WARMUP (5 min) — Review previous quest  │
├─────────────────────────────────────────┤
│ MAIN (20-25 min) — Today's skill        │
├─────────────────────────────────────────┤
│ STRETCH (5 min) — Optional challenge    │
└─────────────────────────────────────────┘
```

### Key Features

1. **Cross-Quest Warmups**
   - Uses review skills from previous quests
   - Relates warmup to today's skill when topics overlap
   - Tracks `reviewSkillId` and `reviewQuestId`

2. **Resilience Layer Integration**
   - Main section includes `adversarialElement`
   - Includes `failureMode` and `recoverySteps`
   - Built from skill's resilience fields

3. **Retry Adaptation**
   - Progressive scaffolding for failed attempts
   - Increases time budget (1.25x → 1.5x)
   - Removes stretch on retry
   - Generates recovery guidance

4. **Skill-Type-Aware Stretch**
   - Foundation: Apply in different context
   - Building: Combine with previous skill
   - Compound: Teach the concept
   - Synthesis: Speed challenge

### Usage

```typescript
import { createDailyDrillEngine } from './daily-drill-engine.js';

const engine = createDailyDrillEngine({
  warmupMinutes: 5,
  stretchMinutes: 5,
  includeStretch: true,
  maxRetryAttempts: 3,
});

// Generate a drill
const result = await engine.generate({
  skill,
  reviewSkill,          // Optional: from previous quest
  dayPlan,
  dailyMinutes: 30,
  attemptNumber: 1,
});

if (result.ok) {
  const { drill, sections, totalMinutes, hasWarmup, hasStretch } = result.value;
}

// Adapt for retry after failure
const retryResult = await engine.adaptForRetry(
  drill,
  'Missed edge cases',  // Failure reason
  2                      // Attempt number
);
```

### DrillSection Structure

```typescript
interface DrillSection {
  type: 'warmup' | 'main' | 'stretch';
  title: string;
  action: string;
  passSignal: string;
  constraint: string;
  estimatedMinutes: number;
  isOptional: boolean;
  isFromPreviousQuest: boolean;
  sourceQuestId?: QuestId;
  sourceSkillId?: SkillId;
  
  // Main section only (resilience layer)
  adversarialElement?: string;
  failureMode?: string;
  recoverySteps?: string;
}
```

### Retry Adaptation

```typescript
// After first failure
const retry = await engine.adaptForRetry(drill, 'Forgot edge cases', 2);

// Result:
{
  attemptNumber: 2,
  previousFailureReason: 'Forgot edge cases',
  main: {
    title: 'Test Skill (Retry 2)',
    action: 'Previous attempt failed: "Forgot edge cases". Take more time...',
    estimatedMinutes: 25,  // 1.25x original
  },
  stretch: undefined,      // Removed on retry
  recoveryGuidance: '1. Re-read the success signal...',
}
```

## Phase 19E: Progression Services (Unlock & Mastery)

Two services that work together to manage skill progression.

### UnlockService

Manages skill unlocking based on prerequisites.

```typescript
import { createUnlockService } from './progression-services.js';

const unlockService = createUnlockService(skillStore);

// Check if prerequisites are met
const prereqCheck = await unlockService.checkPrerequisites(skill, allSkills);
if (prereqCheck.ok && prereqCheck.value.allMet) {
  // Ready to unlock
}

// Unlock all eligible skills in quest
const unlockResult = await unlockService.unlockEligibleSkills(questId, allSkills);
// Returns: { unlockedSkills, stillLockedSkills, unlockedCount }

// Check milestone availability
const milestoneCheck = await unlockService.checkMilestoneAvailability(
  questId,
  allSkills,
  0.75  // 75% mastery required
);

// Get locked skills with reasons
const lockedInfo = await unlockService.getLockedSkillsWithReasons(questId, allSkills);
// Returns: [{ skill, missingPrerequisites, reasons }]
```

### MasteryService

Tracks skill mastery based on drill outcomes.

```typescript
import { createMasteryService } from './progression-services.js';

const masteryService = createMasteryService(skillStore, unlockService);

// Record drill outcome
const outcome = await masteryService.recordOutcome(skillId, passed, allSkills);
// Returns: { skill, previousMastery, newMastery, masteryChanged, unlockedSkills }

// Get mastery summary
const summary = masteryService.getMasterySummary(skills);
// Returns: { total, byMastery: { not_started, practicing, mastered }, masteredPercent }

// Get quest mastery percentage
const percent = await masteryService.getQuestMasteryPercent(questId, allSkills);
```

### Mastery Thresholds

```typescript
MASTERY_THRESHOLDS = {
  PRACTICING: 1,           // 1 pass → practicing
  MASTERED: 3,             // 3 passes → mastered
  CONSECUTIVE_FOR_MASTERY: 2,  // Must be consecutive
}
```

### Progression Flow

```
Drill Complete → MasteryService.recordOutcome()
              → Updates skill (passCount, consecutivePasses, mastery)
              → If mastered: UnlockService.unlockEligibleSkills()
              → Cascade unlocks dependent skills
              → Returns unlockedSkills in result
```

### InMemorySkillStore

Simple store for testing:

```typescript
const store = createInMemorySkillStore();
await store.save(skill);
await store.get(skillId);
await store.getByQuest(questId);
await store.getByStatus(questId, 'locked');
await store.updateStatus(skillId, 'available');
```

## Files

```
src/services/deliberate-practice-engine/
├── types.ts                      # Enhanced type definitions
├── interfaces.ts                 # Enhanced interface contracts
├── skill-tree-generator.ts       # Phase 19B: Skill tree generation
├── skill-tree-generator.test.ts  # Tests for skill tree generator
├── week-plan-generator.ts        # Phase 19C: Week plan generation
├── week-plan-generator.test.ts   # Tests for week plan generator
├── daily-drill-engine.ts         # Phase 19D: Daily drill generation
├── daily-drill-engine.test.ts    # Tests for daily drill engine
├── progression-services.ts       # Phase 19E: Unlock & mastery services
├── progression-services.test.ts  # Tests for progression services
└── README.md                     # This file
```
