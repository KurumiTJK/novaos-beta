// ═══════════════════════════════════════════════════════════════════════════════
// CHAT API — Novaux
// ═══════════════════════════════════════════════════════════════════════════════

import { api } from './client';
import type { ChatResponse, Stance } from '../types';

interface SendMessageRequest {
  message: string;
  newConversation?: boolean;
  stance?: Stance;
}

export async function sendMessage(request: SendMessageRequest): Promise<ChatResponse> {
  return api.post<ChatResponse>('/chat', request);
}
