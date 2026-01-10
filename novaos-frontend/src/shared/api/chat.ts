// ═══════════════════════════════════════════════════════════════════════════════
// CHAT API — Novaux
// With streaming support
// ═══════════════════════════════════════════════════════════════════════════════

import { api, streamRequest } from './client';
import type { ChatResponse, Stance } from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface SendMessageRequest {
  message: string;
  newConversation?: boolean;
  stance?: Stance;
}

export interface StreamMessageCallbacks {
  /** Called for each token received */
  onToken: (text: string) => void;
  /** Called when streaming completes */
  onDone: (data: { conversationId: string; stance?: string; tokensUsed: number; isNewConversation: boolean }) => void;
  /** Called on error */
  onError: (error: string) => void;
  /** Called when stream starts with metadata */
  onStart?: (data: { provider: string; conversationId: string; isNewConversation: boolean }) => void;
  /** Called when server is processing (high-risk path) */
  onThinking?: () => void;
  /** Called if server returns JSON instead of stream (shield, redirect, etc.) */
  onJsonResponse?: (response: ChatResponse) => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STANDARD MESSAGE (non-streaming)
// ─────────────────────────────────────────────────────────────────────────────────

export async function sendMessage(request: SendMessageRequest): Promise<ChatResponse> {
  return api.post<ChatResponse>('/chat', request);
}

// ─────────────────────────────────────────────────────────────────────────────────
// STREAMING MESSAGE
// ─────────────────────────────────────────────────────────────────────────────────

export async function sendMessageStream(
  request: SendMessageRequest,
  callbacks: StreamMessageCallbacks
): Promise<void> {
  try {
    await streamRequest('/chat/stream', request, {
      onToken: callbacks.onToken,
      onDone: callbacks.onDone,
      onError: callbacks.onError,
      onMeta: callbacks.onStart,
      onThinking: callbacks.onThinking,
    });
  } catch (error: any) {
    // ─────────────────────────────────────────────────────────────────────────────
    // HANDLE JSON RESPONSE (shield block, redirect, etc.)
    // ─────────────────────────────────────────────────────────────────────────────
    if (error?.isJsonResponse && error?.data) {
      if (callbacks.onJsonResponse) {
        callbacks.onJsonResponse(error.data as ChatResponse);
      } else {
        // Default: treat as error if no handler
        callbacks.onError('Received non-streaming response');
      }
      return;
    }
    
    // Regular error
    callbacks.onError(error?.message || 'Stream failed');
  }
}
