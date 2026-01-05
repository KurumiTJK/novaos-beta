// ═══════════════════════════════════════════════════════════════════════════════
// CHAT FEATURE — API Endpoints
// ═══════════════════════════════════════════════════════════════════════════════

import { api } from '../../shared/api/client';
import type { ChatResponse, Conversation, ConversationMessage, Stance } from '../../shared/types';

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface SendMessageRequest {
  message: string;
  newConversation?: boolean;
  stance?: Stance;
  actionSource?: string;
}

interface ParseCommandResponse {
  intent: {
    classification: string;
    safety_signal: string;
    requires_tools: boolean;
    tool_hints: string[];
    user_intent: string;
    learning_intent?: boolean;
  };
  suggestedStance: Stance;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ENDPOINTS
// ─────────────────────────────────────────────────────────────────────────────────

export async function sendMessage(request: SendMessageRequest): Promise<ChatResponse> {
  return api.post<ChatResponse>('/chat', request);
}

export async function parseCommand(message: string): Promise<ParseCommandResponse> {
  return api.post<ParseCommandResponse>('/parse-command', { message });
}

export async function listConversations(): Promise<Conversation[]> {
  return api.get<Conversation[]>('/conversations');
}

export async function getConversation(id: string): Promise<Conversation & { messages: ConversationMessage[] }> {
  return api.get<Conversation & { messages: ConversationMessage[] }>(`/conversations/${id}`);
}

export async function getMessages(conversationId: string): Promise<ConversationMessage[]> {
  return api.get<ConversationMessage[]>(`/conversations/${conversationId}/messages`);
}

export async function updateConversation(
  id: string,
  data: { title?: string; tags?: string[] }
): Promise<Conversation> {
  return api.patch<Conversation>(`/conversations/${id}`, data);
}

export async function deleteConversation(id: string): Promise<void> {
  return api.delete<void>(`/conversations/${id}`);
}
