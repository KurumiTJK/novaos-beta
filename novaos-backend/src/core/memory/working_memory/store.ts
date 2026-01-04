// ═══════════════════════════════════════════════════════════════════════════════
// WORKING MEMORY — Store
// Session-based conversation history with security and performance fixes
// ═══════════════════════════════════════════════════════════════════════════════
//
// FIXES APPLIED:
// 1. LTRIM after LPUSH — prevents unbounded message list growth
// 2. TTL on messages list — prevents orphaned data
// 3. Ownership verification — prevents conversation hijacking
// 4. Refresh TTL on messages list when adding — keeps in sync with conversation
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../../../storage/index.js';
import type {
  Message,
  Conversation,
  ConversationWithMessages,
  ContextWindow,
} from './types.js';
import { WORKING_MEMORY_CONFIG } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// REDIS KEY STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────────
//
// conv:{conversationId}           → JSON: Conversation metadata
// conv:{conversationId}:messages  → List: Messages (newest first via LPUSH)
// user:{userId}:conversations     → List: User's conversation IDs
//
// ─────────────────────────────────────────────────────────────────────────────────

export class WorkingMemoryStore {
  constructor(private store: KeyValueStore) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // KEY GENERATORS
  // ─────────────────────────────────────────────────────────────────────────────

  private getConversationKey(conversationId: string): string {
    return `conv:${conversationId}`;
  }

  private getUserConversationsKey(userId: string): string {
    return `user:${userId}:conversations`;
  }

  private getMessagesKey(conversationId: string): string {
    return `conv:${conversationId}:messages`;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONVERSATION CRUD
  // ─────────────────────────────────────────────────────────────────────────────

  async create(userId: string, conversationId: string, title?: string): Promise<Conversation> {
    const now = Date.now();
    const conversation: Conversation = {
      id: conversationId,
      userId,
      title: title ?? 'New Conversation',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      totalTokens: 0,
    };

    const ttl = WORKING_MEMORY_CONFIG.CONVERSATION_TTL_SECONDS;

    // Store conversation with TTL
    await this.store.set(
      this.getConversationKey(conversationId),
      JSON.stringify(conversation),
      ttl
    );

    // Add to user's conversation list
    await this.store.lpush(
      this.getUserConversationsKey(userId),
      conversationId
    );

    return conversation;
  }

  async get(conversationId: string): Promise<Conversation | null> {
    const data = await this.store.get(this.getConversationKey(conversationId));
    return data ? JSON.parse(data) : null;
  }

  async update(conversationId: string, updates: Partial<Conversation>): Promise<Conversation | null> {
    const conversation = await this.get(conversationId);
    if (!conversation) return null;

    const updated: Conversation = {
      ...conversation,
      ...updates,
      updatedAt: Date.now(),
    };

    await this.store.set(
      this.getConversationKey(conversationId),
      JSON.stringify(updated),
      WORKING_MEMORY_CONFIG.CONVERSATION_TTL_SECONDS
    );

    return updated;
  }

  async delete(conversationId: string): Promise<boolean> {
    const conversation = await this.get(conversationId);
    if (!conversation) return false;

    // Delete conversation metadata
    await this.store.delete(this.getConversationKey(conversationId));
    
    // Delete messages list
    await this.store.delete(this.getMessagesKey(conversationId));

    // Note: User's conversation list will self-clean when fetched (null entries filtered)
    // A proper cleanup would require LREM which is O(n)

    return true;
  }

  /**
   * Get or create a conversation with ownership verification.
   * 
   * SECURITY FIX: Prevents user A from hijacking user B's conversation
   * by guessing the conversationId.
   */
  async getOrCreate(userId: string, conversationId: string): Promise<Conversation> {
    const existing = await this.get(conversationId);
    
    if (existing) {
      // SECURITY: Verify ownership
      if (existing.userId !== userId) {
        // Log the attempt but don't reveal the conversation exists
        console.warn(
          `[WORKING_MEMORY] Ownership mismatch for ${conversationId}. ` +
          `Requested by ${userId}, owned by ${existing.userId}. Creating new conversation.`
        );
        // Create new conversation with modified ID
        const newId = `${conversationId}_${Date.now()}`;
        return this.create(userId, newId);
      }
      return existing;
    }
    
    return this.create(userId, conversationId);
  }

  /**
   * Verify that a conversation belongs to a user.
   * Use this for explicit ownership checks in routes.
   */
  async verifyOwnership(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.get(conversationId);
    return conversation !== null && conversation.userId === userId;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // USER CONVERSATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  async listUserConversations(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<Conversation[]> {
    const conversationIds = await this.store.lrange(
      this.getUserConversationsKey(userId),
      offset,
      offset + limit - 1
    );

    const conversations: Conversation[] = [];
    for (const id of conversationIds) {
      const conv = await this.get(id);
      if (conv) {
        conversations.push(conv);
      }
    }

    // Sort by updatedAt descending
    return conversations.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MESSAGE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────

  async addMessage(conversationId: string, message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    const fullMessage: Message = {
      ...message,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
    };

    const messagesKey = this.getMessagesKey(conversationId);
    const ttl = WORKING_MEMORY_CONFIG.CONVERSATION_TTL_SECONDS;

    // Add to messages list (newest first)
    await this.store.lpush(messagesKey, JSON.stringify(fullMessage));

    // FIX 1: Trim to prevent unbounded growth
    await this.store.ltrim(messagesKey, 0, WORKING_MEMORY_CONFIG.MAX_MESSAGES_STORED - 1);

    // FIX 2: Refresh TTL on messages list to keep in sync with conversation
    await this.store.expire(messagesKey, ttl);

    // Update conversation stats
    const conversation = await this.get(conversationId);
    if (conversation) {
      await this.update(conversationId, {
        messageCount: conversation.messageCount + 1,
        totalTokens: conversation.totalTokens + (message.metadata?.tokensUsed ?? 0),
        metadata: {
          ...conversation.metadata,
          lastStance: message.metadata?.stance,
        },
      });

      // Auto-generate title from first user message
      if (conversation.messageCount === 0 && message.role === 'user') {
        const title = this.generateTitle(message.content);
        await this.update(conversationId, { title });
      }
    }

    return fullMessage;
  }

  async getMessages(
    conversationId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Message[]> {
    const data = await this.store.lrange(
      this.getMessagesKey(conversationId),
      offset,
      offset + limit - 1
    );

    // Messages are stored newest first, reverse for chronological order
    return data.map(d => JSON.parse(d)).reverse();
  }

  async getFullConversation(conversationId: string): Promise<ConversationWithMessages | null> {
    const conversation = await this.get(conversationId);
    if (!conversation) return null;

    const messages = await this.getMessages(conversationId);

    return {
      ...conversation,
      messages,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // CONTEXT WINDOW MANAGEMENT
  // ─────────────────────────────────────────────────────────────────────────────

  async buildContextWindow(
    conversationId: string,
    maxTokens: number = WORKING_MEMORY_CONFIG.MAX_CONTEXT_TOKENS,
    maxMessages: number = WORKING_MEMORY_CONFIG.MAX_MESSAGES_IN_CONTEXT
  ): Promise<ContextWindow> {
    const messages = await this.getMessages(conversationId, maxMessages * 2);
    
    let totalTokens = 0;
    let truncated = false;
    const includedMessages: Message[] = [];

    // Work backwards from most recent, estimate tokens
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;
      
      const estimatedTokens = this.estimateTokens(msg.content);

      if (totalTokens + estimatedTokens > maxTokens || includedMessages.length >= maxMessages) {
        truncated = true;
        break;
      }

      includedMessages.unshift(msg);
      totalTokens += estimatedTokens;
    }

    return {
      messages: includedMessages,
      totalTokens,
      truncated,
      oldestIncluded: includedMessages[0]?.timestamp ?? 0,
    };
  }

  formatContextForLLM(contextWindow: ContextWindow): { role: string; content: string }[] {
    return contextWindow.messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token for English
    return Math.ceil(text.length / 4);
  }

  private generateTitle(content: string): string {
    // Take first 50 chars, trim to last complete word
    let title = content.slice(0, 50);
    if (content.length > 50) {
      const lastSpace = title.lastIndexOf(' ');
      if (lastSpace > 20) {
        title = title.slice(0, lastSpace);
      }
      title += '...';
    }
    return title;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

import { getStore } from '../../../storage/index.js';

let workingMemoryStore: WorkingMemoryStore | null = null;

export function getWorkingMemoryStore(): WorkingMemoryStore {
  if (!workingMemoryStore) {
    workingMemoryStore = new WorkingMemoryStore(getStore());
  }
  return workingMemoryStore;
}
