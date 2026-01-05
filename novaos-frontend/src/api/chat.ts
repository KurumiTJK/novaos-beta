// ═══════════════════════════════════════════════════════════════════════════════
// CHAT API — Chat and Conversation Endpoints
// ═══════════════════════════════════════════════════════════════════════════════

import { apiClient } from './client';
import type { 
  ChatResponse, 
  Conversation, 
  ConversationMessage,
  Stance,
  ActionSource,
  IntentSummary,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface SendMessageRequest {
  message: string;
  newConversation?: boolean;
  stance?: Stance;
  actionSource?: ActionSource;
}

export interface ParseCommandResponse {
  parsed: boolean;
  intent?: IntentSummary;
  stance?: Stance;
  response: string;
}

export interface ConversationListResponse {
  conversations: Conversation[];
  count: number;
}

export interface ConversationDetailResponse extends Conversation {
  messages: ConversationMessage[];
}

export interface ConversationMessagesResponse {
  conversationId: string;
  messages: ConversationMessage[];
  count: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CHAT API
// ─────────────────────────────────────────────────────────────────────────────────

export const chatApi = {
  /**
   * Send a chat message.
   * Backend automatically manages conversation continuity.
   */
  async sendMessage(request: SendMessageRequest): Promise<ChatResponse> {
    return apiClient.post<ChatResponse>('/chat', request, {
      timeout: 60000, // 60s for LLM generation
    });
  },

  /**
   * Parse a command without full generation.
   * Useful for intent preview.
   */
  async parseCommand(message: string, conversationId?: string): Promise<ParseCommandResponse> {
    return apiClient.post<ParseCommandResponse>('/parse-command', {
      message,
      conversationId,
    });
  },

  /**
   * List user's conversations.
   */
  async listConversations(limit = 50, offset = 0): Promise<ConversationListResponse> {
    return apiClient.get<ConversationListResponse>(
      `/conversations?limit=${limit}&offset=${offset}`
    );
  },

  /**
   * Get a specific conversation with messages.
   */
  async getConversation(id: string, messagesLimit = 100): Promise<ConversationDetailResponse> {
    return apiClient.get<ConversationDetailResponse>(
      `/conversations/${id}?messagesLimit=${messagesLimit}`
    );
  },

  /**
   * Get messages for a conversation.
   */
  async getMessages(
    conversationId: string, 
    limit = 100, 
    offset = 0
  ): Promise<ConversationMessagesResponse> {
    return apiClient.get<ConversationMessagesResponse>(
      `/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`
    );
  },

  /**
   * Update conversation metadata.
   */
  async updateConversation(
    id: string, 
    updates: { title?: string; tags?: string[] }
  ): Promise<Conversation> {
    return apiClient.patch<Conversation>(`/conversations/${id}`, updates);
  },

  /**
   * Delete a conversation.
   */
  async deleteConversation(id: string): Promise<{ success: boolean }> {
    return apiClient.delete<{ success: boolean }>(`/conversations/${id}`);
  },
};

export default chatApi;
