// ═══════════════════════════════════════════════════════════════════════════════
// ACTIVITY TYPES
// Rich activity structures for each activity type
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// BASE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type ActivityType = 'read' | 'watch' | 'exercise' | 'practice' | 'build' | 'quiz';

export interface VideoResource {
  title: string;
  url: string;
  thumbnailUrl?: string;
  channel?: string;
  duration?: string;
  viewCount?: number;
  publishedAt?: string;
  description?: string;
}

export interface ArticleResource {
  title: string;
  url: string;
  source?: string;
  snippet?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACTIVITY INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: Date;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // READ ACTIVITY
  // Purpose: Knowledge intake & conceptual grounding
  // Allowed: External articles, documentation, LLM explanations
  // Disallowed: Tasks, instructions, questions
  // ─────────────────────────────────────────────────────────────────────────────
  
  // External article (optional - may not always have one)
  article?: ArticleResource;
  
  // LLM-generated explanation (always present for read)
  explanation?: string;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // WATCH ACTIVITY
  // Purpose: Visual + auditory understanding
  // Allowed: YouTube links, recorded lectures, demo videos
  // Optional: Short "what to focus on" note
  // Disallowed: Exercises, quizzes, multi-step tasks
  // ─────────────────────────────────────────────────────────────────────────────
  
  // YouTube video (required for watch)
  video?: VideoResource;
  
  // What to focus on while watching
  focusPoints?: string[];
  
  // ─────────────────────────────────────────────────────────────────────────────
  // EXERCISE ACTIVITY
  // Purpose: Skill reinforcement through constrained action
  // Allowed: Practice problems, short challenges, "try this" prompts
  // Rules: Small scope, fast feedback, one clear objective
  // ─────────────────────────────────────────────────────────────────────────────
  
  // The exercise prompt
  prompt?: string;
  
  // What the expected outcome looks like
  expectedOutcome?: string;
  
  // Hints if they get stuck
  hints?: string[];
  
  // Example solution (revealed after attempt)
  solution?: string;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PRACTICE ACTIVITY
  // Purpose: Procedural mastery through repetition
  // Allowed: Step-by-step instructions, guided workflows, checklists
  // Rules: Learner already knows what this is, goal is speed/confidence
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Step-by-step instructions
  steps?: string[];
  
  // Checklist items to verify completion
  checklist?: string[];
  
  // Tips for better execution
  tips?: string[];
  
  // ─────────────────────────────────────────────────────────────────────────────
  // BUILD ACTIVITY
  // Purpose: Creation & synthesis
  // Allowed: Project steps, build docs, architecture tasks
  // Rules: Produces an artifact, often multi-session
  // ─────────────────────────────────────────────────────────────────────────────
  
  // What they're building
  objective?: string;
  
  // Requirements/specs
  requirements?: string[];
  
  // Guidance/hints for building
  guidance?: string[];
  
  // Reference docs (optional)
  referenceLinks?: ArticleResource[];
  
  // ─────────────────────────────────────────────────────────────────────────────
  // QUIZ ACTIVITY
  // Purpose: Validation & recall
  // Allowed: Multiple choice, short answer, true/false, scenario questions
  // Rules: Has correct/incorrect answers, used for assessment
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Quiz questions
  questions?: QuizQuestion[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACTIVITY VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate that an activity has required fields for its type
 */
export function validateActivity(activity: Activity): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!activity.id) errors.push('Missing id');
  if (!activity.type) errors.push('Missing type');
  if (!activity.title) errors.push('Missing title');
  if (!activity.estimatedMinutes || activity.estimatedMinutes <= 0) {
    errors.push('Invalid estimatedMinutes');
  }
  
  switch (activity.type) {
    case 'read':
      if (!activity.explanation && !activity.article) {
        errors.push('Read activity must have explanation or article');
      }
      break;
      
    case 'watch':
      if (!activity.video) {
        errors.push('Watch activity must have video');
      }
      break;
      
    case 'exercise':
      if (!activity.prompt) {
        errors.push('Exercise activity must have prompt');
      }
      break;
      
    case 'practice':
      if (!activity.steps || activity.steps.length === 0) {
        errors.push('Practice activity must have steps');
      }
      break;
      
    case 'build':
      if (!activity.objective) {
        errors.push('Build activity must have objective');
      }
      break;
      
    case 'quiz':
      if (!activity.questions || activity.questions.length === 0) {
        errors.push('Quiz activity must have questions');
      }
      break;
  }
  
  return { valid: errors.length === 0, errors };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACTIVITY CONTENT TABLE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Summary of what each activity type should contain:
 * 
 * | Type     | Resource Link | Inline LLM Content | Tasks | Output Required | Purpose   |
 * |----------|---------------|--------------------| ------|-----------------|-----------|
 * | Read     | ✅ (article)  | ✅ (explanation)   | ❌    | ❌              | Understand|
 * | Watch    | ✅ (video)    | ⚠️ (focus points)  | ❌    | ❌              | Observe   |
 * | Exercise | ❌            | ✅                 | ✅    | ✅ (small)      | Reinforce |
 * | Practice | ❌            | ✅                 | ✅    | ❌ / implicit   | Fluency   |
 * | Build    | ✅ (docs)     | ✅                 | ✅    | ✅ (artifact)   | Create    |
 * | Quiz     | ❌            | ✅                 | ❌    | ✅ (answers)    | Validate  |
 */
