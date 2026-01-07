// ═══════════════════════════════════════════════════════════════════════════════
// CHAT STORE — Novaux
// With SwordGate confirmation handling
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { sendMessage as sendMessageApi } from '../api/chat';
import { useUIStore } from './uiStore';
import type { Message, PendingAction } from '../types';

interface ChatStore {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  conversationId: string | null;
  
  // Actions
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  startNewConversation: () => void;
  
  // Confirmation actions
  confirmPendingAction: (messageId: string) => void;
  cancelPendingAction: (messageId: string) => void;
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

      // Create assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        stance: response.stance,
      };

      // ─────────────────────────────────────────────────────────────────────────
      // HANDLE PENDING CONFIRMATION
      // When backend detects learning intent, it returns a pending action
      // that requires user confirmation before navigating
      // ─────────────────────────────────────────────────────────────────────────
      if (response.status === 'pending_confirmation' && response.pendingAction) {
        assistantMessage.pendingAction = response.pendingAction;
      }

      // Remove loading message and add real response
      set((state) => ({
        messages: state.messages
          .filter((m) => !m.isLoading)
          .concat(assistantMessage),
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

  // ─────────────────────────────────────────────────────────────────────────────
  // CONFIRMATION ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * User clicked "Yes" - execute the pending action
   */
  confirmPendingAction: (messageId: string) => {
    const { messages } = get();
    const message = messages.find(m => m.id === messageId);
    
    if (!message?.pendingAction) return;
    
    const { pendingAction } = message;
    
    // Clear the pending action from the message
    set((state) => ({
      messages: state.messages.map(m => 
        m.id === messageId 
          ? { ...m, pendingAction: undefined, actionTaken: 'confirmed' as const }
          : m
      ),
    }));
    
    // Execute the action based on type
    if (pendingAction.type === 'sword_redirect') {
      useUIStore.getState().openSword(pendingAction.redirect);
    }
  },

  /**
   * User clicked "No" - dismiss the pending action
   */
  cancelPendingAction: (messageId: string) => {
    set((state) => ({
      messages: state.messages.map(m => 
        m.id === messageId 
          ? { ...m, pendingAction: undefined, actionTaken: 'cancelled' as const }
          : m
      ),
    }));
  },

  clearMessages: () => {
    set({ messages: [], error: null });
  },

  startNewConversation: () => {
    set({ messages: [], conversationId: null, error: null });
  },
}));
