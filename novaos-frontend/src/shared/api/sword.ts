// ═══════════════════════════════════════════════════════════════════════════════
// SWORD API — NovaOS SwordGate Endpoints
// ═══════════════════════════════════════════════════════════════════════════════

import { api } from './client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// Main State Types
// ─────────────────────────────────────────────────────────────────────────────────

export interface SwordState {
  hasActivePlan: boolean;
  activePlan?: LearningPlan;
  activeSession?: DesignerSession;
  currentSpark?: Spark;
  stats: LearningStats;
}

export interface TodayState {
  hasActivePlan: boolean;
  plan?: LearningPlan;
  currentSubskill?: Subskill;
  currentSpark?: Spark;
  progress: {
    completedToday: number;
    targetToday: number;
    streak: number;
  };
  needsRefresh?: boolean;
  refreshSubskillId?: string;
}

export interface LearningStats {
  totalPlansCompleted: number;
  totalSubskillsCompleted: number;
  currentStreak: number;
  sparksCompletedToday: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// Exploration Types
// ─────────────────────────────────────────────────────────────────────────────────

export type ExplorationState = 'orient' | 'clarify';

export interface ExplorationStartResponse {
  sessionId: string;
  message: string;
  state: ExplorationState;
}

export interface ExplorationChatResponse {
  response: string;
  state: ExplorationState;
}

export interface ExplorationData {
  messages?: Array<{ role: string; content: string }>;
  learningGoal?: string;
  priorKnowledge?: string;
  context?: string;
  constraints?: string[];
  readyForCapstone?: boolean;
}

// Constraints in ClarifyData is always string[] (tags like "30 min/day", "4 weeks")
export interface ClarifyData {
  learningGoal: string;
  priorKnowledge: string;
  context: string;
  constraints: string[];
}

// The structured constraints object (used elsewhere)
export interface StructuredConstraints {
  dailyMinutes: number;
  totalWeeks: number;
  preferredStyle: string;
}

export interface ClarifyResponse {
  data: ClarifyData;
  canFinalize: boolean;
  // Extended fields from backend (same as ClarifyData for direct access)
  learningGoal?: string;
  priorKnowledge?: string;
  context?: string;
  constraints?: string[];
  // Extraction metadata
  extracted?: ClarifyData;
  fieldSources?: Record<string, string>;
  missing?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// Designer Types
// ─────────────────────────────────────────────────────────────────────────────────

export type DesignerPhase = 
  | 'exploration' 
  | 'orient'
  | 'clarify' 
  | 'capstone' 
  | 'subskills' 
  | 'skills'
  | 'routing' 
  | 'path'
  | 'review'
  | 'complete';

export interface CapstoneData {
  title?: string;
  description?: string;
  capstoneStatement?: string;
  successCriteria?: string[];
}

export interface SubskillsData {
  subskills?: Subskill[];
  totalSessions?: number;
  estimatedWeeks?: number;
}

export interface RoutingData {
  assignments?: SubskillRouting[];
}

export interface DesignerSession {
  id: string;
  userId: string;
  phase: DesignerPhase;
  // Phase tracking
  internalPhase?: string;
  visiblePhase?: string;
  // Basic fields
  topic?: string;
  learningGoal?: string;
  priorKnowledge?: string;
  context?: string;
  constraints?: string[];
  // Nested data from backend
  explorationData?: ExplorationData;
  clarifyData?: ClarifyData;
  capstoneData?: CapstoneData;
  capstone?: Capstone;
  subskillsData?: SubskillsData;
  subskills?: Subskill[];
  routingData?: RoutingData;
  routing?: SubskillRouting[];
  // Review data
  totalSessions?: number;
  estimatedWeeks?: number;
  estimatedTimeDisplay?: string;
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface Capstone {
  id: string;
  title: string;
  description: string;
  successCriteria: string[];
}

export interface Subskill {
  id: string;
  planId?: string;
  title: string;
  description: string;
  order: number;
  status: 'pending' | 'locked' | 'available' | 'active' | 'in_progress' | 'completed' | 'mastered' | 'skipped';
  route?: 'recall' | 'practice' | 'build' | 'tutorial' | 'project' | 'assessment';
  progress: number;
  totalSessions: number;
  completedSessions?: number;
  sessionsCompleted?: number;
  estimatedSessions?: number;
}

export interface SubskillRouting {
  subskillId: string;
  route: 'tutorial' | 'practice' | 'project' | 'assessment' | 'recall' | 'build';
  order: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// Runner Types
// ─────────────────────────────────────────────────────────────────────────────────

export interface RunnerStartResponse {
  sessionId: string;
  subskill: Subskill;
  content: LessonContent;
}

export interface LessonContent {
  type: 'tutorial' | 'practice' | 'project' | 'assessment';
  title: string;
  content: string;
  assets?: Asset[];
  masteryCheck?: MasteryCheck;
}

export interface Asset {
  id: string;
  type: 'video' | 'article' | 'exercise' | 'quiz';
  title: string;
  url?: string;
  content?: string;
  completed: boolean;
}

export interface MasteryCheck {
  questions: MasteryQuestion[];
  passingScore: number;
}

export interface MasteryQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  correctAnswer?: string;
  explanation?: string;
}

export interface SubskillProgress {
  subskillId: string;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  progress: number;
  sessionsCompleted: number;
  totalSessions: number;
  lastSessionAt?: string;
  masteryScore?: number;
}

export interface PlanProgress {
  planId: string;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  progress: number;
  subskillsCompleted: number;
  totalSubskills: number;
  currentSubskillId?: string;
}

export interface SessionHistory {
  id: string;
  subskillId: string;
  sessionNumber: number;
  completedAt: string;
  duration: number;
  masteryScore?: number;
}

export interface LessonPlan {
  id: string;
  subskillId: string;
  sessions: LessonSession[];
}

export interface LessonSession {
  number: number;
  title: string;
  type: 'tutorial' | 'practice' | 'project' | 'assessment';
  estimatedMinutes: number;
}

export interface RefreshCheckResult {
  needsRefresh: boolean;
  reason?: string;
  daysSinceLastSession?: number;
}

export interface RefreshContent {
  summary: string;
  keyPoints: string[];
  quickQuiz?: MasteryQuestion[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// Spark Types
// ─────────────────────────────────────────────────────────────────────────────────

export interface Spark {
  id: string;
  userId: string;
  task: string;
  context?: string;
  subskillId?: string;
  estimatedMinutes: number;
  status: 'active' | 'completed' | 'skipped';
  skipReason?: string;
  completedAt?: string;
  createdAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// Plan Types
// ─────────────────────────────────────────────────────────────────────────────────

export interface LearningPlan {
  id: string;
  userId: string;
  title: string;
  capstone?: Capstone;
  subskills?: Subskill[];
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  progress?: number;
  createdAt: string;
  updatedAt: string;
  // Extended fields
  capstoneStatement?: string;
  estimatedTimeDisplay?: string;
  estimatedWeeks?: number;
  estimatedSessions?: number;
  totalSubskills?: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// Assessment Types
// ─────────────────────────────────────────────────────────────────────────────────

export interface InitialAssessment {
  subskillId: string;
  questions: MasteryQuestion[];
}

export interface AssessmentResult {
  score: number;
  passed: boolean;
  feedback?: string;
  skipToSession?: number;
}

export interface KnowledgeCheck {
  id: string;
  subskillId: string;
  questions: MasteryQuestion[];
  passingScore: number;
}

export interface KnowledgeCheckResult {
  passed: boolean;
  score: number;
  correctCount: number;
  totalQuestions: number;
  feedback?: string;
  needsRemediation?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// Daily Lesson Types (NEW)
// ─────────────────────────────────────────────────────────────────────────────────

export type ActivityType = 'read' | 'watch' | 'exercise' | 'practice' | 'build' | 'quiz';

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
  completedAt?: string;
  
  // Read
  explanation?: string;
  article?: { title: string; url: string; snippet?: string };
  
  // Watch
  video?: { 
    title: string; 
    url: string; 
    thumbnailUrl?: string;
    channelName?: string;
    duration?: string;
    viewCount?: number;
  };
  focusPoints?: string[];
  
  // Exercise
  prompt?: string;
  expectedOutcome?: string;
  hints?: string[];
  solution?: string;
  
  // Practice
  steps?: string[];
  checklist?: string[];
  tips?: string[];
  
  // Build
  objective?: string;
  requirements?: string[];
  guidance?: string[];
  
  // Quiz
  questions?: Array<{
    id: string;
    question: string;
    options: string[];
    correctAnswer: string;
    explanation?: string;
  }>;
}

export interface DailyLesson {
  id: string;
  subskillId: string;
  lessonPlanId?: string;
  userId?: string;
  sessionNumber: number;
  sessionGoal?: string;
  content?: LessonSection[];
  activities?: Activity[];
  keyPoints?: string[];
  generatedAt?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface SessionSummary {
  id: string;
  subskillId: string;
  dailyLessonId?: string;
  userId?: string;
  sessionNumber: number;
  summary: string;
  keyConcepts: string[];
  createdAt?: string;
}

export interface SessionOutline {
  sessionNumber: number;
  title: string;
  focus: string;
  objectives?: string[];
  estimatedMinutes: number;
}

export interface SubskillLessonPlan {
  id: string;
  subskillId: string;
  planId: string;
  learningObjectives?: string[];
  prerequisites?: string[];
  sessionOutline?: SessionOutline[];
  isRemediationPlan?: boolean;
  assessmentId?: string;
  generatedAt?: string;
  generationSource?: string;
}

export interface StartSubskillResult {
  routeType: 'skip' | 'assess' | 'learn';
  subskill: Subskill;
  nextSubskill?: Subskill;
  assessment?: InitialAssessment;
  lessonPlan?: SubskillLessonPlan;
}

export interface StartSessionResult {
  dailyLesson: DailyLesson;
  previousSummaries?: SessionSummary[];
  refreshContent?: RefreshContent;
}

export interface CompleteSessionResult {
  subskill: Subskill;
  sessionCompleted: number;
  totalSessions: number;
  isSubskillComplete: boolean;
  isKnowledgeCheckNext: boolean;
  isPlanComplete: boolean;
  nextSubskill?: Subskill;
}

export interface RunnerStats {
  totalPlans: number;
  activePlan: boolean;
  subskillsCompleted: number;
  subskillsTotal: number;
  subskillsInProgress: number;
  sessionsCompletedTotal: number;
  sessionsCompletedThisWeek: number;
  currentStreak: number;
  longestStreak: number;
  totalMinutesLearned: number;
  averageSessionMinutes: number;
  knowledgeChecksPassed: number;
  knowledgeChecksFailed: number;
  averageScore: number;
  // LearningStats compatibility fields (required for type compatibility)
  totalPlansCompleted: number;
  totalSubskillsCompleted: number;
  sparksCompletedToday: number;
}

// Aliases for backwards compatibility
export type GoalState = DesignerSession;
export interface GoalGenerateResponse {
  capstone: Capstone;
  subskills?: Subskill[];
  routing?: SubskillRouting[];
}
export type ReviewState = DesignerSession;
export type ReviewConfirmResponse = { plan: LearningPlan };

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN STATE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /sword - Full SwordGate state
 */
export async function getSwordState(): Promise<SwordState> {
  return api.get<SwordState>('/sword');
}

/**
 * GET /sword/today - Today's learning content
 */
export async function getToday(): Promise<TodayState> {
  return api.get<TodayState>('/sword/today');
}

/**
 * Alias for getToday
 */
export const getTodayState = getToday;

// ═══════════════════════════════════════════════════════════════════════════════
// EXPLORATION ENDPOINTS (Orient + Clarify)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /sword/explore/start - Start exploration (enters Orient mode)
 */
export async function startExploration(
  topic?: string,
  sessionId?: string
): Promise<ExplorationStartResponse> {
  return api.post<ExplorationStartResponse>('/sword/explore/start', { topic, sessionId });
}

/**
 * POST /sword/explore/chat - Chat in Orient phase
 */
export async function exploreChat(
  sessionId: string,
  message: string
): Promise<ExplorationChatResponse> {
  return api.post<ExplorationChatResponse>('/sword/explore/chat', { sessionId, message });
}

/**
 * POST /sword/explore/confirm - Confirm Orient → move to Clarify
 */
export async function confirmExploration(sessionId: string): Promise<ClarifyResponse> {
  return api.post<ClarifyResponse>('/sword/explore/confirm', { sessionId });
}

/**
 * GET /sword/explore/clarify - Get Clarify data
 */
export async function getClarifyData(sessionId: string): Promise<ClarifyResponse> {
  return api.get<ClarifyResponse>(`/sword/explore/clarify?sessionId=${sessionId}`);
}

/**
 * PATCH /sword/explore/field - Update a field in Clarify
 */
export async function updateClarifyField(
  sessionId: string,
  field: 'learningGoal' | 'priorKnowledge' | 'context',
  value: string
): Promise<ClarifyData> {
  return api.patch<ClarifyData>('/sword/explore/field', { sessionId, field, value });
}

/**
 * PATCH /sword/explore/constraints - Update constraints in Clarify
 */
export async function updateConstraints(
  sessionId: string,
  constraints: string[]
): Promise<ClarifyData> {
  return api.patch<ClarifyData>('/sword/explore/constraints', { sessionId, constraints });
}

/**
 * POST /sword/explore/back - Go back to Orient
 */
export async function backToOrient(sessionId: string): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>('/sword/explore/back', { sessionId });
}

/**
 * POST /sword/explore/continue - Continue to Goal
 */
export async function continueToGoal(sessionId: string): Promise<{ success: boolean }> {
  return api.post<{ success: boolean }>('/sword/explore/continue', { sessionId });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON DESIGNER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /sword/designer/finalize - Finalize Clarify → Generate Capstone
 */
export async function finalizeExploration(sessionId: string): Promise<{ capstone: Capstone }> {
  return api.post<{ capstone: Capstone }>('/sword/designer/finalize', { sessionId });
}

/**
 * POST /sword/designer/capstone/confirm - Confirm capstone
 */
export async function confirmCapstone(sessionId: string): Promise<{ confirmed: boolean }> {
  return api.post<{ confirmed: boolean }>('/sword/designer/capstone/confirm', { sessionId });
}

/**
 * POST /sword/designer/subskills - Generate subskills
 */
export async function generateSubskills(sessionId: string): Promise<{ subskills: Subskill[] }> {
  return api.post<{ subskills: Subskill[] }>('/sword/designer/subskills', { sessionId });
}

/**
 * POST /sword/designer/subskills/confirm - Confirm subskills
 */
export async function confirmSubskills(sessionId: string): Promise<{ confirmed: boolean }> {
  return api.post<{ confirmed: boolean }>('/sword/designer/subskills/confirm', { sessionId });
}

/**
 * POST /sword/designer/routing - Generate routing
 */
export async function generateRouting(sessionId: string): Promise<{ routing: SubskillRouting[] }> {
  return api.post<{ routing: SubskillRouting[] }>('/sword/designer/routing', { sessionId });
}

/**
 * POST /sword/designer/routing/confirm - Confirm routing → Create plan
 */
export async function confirmRouting(sessionId: string): Promise<{ plan: LearningPlan }> {
  return api.post<{ plan: LearningPlan }>('/sword/designer/routing/confirm', { sessionId });
}

/**
 * GET /sword/designer - Get active designer session
 */
export async function getActiveSession(): Promise<DesignerSession | null> {
  return api.get<DesignerSession | null>('/sword/designer');
}

/**
 * GET /sword/designer/sessions - List all designer sessions
 */
export async function getSessions(): Promise<DesignerSession[]> {
  return api.get<DesignerSession[]>('/sword/designer/sessions');
}

/**
 * DELETE /sword/designer - Delete current designer session
 */
export async function deleteSession(): Promise<{ deleted: boolean }> {
  return api.delete<{ deleted: boolean }>('/sword/designer');
}

/**
 * GET /sword/goal - Get goal state
 */
export async function getGoalState(sessionId: string): Promise<GoalState> {
  return api.get<GoalState>(`/sword/goal?sessionId=${sessionId}`);
}

/**
 * POST /sword/goal/generate - Generate goal/capstone
 */
export async function generateGoal(sessionId: string): Promise<GoalGenerateResponse> {
  return api.post<GoalGenerateResponse>('/sword/goal/generate', { sessionId });
}

/**
 * GET /sword/review - Get review state
 */
export async function getReview(sessionId: string): Promise<ReviewState> {
  return api.get<ReviewState>(`/sword/review?sessionId=${sessionId}`);
}

/**
 * POST /sword/review/confirm - Confirm review
 */
export async function confirmReview(sessionId: string): Promise<ReviewConfirmResponse> {
  return api.post<ReviewConfirmResponse>('/sword/review/confirm', { sessionId });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON RUNNER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /sword/runner/start - Start learning session (legacy)
 */
export async function startRunner(subskillId: string): Promise<RunnerStartResponse> {
  return api.post<RunnerStartResponse>('/sword/runner/start', { subskillId });
}

/**
 * POST /sword/runner/complete - Complete current content
 */
export async function completeContent(
  sessionId: string,
  assetId?: string
): Promise<{ completed: boolean; nextContent?: LessonContent }> {
  return api.post<{ completed: boolean; nextContent?: LessonContent }>(
    '/sword/runner/complete',
    { sessionId, assetId }
  );
}

/**
 * POST /sword/runner/submit-mastery - Submit mastery check answers
 */
export async function submitMastery(
  sessionId: string,
  answers: Record<string, number>
): Promise<AssessmentResult> {
  return api.post<AssessmentResult>('/sword/runner/submit-mastery', { sessionId, answers });
}

/**
 * GET /sword/runner/progress/subskill/:id - Get subskill progress
 */
export async function getSubskillProgress(subskillId: string): Promise<SubskillProgress> {
  return api.get<SubskillProgress>(`/sword/runner/progress/subskill/${subskillId}`);
}

/**
 * GET /sword/runner/progress/plan/:id - Get plan progress
 */
export async function getPlanProgress(planId: string): Promise<PlanProgress> {
  return api.get<PlanProgress>(`/sword/runner/progress/plan/${planId}`);
}

/**
 * GET /sword/runner/history/:subskillId - Get session history
 */
export async function getSessionHistory(subskillId: string): Promise<SessionHistory[]> {
  return api.get<SessionHistory[]>(`/sword/runner/history/${subskillId}`);
}

/**
 * GET /sword/runner/lesson-plan/:subskillId - Get lesson plan for subskill
 */
export async function getLessonPlan(subskillId: string): Promise<LessonPlan> {
  return api.get<LessonPlan>(`/sword/runner/lesson-plan/${subskillId}`);
}

/**
 * GET /sword/runner/refresh/:subskillId - Check if needs refresh
 */
export async function checkNeedsRefresh(subskillId: string): Promise<RefreshCheckResult> {
  return api.get<RefreshCheckResult>(`/sword/runner/refresh/${subskillId}`);
}

/**
 * GET /sword/runner/refresh/:subskillId/content - Get refresh content
 */
export async function getRefreshContent(subskillId: string): Promise<RefreshContent> {
  return api.get<RefreshContent>(`/sword/runner/refresh/${subskillId}/content`);
}

/**
 * POST /sword/runner/refresh/:subskillId/skip - Skip refresh
 */
export async function skipRefresh(subskillId: string): Promise<{ skipped: boolean }> {
  return api.post<{ skipped: boolean }>(`/sword/runner/refresh/${subskillId}/skip`);
}

/**
 * GET /sword/plans/:planId/subskills - Get all subskills for a plan
 */
export async function getRunnerSubskills(planId: string): Promise<Subskill[]> {
  return api.get<Subskill[]>(`/sword/plans/${planId}/subskills`);
}

/**
 * Alias for getRunnerSubskills
 */
export const getAllSubskills = getRunnerSubskills;

/**
 * GET /sword/runner/stats - Get runner statistics
 * 
 * NOTE: This endpoint does NOT exist on the backend.
 * Use getToday() instead and derive stats from the response.
 * 
 * Stats can be derived from:
 * - getToday().progress.streak → currentStreak
 * - getToday().progress.completedToday → sparksCompletedToday
 * - getPlans() + count completed subskills → totalSubskillsCompleted
 */
// export async function getStats(): Promise<RunnerStats> {
//   return api.get<RunnerStats>('/sword/runner/stats');
// }

// ─────────────────────────────────────────────────────────────────────────────────
// NEW Daily Lesson Endpoints
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * POST /sword/runner/subskill/:id/start - Start a subskill (generates lesson plan)
 */
export async function startSubskillLearning(subskillId: string): Promise<StartSubskillResult> {
  return api.post<StartSubskillResult>(`/sword/runner/subskill/${subskillId}/start`);
}

/**
 * POST /sword/runner/session/start - Start a daily session (generates lesson content)
 */
export async function startSession(subskillId: string): Promise<StartSessionResult> {
  return api.post<StartSessionResult>('/sword/runner/session/start', { subskillId });
}

/**
 * GET /sword/runner/session/:subskillId/:sessionNumber - Get cached session
 */
export async function getSession(
  subskillId: string,
  sessionNumber: number
): Promise<DailyLesson | null> {
  try {
    return await api.get<DailyLesson>(`/sword/runner/session/${subskillId}/${sessionNumber}`);
  } catch (err: any) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

/**
 * POST /sword/runner/session/regenerate - Regenerate a session
 */
export async function regenerateSession(
  subskillId: string,
  sessionNumber: number
): Promise<DailyLesson> {
  return api.post<DailyLesson>('/sword/runner/session/regenerate', { subskillId, sessionNumber });
}

/**
 * POST /sword/runner/session/:id/complete - Complete a session
 */
export async function completeSession(dailyLessonId: string): Promise<CompleteSessionResult> {
  return api.post<CompleteSessionResult>(`/sword/runner/session/${dailyLessonId}/complete`);
}

/**
 * POST /sword/runner/session/:dailyLessonId/activity/:activityId/complete - Complete activity
 */
export async function completeActivity(
  dailyLessonId: string,
  activityId: string
): Promise<{ completed: boolean }> {
  return api.post<{ completed: boolean }>(
    `/sword/runner/session/${dailyLessonId}/activity/${activityId}/complete`
  );
}

/**
 * GET /sword/runner/subskill-lesson-plan/:subskillId - Get subskill lesson plan
 */
export async function getSubskillLessonPlan(subskillId: string): Promise<SubskillLessonPlan | null> {
  try {
    return await api.get<SubskillLessonPlan>(`/sword/runner/subskill-lesson-plan/${subskillId}`);
  } catch (err: any) {
    if (err.response?.status === 404) return null;
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPARK ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /sword/spark - Generate new spark
 */
export async function generateSpark(): Promise<Spark | null> {
  return api.post<Spark | null>('/sword/spark');
}

/**
 * GET /sword/spark/current - Get current active spark
 */
export async function getCurrentSpark(): Promise<Spark | null> {
  return api.get<Spark | null>('/sword/spark/current');
}

/**
 * POST /sword/spark/:id/complete - Complete spark
 */
export async function completeSpark(sparkId: string): Promise<Spark> {
  return api.post<Spark>(`/sword/spark/${sparkId}/complete`);
}

/**
 * POST /sword/spark/:id/skip - Skip spark
 */
export async function skipSpark(sparkId: string, reason?: string): Promise<Spark> {
  return api.post<Spark>(`/sword/spark/${sparkId}/skip`, { reason });
}

/**
 * GET /sword/sparks - List all sparks
 */
export async function getSparks(
  limit = 20,
  status?: 'active' | 'completed' | 'skipped'
): Promise<Spark[]> {
  const params = new URLSearchParams({ limit: limit.toString() });
  if (status) params.append('status', status);
  return api.get<Spark[]>(`/sword/sparks?${params}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PLANS ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /sword/plans - List all learning plans
 */
export async function getPlans(): Promise<LearningPlan[]> {
  return api.get<LearningPlan[]>('/sword/plans');
}

/**
 * GET /sword/plans/:id - Get plan details
 */
export async function getPlan(planId: string): Promise<LearningPlan> {
  return api.get<LearningPlan>(`/sword/plans/${planId}`);
}

/**
 * POST /sword/plans/:id/activate - Activate plan
 */
export async function activatePlan(planId: string): Promise<LearningPlan> {
  return api.post<LearningPlan>(`/sword/plans/${planId}/activate`);
}

/**
 * POST /sword/plans/:id/pause - Pause plan
 */
export async function pausePlan(planId: string): Promise<LearningPlan> {
  return api.post<LearningPlan>(`/sword/plans/${planId}/pause`);
}

/**
 * POST /sword/plans/:id/complete - Complete plan
 */
export async function completePlan(planId: string): Promise<LearningPlan> {
  return api.post<LearningPlan>(`/sword/plans/${planId}/complete`);
}

/**
 * DELETE /sword/plans/:id - Delete plan
 */
export async function deletePlan(planId: string): Promise<{ deleted: boolean }> {
  return api.delete<{ deleted: boolean }>(`/sword/plans/${planId}`);
}

/**
 * POST /sword/subskills/:id/start - Start a subskill (legacy)
 */
export async function startSubskill(subskillId: string): Promise<Subskill> {
  return api.post<Subskill>(`/sword/subskills/${subskillId}/start`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSESSMENT ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /sword/assess/initial - Get initial assessment for subskill
 */
export async function getInitialAssessment(subskillId: string): Promise<InitialAssessment> {
  return api.post<InitialAssessment>('/sword/assess/initial', { subskillId });
}

/**
 * POST /sword/assess/submit - Submit assessment answers
 */
export async function submitAssessment(
  subskillId: string,
  answers: Record<string, number>
): Promise<AssessmentResult> {
  return api.post<AssessmentResult>('/sword/assess/submit', { subskillId, answers });
}

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE CHECK ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /sword/runner/knowledge-check/:subskillId - Get knowledge check for subskill
 */
export async function getKnowledgeCheck(subskillId: string): Promise<KnowledgeCheck> {
  return api.get<KnowledgeCheck>(`/sword/runner/knowledge-check/${subskillId}`);
}

/**
 * POST /sword/runner/knowledge-check/:checkId/submit - Submit knowledge check answers
 */
export async function submitKnowledgeCheck(
  checkId: string,
  answers: Array<{ questionId: string; answer: string | string[] }>
): Promise<KnowledgeCheckResult> {
  return api.post<KnowledgeCheckResult>(`/sword/runner/knowledge-check/${checkId}/submit`, { answers });
}
