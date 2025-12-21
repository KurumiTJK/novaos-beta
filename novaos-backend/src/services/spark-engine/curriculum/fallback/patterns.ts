// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK PATTERNS — Pre-Written Curriculum Patterns
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════
//
// Provides fallback curriculum structure when LLM is unavailable:
//   - Pre-written exercises by topic
//   - Template-based day structures
//   - Self-guided learning patterns
//
// Used when:
//   - LLM circuit breaker is open
//   - LLM request times out
//   - LLM response fails validation
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { TopicId } from '../../resource-discovery/types.js';
import type {
  DifficultyLevel,
  Exercise,
  ExerciseType,
  LearningObjective,
} from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A fallback exercise template.
 */
export interface ExerciseTemplate {
  /** Template ID */
  readonly id: string;
  
  /** Exercise type */
  readonly type: ExerciseType;
  
  /** Template with placeholders */
  readonly template: string;
  
  /** Default duration in minutes */
  readonly defaultMinutes: number;
  
  /** Applicable difficulty levels */
  readonly difficulties: readonly DifficultyLevel[];
  
  /** Applicable topics */
  readonly topics: readonly string[];
  
  /** Whether this is optional by default */
  readonly optional: boolean;
}

/**
 * A fallback objective template.
 */
export interface ObjectiveTemplate {
  /** Template ID */
  readonly id: string;
  
  /** Template with placeholders */
  readonly template: string;
  
  /** Applicable difficulty levels */
  readonly difficulties: readonly DifficultyLevel[];
  
  /** Applicable topics */
  readonly topics: readonly string[];
}

/**
 * Day structure template.
 */
export interface DayStructureTemplate {
  /** Template ID */
  readonly id: string;
  
  /** Template name */
  readonly name: string;
  
  /** Theme template */
  readonly themeTemplate: string;
  
  /** Number of resources to assign */
  readonly resourceCount: number;
  
  /** Exercise types to include */
  readonly exercises: readonly ExerciseType[];
  
  /** Objective count */
  readonly objectiveCount: number;
  
  /** Notes template */
  readonly notesTemplate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXERCISE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Pre-written exercise templates organized by type.
 */
export const EXERCISE_TEMPLATES: readonly ExerciseTemplate[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // PRACTICE EXERCISES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'practice-implement',
    type: 'practice',
    template: 'Implement the main concept from today\'s resource in a small project or code snippet.',
    defaultMinutes: 30,
    difficulties: ['beginner', 'intermediate', 'advanced'],
    topics: ['programming', 'typescript', 'javascript', 'python', 'coding'],
    optional: false,
  },
  {
    id: 'practice-recreate',
    type: 'practice',
    template: 'Recreate one example from the resource without looking at the original.',
    defaultMinutes: 20,
    difficulties: ['beginner', 'intermediate'],
    topics: ['programming', 'design', 'coding'],
    optional: false,
  },
  {
    id: 'practice-extend',
    type: 'practice',
    template: 'Extend the example from the resource with one additional feature or improvement.',
    defaultMinutes: 25,
    difficulties: ['intermediate', 'advanced'],
    topics: ['programming', 'coding'],
    optional: false,
  },
  {
    id: 'practice-debug',
    type: 'practice',
    template: 'Intentionally break the code and practice debugging to fix it.',
    defaultMinutes: 15,
    difficulties: ['beginner', 'intermediate'],
    topics: ['programming', 'debugging', 'coding'],
    optional: true,
  },
  {
    id: 'practice-refactor',
    type: 'practice',
    template: 'Refactor the example code to improve readability or performance.',
    defaultMinutes: 20,
    difficulties: ['intermediate', 'advanced'],
    topics: ['programming', 'refactoring', 'coding'],
    optional: false,
  },
  {
    id: 'practice-apply',
    type: 'practice',
    template: 'Apply today\'s concepts to a real problem you\'re currently facing.',
    defaultMinutes: 30,
    difficulties: ['intermediate', 'advanced'],
    topics: ['*'], // All topics
    optional: false,
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // QUIZ EXERCISES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'quiz-concepts',
    type: 'quiz',
    template: 'Write down 3 key concepts from today\'s material and explain each in your own words.',
    defaultMinutes: 10,
    difficulties: ['beginner', 'intermediate', 'advanced'],
    topics: ['*'],
    optional: false,
  },
  {
    id: 'quiz-compare',
    type: 'quiz',
    template: 'Compare and contrast the main approach with an alternative you know.',
    defaultMinutes: 10,
    difficulties: ['intermediate', 'advanced'],
    topics: ['*'],
    optional: false,
  },
  {
    id: 'quiz-when-to-use',
    type: 'quiz',
    template: 'List 3 scenarios where you would use this technique and 2 where you wouldn\'t.',
    defaultMinutes: 10,
    difficulties: ['intermediate', 'advanced'],
    topics: ['*'],
    optional: false,
  },
  {
    id: 'quiz-pitfalls',
    type: 'quiz',
    template: 'Identify 3 common mistakes or pitfalls when applying these concepts.',
    defaultMinutes: 10,
    difficulties: ['beginner', 'intermediate'],
    topics: ['*'],
    optional: true,
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PROJECT EXERCISES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'project-mini',
    type: 'project',
    template: 'Build a small project that demonstrates the core concept from today\'s learning.',
    defaultMinutes: 45,
    difficulties: ['beginner', 'intermediate', 'advanced'],
    topics: ['programming', 'coding', 'design'],
    optional: false,
  },
  {
    id: 'project-combine',
    type: 'project',
    template: 'Create a project that combines today\'s concept with something you learned earlier this week.',
    defaultMinutes: 60,
    difficulties: ['intermediate', 'advanced'],
    topics: ['programming', 'coding'],
    optional: true,
  },
  {
    id: 'project-portfolio',
    type: 'project',
    template: 'Add a portfolio-worthy example of this concept to your personal project collection.',
    defaultMinutes: 60,
    difficulties: ['intermediate', 'advanced'],
    topics: ['*'],
    optional: true,
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // REFLECTION EXERCISES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'reflect-learning',
    type: 'reflection',
    template: 'Write a brief reflection: What was the most valuable insight from today? What questions remain?',
    defaultMinutes: 10,
    difficulties: ['beginner', 'intermediate', 'advanced'],
    topics: ['*'],
    optional: false,
  },
  {
    id: 'reflect-connection',
    type: 'reflection',
    template: 'How does today\'s learning connect to your current work or projects?',
    defaultMinutes: 10,
    difficulties: ['intermediate', 'advanced'],
    topics: ['*'],
    optional: true,
  },
  {
    id: 'reflect-teach',
    type: 'reflection',
    template: 'Explain today\'s main concept as if teaching it to someone new to the field.',
    defaultMinutes: 15,
    difficulties: ['intermediate', 'advanced'],
    topics: ['*'],
    optional: false,
  },
  {
    id: 'reflect-difficulty',
    type: 'reflection',
    template: 'What was the most challenging part of today\'s material? How might you overcome that challenge?',
    defaultMinutes: 10,
    difficulties: ['beginner', 'intermediate'],
    topics: ['*'],
    optional: true,
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // DISCUSSION EXERCISES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'discuss-share',
    type: 'discussion',
    template: 'Share one insight from today\'s learning with a peer or in a community forum.',
    defaultMinutes: 15,
    difficulties: ['beginner', 'intermediate', 'advanced'],
    topics: ['*'],
    optional: true,
  },
  {
    id: 'discuss-debate',
    type: 'discussion',
    template: 'Find an opposing viewpoint on today\'s topic and consider both perspectives.',
    defaultMinutes: 15,
    difficulties: ['intermediate', 'advanced'],
    topics: ['*'],
    optional: true,
  },
  {
    id: 'discuss-question',
    type: 'discussion',
    template: 'Post a thoughtful question about today\'s topic in a relevant community or forum.',
    defaultMinutes: 10,
    difficulties: ['beginner', 'intermediate'],
    topics: ['*'],
    optional: true,
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// OBJECTIVE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Pre-written learning objective templates.
 */
export const OBJECTIVE_TEMPLATES: readonly ObjectiveTemplate[] = [
  {
    id: 'obj-understand',
    template: 'Understand the fundamental concepts and principles covered in today\'s resources.',
    difficulties: ['beginner', 'intermediate', 'advanced'],
    topics: ['*'],
  },
  {
    id: 'obj-apply',
    template: 'Apply the learned concepts to practical examples or exercises.',
    difficulties: ['beginner', 'intermediate', 'advanced'],
    topics: ['*'],
  },
  {
    id: 'obj-implement',
    template: 'Implement a working example that demonstrates the key techniques.',
    difficulties: ['intermediate', 'advanced'],
    topics: ['programming', 'coding'],
  },
  {
    id: 'obj-analyze',
    template: 'Analyze when and why to use these approaches versus alternatives.',
    difficulties: ['intermediate', 'advanced'],
    topics: ['*'],
  },
  {
    id: 'obj-build',
    template: 'Build foundational knowledge that supports more advanced topics.',
    difficulties: ['beginner'],
    topics: ['*'],
  },
  {
    id: 'obj-connect',
    template: 'Connect today\'s concepts with previously learned material.',
    difficulties: ['intermediate', 'advanced'],
    topics: ['*'],
  },
  {
    id: 'obj-evaluate',
    template: 'Evaluate the tradeoffs and limitations of different approaches.',
    difficulties: ['advanced'],
    topics: ['*'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// DAY STRUCTURE TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Pre-defined day structure templates.
 */
export const DAY_STRUCTURE_TEMPLATES: readonly DayStructureTemplate[] = [
  {
    id: 'introduction',
    name: 'Introduction Day',
    themeTemplate: 'Introduction to {topic}',
    resourceCount: 2,
    exercises: ['quiz', 'reflection'],
    objectiveCount: 2,
    notesTemplate: 'Focus on understanding the basics. Don\'t worry about mastering everything today.',
  },
  {
    id: 'deep-dive',
    name: 'Deep Dive Day',
    themeTemplate: 'Deep Dive: {topic}',
    resourceCount: 3,
    exercises: ['practice', 'quiz'],
    objectiveCount: 3,
    notesTemplate: 'Take your time with the material. Pause and practice as you go.',
  },
  {
    id: 'practice-day',
    name: 'Practice Day',
    themeTemplate: 'Hands-On Practice: {topic}',
    resourceCount: 2,
    exercises: ['practice', 'practice', 'reflection'],
    objectiveCount: 2,
    notesTemplate: 'Today is about doing, not just reading. Spend most of your time coding or practicing.',
  },
  {
    id: 'project-day',
    name: 'Project Day',
    themeTemplate: 'Building with {topic}',
    resourceCount: 1,
    exercises: ['project', 'reflection'],
    objectiveCount: 2,
    notesTemplate: 'Apply what you\'ve learned to build something real.',
  },
  {
    id: 'review-day',
    name: 'Review Day',
    themeTemplate: 'Review and Consolidate: {topic}',
    resourceCount: 2,
    exercises: ['quiz', 'reflection', 'discussion'],
    objectiveCount: 2,
    notesTemplate: 'Look back at what you\'ve learned. Identify gaps and strengthen understanding.',
  },
  {
    id: 'advanced-day',
    name: 'Advanced Concepts',
    themeTemplate: 'Advanced {topic}',
    resourceCount: 2,
    exercises: ['practice', 'quiz'],
    objectiveCount: 3,
    notesTemplate: 'Challenge yourself with more complex material. It\'s okay if some concepts take time to sink in.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// SELECTION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Select exercises matching criteria.
 */
export function selectExercises(
  options: {
    types?: ExerciseType[];
    difficulty?: DifficultyLevel;
    topics?: string[];
    count?: number;
    includeOptional?: boolean;
  }
): Exercise[] {
  const {
    types,
    difficulty = 'intermediate',
    topics = [],
    count = 2,
    includeOptional = true,
  } = options;
  
  // Filter matching templates
  let candidates = EXERCISE_TEMPLATES.filter(template => {
    // Type filter
    if (types && types.length > 0 && !types.includes(template.type)) {
      return false;
    }
    
    // Difficulty filter
    if (!template.difficulties.includes(difficulty)) {
      return false;
    }
    
    // Optional filter
    if (!includeOptional && template.optional) {
      return false;
    }
    
    // Topic filter
    if (topics.length > 0) {
      const hasWildcard = template.topics.includes('*');
      const hasMatch = template.topics.some(t => 
        topics.some(topic => topic.toLowerCase().includes(t.toLowerCase()))
      );
      if (!hasWildcard && !hasMatch) {
        return false;
      }
    }
    
    return true;
  });
  
  // Shuffle and take requested count
  candidates = shuffle(candidates);
  const selected = candidates.slice(0, count);
  
  // Convert to Exercise
  return selected.map(template => ({
    type: template.type,
    description: template.template,
    minutes: template.defaultMinutes,
    optional: template.optional,
  }));
}

/**
 * Select objectives matching criteria.
 */
export function selectObjectives(
  options: {
    difficulty?: DifficultyLevel;
    topics?: string[];
    count?: number;
  }
): LearningObjective[] {
  const {
    difficulty = 'intermediate',
    topics = [],
    count = 2,
  } = options;
  
  // Filter matching templates
  let candidates = OBJECTIVE_TEMPLATES.filter(template => {
    // Difficulty filter
    if (!template.difficulties.includes(difficulty)) {
      return false;
    }
    
    // Topic filter
    if (topics.length > 0) {
      const hasWildcard = template.topics.includes('*');
      const hasMatch = template.topics.some(t =>
        topics.some(topic => topic.toLowerCase().includes(t.toLowerCase()))
      );
      if (!hasWildcard && !hasMatch) {
        return false;
      }
    }
    
    return true;
  });
  
  // Shuffle and take requested count
  candidates = shuffle(candidates);
  const selected = candidates.slice(0, count);
  
  // Convert to LearningObjective
  return selected.map(template => ({
    description: template.template,
  }));
}

/**
 * Select day structure template.
 */
export function selectDayStructure(
  dayNumber: number,
  totalDays: number,
  difficulty: DifficultyLevel
): DayStructureTemplate {
  // Determine structure based on position in curriculum
  if (dayNumber === 1) {
    return DAY_STRUCTURE_TEMPLATES.find(t => t.id === 'introduction')!;
  }
  
  if (dayNumber === totalDays) {
    return DAY_STRUCTURE_TEMPLATES.find(t => t.id === 'review-day')!;
  }
  
  if (dayNumber === totalDays - 1 && totalDays > 3) {
    return DAY_STRUCTURE_TEMPLATES.find(t => t.id === 'project-day')!;
  }
  
  if (difficulty === 'advanced' && dayNumber > totalDays / 2) {
    return DAY_STRUCTURE_TEMPLATES.find(t => t.id === 'advanced-day')!;
  }
  
  // Alternate between deep-dive and practice
  if (dayNumber % 2 === 0) {
    return DAY_STRUCTURE_TEMPLATES.find(t => t.id === 'practice-day')!;
  }
  
  return DAY_STRUCTURE_TEMPLATES.find(t => t.id === 'deep-dive')!;
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Fisher-Yates shuffle.
 */
function shuffle<T>(array: readonly T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/**
 * Apply topic to template string.
 */
export function applyTemplate(template: string, topic: string): string {
  return template.replace(/\{topic\}/g, topic);
}

// ─────────────────────────────────────────────────────────────────────────────────
// SELF-GUIDED PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generic self-guided learning notes for when LLM is unavailable.
 */
export const SELF_GUIDED_NOTES = {
  beforeStudy: `Before you begin:
- Review the resource titles and descriptions
- Set a timer for your study session
- Have a notebook ready for notes
- Minimize distractions`,

  duringStudy: `While studying:
- Take notes on key concepts
- Pause to think about how ideas connect
- Try examples as you encounter them
- Write down questions that arise`,

  afterStudy: `After completing resources:
- Review your notes
- Attempt the exercises without looking back
- Reflect on what you learned
- Plan how to apply these concepts`,

  stuckAdvice: `If you're stuck:
- Re-read the relevant section
- Search for alternative explanations
- Take a short break and return fresh
- Move on and return to difficult topics later`,
} as const;

/**
 * Generate self-guided fallback notes for a day.
 */
export function generateSelfGuidedNotes(
  dayNumber: number,
  totalDays: number,
  resourceCount: number
): string {
  const lines: string[] = [];
  
  lines.push('📚 Self-Guided Learning Day');
  lines.push('');
  
  if (dayNumber === 1) {
    lines.push('Welcome! This is your first day. Take it slow and focus on understanding fundamentals.');
  } else if (dayNumber === totalDays) {
    lines.push('Final day! Review what you\'ve learned and consolidate your understanding.');
  } else {
    lines.push(`Day ${dayNumber} of ${totalDays}. Build on yesterday\'s progress.`);
  }
  
  lines.push('');
  lines.push(`Today you have ${resourceCount} resource${resourceCount > 1 ? 's' : ''} to work through.`);
  lines.push('');
  lines.push(SELF_GUIDED_NOTES.beforeStudy);
  
  return lines.join('\n');
}
