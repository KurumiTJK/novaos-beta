// ═══════════════════════════════════════════════════════════════════════════════
// WORKING MEMORY — Types
// Session-based conversation history and context management
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// MESSAGE
// ─────────────────────────────────────────────────────────────────────────────────

export interface MessageMetadata {
  stance?: string;
  status?: string;
  tokensUsed?: number;
  gateResults?: Record<string, unknown>;
  liveData?: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: MessageMetadata;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVERSATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface ConversationMetadata {
  lastStance?: string;
  tags?: string[];
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  totalTokens: number;
  metadata?: ConversationMetadata;
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTEXT WINDOW
// ─────────────────────────────────────────────────────────────────────────────────

export interface ContextWindow {
  messages: Message[];
  totalTokens: number;
  truncated: boolean;
  oldestIncluded: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

export const WORKING_MEMORY_CONFIG = {
  /** Maximum tokens to include in context window */
  MAX_CONTEXT_TOKENS: 8000,
  
  /** Maximum messages to include in context window */
  MAX_MESSAGES_IN_CONTEXT: 50,
  
  /** Maximum messages to store per conversation (prevents unbounded growth) */
  MAX_MESSAGES_STORED: 1000,
  
  /** Conversation TTL in days */
  CONVERSATION_TTL_DAYS: 30,
  
  /** Conversation TTL in seconds */
  CONVERSATION_TTL_SECONDS: 30 * 24 * 60 * 60,
} as const;
