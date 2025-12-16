// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS SDK — TypeScript Client SDK for NovaOS
// ═══════════════════════════════════════════════════════════════════════════════
//
// Usage:
//
//   import { NovaClient, createNovaClient } from '@novaos/sdk';
//
//   const client = createNovaClient({
//     baseUrl: 'https://api.novaos.dev',
//     apiKey: 'your-api-key',
//   });
//
//   // Send a chat message
//   const response = await client.chat({ message: 'Hello!' });
//
//   // Stream a response
//   const stream = await client.chatStream({ message: 'Tell me a story' });
//   for await (const chunk of stream) {
//     console.log(chunk);
//   }
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

export { NovaClient, createNovaClient } from './client.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type {
  // Config
  NovaClientConfig,
  RequestOptions,
  
  // Auth
  RegisterRequest,
  RegisterResponse,
  AuthVerifyResponse,
  AuthStatusResponse,
  
  // Chat
  ChatRequest,
  ChatResponse,
  StreamEvent,
  
  // Conversations
  Conversation,
  Message,
  ConversationListResponse,
  ConversationDetailResponse,
  
  // Goals
  InterestLevel,
  GoalStatus,
  GoalEvent,
  Goal,
  CreateGoalRequest,
  GoalWithPath,
  
  // Quests
  QuestStatus,
  QuestPriority,
  QuestEvent,
  Quest,
  CreateQuestRequest,
  
  // Steps
  StepType,
  StepStatus,
  StepEvent,
  Step,
  CreateStepRequest,
  
  // Sparks
  FrictionLevel,
  SparkStatus,
  SparkEvent,
  Spark,
  GenerateSparkRequest,
  
  // Path
  Path,
  Blocker,
  
  // Memory
  MemoryCategory,
  ConfidenceLevel,
  SensitivityLevel,
  Memory,
  CreateMemoryRequest,
  UpdateMemoryRequest,
  MemoryStats,
  ExtractMemoriesResponse,
  
  // Profile
  Profile,
  Preferences,
  
  // Search
  SearchRequest,
  SearchResult,
  SearchResponse,
  
  // Export
  ExportFormat,
  ExportScope,
  ExportRequest,
  ExportResult,
  ImportRequest,
  ImportResult,
  DeleteAccountRequest,
  DeleteAccountResult,
  
  // Admin
  BlockUserRequest,
  AuditLog,
  
  // Health
  HealthResponse,
  VersionResponse,
  
  // Errors
  ApiError,
} from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  NovaError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  BlockedError,
  AckRequiredError,
  StoppedError,
  TimeoutError,
  NetworkError,
  ServerError,
  StreamError,
  isNovaError,
  isRetryableError,
} from './errors.js';

// ─────────────────────────────────────────────────────────────────────────────────
// STREAMING
// ─────────────────────────────────────────────────────────────────────────────────

export {
  createStreamReader,
  consumeStream,
  collectStream,
  streamToChunks,
  streamToString,
  TextStream,
  type StreamReader,
  type StreamOptions,
} from './streaming.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RETRY
// ─────────────────────────────────────────────────────────────────────────────────

export {
  withRetry,
  withRetryAndSignal,
  retryable,
  calculateDelay,
  sleep,
  DEFAULT_RETRY_OPTIONS,
  type RetryOptions,
  type RetryState,
} from './retry.js';

// ─────────────────────────────────────────────────────────────────────────────────
// HOOKS & STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

export {
  // State managers
  createChatManager,
  createGoalsManager,
  createSparkManager,
  createNovaContextValue,
  NovaStore,
  
  // Hook factories
  createQueryHook,
  createMutationHook,
  
  // Types
  type UseChatResult,
  type UseGoalsResult,
  type UseSparkResult,
  type UseMemoriesResult,
  type UseProfileResult,
  type UseSearchResult,
  type UseQueryResult,
  type UseMutationResult,
  type ChatMessage,
  type NovaContextValue,
} from './hooks.js';

// ─────────────────────────────────────────────────────────────────────────────────
// VERSION
// ─────────────────────────────────────────────────────────────────────────────────

export const SDK_VERSION = '1.0.0';
