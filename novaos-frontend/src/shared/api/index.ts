// ═══════════════════════════════════════════════════════════════════════════════
// API EXPORTS — NovaOS
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

export {
  api,
  ApiError,
  getToken,
  setToken,
  getRefreshToken,
  setRefreshToken,
  setTokens,
  clearToken,
  onAuthLogout,
} from './client';

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────────

export {
  register,
  getAuthStatus,
  verifyToken,
  refreshTokens,
  logout,
  type TokenPair,
  type RefreshResponse,
} from './auth';

// ─────────────────────────────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────────────────────────────

export { sendMessage } from './chat';

// ─────────────────────────────────────────────────────────────────────────────────
// SWORD (SwordGate)
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // Main state
  getSwordState,
  getToday,
  getTodayState,
  
  // Exploration
  startExploration,
  exploreChat,
  confirmExploration,
  getClarifyData,
  updateClarifyField,
  updateConstraints,
  continueToGoal,
  backToOrient,
  
  // Goal (auto-generation)
  getGoalState,
  generateGoal,
  
  // Review
  getReview,
  confirmReview,
  
  // Designer session
  getActiveSession,
  getSessions,
  deleteSession,
  
  // Runner
  startRunner,
  startSession,
  completeSession,
  getRunnerSubskills,
  getSubskillProgress,
  getPlanProgress,
  getSessionHistory,
  getLessonPlan,
  getKnowledgeCheck,
  submitKnowledgeCheck,
  checkNeedsRefresh,
  getRefreshContent,
  skipRefresh,
  
  // Sparks
  generateSpark,
  getCurrentSpark,
  completeSpark,
  skipSpark,
  getSparks,
  
  // Plans
  getPlans,
  getPlan,
  activatePlan,
  pausePlan,
  completePlan,
  deletePlan,
  startSubskill,
  
  // NOTE: getStats removed - endpoint does not exist on backend
  // Use getToday() and derive stats from plans + today.progress
  
  // Types
  type SwordState,
  type TodayState,
  type LearningStats,
  type ExplorationState,
  type ExplorationStartResponse,
  type ExplorationChatResponse,
  type ClarifyData,
  type ClarifyResponse,
  type DesignerPhase,
  type DesignerSession,
  type Capstone,
  type Subskill,
  type SubskillRouting,
  type GoalState,
  type GoalGenerateResponse,
  type ReviewState,
  type ReviewConfirmResponse,
  type RunnerStartResponse,
  type LessonContent,
  type Asset,
  type MasteryCheck,
  type MasteryQuestion,
  type SubskillProgress,
  type PlanProgress,
  type SessionHistory,
  type LessonPlan,
  type LessonSession,
  type RefreshCheckResult,
  type RefreshContent,
  type Spark,
  type LearningPlan,
  type InitialAssessment,
  type AssessmentResult,
} from './sword';

// ─────────────────────────────────────────────────────────────────────────────────
// SHIELD
// ─────────────────────────────────────────────────────────────────────────────────

export {
  getShieldStatus,
  confirmWarning,
  confirmSafety,
  getShieldColor,
  getShieldIcon,
  hasShieldActivation,
  type ShieldDomain,
  type ShieldSeverity,
  type ShieldStatus,
  type ShieldActivation,
  type ShieldConfirmResponse,
  type ShieldSafeResponse,
} from './shield';

// ─────────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  getSettings,
  updateSettings,
  DEFAULT_SETTINGS,
  getThemeColors,
  getStanceColor,
  getStanceLabel,
  type Theme,
  type DefaultStance,
  type NotificationSettings,
  type Settings,
  type SettingsUpdate,
} from './settings';
