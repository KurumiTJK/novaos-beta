// ═══════════════════════════════════════════════════════════════════════════════
// WORKING MEMORY — Session-based Conversation History
// ═══════════════════════════════════════════════════════════════════════════════
//
// Manages conversation history for multi-turn context in the pipeline.
// Messages are stored in Redis and passed to Intent Gate and Response Gate.
//
// Usage:
//   import { workingMemory } from '../core/memory/working_memory/index.js';
//   
//   await workingMemory.getOrCreate(userId, convId);
//   await workingMemory.addUserMessage(convId, message);
//   const context = await workingMemory.buildContext(convId);
//
// ═══════════════════════════════════════════════════════════════════════════════

// Types
export type {
  Message,
  MessageMetadata,
  Conversation,
  ConversationMetadata,
  ConversationWithMessages,
  ContextWindow,
} from './types.js';

export { WORKING_MEMORY_CONFIG } from './types.js';

// Store
export { WorkingMemoryStore, getWorkingMemoryStore } from './store.js';

// ─────────────────────────────────────────────────────────────────────────────────
// WORKING MEMORY SERVICE
// High-level API for conversation operations
// ─────────────────────────────────────────────────────────────────────────────────

import { getWorkingMemoryStore } from './store.js';
import type { Message } from './types.js';

export const workingMemory = {
  /**
   * Get or create a conversation with ownership verification.
   */
  async getOrCreate(userId: string, conversationId: string) {
    return getWorkingMemoryStore().getOrCreate(userId, conversationId);
  },

  /**
   * Get a conversation by ID.
   */
  async get(conversationId: string) {
    return getWorkingMemoryStore().get(conversationId);
  },

  /**
   * Verify that a conversation belongs to a user.
   */
  async verifyOwnership(conversationId: string, userId: string) {
    return getWorkingMemoryStore().verifyOwnership(conversationId, userId);
  },

  /**
   * List user's conversations.
   */
  async list(userId: string, limit?: number, offset?: number) {
    return getWorkingMemoryStore().listUserConversations(userId, limit, offset);
  },

  /**
   * Delete a conversation.
   */
  async delete(conversationId: string) {
    return getWorkingMemoryStore().delete(conversationId);
  },

  /**
   * Add a user message to a conversation.
   */
  async addUserMessage(conversationId: string, content: string) {
    return getWorkingMemoryStore().addMessage(conversationId, {
      role: 'user',
      content,
    });
  },

  /**
   * Add an assistant message to a conversation.
   */
  async addAssistantMessage(
    conversationId: string,
    content: string,
    metadata?: Message['metadata']
  ) {
    return getWorkingMemoryStore().addMessage(conversationId, {
      role: 'assistant',
      content,
      metadata,
    });
  },

  /**
   * Get messages from a conversation.
   */
  async getMessages(conversationId: string, limit?: number) {
    return getWorkingMemoryStore().getMessages(conversationId, limit);
  },

  /**
   * Get full conversation with messages.
   */
  async getFull(conversationId: string) {
    return getWorkingMemoryStore().getFullConversation(conversationId);
  },

  /**
   * Build context window for pipeline.
   */
  async buildContext(conversationId: string, maxTokens?: number) {
    return getWorkingMemoryStore().buildContextWindow(conversationId, maxTokens);
  },

  /**
   * Update conversation title.
   */
  async updateTitle(conversationId: string, title: string) {
    return getWorkingMemoryStore().update(conversationId, { title });
  },

  /**
   * Add a tag to a conversation.
   */
  async addTag(conversationId: string, tag: string) {
    const conv = await getWorkingMemoryStore().get(conversationId);
    if (!conv) return null;
    
    const tags = conv.metadata?.tags ?? [];
    if (!tags.includes(tag)) {
      tags.push(tag);
      return getWorkingMemoryStore().update(conversationId, {
        metadata: { ...conv.metadata, tags },
      });
    }
    return conv;
  },
};
