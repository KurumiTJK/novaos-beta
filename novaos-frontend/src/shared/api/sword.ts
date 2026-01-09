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

export interface ClarifyData {
  learningGoal: string;
  priorKnowledge: string;
  context: string;
  constraints: {
    dailyMinutes: number;
    totalWeeks: number;
    preferredStyle: string;
  };
}

export interface ClarifyResponse {
  data: ClarifyData;
  canFinalize: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// Designer Types
// ─────────────────────────────────────────────────────────────────────────────────

export type DesignerPhase = 
  | 'exploration' 
  | 'clarify' 
  | 'capstone' 
  | 'subskills' 
  | 'routing' 
  | 'complete';

export interface DesignerSession {
  id: string;
  userId: string;
  phase: DesignerPhase;
  topic?: string;
  learningGoal?: string;
  priorKnowledge?: string;
  context?: string;
  constraints?: {
    dailyMinutes: number;
    totalWeeks: number;
    preferredStyle: string;
  };
  capstone?: Capstone;
  subskills?: Subskill[];
  routing?: SubskillRouting[];
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
  title: string;
  description: string;
  order: number;
  status: 'locked' | 'available' | 'in_progress' | 'completed';
  progress: number;
  totalSessions: number;
  completedSessions: number;
}

export interface SubskillRouting {
  subskillId: string;
  route: 'tutorial' | 'practice' | 'project' | 'assessment';
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
  capstone: Capstone;
  subskills: Subskill[];
  status: 'active' | 'paused' | 'completed' | 'abandoned';
  progress: number;
  createdAt: string;
  updatedAt: string;
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
  constraints: Partial<ClarifyData['constraints']>
): Promise<ClarifyData> {
  return api.patch<ClarifyData>('/sword/explore/constraints', { sessionId, constraints });
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
 * GET /sword/designer/session - Get active designer session
 */
export async function getActiveSession(): Promise<DesignerSession | null> {
  return api.get<DesignerSession | null>('/sword/designer/session');
}

/**
 * GET /sword/designer/sessions - List all designer sessions
 */
export async function getSessions(): Promise<DesignerSession[]> {
  return api.get<DesignerSession[]>('/sword/designer/sessions');
}

/**
 * DELETE /sword/designer/session/:id - Delete a designer session
 */
export async function deleteSession(sessionId: string): Promise<{ deleted: boolean }> {
  return api.delete<{ deleted: boolean }>(`/sword/designer/session/${sessionId}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LESSON RUNNER ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /sword/runner/start - Start learning session
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
 * POST /sword/subskills/:id/start - Start a subskill
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
