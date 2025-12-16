// ═══════════════════════════════════════════════════════════════════════════════
// NOVA CLIENT — Type-safe API Client for NovaOS
// ═══════════════════════════════════════════════════════════════════════════════

import type {
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
  // Conversations
  Conversation,
  ConversationListResponse,
  ConversationDetailResponse,
  // Goals
  Goal,
  GoalWithPath,
  CreateGoalRequest,
  GoalEvent,
  // Quests
  Quest,
  CreateQuestRequest,
  QuestEvent,
  // Steps
  Step,
  CreateStepRequest,
  StepEvent,
  // Sparks
  Spark,
  GenerateSparkRequest,
  SparkEvent,
  // Path
  Path,
  // Memory
  Memory,
  CreateMemoryRequest,
  UpdateMemoryRequest,
  MemoryStats,
  MemoryCategory,
  ExtractMemoriesResponse,
  // Profile
  Profile,
  Preferences,
  // Search
  SearchRequest,
  SearchResponse,
  // Export
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
} from './types.js';

import {
  NovaError,
  AuthenticationError,
  TimeoutError,
  NetworkError,
  AckRequiredError,
  StoppedError,
  createErrorFromResponse,
} from './errors.js';

import { withRetryAndSignal, type RetryOptions } from './retry.js';
import { createStreamReader, TextStream, type StreamOptions } from './streaming.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG: Partial<NovaClientConfig> = {
  timeout: 30000,
  retries: 3,
  debug: false,
};

// ─────────────────────────────────────────────────────────────────────────────────
// NOVA CLIENT CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class NovaClient {
  private config: Required<Pick<NovaClientConfig, 'baseUrl' | 'timeout' | 'retries' | 'debug'>> & NovaClientConfig;
  private fetchFn: typeof fetch;

  constructor(config: NovaClientConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
    } as typeof this.config;
    
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
    
    if (!this.config.baseUrl) {
      throw new NovaError('baseUrl is required', 'CONFIG_ERROR');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HTTP HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private getHeaders(options?: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...options?.headers,
    };

    if (this.config.token) {
      headers['Authorization'] = `Bearer ${this.config.token}`;
    } else if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(path, this.config.baseUrl);
    
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }
    
    return url.toString();
  }

  private log(message: string, data?: unknown): void {
    if (this.config.debug) {
      console.log(`[NovaClient] ${message}`, data ?? '');
    }
  }

  private async request<T>(
    method: string,
    path: string,
    options?: RequestOptions & { body?: unknown; params?: Record<string, string | number | boolean | undefined> }
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const timeout = options?.timeout ?? this.config.timeout;
    const retries = options?.retries ?? this.config.retries;
    
    const retryOptions: Partial<RetryOptions> = {
      maxRetries: retries,
      onRetry: (attempt, error, delay) => {
        this.log(`Retry attempt ${attempt} after ${delay}ms`, error);
      },
    };

    return withRetryAndSignal(
      async (signal) => {
        // Create timeout signal
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // Combine with provided signal
        const combinedSignal = options?.signal
          ? this.combineSignals(options.signal, controller.signal)
          : controller.signal;

        try {
          this.log(`${method} ${url}`);
          
          const response = await this.fetchFn(url, {
            method,
            headers: this.getHeaders(options),
            body: options?.body ? JSON.stringify(options.body) : undefined,
            signal: combinedSignal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw await createErrorFromResponse(response);
          }

          const data = await response.json() as T;
          this.log(`Response:`, data);
          return data;
          
        } catch (error) {
          clearTimeout(timeoutId);
          
          if (error instanceof DOMException && error.name === 'AbortError') {
            if (options?.signal?.aborted) {
              throw error; // User cancelled
            }
            throw new TimeoutError(timeout);
          }
          
          if (error instanceof NovaError) {
            throw error;
          }
          
          throw new NetworkError(
            error instanceof Error ? error.message : 'Network error',
            error instanceof Error ? error : undefined
          );
        }
      },
      options?.signal,
      retryOptions
    );
  }

  private combineSignals(...signals: AbortSignal[]): AbortSignal {
    const controller = new AbortController();
    
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }
    
    return controller.signal;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // AUTH ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Register a new user and get authentication credentials
   */
  async register(request: RegisterRequest, options?: RequestOptions): Promise<RegisterResponse> {
    return this.request<RegisterResponse>('POST', '/api/v1/auth/register', {
      ...options,
      body: request,
    });
  }

  /**
   * Verify the current authentication token
   */
  async verifyAuth(options?: RequestOptions): Promise<AuthVerifyResponse> {
    if (!this.config.token && !this.config.apiKey) {
      throw new AuthenticationError('No authentication credentials provided');
    }
    return this.request<AuthVerifyResponse>('GET', '/api/v1/auth/verify', options);
  }

  /**
   * Get the current authentication status
   */
  async getAuthStatus(options?: RequestOptions): Promise<AuthStatusResponse> {
    return this.request<AuthStatusResponse>('GET', '/api/v1/auth/status', options);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CHAT ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Send a chat message and get a response
   */
  async chat(request: ChatRequest, options?: RequestOptions): Promise<ChatResponse> {
    const response = await this.request<ChatResponse>('POST', '/api/v1/chat', {
      ...options,
      body: request,
    });

    // Handle special response types
    if (response.type === 'await_ack' && response.ackRequired) {
      throw new AckRequiredError(
        response.ackRequired.token,
        response.ackRequired.requiredText,
        response.ackRequired.expiresAt,
        response.message
      );
    }

    if (response.type === 'stopped' && response.stoppedReason) {
      throw new StoppedError(response.stoppedReason);
    }

    return response;
  }

  /**
   * Send a chat message with streaming response
   */
  async chatStream(
    request: ChatRequest,
    streamOptions?: StreamOptions,
    requestOptions?: RequestOptions
  ): Promise<TextStream> {
    const url = this.buildUrl('/api/v1/chat/stream');
    const timeout = requestOptions?.timeout ?? this.config.timeout;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const signal = requestOptions?.signal
      ? this.combineSignals(requestOptions.signal, controller.signal)
      : controller.signal;

    try {
      const response = await this.fetchFn(url, {
        method: 'POST',
        headers: {
          ...this.getHeaders(requestOptions),
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify(request),
        signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw await createErrorFromResponse(response);
      }

      const reader = createStreamReader(response, streamOptions?.signal ?? signal);
      return new TextStream(reader);
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (requestOptions?.signal?.aborted) {
          throw error;
        }
        throw new TimeoutError(timeout);
      }
      
      if (error instanceof NovaError) {
        throw error;
      }
      
      throw new NetworkError(
        error instanceof Error ? error.message : 'Network error',
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Send an enhanced chat message (with Memory + Sword integration)
   */
  async chatEnhanced(request: ChatRequest, options?: RequestOptions): Promise<ChatResponse> {
    return this.request<ChatResponse>('POST', '/api/v1/chat/enhanced', {
      ...options,
      body: request,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONVERSATION ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List user's conversations
   */
  async listConversations(
    params?: { limit?: number; offset?: number },
    options?: RequestOptions
  ): Promise<ConversationListResponse> {
    return this.request<ConversationListResponse>('GET', '/api/v1/conversations', {
      ...options,
      params,
    });
  }

  /**
   * Get a specific conversation with messages
   */
  async getConversation(conversationId: string, options?: RequestOptions): Promise<ConversationDetailResponse> {
    return this.request<ConversationDetailResponse>('GET', `/api/v1/conversations/${conversationId}`, options);
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(conversationId: string, options?: RequestOptions): Promise<{ success: boolean; deletedMessages: number }> {
    return this.request('DELETE', `/api/v1/conversations/${conversationId}`, options);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GOAL ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List user's goals
   */
  async listGoals(
    params?: { status?: string },
    options?: RequestOptions
  ): Promise<{ goals: Goal[] }> {
    return this.request('GET', '/api/v1/goals', { ...options, params });
  }

  /**
   * Create a new goal
   */
  async createGoal(request: CreateGoalRequest, options?: RequestOptions): Promise<{ goal: Goal }> {
    return this.request('POST', '/api/v1/goals', { ...options, body: request });
  }

  /**
   * Get a goal with its path
   */
  async getGoal(goalId: string, options?: RequestOptions): Promise<GoalWithPath> {
    return this.request('GET', `/api/v1/goals/${goalId}`, options);
  }

  /**
   * Transition a goal to a new status
   */
  async transitionGoal(
    goalId: string,
    event: GoalEvent,
    reason?: string,
    options?: RequestOptions
  ): Promise<{ goal: Goal }> {
    return this.request('POST', `/api/v1/goals/${goalId}/transition`, {
      ...options,
      body: { event, reason },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // QUEST ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new quest
   */
  async createQuest(request: CreateQuestRequest, options?: RequestOptions): Promise<{ quest: Quest }> {
    return this.request('POST', '/api/v1/quests', { ...options, body: request });
  }

  /**
   * Transition a quest to a new status
   */
  async transitionQuest(
    questId: string,
    event: QuestEvent,
    reason?: string,
    options?: RequestOptions
  ): Promise<{ quest: Quest }> {
    return this.request('POST', `/api/v1/quests/${questId}/transition`, {
      ...options,
      body: { event, reason },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a new step
   */
  async createStep(request: CreateStepRequest, options?: RequestOptions): Promise<{ step: Step }> {
    return this.request('POST', '/api/v1/steps', { ...options, body: request });
  }

  /**
   * Transition a step to a new status
   */
  async transitionStep(
    stepId: string,
    event: StepEvent,
    notes?: string,
    options?: RequestOptions
  ): Promise<{ step: Step }> {
    return this.request('POST', `/api/v1/steps/${stepId}/transition`, {
      ...options,
      body: { event, notes },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SPARK ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Generate a new spark
   */
  async generateSpark(request?: GenerateSparkRequest, options?: RequestOptions): Promise<{ spark: Spark }> {
    return this.request('POST', '/api/v1/sparks/generate', { ...options, body: request ?? {} });
  }

  /**
   * Get the active spark
   */
  async getActiveSpark(options?: RequestOptions): Promise<{ spark: Spark | null }> {
    return this.request('GET', '/api/v1/sparks/active', options);
  }

  /**
   * Transition a spark to a new status
   */
  async transitionSpark(
    sparkId: string,
    event: SparkEvent,
    reason?: string,
    options?: RequestOptions
  ): Promise<{ spark: Spark }> {
    return this.request('POST', `/api/v1/sparks/${sparkId}/transition`, {
      ...options,
      body: { event, reason },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATH ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get the path to a goal
   */
  async getPath(goalId: string, options?: RequestOptions): Promise<{ path: Path }> {
    return this.request('GET', `/api/v1/path/${goalId}`, options);
  }

  /**
   * Generate the next spark for a path
   */
  async generateNextSpark(goalId: string, options?: RequestOptions): Promise<{ spark: Spark }> {
    return this.request('POST', `/api/v1/path/${goalId}/next-spark`, options);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PROFILE ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get user profile
   */
  async getProfile(options?: RequestOptions): Promise<{ profile: Profile }> {
    return this.request('GET', '/api/v1/profile', options);
  }

  /**
   * Update user profile
   */
  async updateProfile(updates: Partial<Profile>, options?: RequestOptions): Promise<{ profile: Profile }> {
    return this.request('PATCH', '/api/v1/profile', { ...options, body: updates });
  }

  /**
   * Get user preferences
   */
  async getPreferences(options?: RequestOptions): Promise<{ preferences: Preferences }> {
    return this.request('GET', '/api/v1/preferences', options);
  }

  /**
   * Update user preferences
   */
  async updatePreferences(updates: Partial<Preferences>, options?: RequestOptions): Promise<{ preferences: Preferences }> {
    return this.request('PATCH', '/api/v1/preferences', { ...options, body: updates });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MEMORY ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * List memories
   */
  async listMemories(
    params?: { category?: MemoryCategory; limit?: number },
    options?: RequestOptions
  ): Promise<{ memories: Memory[]; total: number }> {
    return this.request('GET', '/api/v1/memories', { ...options, params });
  }

  /**
   * Get memory stats
   */
  async getMemoryStats(options?: RequestOptions): Promise<{ stats: MemoryStats }> {
    return this.request('GET', '/api/v1/memories/stats', options);
  }

  /**
   * Create a new memory
   */
  async createMemory(request: CreateMemoryRequest, options?: RequestOptions): Promise<{ memory: Memory }> {
    return this.request('POST', '/api/v1/memories', { ...options, body: request });
  }

  /**
   * Get a specific memory
   */
  async getMemory(memoryId: string, options?: RequestOptions): Promise<{ memory: Memory }> {
    return this.request('GET', `/api/v1/memories/${memoryId}`, options);
  }

  /**
   * Update a memory
   */
  async updateMemory(memoryId: string, updates: UpdateMemoryRequest, options?: RequestOptions): Promise<{ memory: Memory }> {
    return this.request('PATCH', `/api/v1/memories/${memoryId}`, { ...options, body: updates });
  }

  /**
   * Delete a memory
   */
  async deleteMemory(memoryId: string, options?: RequestOptions): Promise<{ deleted: boolean }> {
    return this.request('DELETE', `/api/v1/memories/${memoryId}`, options);
  }

  /**
   * Clear all or category memories
   */
  async clearMemories(category?: MemoryCategory, options?: RequestOptions): Promise<{ deleted: number }> {
    return this.request('DELETE', '/api/v1/memories', { ...options, params: { category } });
  }

  /**
   * Extract memories from a message
   */
  async extractMemories(
    message: string,
    conversationId?: string,
    options?: RequestOptions
  ): Promise<ExtractMemoriesResponse> {
    return this.request('POST', '/api/v1/memories/extract', {
      ...options,
      body: { message, conversationId },
    });
  }

  /**
   * Get memory context for LLM
   */
  async getMemoryContext(
    message?: string,
    options?: RequestOptions
  ): Promise<{ injection: unknown; formatted: string }> {
    return this.request('POST', '/api/v1/memories/context', {
      ...options,
      body: { message },
    });
  }

  /**
   * Trigger memory decay
   */
  async triggerMemoryDecay(options?: RequestOptions): Promise<{ decayed: number; deleted: number }> {
    return this.request('POST', '/api/v1/memories/decay', options);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // SEARCH ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Search across user data
   */
  async search(request: SearchRequest, options?: RequestOptions): Promise<SearchResponse> {
    return this.request('POST', '/api/v1/search', { ...options, body: request });
  }

  /**
   * Get search suggestions
   */
  async searchSuggest(
    query: string,
    limit?: number,
    options?: RequestOptions
  ): Promise<{ suggestions: string[] }> {
    return this.request('GET', '/api/v1/search/suggest', {
      ...options,
      params: { q: query, limit },
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // EXPORT ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create a data export
   */
  async createExport(request: ExportRequest, options?: RequestOptions): Promise<ExportResult> {
    return this.request('POST', '/api/v1/export', { ...options, body: request });
  }

  /**
   * Download an export
   */
  async downloadExport(exportId: string, options?: RequestOptions): Promise<Blob> {
    const url = this.buildUrl(`/api/v1/export/${exportId}/download`);
    
    const response = await this.fetchFn(url, {
      headers: this.getHeaders(options),
      signal: options?.signal,
    });

    if (!response.ok) {
      throw await createErrorFromResponse(response);
    }

    return response.blob();
  }

  /**
   * Import data
   */
  async importData(request: ImportRequest, options?: RequestOptions): Promise<ImportResult> {
    return this.request('POST', '/api/v1/export/import', { ...options, body: request });
  }

  /**
   * Validate import data (dry run)
   */
  async validateImport(data: string, options?: RequestOptions): Promise<ImportResult> {
    return this.request('POST', '/api/v1/export/import/validate', {
      ...options,
      body: { data, dryRun: true },
    });
  }

  /**
   * Delete all user data
   */
  async deleteAccount(request: DeleteAccountRequest, options?: RequestOptions): Promise<DeleteAccountResult> {
    return this.request('DELETE', '/api/v1/export/account', { ...options, body: request });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADMIN ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Block a user
   */
  async blockUser(request: BlockUserRequest, options?: RequestOptions): Promise<{ success: boolean; blockedUntil: number }> {
    return this.request('POST', '/api/v1/admin/block-user', { ...options, body: request });
  }

  /**
   * Unblock a user
   */
  async unblockUser(targetUserId: string, options?: RequestOptions): Promise<{ success: boolean }> {
    return this.request('POST', '/api/v1/admin/unblock-user', {
      ...options,
      body: { targetUserId },
    });
  }

  /**
   * Get audit logs
   */
  async getAuditLogs(
    params?: { userId?: string; limit?: number },
    options?: RequestOptions
  ): Promise<{ logs: AuditLog[]; count: number }> {
    return this.request('GET', '/api/v1/admin/audit-logs', { ...options, params });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HEALTH ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get health status
   */
  async getHealth(options?: RequestOptions): Promise<HealthResponse> {
    return this.request('GET', '/api/v1/health', options);
  }

  /**
   * Get version information
   */
  async getVersion(options?: RequestOptions): Promise<VersionResponse> {
    return this.request('GET', '/api/v1/version', options);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // UTILITY METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Set authentication token
   */
  setToken(token: string): void {
    this.config.token = token;
    this.config.apiKey = undefined;
  }

  /**
   * Set API key
   */
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.config.token = undefined;
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    this.config.token = undefined;
    this.config.apiKey = undefined;
  }

  /**
   * Check if client has authentication
   */
  hasAuth(): boolean {
    return !!(this.config.token || this.config.apiKey);
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return this.config.baseUrl;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FACTORY FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a new NovaClient instance
 */
export function createNovaClient(config: NovaClientConfig): NovaClient {
  return new NovaClient(config);
}
