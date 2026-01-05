// ═══════════════════════════════════════════════════════════════════════════════
// CHAT FEATURE — Zustand Store
// ═══════════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import * as chatApi from './chatApi';
import { generateId } from '../../shared/utils';
import type { Message, Conversation, Stance, GateResults } from '../../shared/types';

// ─────────────────────────────────────────────────────────────────────────────────
// STATE INTERFACE
// ─────────────────────────────────────────────────────────────────────────────────

interface ChatState {
  messages: Message[];
  conversations: Conversation[];
  conversationId: string | null;
  currentStance: Stance;
  isLoading: boolean;
  error: string | null;

  // Detected modes from pipeline
  detectedCrisis: boolean;
  detectedLearning: boolean;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  loadConversations: () => Promise<void>;
  loadConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  setStance: (stance: Stance) => void;
  clearMessages: () => void;
  clearError: () => void;
  resetDetectedModes: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE
// ─────────────────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  conversations: [],
  conversationId: null,
  currentStance: 'lens',
  isLoading: false,
  error: null,
  detectedCrisis: false,
  detectedLearning: false,

  sendMessage: async (content: string) => {
    const { currentStance, messages } = get();

    // Add user message immediately
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    // Add placeholder for assistant
    const assistantPlaceholder: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isLoading: true,
    };

    set({
      messages: [...messages, userMessage, assistantPlaceholder],
      isLoading: true,
      error: null,
      detectedCrisis: false,
      detectedLearning: false,
    });

    try {
      const response = await chatApi.sendMessage({
        message: content,
        stance: currentStance,
      });

      // Check for crisis or learning mode triggers
      const gateResults = response.gateResults;
      const isCrisis = gateResults?.intent?.safety_signal === 'high';
      const isLearning = gateResults?.intent?.learning_intent && response.stance === 'sword';

      // Create assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: response.response,
        timestamp: new Date(),
        stance: response.stance,
        confidence: gateResults?.response?.confidence,
        freshness: gateResults?.response?.freshness,
        gateResults,
      };

      // Replace placeholder with actual response
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg.id === assistantPlaceholder.id ? assistantMessage : msg
        ),
        conversationId: response.conversationId,
        currentStance: response.stance,
        isLoading: false,
        detectedCrisis: isCrisis,
        detectedLearning: isLearning,
      }));
    } catch (error) {
      // Remove placeholder on error
      set((state) => ({
        messages: state.messages.filter((msg) => msg.id !== assistantPlaceholder.id),
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to send message',
      }));
    }
  },

  loadConversations: async () => {
    try {
      const conversations = await chatApi.listConversations();
      set({ conversations });
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  },

  loadConversation: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const conversation = await chatApi.getConversation(id);

      // Convert conversation messages to UI messages
      const messages: Message[] = conversation.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(msg.timestamp),
        stance: msg.stance,
        gateResults: msg.gateResults,
      }));

      set({
        messages,
        conversationId: id,
        isLoading: false,
      });
    } catch (error) {
      set({
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load conversation',
      });
    }
  },

  startNewConversation: () => {
    set({
      messages: [],
      conversationId: null,
      currentStance: 'lens',
      error: null,
      detectedCrisis: false,
      detectedLearning: false,
    });
  },

  setStance: (stance: Stance) => {
    set({ currentStance: stance });
  },

  clearMessages: () => {
    set({ messages: [], conversationId: null });
  },

  clearError: () => {
    set({ error: null });
  },

  resetDetectedModes: () => {
    set({ detectedCrisis: false, detectedLearning: false });
  },
}));
