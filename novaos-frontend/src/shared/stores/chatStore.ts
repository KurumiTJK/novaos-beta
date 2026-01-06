// ═══════════════════════════════════════════════════════════════════════════════
// CHAT STORE — Novaux
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { sendMessage as sendMessageApi } from '../api/chat';
import type { Message } from '../types';

interface ChatStore {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  startNewConversation: () => void;
}

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  isLoading: false,
  error: null,
  conversationId: null,

  sendMessage: async (content: string) => {
    const { messages, conversationId } = get();
    
    // Add user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    
    // Add loading message
    const loadingMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    set({
      messages: [...messages, userMessage, loadingMessage],
      isLoading: true,
      error: null,
    });

    try {
      const response = await sendMessageApi({
        message: content,
        newConversation: !conversationId,
      });

      // Remove loading message and add real response
      set((state) => ({
        messages: state.messages
          .filter((m) => !m.isLoading)
          .concat({
            id: generateId(),
            role: 'assistant',
            content: response.response,
            timestamp: new Date(),
            stance: response.stance,
          }),
        isLoading: false,
        conversationId: response.conversationId,
      }));
    } catch (error) {
      // Remove loading message on error
      set((state) => ({
        messages: state.messages.filter((m) => !m.isLoading),
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      }));
    }
  },

  clearMessages: () => {
    set({ messages: [], error: null });
  },

  startNewConversation: () => {
    set({ messages: [], conversationId: null, error: null });
  },
}));
