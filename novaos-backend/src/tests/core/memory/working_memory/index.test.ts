// ═══════════════════════════════════════════════════════════════════════════════
// WORKING MEMORY INDEX TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the storage module before importing workingMemory
vi.mock('../../../../storage/index.js', () => {
  const data = new Map<string, string>();
  const lists = new Map<string, string[]>();

  return {
    getStore: vi.fn(() => ({
      get: vi.fn(async (key: string) => data.get(key) ?? null),
      set: vi.fn(async (key: string, value: string) => { data.set(key, value); }),
      delete: vi.fn(async (key: string) => { data.delete(key); lists.delete(key); }),
      exists: vi.fn(async (key: string) => data.has(key)),
      expire: vi.fn(async () => true),
      lpush: vi.fn(async (key: string, value: string) => {
        const list = lists.get(key) ?? [];
        list.unshift(value);
        lists.set(key, list);
        return list.length;
      }),
      lrange: vi.fn(async (key: string, start: number, stop: number) => {
        const list = lists.get(key) ?? [];
        return list.slice(start, stop + 1);
      }),
      ltrim: vi.fn(async (key: string, start: number, stop: number) => {
        const list = lists.get(key) ?? [];
        lists.set(key, list.slice(start, stop + 1));
      }),
      llen: vi.fn(async (key: string) => lists.get(key)?.length ?? 0),
    })),
    _testHelpers: {
      clear: () => { data.clear(); lists.clear(); },
    },
  };
});

import {
  workingMemory,
  getWorkingMemoryStore,
  WorkingMemoryStore,
  WORKING_MEMORY_CONFIG,
  type Message,
  type Conversation,
  type ConversationWithMessages,
  type ContextWindow,
} from '../../../../core/memory/working_memory/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Working Memory Exports', () => {
  it('should export workingMemory service', () => {
    expect(workingMemory).toBeDefined();
    expect(typeof workingMemory.getOrCreate).toBe('function');
    expect(typeof workingMemory.get).toBe('function');
    expect(typeof workingMemory.list).toBe('function');
    expect(typeof workingMemory.delete).toBe('function');
    expect(typeof workingMemory.addUserMessage).toBe('function');
    expect(typeof workingMemory.addAssistantMessage).toBe('function');
    expect(typeof workingMemory.getMessages).toBe('function');
    expect(typeof workingMemory.getFull).toBe('function');
    expect(typeof workingMemory.buildContext).toBe('function');
    expect(typeof workingMemory.updateTitle).toBe('function');
    expect(typeof workingMemory.addTag).toBe('function');
    expect(typeof workingMemory.verifyOwnership).toBe('function');
  });

  it('should export getWorkingMemoryStore', () => {
    expect(getWorkingMemoryStore).toBeDefined();
    expect(typeof getWorkingMemoryStore).toBe('function');
  });

  it('should export WorkingMemoryStore class', () => {
    expect(WorkingMemoryStore).toBeDefined();
  });

  it('should export WORKING_MEMORY_CONFIG', () => {
    expect(WORKING_MEMORY_CONFIG).toBeDefined();
    expect(WORKING_MEMORY_CONFIG.MAX_CONTEXT_TOKENS).toBe(8000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// WORKING MEMORY SERVICE
// ─────────────────────────────────────────────────────────────────────────────────

describe('workingMemory Service', () => {
  describe('getOrCreate', () => {
    it('should create conversation via store', async () => {
      const conv = await workingMemory.getOrCreate('user-123', 'conv-test-1');
      expect(conv.id).toBe('conv-test-1');
      expect(conv.userId).toBe('user-123');
    });
  });

  describe('get', () => {
    it('should get conversation via store', async () => {
      await workingMemory.getOrCreate('user-123', 'conv-test-2');
      const conv = await workingMemory.get('conv-test-2');
      expect(conv?.id).toBe('conv-test-2');
    });
  });

  describe('verifyOwnership', () => {
    it('should verify ownership via store', async () => {
      await workingMemory.getOrCreate('user-123', 'conv-test-3');
      const owned = await workingMemory.verifyOwnership('conv-test-3', 'user-123');
      expect(owned).toBe(true);
    });
  });

  describe('list', () => {
    it('should list user conversations', async () => {
      await workingMemory.getOrCreate('user-list', 'conv-list-1');
      await workingMemory.getOrCreate('user-list', 'conv-list-2');
      const convs = await workingMemory.list('user-list');
      expect(convs.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('delete', () => {
    it('should delete conversation', async () => {
      await workingMemory.getOrCreate('user-123', 'conv-to-delete');
      await workingMemory.delete('conv-to-delete');
      const conv = await workingMemory.get('conv-to-delete');
      expect(conv).toBeNull();
    });
  });

  describe('addUserMessage', () => {
    it('should add user message', async () => {
      await workingMemory.getOrCreate('user-123', 'conv-msg-1');
      const msg = await workingMemory.addUserMessage('conv-msg-1', 'Hello');
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('Hello');
    });
  });

  describe('addAssistantMessage', () => {
    it('should add assistant message with metadata', async () => {
      await workingMemory.getOrCreate('user-123', 'conv-msg-2');
      const msg = await workingMemory.addAssistantMessage('conv-msg-2', 'Hi!', {
        stance: 'LENS',
        tokensUsed: 50,
      });
      expect(msg.role).toBe('assistant');
      expect(msg.metadata?.stance).toBe('LENS');
    });
  });

  describe('getMessages', () => {
    it('should get messages', async () => {
      await workingMemory.getOrCreate('user-123', 'conv-msg-3');
      await workingMemory.addUserMessage('conv-msg-3', 'Hello');
      await workingMemory.addAssistantMessage('conv-msg-3', 'Hi!');

      const messages = await workingMemory.getMessages('conv-msg-3');
      expect(messages.length).toBe(2);
    });
  });

  describe('getFull', () => {
    it('should get full conversation with messages', async () => {
      await workingMemory.getOrCreate('user-123', 'conv-full');
      await workingMemory.addUserMessage('conv-full', 'Hello');

      const full = await workingMemory.getFull('conv-full');
      expect(full?.messages.length).toBe(1);
    });
  });

  describe('buildContext', () => {
    it('should build context window', async () => {
      await workingMemory.getOrCreate('user-123', 'conv-ctx');
      await workingMemory.addUserMessage('conv-ctx', 'Hello');
      await workingMemory.addAssistantMessage('conv-ctx', 'Hi!');

      const context = await workingMemory.buildContext('conv-ctx');
      expect(context.messages.length).toBe(2);
      expect(context.truncated).toBe(false);
    });
  });

  describe('updateTitle', () => {
    it('should update conversation title', async () => {
      await workingMemory.getOrCreate('user-123', 'conv-title');
      await workingMemory.updateTitle('conv-title', 'New Title');

      const conv = await workingMemory.get('conv-title');
      expect(conv?.title).toBe('New Title');
    });
  });

  describe('addTag', () => {
    it('should add tag to conversation', async () => {
      await workingMemory.getOrCreate('user-123', 'conv-tag');
      await workingMemory.addTag('conv-tag', 'python');

      const conv = await workingMemory.get('conv-tag');
      expect(conv?.metadata?.tags).toContain('python');
    });

    it('should not duplicate tags', async () => {
      await workingMemory.getOrCreate('user-123', 'conv-tag-dup');
      await workingMemory.addTag('conv-tag-dup', 'python');
      await workingMemory.addTag('conv-tag-dup', 'python');

      const conv = await workingMemory.get('conv-tag-dup');
      const pythonCount = conv?.metadata?.tags?.filter(t => t === 'python').length ?? 0;
      expect(pythonCount).toBe(1);
    });

    it('should return null for non-existent conversation', async () => {
      const result = await workingMemory.addTag('non-existent', 'tag');
      expect(result).toBeNull();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

describe('getWorkingMemoryStore', () => {
  it('should return WorkingMemoryStore instance', () => {
    const store = getWorkingMemoryStore();
    expect(store).toBeInstanceOf(WorkingMemoryStore);
  });

  it('should return same instance (singleton)', () => {
    const store1 = getWorkingMemoryStore();
    const store2 = getWorkingMemoryStore();
    expect(store1).toBe(store2);
  });
});
