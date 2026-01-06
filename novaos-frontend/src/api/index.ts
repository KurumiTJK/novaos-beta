// ═══════════════════════════════════════════════════════════════════════════════
// API — Re-exports
// ═══════════════════════════════════════════════════════════════════════════════

export { apiClient, getStoredToken, setStoredToken, clearStoredToken } from './client';
export type { ApiError, RequestConfig } from './client';

export { authApi } from './auth';
export { chatApi } from './chat';
export type { 
  SendMessageRequest, 
  ParseCommandResponse,
  ConversationListResponse,
  ConversationDetailResponse,
  ConversationMessagesResponse,
} from './chat';
