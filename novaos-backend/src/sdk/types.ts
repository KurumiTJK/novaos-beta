// ═══════════════════════════════════════════════════════════════════════════════
// SDK TYPES — Type Definitions for NovaOS Client SDK
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIG TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface NovaClientConfig {
  /** Base URL of the NovaOS API */
  baseUrl: string;
  /** API key for authentication */
  apiKey?: string;
  /** Bearer token for authentication */
  token?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Number of retry attempts for failed requests */
  retries?: number;
  /** Enable debug logging */
  debug?: boolean;
  /** Custom fetch implementation */
  fetch?: typeof fetch;
  /** Custom headers to include in all requests */
  headers?: Record<string, string>;
}

export interface RequestOptions {
  /** Override timeout for this request */
  timeout?: number;
  /** Override retries for this request */
  retries?: number;
  /** Abort signal for request cancellation */
  signal?: AbortSignal;
  /** Additional headers for this request */
  headers?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  tier?: 'free' | 'pro' | 'enterprise';
}

export interface RegisterResponse {
  userId: string;
  token: string;
  apiKey: string;
  tier: string;
  expiresIn: string;
}

export interface AuthVerifyResponse {
  valid: boolean;
  user: {
    userId: string;
    email: string;
    tier: string;
  };
}

export interface AuthStatusResponse {
  authenticated: boolean;
  userId: string;
  tier: string;
  blocked: boolean;
  blockedReason?: string;
  blockedUntil?: string;
  recentVetos: number;
  storage: 'redis' | 'memory';
}

// ─────────────────────────────────────────────────────────────────────────────────
// CHAT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string;
  conversationId?: string;
  ackToken?: string;
  context?: {
    timezone?: string;
    locale?: string;
  };
}

export interface ChatResponse {
  type: 'success' | 'await_ack' | 'stopped';
  message: string;
  conversationId: string;
  stance?: 'control' | 'shield' | 'lens' | 'sword';
  confidence?: 'high' | 'medium' | 'low' | 'inference' | 'speculation';
  verified?: boolean;
  freshnessWarning?: string;
  spark?: Spark;
  transparency?: {
    gates: string[];
    reasoning: string;
  };
  ackRequired?: {
    token: string;
    requiredText: string;
    expiresAt: string;
  };
  stoppedReason?: string;
}

export interface StreamEvent {
  type: 'chunk' | 'done' | 'error' | 'metadata';
  data?: string;
  metadata?: Partial<ChatResponse>;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVERSATION TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  totalTokens?: number;
  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokens?: number;
  metadata?: Record<string, unknown>;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
  hasMore: boolean;
}

export interface ConversationDetailResponse {
  conversation: Conversation;
  messages: Message[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// GOAL TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type InterestLevel = 
  | 'physical_safety'
  | 'financial_stability'
  | 'career_capital'
  | 'reputation'
  | 'emotional_stability'
  | 'comfort';

export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type GoalEvent = 'START' | 'PAUSE' | 'RESUME' | 'COMPLETE' | 'ABANDON';

export interface Goal {
  id: string;
  userId: string;
  title: string;
  description: string;
  desiredOutcome: string;
  interestLevel: InterestLevel;
  tags: string[];
  status: GoalStatus;
  progress: number;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  questIds: string[];
  motivations: string[];
  constraints: string[];
  successCriteria: string[];
}

export interface CreateGoalRequest {
  title: string;
  description: string;
  desiredOutcome: string;
  interestLevel?: InterestLevel;
  targetDate?: string;
  motivations?: string[];
  constraints?: string[];
  successCriteria?: string[];
  tags?: string[];
}

export interface GoalWithPath {
  goal: Goal;
  path: Path;
}

// ─────────────────────────────────────────────────────────────────────────────────
// QUEST TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type QuestStatus = 'not_started' | 'active' | 'blocked' | 'completed' | 'skipped';
export type QuestPriority = 'critical' | 'high' | 'medium' | 'low';
export type QuestEvent = 'START' | 'BLOCK' | 'UNBLOCK' | 'COMPLETE' | 'SKIP';

export interface Quest {
  id: string;
  userId: string;
  goalId: string;
  title: string;
  description: string;
  outcome: string;
  status: QuestStatus;
  priority: QuestPriority;
  progress: number;
  order: number;
  estimatedMinutes?: number;
  targetDate?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  stepIds: string[];
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  riskNotes?: string;
}

export interface CreateQuestRequest {
  goalId: string;
  title: string;
  description: string;
  outcome: string;
  priority?: QuestPriority;
  estimatedMinutes?: number;
  targetDate?: string;
  riskLevel?: 'none' | 'low' | 'medium' | 'high';
  riskNotes?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STEP TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type StepType = 'action' | 'decision' | 'verification' | 'milestone';
export type StepStatus = 'pending' | 'active' | 'completed' | 'skipped';
export type StepEvent = 'START' | 'COMPLETE' | 'SKIP';

export interface Step {
  id: string;
  questId: string;
  title: string;
  description?: string;
  type: StepType;
  status: StepStatus;
  order: number;
  estimatedMinutes?: number;
  createdAt: string;
  completedAt?: string;
  completionNotes?: string;
  verificationRequired: boolean;
}

export interface CreateStepRequest {
  questId: string;
  title: string;
  description?: string;
  type?: StepType;
  estimatedMinutes?: number;
  verificationRequired?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type FrictionLevel = 'minimal' | 'low' | 'medium';
export type SparkStatus = 'suggested' | 'accepted' | 'completed' | 'skipped' | 'expired';
export type SparkEvent = 'ACCEPT' | 'COMPLETE' | 'SKIP';

export interface Spark {
  id: string;
  userId: string;
  stepId?: string;
  questId?: string;
  action: string;
  rationale: string;
  estimatedMinutes: number;
  frictionLevel: FrictionLevel;
  reversible: boolean;
  status: SparkStatus;
  createdAt: string;
  expiresAt?: string;
  completedAt?: string;
  nextSparkHint?: string;
}

export interface GenerateSparkRequest {
  stepId?: string;
  questId?: string;
  goalId?: string;
  context?: string;
  maxMinutes?: number;
  frictionLevel?: FrictionLevel;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PATH TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface Path {
  goalId: string;
  currentQuestId?: string;
  currentStepId?: string;
  completedQuests: number;
  totalQuests: number;
  overallProgress: number;
  nextStep?: Step;
  activeSpark?: Spark;
  blockers: Blocker[];
  estimatedCompletionDate?: string;
  daysRemaining?: number;
  onTrack: boolean;
}

export interface Blocker {
  type: 'quest_dependency' | 'external' | 'resource' | 'decision';
  description: string;
  questId?: string;
  suggestedAction?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MEMORY TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type MemoryCategory = 
  | 'preference'
  | 'fact'
  | 'project'
  | 'skill'
  | 'interest'
  | 'relationship'
  | 'goal'
  | 'context';

export type ConfidenceLevel = 'explicit' | 'inferred' | 'speculative';
export type SensitivityLevel = 'public' | 'private' | 'sensitive';

export interface Memory {
  id: string;
  userId: string;
  category: MemoryCategory;
  key: string;
  value: string;
  context?: string;
  confidence: ConfidenceLevel;
  sensitivity: SensitivityLevel;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
  reinforcementScore: number;
}

export interface CreateMemoryRequest {
  category: MemoryCategory;
  key: string;
  value: string;
  context?: string;
  confidence?: ConfidenceLevel;
  sensitivity?: SensitivityLevel;
  expiresAt?: string;
}

export interface UpdateMemoryRequest {
  value?: string;
  context?: string;
  confidence?: ConfidenceLevel;
  sensitivity?: SensitivityLevel;
  expiresAt?: string;
}

export interface MemoryStats {
  total: number;
  byCategory: Record<MemoryCategory, number>;
  averageReinforcementScore: number;
}

export interface ExtractMemoriesResponse {
  saved: number;
  memories: Memory[];
  profileUpdated: boolean;
  preferencesUpdated: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROFILE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface Profile {
  userId: string;
  name?: string;
  role?: string;
  organization?: string;
  location?: string;
  timezone?: string;
  preferredTone: 'formal' | 'friendly' | 'direct' | 'supportive';
  preferredDepth: 'brief' | 'moderate' | 'detailed';
  preferredFormat: 'prose' | 'bullets' | 'structured';
  expertiseAreas: string[];
  expertiseLevel: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  interests: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Preferences {
  userId: string;
  tone: 'formal' | 'friendly' | 'direct' | 'supportive';
  verbosity: 'concise' | 'balanced' | 'detailed';
  formatting: 'minimal' | 'moderate' | 'rich';
  proactiveReminders: boolean;
  suggestNextSteps: boolean;
  askClarifyingQuestions: boolean;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  memoryEnabled: boolean;
  autoExtractFacts: boolean;
  defaultMode: 'snapshot' | 'expansion';
  showConfidenceLevel: boolean;
  showSources: boolean;
  updatedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface SearchRequest {
  query: string;
  scope?: 'all' | 'conversations' | 'memories' | 'goals';
  limit?: number;
  offset?: number;
  filters?: {
    dateFrom?: string;
    dateTo?: string;
    types?: string[];
  };
}

export interface SearchResult {
  id: string;
  type: 'conversation' | 'message' | 'memory' | 'goal';
  title: string;
  snippet: string;
  score: number;
  highlights: string[];
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
  took: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type ExportFormat = 'json' | 'markdown' | 'csv';
export type ExportScope = 'all' | 'conversations' | 'memories' | 'goals' | 'profile' | 'search_history';

export interface ExportRequest {
  scopes: ExportScope[];
  format: ExportFormat;
  startDate?: string;
  endDate?: string;
  includeMetadata?: boolean;
  prettyPrint?: boolean;
  redactSensitive?: boolean;
}

export interface ExportResult {
  exportId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  stats: {
    conversations: number;
    messages: number;
    memories: number;
    goals: number;
    quests: number;
    steps: number;
    sparks: number;
  };
  createdAt: string;
  expiresAt: string;
  downloadUrl: string;
}

export interface ImportRequest {
  data: string;
  mergeStrategy?: 'skip' | 'replace' | 'newest' | 'merge';
  dryRun?: boolean;
}

export interface ImportResult {
  success: boolean;
  dryRun: boolean;
  imported: Record<string, number>;
  skipped: Record<string, number>;
  errors: Array<{ type: string; message: string; path?: string }>;
}

export interface DeleteAccountRequest {
  confirmation: string;
  exportFirst?: boolean;
}

export interface DeleteAccountResult {
  success: boolean;
  userId: string;
  deleted: Record<string, number>;
  exportId?: string;
  deletedAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ADMIN TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface BlockUserRequest {
  targetUserId: string;
  reason: string;
  durationMinutes?: number;
}

export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  details: Record<string, unknown>;
  timestamp: string;
  ipAddress?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
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
  features: string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}
