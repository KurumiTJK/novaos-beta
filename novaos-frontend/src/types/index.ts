// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS FRONTEND TYPES — Matches Backend API Contract
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// STANCE & ACTION
// ─────────────────────────────────────────────────────────────────────────────────

export type Stance = 'control' | 'shield' | 'lens' | 'sword';
export type ActionSource = 'chat' | 'command' | 'api' | 'system';

// ─────────────────────────────────────────────────────────────────────────────────
// INTENT GATE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type PrimaryRoute = 'SAY' | 'MAKE' | 'FIX' | 'DO';
export type IntentStance = 'LENS' | 'SWORD' | 'SHIELD';
export type SafetySignal = 'none' | 'low' | 'medium' | 'high';
export type Urgency = 'low' | 'medium' | 'high';

export interface IntentSummary {
  primary_route: PrimaryRoute;
  stance: IntentStance;
  safety_signal: SafetySignal;
  urgency: Urgency;
  live_data: boolean;
  external_tool: boolean;
  learning_intent: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVERSATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
  metadata?: {
    liveData?: boolean;
    stance?: Stance;
    tokensUsed?: number;
  };
}

export interface Conversation {
  id: string;
  userId: string;
  title?: string;
  tags?: string[];
  messageCount: number;
  createdAt: number;
  updatedAt: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE RESULT (from /api/v1/chat)
// ─────────────────────────────────────────────────────────────────────────────────

export type PipelineStatus = 'success' | 'stopped' | 'await_ack' | 'degraded' | 'error';

export interface GateResult<T = unknown> {
  gateId?: string;
  action: string;
  status: string;
  output: T;
  message?: string;
  executionTimeMs?: number;
}

export interface GateResults {
  intent?: GateResult<IntentSummary>;
  shield?: GateResult<unknown>;
  tools?: GateResult<unknown>;
  stance?: GateResult<unknown>;
  capability?: GateResult<{ provider?: string }>;
  response?: GateResult<{ text: string; model: string; tokensUsed?: number }>;
  model?: GateResult<{ text: string; model: string; tokensUsed?: number }>;
  constitution?: GateResult<unknown>;
  memory?: GateResult<unknown>;
}

export interface PipelineResult {
  status: PipelineStatus;
  response: string;
  stance?: Stance;
  gateResults: GateResults;
  ackToken?: string;
  ackMessage?: string;
  metadata: {
    requestId?: string;
    totalTimeMs: number;
    regenerations?: number;
    degradationReason?: string;
    error?: string;
  };
}

export interface ChatResponse extends PipelineResult {
  conversationId: string;
  isNewConversation: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type UserTier = 'free' | 'pro' | 'enterprise';

export interface RegisterResponse {
  userId: string;
  token: string;
  apiKey: string;
  tier: UserTier;
  expiresAt: number;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  userId: string;
  tier: UserTier;
  blocked: boolean;
  blockedReason?: string;
  blockedUntil?: number;
  recentVetos: number;
  storage: 'redis' | 'memory';
}

export interface VerifyResponse {
  valid: boolean;
  user: {
    userId: string;
    tier: UserTier;
    role: string;
    permissions: string[];
    issuedAt: number;
    expiresAt: number;
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// API HEALTH/VERSION
// ─────────────────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  version: string;
  timestamp: string;
  uptime: number;
  storage: 'redis' | 'memory';
  verification: 'enabled' | 'disabled';
}

export interface VersionResponse {
  api: string;
  constitution: string;
  gates: string[];
  models: {
    pipeline: string;
    generation: string;
  };
  features: string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTROL MODE — Crisis Data Types
// ─────────────────────────────────────────────────────────────────────────────────

export interface VitalSigns {
  heartRate: number;
  hrv: number;
  spo2: number;
  timestamp: number;
  source: 'apple_watch' | 'oura' | 'fitbit' | 'manual';
}

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  city?: string;
  timestamp: number;
}

export interface NearbyService {
  type: 'hospital' | 'police' | 'fire' | 'pharmacy';
  name: string;
  distance: number;
  address: string;
  phone?: string;
}

export interface ThreatAlert {
  type: 'weather' | 'crime' | 'traffic' | 'power' | 'emergency' | 'health';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  source: string;
  timestamp: number;
}

export interface CrisisActionStep {
  step: number;
  action: string;
  icon: string;
  status: 'complete' | 'current' | 'pending';
  timeEstimate?: string;
}

export interface CrisisState {
  active: boolean;
  triggeredAt?: number;
  vitals?: VitalSigns;
  location?: LocationData;
  nearbyServices: NearbyService[];
  threats: ThreatAlert[];
  actionPlan: CrisisActionStep[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// SWORD MODE — Learning Types
// ─────────────────────────────────────────────────────────────────────────────────

export interface LearningGoal {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];
  createdAt: number;
}

export interface Quest {
  id: string;
  goalId: string;
  title: string;
  icon: string;
  weeks: string;
  lessonCount: number;
  status: 'locked' | 'ready' | 'in_progress' | 'complete';
  progress: number;
}

export interface Lesson {
  id: string;
  questId: string;
  title: string;
  dayNumber: number;
  sections: LessonSection[];
  estimatedMinutes: number;
  status: 'locked' | 'ready' | 'in_progress' | 'complete';
}

export interface LessonSection {
  id: string;
  type: 'content' | 'quiz' | 'exercise' | 'insight';
  title: string;
  content: string;
  quiz?: QuizQuestion;
  completed: boolean;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Spark {
  id: string;
  lessonId: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  status: 'pending' | 'in_progress' | 'complete';
}

export interface LearningPath {
  goal: LearningGoal;
  quests: Quest[];
  currentQuestId?: string;
  currentLessonId?: string;
  totalProgress: number;
  dayStreak: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MODULE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type ModuleType = 
  | 'finance' 
  | 'health' 
  | 'calendar' 
  | 'weather' 
  | 'reminders' 
  | 'email' 
  | 'maps' 
  | 'abilities';

export interface ModuleConfig {
  id: ModuleType;
  name: string;
  icon: string;
  color: string;
  description: string;
  enabled: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// UI STATE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type AppMode = 'chat' | 'module' | 'control' | 'sword';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  stance?: Stance;
  metadata?: {
    liveData?: boolean;
    confidence?: 'low' | 'medium' | 'high';
    freshness?: 'stale' | 'current' | 'live';
    tokensUsed?: number;
  };
}
