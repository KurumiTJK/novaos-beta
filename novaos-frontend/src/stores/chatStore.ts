// ═══════════════════════════════════════════════════════════════════════════════
// CHAT STORE — Chat State Management
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { chatApi } from '../api';
import type { 
  Message, 
  Stance, 
  ChatResponse,
  IntentSummary,
  Conversation,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface ChatState {
  // State
  messages: Message[];
  conversationId: string | null;
  currentStance: Stance;
  isLoading: boolean;
  error: string | null;
  lastIntent: IntentSummary | null;
  conversations: Conversation[];

  // Actions
  sendMessage: (content: string) => Promise<ChatResponse | null>;
  startNewConversation: () => void;
  setStance: (stance: Stance) => void;
  loadConversation: (conversationId: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  clearMessages: () => void;
  clearError: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function createMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseConfidence(response: ChatResponse): 'low' | 'medium' | 'high' {
  // Could be enhanced with actual confidence from backend
  const tokensUsed = response.gateResults?.model?.output?.tokensUsed ?? 0;
  if (tokensUsed < 100) return 'low';
  if (tokensUsed < 500) return 'medium';
  return 'high';
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>()((set, get) => ({
  // Initial state
  messages: [],
  conversationId: null,
  currentStance: 'lens',
  isLoading: false,
  error: null,
  lastIntent: null,
  conversations: [],

  // Send a message
  sendMessage: async (content: string) => {
    const { conversationId, currentStance } = get();
    
    // Add user message immediately (optimistic)
    const userMessage: Message = {
      id: createMessageId(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    
    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      const response = await chatApi.sendMessage({
        message: content,
        newConversation: !conversationId,
        stance: currentStance,
        actionSource: 'chat',
      });

      // Update conversation ID if new
      if (response.conversationId !== conversationId) {
        set({ conversationId: response.conversationId });
      }

      // Add assistant message
      const assistantMessage: Message = {
        id: createMessageId(),
        role: 'assistant',
        content: response.response,
        timestamp: Date.now(),
        stance: response.stance,
        metadata: {
          liveData: response.gateResults?.capability?.output?.provider === 'gemini_grounded',
          confidence: parseConfidence(response),
          freshness: response.gateResults?.capability?.output?.provider ? 'live' : 'current',
          tokensUsed: response.gateResults?.model?.output?.tokensUsed,
        },
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        currentStance: response.stance || state.currentStance,
        lastIntent: response.gateResults?.intent?.output || null,
        isLoading: false,
      }));

      return response;
    } catch (error) {
      set({
        error: (error as Error).message || 'Failed to send message',
        isLoading: false,
      });
      return null;
    }
  },

  // Start a new conversation
  startNewConversation: () => {
    set({
      messages: [],
      conversationId: null,
      currentStance: 'lens',
      lastIntent: null,
      error: null,
    });
  },

  // Set current stance
  setStance: (stance: Stance) => {
    set({ currentStance: stance });
  },

  // Load a specific conversation
  loadConversation: async (conversationId: string) => {
    set({ isLoading: true, error: null });
    
    try {
      const conversation = await chatApi.getConversation(conversationId);
      
      const messages: Message[] = conversation.messages.map((msg, index) => ({
        id: `msg-loaded-${index}`,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.timestamp || Date.now(),
        stance: msg.metadata?.stance,
        metadata: msg.metadata ? {
          liveData: msg.metadata.liveData,
          tokensUsed: msg.metadata.tokensUsed,
        } : undefined,
      }));

      set({
        messages,
        conversationId,
        isLoading: false,
      });
    } catch (error) {
      set({
        error: (error as Error).message || 'Failed to load conversation',
        isLoading: false,
      });
    }
  },

  // Load list of conversations
  loadConversations: async () => {
    try {
      const response = await chatApi.listConversations();
      set({ conversations: response.conversations });
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  },

  // Clear messages
  clearMessages: () => {
    set({ messages: [], conversationId: null, lastIntent: null });
  },

  // Clear error
  clearError: () => set({ error: null }),
}));

export default useChatStore;
