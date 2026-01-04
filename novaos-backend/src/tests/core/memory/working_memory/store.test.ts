// ═══════════════════════════════════════════════════════════════════════════════
// WORKING MEMORY STORE TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WorkingMemoryStore } from '../../../../core/memory/working_memory/store.js';
import { WORKING_MEMORY_CONFIG } from '../../../../core/memory/working_memory/types.js';
import type { KeyValueStore } from '../../../../storage/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MOCK STORE
// ─────────────────────────────────────────────────────────────────────────────────

function createMockStore(): KeyValueStore & {
  _data: Map<string, string>;
  _lists: Map<string, string[]>;
  _ttls: Map<string, number>;
} {
  const data = new Map<string, string>();
  const lists = new Map<string, string[]>();
  const ttls = new Map<string, number>();

  return {
    _data: data,
    _lists: lists,
    _ttls: ttls,

    async get(key: string) {
      return data.get(key) ?? null;
    },

    async set(key: string, value: string, ttl?: number) {
      data.set(key, value);
      if (ttl) ttls.set(key, ttl);
    },

    async delete(key: string) {
      data.delete(key);
      lists.delete(key);
      ttls.delete(key);
    },

    async exists(key: string) {
      return data.has(key) || lists.has(key);
    },

    async expire(key: string, seconds: number) {
      ttls.set(key, seconds);
      return true;
    },

    async lpush(key: string, value: string) {
      const list = lists.get(key) ?? [];
      list.unshift(value);
      lists.set(key, list);
      return list.length;
    },

    async lrange(key: string, start: number, stop: number) {
      const list = lists.get(key) ?? [];
      // Redis-style: stop is inclusive
      return list.slice(start, stop + 1);
    },

    async ltrim(key: string, start: number, stop: number) {
      const list = lists.get(key) ?? [];
      lists.set(key, list.slice(start, stop + 1));
    },

    async llen(key: string) {
      return lists.get(key)?.length ?? 0;
    },

    // Stub other methods
    async mget() { return []; },
    async mset() {},
    async incr() { return 1; },
    async decr() { return 0; },
    async keys() { return []; },
    async ttl() { return -1; },
    async scan() { return { cursor: '0', keys: [] }; },
  } as KeyValueStore & {
    _data: Map<string, string>;
    _lists: Map<string, string[]>;
    _ttls: Map<string, number>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVERSATION CRUD
// ─────────────────────────────────────────────────────────────────────────────────

describe('WorkingMemoryStore', () => {
  let mockStore: ReturnType<typeof createMockStore>;
  let store: WorkingMemoryStore;

  beforeEach(() => {
    mockStore = createMockStore();
    store = new WorkingMemoryStore(mockStore);
  });

  describe('create', () => {
    it('should create a new conversation', async () => {
      const conv = await store.create('user-123', 'conv-456');

      expect(conv.id).toBe('conv-456');
      expect(conv.userId).toBe('user-123');
      expect(conv.title).toBe('New Conversation');
      expect(conv.messageCount).toBe(0);
      expect(conv.totalTokens).toBe(0);
    });

    it('should set custom title', async () => {
      const conv = await store.create('user-123', 'conv-456', 'My Custom Title');
      expect(conv.title).toBe('My Custom Title');
    });

    it('should store with TTL', async () => {
      await store.create('user-123', 'conv-456');
      expect(mockStore._ttls.get('conv:conv-456')).toBe(WORKING_MEMORY_CONFIG.CONVERSATION_TTL_SECONDS);
    });

    it('should add to user conversation list', async () => {
      await store.create('user-123', 'conv-456');
      const list = mockStore._lists.get('user:user-123:conversations');
      expect(list).toContain('conv-456');
    });
  });

  describe('get', () => {
    it('should return conversation', async () => {
      await store.create('user-123', 'conv-456');
      const conv = await store.get('conv-456');
      expect(conv?.id).toBe('conv-456');
    });

    it('should return null for non-existent', async () => {
      const conv = await store.get('non-existent');
      expect(conv).toBeNull();
    });
  });

  describe('update', () => {
    it('should update conversation fields', async () => {
      await store.create('user-123', 'conv-456');
      const updated = await store.update('conv-456', { title: 'New Title' });

      expect(updated?.title).toBe('New Title');
    });

    it('should update updatedAt timestamp', async () => {
      const conv = await store.create('user-123', 'conv-456');
      const originalUpdatedAt = conv.updatedAt;

      await new Promise(r => setTimeout(r, 10));
      const updated = await store.update('conv-456', { title: 'New' });

      expect(updated?.updatedAt).toBeGreaterThan(originalUpdatedAt);
    });

    it('should return null for non-existent', async () => {
      const result = await store.update('non-existent', { title: 'Test' });
      expect(result).toBeNull();
    });
  });

  describe('delete', () => {
    it('should delete conversation and messages', async () => {
      await store.create('user-123', 'conv-456');
      await store.addMessage('conv-456', { role: 'user', content: 'Hi' });

      const result = await store.delete('conv-456');

      expect(result).toBe(true);
      expect(await store.get('conv-456')).toBeNull();
    });

    it('should return false for non-existent', async () => {
      const result = await store.delete('non-existent');
      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // OWNERSHIP & SECURITY
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('getOrCreate', () => {
    it('should create new conversation if not exists', async () => {
      const conv = await store.getOrCreate('user-123', 'conv-456');
      expect(conv.id).toBe('conv-456');
      expect(conv.userId).toBe('user-123');
    });

    it('should return existing conversation if owned by user', async () => {
      await store.create('user-123', 'conv-456', 'Original');
      const conv = await store.getOrCreate('user-123', 'conv-456');
      expect(conv.title).toBe('Original');
    });

    it('should create new conversation if ownership mismatch (security)', async () => {
      // User A creates conversation
      await store.create('user-A', 'conv-456');

      // User B tries to access it - should get NEW conversation
      const conv = await store.getOrCreate('user-B', 'conv-456');

      // Should have modified ID to prevent hijacking
      expect(conv.id).not.toBe('conv-456');
      expect(conv.userId).toBe('user-B');
    });
  });

  describe('verifyOwnership', () => {
    it('should return true for owner', async () => {
      await store.create('user-123', 'conv-456');
      const result = await store.verifyOwnership('conv-456', 'user-123');
      expect(result).toBe(true);
    });

    it('should return false for non-owner', async () => {
      await store.create('user-123', 'conv-456');
      const result = await store.verifyOwnership('conv-456', 'user-999');
      expect(result).toBe(false);
    });

    it('should return false for non-existent conversation', async () => {
      const result = await store.verifyOwnership('non-existent', 'user-123');
      expect(result).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // USER CONVERSATIONS
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('listUserConversations', () => {
    it('should return user conversations sorted by updatedAt', async () => {
      await store.create('user-123', 'conv-1');
      await new Promise(r => setTimeout(r, 10));
      await store.create('user-123', 'conv-2');
      await new Promise(r => setTimeout(r, 10));
      await store.create('user-123', 'conv-3');

      const convs = await store.listUserConversations('user-123');

      expect(convs.length).toBe(3);
      expect(convs[0]?.id).toBe('conv-3'); // Most recent first
    });

    it('should respect limit and offset', async () => {
      await store.create('user-123', 'conv-1');
      await store.create('user-123', 'conv-2');
      await store.create('user-123', 'conv-3');

      const convs = await store.listUserConversations('user-123', 2, 0);
      expect(convs.length).toBe(2);
    });

    it('should return empty array for user with no conversations', async () => {
      const convs = await store.listUserConversations('user-no-convs');
      expect(convs).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // MESSAGE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('addMessage', () => {
    it('should add message with generated id and timestamp', async () => {
      await store.create('user-123', 'conv-456');
      const msg = await store.addMessage('conv-456', {
        role: 'user',
        content: 'Hello',
      });

      expect(msg.id).toBeDefined();
      expect(msg.timestamp).toBeDefined();
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello');
    });

    it('should increment conversation messageCount', async () => {
      await store.create('user-123', 'conv-456');
      await store.addMessage('conv-456', { role: 'user', content: 'Hi' });

      const conv = await store.get('conv-456');
      expect(conv?.messageCount).toBe(1);
    });

    it('should update totalTokens when metadata provided', async () => {
      await store.create('user-123', 'conv-456');
      await store.addMessage('conv-456', {
        role: 'assistant',
        content: 'Hello!',
        metadata: { tokensUsed: 50 },
      });

      const conv = await store.get('conv-456');
      expect(conv?.totalTokens).toBe(50);
    });

    it('should auto-generate title from first user message', async () => {
      await store.create('user-123', 'conv-456');
      await store.addMessage('conv-456', {
        role: 'user',
        content: 'What is the capital of France?',
      });

      const conv = await store.get('conv-456');
      expect(conv?.title).toBe('What is the capital of France?');
    });

    it('should truncate long titles', async () => {
      await store.create('user-123', 'conv-456');
      await store.addMessage('conv-456', {
        role: 'user',
        content: 'This is a very long message that should be truncated to fit within the title limit for conversations',
      });

      const conv = await store.get('conv-456');
      expect(conv?.title?.endsWith('...')).toBe(true);
      expect((conv?.title?.length ?? 0)).toBeLessThanOrEqual(55);
    });

    it('should trim messages list to prevent unbounded growth', async () => {
      await store.create('user-123', 'conv-456');

      // Add messages up to limit
      for (let i = 0; i < 5; i++) {
        await store.addMessage('conv-456', { role: 'user', content: `Message ${i}` });
      }

      // Verify ltrim was called (mock tracks this via list size)
      const msgKey = 'conv:conv-456:messages';
      expect(mockStore._lists.get(msgKey)?.length).toBeLessThanOrEqual(
        WORKING_MEMORY_CONFIG.MAX_MESSAGES_STORED
      );
    });

    it('should refresh TTL on messages list', async () => {
      await store.create('user-123', 'conv-456');
      await store.addMessage('conv-456', { role: 'user', content: 'Hi' });

      const ttl = mockStore._ttls.get('conv:conv-456:messages');
      expect(ttl).toBe(WORKING_MEMORY_CONFIG.CONVERSATION_TTL_SECONDS);
    });
  });

  describe('getMessages', () => {
    it('should return messages in chronological order', async () => {
      await store.create('user-123', 'conv-456');
      await store.addMessage('conv-456', { role: 'user', content: 'First' });
      await store.addMessage('conv-456', { role: 'assistant', content: 'Second' });
      await store.addMessage('conv-456', { role: 'user', content: 'Third' });

      const messages = await store.getMessages('conv-456');

      expect(messages[0]?.content).toBe('First');
      expect(messages[1]?.content).toBe('Second');
      expect(messages[2]?.content).toBe('Third');
    });

    it('should respect limit', async () => {
      await store.create('user-123', 'conv-456');
      for (let i = 0; i < 10; i++) {
        await store.addMessage('conv-456', { role: 'user', content: `Msg ${i}` });
      }

      const messages = await store.getMessages('conv-456', 5);
      expect(messages.length).toBe(5);
    });

    it('should return empty array for no messages', async () => {
      await store.create('user-123', 'conv-456');
      const messages = await store.getMessages('conv-456');
      expect(messages).toEqual([]);
    });
  });

  describe('getFullConversation', () => {
    it('should return conversation with messages', async () => {
      await store.create('user-123', 'conv-456');
      await store.addMessage('conv-456', { role: 'user', content: 'Hi' });

      const full = await store.getFullConversation('conv-456');

      expect(full?.id).toBe('conv-456');
      expect(full?.messages.length).toBe(1);
    });

    it('should return null for non-existent', async () => {
      const full = await store.getFullConversation('non-existent');
      expect(full).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────────
  // CONTEXT WINDOW
  // ─────────────────────────────────────────────────────────────────────────────────

  describe('buildContextWindow', () => {
    it('should include recent messages within token limit', async () => {
      await store.create('user-123', 'conv-456');
      await store.addMessage('conv-456', { role: 'user', content: 'Hello' });
      await store.addMessage('conv-456', { role: 'assistant', content: 'Hi!' });

      const context = await store.buildContextWindow('conv-456');

      expect(context.messages.length).toBe(2);
      expect(context.truncated).toBe(false);
    });

    it('should truncate when exceeding token limit', async () => {
      await store.create('user-123', 'conv-456');

      // Add many messages
      for (let i = 0; i < 20; i++) {
        await store.addMessage('conv-456', {
          role: 'user',
          content: 'A'.repeat(2000), // ~500 tokens each
        });
      }

      const context = await store.buildContextWindow('conv-456', 1000, 5);

      expect(context.truncated).toBe(true);
      expect(context.messages.length).toBeLessThanOrEqual(5);
    });

    it('should respect maxMessages parameter', async () => {
      await store.create('user-123', 'conv-456');
      for (let i = 0; i < 10; i++) {
        await store.addMessage('conv-456', { role: 'user', content: `Msg ${i}` });
      }

      const context = await store.buildContextWindow('conv-456', 8000, 3);

      expect(context.messages.length).toBeLessThanOrEqual(3);
    });

    it('should include most recent messages', async () => {
      await store.create('user-123', 'conv-456');
      await store.addMessage('conv-456', { role: 'user', content: 'Old' });
      await store.addMessage('conv-456', { role: 'user', content: 'Recent' });

      const context = await store.buildContextWindow('conv-456', 100, 1);

      expect(context.messages[0]?.content).toBe('Recent');
    });

    it('should track oldest included timestamp', async () => {
      await store.create('user-123', 'conv-456');
      const msg = await store.addMessage('conv-456', { role: 'user', content: 'Test' });

      const context = await store.buildContextWindow('conv-456');

      expect(context.oldestIncluded).toBe(msg.timestamp);
    });
  });

  describe('formatContextForLLM', () => {
    it('should format messages for LLM API', async () => {
      await store.create('user-123', 'conv-456');
      await store.addMessage('conv-456', { role: 'user', content: 'Hello' });
      await store.addMessage('conv-456', { role: 'assistant', content: 'Hi!' });

      const context = await store.buildContextWindow('conv-456');
      const formatted = store.formatContextForLLM(context);

      expect(formatted).toEqual([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi!' },
      ]);
    });
  });
});
