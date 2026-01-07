// ═══════════════════════════════════════════════════════════════════════════════
// SHARED TYPES — NovaOS
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// CHAT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export type Stance = 'control' | 'shield' | 'lens' | 'sword';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  stance?: Stance;
  isLoading?: boolean;
  // SwordGate confirmation
  pendingAction?: PendingAction;
  actionTaken?: 'confirmed' | 'cancelled';
}

export interface ChatResponse {
  response: string;
  stance: Stance;
  status: 'completed' | 'stopped' | 'error' | 'pending_confirmation';
  conversationId: string;
  isNewConversation: boolean;
  // SwordGate confirmation
  pendingAction?: PendingAction;
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
}

export interface RegisterResponse {
  userId: string;
  token: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  userId?: string;
  tier?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MODULE TYPES (Dashboard Widgets)
// ─────────────────────────────────────────────────────────────────────────────────

// Added 'learning' module type
export type ModuleType = 'finance' | 'health' | 'calendar' | 'reminders' | 'weather' | 'email' | 'learning';

export interface ModuleData {
  title: string;
  hero: {
    value: string;
    label: string;
  };
  cards: Array<{
    label: string;
    value: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// UI TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type TabId = 'home' | 'modules' | 'skills' | 'settings';

export interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SWORDGATE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Redirect signal from backend when learning intent detected
 */
export interface SwordRedirect {
  target: 'swordgate';
  mode: 'designer' | 'runner';
  planId?: string;
  topic?: string;
}

/**
 * Pending action requiring user confirmation
 * Shown as buttons in chat UI
 */
export interface PendingAction {
  type: 'sword_redirect';
  redirect: SwordRedirect;
  confirmText: string;
  cancelText: string;
}

/**
 * UI state for SwordGate
 */
export interface SwordState {
  isActive: boolean;
  mode: 'designer' | 'runner' | null;
  planId?: string;
  topic?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON TYPES
// ═══════════════════════════════════════════════════════════════════════════════
// TODO: These types should match backend responses from:
//   - GET /api/v1/sword/today
//   - GET /api/v1/sword/lessons
// ═══════════════════════════════════════════════════════════════════════════════
// ─────────────────────────────────────────────────────────────────────────────────

export type LessonStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export interface Spark {
  id: string;
  task: string;
  estimatedMinutes: number;
  context?: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  progress: number; // 0-1
  status: LessonStatus;
  totalSessions: number;
  completedSessions: number;
  emoji: string;
}

export interface Milestone {
  id: string;
  title: string;
  completed: boolean;
}

export interface LearningPath {
  id: string;
  goal: string;
  progress: number; // 0-1
  milestones: Milestone[];
}

export interface LearningStats {
  totalLessonsCompleted: number;
  totalSessionsCompleted: number;
  currentStreak: number;
  sparksCompletedToday: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TODO: Add these types when wiring to backend TodayResponse
// 
// export interface TodayResponse {
//   plan: LessonPlan;
//   currentNode: Node;
//   nodeProgress: NodeProgress;
//   sessionNumber: number;
//   totalSessions: number;
//   dailyPlan: DailyPlan;
//   isRefreshSession: boolean;
//   refreshReason?: string;
//   hasOtherInProgress?: { nodeId: string; nodeTitle: string; sessionNumber: number };
//   completedNodes: number;
//   totalNodes: number;
//   nextAvailableNodes: Array<{ id: string; title: string; route: string }>;
//   methodNodeDue: boolean;
//   nextMethodNodeType?: string;
// }
// ═══════════════════════════════════════════════════════════════════════════════
