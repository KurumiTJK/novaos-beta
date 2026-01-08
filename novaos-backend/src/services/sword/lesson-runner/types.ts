// ═══════════════════════════════════════════════════════════════════════════════
// LESSON RUNNER TYPES
// Types for the simplified subskill-based lesson runner
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  Route,
  SubskillType,
  PlanSubskill,
  LessonPlan,
  GenerationSource,
} from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────────

export type SubskillRouteType = 'skip' | 'assess' | 'learn';

export type AssessmentRecommendation = 'autopass' | 'targeted' | 'convert_learn';

export type QuestionType = 'multiple_choice' | 'short_answer' | 'true_false' | 'ordering';

export type ActivityType = 'read' | 'watch' | 'exercise' | 'practice' | 'build' | 'quiz';

// ─────────────────────────────────────────────────────────────────────────────────
// SUBSKILL LESSON PLAN
// Generated once when subskill starts
// ─────────────────────────────────────────────────────────────────────────────────

export interface SessionOutline {
  sessionNumber: number;
  title: string;
  focus: string;
  objectives: string[];
  estimatedMinutes: number;
}

export interface SubskillLessonPlan {
  id: string;
  subskillId: string;
  planId: string;
  
  // Learning structure
  learningObjectives: string[];
  prerequisites: string[];
  sessionOutline: SessionOutline[];
  
  // For assess flow (targeted remediation)
  isRemediationPlan: boolean;
  assessmentId?: string;
  gaps?: Gap[];
  
  // Metadata
  generatedAt: Date;
  generationSource: GenerationSource;
}

export interface SubskillLessonPlanRow {
  id: string;
  subskill_id: string;
  plan_id: string;
  learning_objectives: string[];
  prerequisites: string[];
  session_outline: SessionOutline[];
  is_remediation_plan: boolean;
  assessment_id: string | null;
  gaps: Gap[] | null;
  generated_at: string;
  generation_source: string;
}

export function mapSubskillLessonPlan(row: SubskillLessonPlanRow): SubskillLessonPlan {
  return {
    id: row.id,
    subskillId: row.subskill_id,
    planId: row.plan_id,
    learningObjectives: row.learning_objectives || [],
    prerequisites: row.prerequisites || [],
    sessionOutline: row.session_outline || [],
    isRemediationPlan: row.is_remediation_plan,
    assessmentId: row.assessment_id || undefined,
    gaps: row.gaps || undefined,
    generatedAt: new Date(row.generated_at),
    generationSource: row.generation_source as GenerationSource,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASSESSMENT (Diagnostic Test)
// ─────────────────────────────────────────────────────────────────────────────────

export interface DiagnosticQuestion {
  id: string;
  area: string;
  question: string;
  type: QuestionType;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  difficulty: 1 | 2 | 3;
}

export interface UserAnswer {
  questionId: string;
  answer: string | string[];
  isCorrect?: boolean;
}

export interface AreaResult {
  area: string;
  questionsTotal: number;
  questionsCorrect: number;
  score: number;
  status: 'strong' | 'weak' | 'gap';
}

export interface Gap {
  area: string;
  score: number;
  priority: 'high' | 'medium' | 'low';
  suggestedFocus: string;
}

export interface SubskillAssessment {
  id: string;
  subskillId: string;
  userId: string;
  
  // Test content
  questions: DiagnosticQuestion[];
  answers?: UserAnswer[];
  
  // Results
  score?: number;
  areaResults?: AreaResult[];
  gaps?: Gap[];
  strengths?: string[];
  recommendation?: AssessmentRecommendation;
  
  // Timestamps
  startedAt: Date;
  completedAt?: Date;
}

export interface SubskillAssessmentRow {
  id: string;
  subskill_id: string;
  user_id: string;
  questions: DiagnosticQuestion[];
  answers: UserAnswer[] | null;
  score: number | null;
  area_results: AreaResult[] | null;
  gaps: Gap[] | null;
  strengths: string[] | null;
  recommendation: string | null;
  started_at: string;
  completed_at: string | null;
}

export function mapSubskillAssessment(row: SubskillAssessmentRow): SubskillAssessment {
  return {
    id: row.id,
    subskillId: row.subskill_id,
    userId: row.user_id,
    questions: row.questions,
    answers: row.answers || undefined,
    score: row.score || undefined,
    areaResults: row.area_results || undefined,
    gaps: row.gaps || undefined,
    strengths: row.strengths || undefined,
    recommendation: row.recommendation as AssessmentRecommendation | undefined,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// DAILY LESSON
// Generated per session when user starts
// ─────────────────────────────────────────────────────────────────────────────────

export interface LessonSection {
  title: string;
  content: string;
  bulletPoints?: string[];
}

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
  
  // LLM-generated explanation (always present for read)
  explanation?: string;
  
  // External article (optional - may not always have one)
  article?: ArticleResource;
  
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
  questions?: ActivityQuizQuestion[];
}

export interface ResourceLink {
  title: string;
  url: string;
  snippet?: string;
  source?: string;
}

// Alias for clarity in activity context
export type ArticleResource = ResourceLink;

export interface ActivityQuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface VideoResource {
  title: string;
  url: string;
  thumbnailUrl?: string;
  duration?: string;
  channel?: string;
  viewCount?: number;
  publishedAt?: string;
  description?: string;
}

export interface DailyLessonResources {
  articles: ResourceLink[];
  videos: VideoResource[];
  searchedAt?: Date;
}

export interface DailyLessonContext {
  planId: string;
  planTitle: string;
  capstoneStatement?: string;
  
  subskillId: string;
  subskillTitle: string;
  subskillDescription?: string;
  route: Route;
  complexity: 1 | 2 | 3;
  
  sessionNumber: number;
  totalSessions: number;
  dailyMinutes: number;
  
  overallProgress: number;
  subskillsCompleted: number;
  totalSubskills: number;
}

export interface DailyLesson {
  id: string;
  subskillId: string;
  lessonPlanId?: string;
  userId: string;
  sessionNumber: number;
  
  // Context snapshot
  context: DailyLessonContext;
  
  // Generated content
  sessionGoal?: string;
  content?: LessonSection[];
  activities?: Activity[];
  keyPoints?: string[];
  
  // Resources
  resources?: DailyLessonResources;
  resourcesFetchedAt?: Date;
  
  // Metadata
  generatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface DailyLessonRow {
  id: string;
  subskill_id: string;
  lesson_plan_id: string | null;
  user_id: string;
  session_number: number;
  context: DailyLessonContext;
  session_goal: string | null;
  content: LessonSection[] | null;
  activities: Activity[] | null;
  key_points: string[] | null;
  resources: DailyLessonResources | null;
  resources_fetched_at: string | null;
  generated_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export function mapDailyLesson(row: DailyLessonRow): DailyLesson {
  return {
    id: row.id,
    subskillId: row.subskill_id,
    lessonPlanId: row.lesson_plan_id || undefined,
    userId: row.user_id,
    sessionNumber: row.session_number,
    context: row.context,
    sessionGoal: row.session_goal || undefined,
    content: row.content || undefined,
    activities: row.activities || undefined,
    keyPoints: row.key_points || undefined,
    resources: row.resources || undefined,
    resourcesFetchedAt: row.resources_fetched_at ? new Date(row.resources_fetched_at) : undefined,
    generatedAt: new Date(row.generated_at),
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE CHECK (Mastery Test)
// ─────────────────────────────────────────────────────────────────────────────────

export interface KnowledgeCheckQuestion {
  id: string;
  question: string;
  type: QuestionType;
  options?: string[];
  correctAnswer: string | string[];
  explanation: string;
  relatedConcept?: string;
}

export interface MissedQuestion {
  questionId: string;
  question: string;
  userAnswer: string | string[];
  correctAnswer: string | string[];
  explanation: string;
}

export interface KnowledgeCheck {
  id: string;
  subskillId: string;
  userId: string;
  attemptNumber: number;
  
  // Test content
  questions: KnowledgeCheckQuestion[];
  answers?: UserAnswer[];
  
  // Results
  score?: number;
  passed?: boolean;
  missedQuestions?: MissedQuestion[];
  feedback?: string[];
  
  // Timestamps
  startedAt: Date;
  completedAt?: Date;
}

export interface KnowledgeCheckRow {
  id: string;
  subskill_id: string;
  user_id: string;
  attempt_number: number;
  questions: KnowledgeCheckQuestion[];
  answers: UserAnswer[] | null;
  score: number | null;
  passed: boolean | null;
  missed_questions: MissedQuestion[] | null;
  feedback: string[] | null;
  started_at: string;
  completed_at: string | null;
}

export function mapKnowledgeCheck(row: KnowledgeCheckRow): KnowledgeCheck {
  return {
    id: row.id,
    subskillId: row.subskill_id,
    userId: row.user_id,
    attemptNumber: row.attempt_number,
    questions: row.questions,
    answers: row.answers || undefined,
    score: row.score || undefined,
    passed: row.passed || undefined,
    missedQuestions: row.missed_questions || undefined,
    feedback: row.feedback || undefined,
    startedAt: new Date(row.started_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION SUMMARY
// ─────────────────────────────────────────────────────────────────────────────────

export interface SessionSummary {
  id: string;
  subskillId: string;
  dailyLessonId?: string;
  userId: string;
  sessionNumber: number;
  
  summary: string;
  keyConcepts: string[];
  
  createdAt: Date;
}

export interface SessionSummaryRow {
  id: string;
  subskill_id: string;
  daily_lesson_id: string | null;
  user_id: string;
  session_number: number;
  summary: string;
  key_concepts: string[];
  created_at: string;
}

export function mapSessionSummary(row: SessionSummaryRow): SessionSummary {
  return {
    id: row.id,
    subskillId: row.subskill_id,
    dailyLessonId: row.daily_lesson_id || undefined,
    userId: row.user_id,
    sessionNumber: row.session_number,
    summary: row.summary,
    keyConcepts: row.key_concepts || [],
    createdAt: new Date(row.created_at),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// API RESPONSE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface TodayState {
  plan: LessonPlan;
  currentSubskill: PlanSubskill;
  
  // Session info
  sessionNumber: number;
  totalSessions: number;
  isKnowledgeCheckDay: boolean;
  
  // Progress
  subskillsCompleted: number;
  totalSubskills: number;
  overallProgress: number;
  
  // Refresh
  needsRefresh: boolean;
  refreshGapDays?: number;
}

export interface RunnerStats {
  // Overall
  totalPlans: number;
  activePlan: boolean;
  
  // Subskills
  subskillsCompleted: number;
  subskillsTotal: number;
  subskillsInProgress: number;
  
  // Sessions
  sessionsCompletedTotal: number;
  sessionsCompletedThisWeek: number;
  currentStreak: number;
  longestStreak: number;
  
  // Time
  totalMinutesLearned: number;
  averageSessionMinutes: number;
  
  // Mastery
  knowledgeChecksPassed: number;
  knowledgeChecksFailed: number;
  averageScore: number;
}

export interface StartSubskillResult {
  routeType: SubskillRouteType;
  subskill: PlanSubskill;
  
  // For skip
  nextSubskill?: PlanSubskill;
  
  // For assess
  assessment?: SubskillAssessment;
  
  // For learn
  lessonPlan?: SubskillLessonPlan;
}

export interface AssessmentResult {
  assessment: SubskillAssessment;
  recommendation: AssessmentRecommendation;
  
  // What happens next
  nextAction: 'autopass' | 'start_remediation' | 'start_learning';
  nextSubskill?: PlanSubskill;
  lessonPlan?: SubskillLessonPlan;
}

export interface StartSessionResult {
  dailyLesson: DailyLesson;
  previousSummaries: SessionSummary[];
  
  // Optional refresh content
  refreshContent?: RefreshContent;
}

export interface CompleteSessionResult {
  subskill: PlanSubskill;
  sessionCompleted: number;
  totalSessions: number;
  
  // What's next
  isSubskillComplete: boolean;
  isKnowledgeCheckNext: boolean;
  isPlanComplete: boolean;
  
  nextSubskill?: PlanSubskill;
}

export interface KnowledgeCheckResult {
  check: KnowledgeCheck;
  passed: boolean;
  score: number;
  
  // If failed
  missedQuestions?: MissedQuestion[];
  feedback?: string[];
  canRetake: boolean;
  attemptNumber: number;
  
  // If passed
  nextSubskill?: PlanSubskill;
  isPlanComplete?: boolean;
}

export interface RefreshContent {
  summary: string;
  previousSessionsSummary: string[];
  recallQuestions: string[];
  quickTips?: string[];
  estimatedMinutes: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// INPUT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface SubmitAssessmentInput {
  assessmentId: string;
  answers: UserAnswer[];
}

export interface SubmitKnowledgeCheckInput {
  checkId: string;
  answers: UserAnswer[];
}

export interface CompleteActivityInput {
  dailyLessonId: string;
  activityId: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// INTERNAL TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface SubskillContext {
  subskill: PlanSubskill;
  plan: LessonPlan;
  lessonPlan?: SubskillLessonPlan;
  previousSummaries: SessionSummary[];
}

export interface GenerationContext {
  subskill: PlanSubskill;
  plan: LessonPlan;
  sessionOutline?: SessionOutline;
  sessionNumber: number;
  totalSessions: number;
  previousSummaries: SessionSummary[];
  route: Route;
}
