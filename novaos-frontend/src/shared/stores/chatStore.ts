// ═══════════════════════════════════════════════════════════════════════════════
// CHAT STORE — NovaOS
// Fixed to match existing ChatPage interface + added shield/stance support
// + SwordGate redirect handling
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { sendMessage as sendMessageApi } from '../api/chat';
import { useUIStore } from './uiStore';
import type { Message as MessageType, Stance, ShieldActivation, SwordRedirect } from '../types';

// ─────────────────────────────────────────────────────────────────────────────────
// RE-EXPORT TYPES FOR CONSUMERS
// ─────────────────────────────────────────────────────────────────────────────────

export type { MessageType as Message };

// ─────────────────────────────────────────────────────────────────────────────────
// STORE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

export interface ChatState {
  // ─────────────────────────────────────────────────────────────────────────────
  // STATE
  // ─────────────────────────────────────────────────────────────────────────────
  
  messages: MessageType[];
  conversationId: string | null;
  isLoading: boolean;
  error: string | null;
  
  /** Current stance */
  currentStance: Stance | null;
  
  /** Shield activation (if any) */
  shieldActivation: ShieldActivation | null;
  isShieldOverlayOpen: boolean;
  
  // ─────────────────────────────────────────────────────────────────────────────
  // ACTIONS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /** Send a message */
  sendMessage: (content: string) => Promise<void>;
  
  /** Confirm pending action */
  confirmPendingAction: (messageId: string) => void;
  
  /** Cancel pending action */
  cancelPendingAction: (messageId: string) => void;
  
  /** Clear all messages */
  clearMessages: () => void;
  
  /** Set conversation ID */
  setConversationId: (id: string | null) => void;
  
  /** Handle shield confirmation */
  handleShieldConfirm: (response: string) => void;
  
  /** Handle shield cancel */
  handleShieldCancel: () => void;
  
  /** Dismiss error */
  dismissError: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  conversationId: null,
  isLoading: false,
  error: null,
  currentStance: null,
  shieldActivation: null,
  isShieldOverlayOpen: false,

  // ═══════════════════════════════════════════════════════════════════════════
  // SEND MESSAGE
  // ═══════════════════════════════════════════════════════════════════════════
  
  sendMessage: async (content: string) => {
    const { conversationId, messages } = get();
    
    // Add user message
    const userMessage: MessageType = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    
    // Add loading message (assistant typing)
    const loadingMessage: MessageType = {
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
      // Call API with correct format
      const response = await sendMessageApi({
        message: content,
        newConversation: !conversationId,
      });
      
      // ─────────────────────────────────────────────────────────────────────────
      // CHECK FOR SHIELD ACTIVATION
      // ─────────────────────────────────────────────────────────────────────────
      if (response.shieldActivation) {
        set({
          isLoading: false,
          shieldActivation: response.shieldActivation,
          isShieldOverlayOpen: true,
          // Remove loading message but keep user message
          messages: get().messages.filter(m => !m.isLoading),
        });
        return;
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // CHECK FOR SWORDGATE REDIRECT
      // ─────────────────────────────────────────────────────────────────────────
      if (response.status === 'redirect' && response.redirect) {
        const redirect = response.redirect as SwordRedirect;
        
        // Add confirmation message before redirecting
        const confirmMessage: MessageType = {
          id: generateId(),
          role: 'assistant',
          content: redirect.mode === 'designer'
            ? `I'd love to help you learn ${redirect.topic || 'that'}! Would you like me to create a personalized learning plan?`
            : `Let's continue with your learning plan!`,
          timestamp: new Date(),
          stance: 'sword',
          pendingAction: {
            type: 'sword_redirect',
            redirect,
            confirmText: 'Yes, let\'s go!',
            cancelText: 'Not now',
          },
        };
        
        set({
          messages: get().messages
            .filter(m => !m.isLoading)
            .concat(confirmMessage),
          conversationId: response.conversationId || conversationId,
          currentStance: 'sword',
          isLoading: false,
        });
        return;
      }
      
      // ─────────────────────────────────────────────────────────────────────────
      // NORMAL RESPONSE
      // ─────────────────────────────────────────────────────────────────────────
      const assistantMessage: MessageType = {
        id: generateId(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        stance: response.stance,
        pendingAction: response.pendingAction,
      };
      
      set({
        messages: get().messages
          .filter(m => !m.isLoading)
          .concat(assistantMessage),
        conversationId: response.conversationId || conversationId,
        currentStance: response.stance || null,
        isLoading: false,
      });
    } catch (error) {
      console.error('[CHAT] Send failed:', error);
      
      set({
        messages: get().messages.filter(m => !m.isLoading),
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIRM PENDING ACTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  confirmPendingAction: (messageId: string) => {
    const message = get().messages.find(m => m.id === messageId);
    const pendingAction = message?.pendingAction;
    
    // Update message state
    set({
      messages: get().messages.map(msg =>
        msg.id === messageId
          ? { ...msg, pendingAction: undefined, actionTaken: 'confirmed' as const }
          : msg
      ),
    });
    
    // ─────────────────────────────────────────────────────────────────────────
    // HANDLE SWORDGATE REDIRECT
    // ─────────────────────────────────────────────────────────────────────────
    if (pendingAction?.type === 'sword_redirect' && pendingAction.redirect) {
      const redirect = pendingAction.redirect;
      
      // Use setTimeout to allow UI to update before navigation
      setTimeout(() => {
        useUIStore.getState().openSword(redirect);
      }, 300);
      return;
    }
    
    // TODO: Handle other action types
    // api.post('/chat/confirm', { messageId });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CANCEL PENDING ACTION
  // ═══════════════════════════════════════════════════════════════════════════
  
  cancelPendingAction: (messageId: string) => {
    set({
      messages: get().messages.map(msg =>
        msg.id === messageId
          ? { ...msg, pendingAction: undefined, actionTaken: 'cancelled' as const }
          : msg
      ),
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEAR MESSAGES
  // ═══════════════════════════════════════════════════════════════════════════
  
  clearMessages: () => {
    set({
      messages: [],
      conversationId: null,
      error: null,
      currentStance: null,
      shieldActivation: null,
      isShieldOverlayOpen: false,
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SET CONVERSATION ID
  // ═══════════════════════════════════════════════════════════════════════════
  
  setConversationId: (id: string | null) => {
    set({ conversationId: id });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIELD CONFIRM
  // ═══════════════════════════════════════════════════════════════════════════
  
  handleShieldConfirm: (response: string) => {
    const assistantMessage: MessageType = {
      id: generateId(),
      role: 'assistant',
      content: response,
      timestamp: new Date(),
      stance: 'shield',
    };
    
    set({
      messages: [...get().messages, assistantMessage],
      shieldActivation: null,
      isShieldOverlayOpen: false,
      currentStance: 'shield',
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIELD CANCEL
  // ═══════════════════════════════════════════════════════════════════════════
  
  handleShieldCancel: () => {
    // Remove the last user message (that triggered shield)
    const messages = get().messages;
    const withoutLastUser = messages.slice(0, -1);
    
    set({
      messages: withoutLastUser,
      shieldActivation: null,
      isShieldOverlayOpen: false,
    });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DISMISS ERROR
  // ═══════════════════════════════════════════════════════════════════════════
  
  dismissError: () => {
    set({ error: null });
  },
}));

// ─────────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────────

export const selectLastMessage = (state: ChatState) => 
  state.messages[state.messages.length - 1];

export const selectHasMessages = (state: ChatState) => 
  state.messages.length > 0;

export const selectIsShieldActive = (state: ChatState) => 
  state.isShieldOverlayOpen && state.shieldActivation !== null;
