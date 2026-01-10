// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING TYPES
// ═══════════════════════════════════════════════════════════════════════════════

import type { Stance, ProviderName } from '../../../types/index.js';

/**
 * SSE event types for chat streaming
 */
export type StreamEventType = 'token' | 'done' | 'error' | 'meta' | 'thinking';

/**
 * Token event - sent for each chunk of text
 */
export interface TokenEvent {
  type: 'token';
  text: string;
}

/**
 * Done event - sent when streaming completes
 */
export interface DoneEvent {
  type: 'done';
  conversationId: string;
  stance?: Stance;
  tokensUsed: number;
  model: string;
  isNewConversation: boolean;
}

/**
 * Error event - sent when an error occurs
 */
export interface ErrorEvent {
  type: 'error';
  error: string;
  code?: string;
}

/**
 * Meta event - sent before streaming starts with metadata
 */
export interface MetaEvent {
  type: 'meta';
  provider: ProviderName;
  conversationId: string;
  isNewConversation: boolean;
}

/**
 * Thinking event - sent when server is processing (high-risk path)
 * Keeps connection alive while full pipeline runs
 */
export interface ThinkingEvent {
  type: 'thinking';
}

export type StreamEvent = TokenEvent | DoneEvent | ErrorEvent | MetaEvent | ThinkingEvent;

/**
 * Streaming executor function signature
 */
export type StreamExecutor = (
  systemPrompt: string,
  userPrompt: string,
  config: import('../../../types/index.js').ProviderConfig,
  onToken: (text: string) => void,
  conversationHistory?: readonly import('../../../types/index.js').ConversationMessage[]
) => Promise<{ tokensUsed: number; model: string }>;
