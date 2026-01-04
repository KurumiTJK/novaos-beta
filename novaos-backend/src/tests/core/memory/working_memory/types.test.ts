// ═══════════════════════════════════════════════════════════════════════════════
// WORKING MEMORY TYPES TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  WORKING_MEMORY_CONFIG,
  type Message,
  type MessageMetadata,
  type Conversation,
  type ConversationMetadata,
  type ConversationWithMessages,
  type ContextWindow,
} from '../../../../core/memory/working_memory/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

describe('WORKING_MEMORY_CONFIG', () => {
  it('should have MAX_CONTEXT_TOKENS', () => {
    expect(WORKING_MEMORY_CONFIG.MAX_CONTEXT_TOKENS).toBe(8000);
  });

  it('should have MAX_MESSAGES_IN_CONTEXT', () => {
    expect(WORKING_MEMORY_CONFIG.MAX_MESSAGES_IN_CONTEXT).toBe(50);
  });

  it('should have MAX_MESSAGES_STORED', () => {
    expect(WORKING_MEMORY_CONFIG.MAX_MESSAGES_STORED).toBe(1000);
  });

  it('should have CONVERSATION_TTL_DAYS', () => {
    expect(WORKING_MEMORY_CONFIG.CONVERSATION_TTL_DAYS).toBe(30);
  });

  it('should have CONVERSATION_TTL_SECONDS matching days', () => {
    const expectedSeconds = 30 * 24 * 60 * 60;
    expect(WORKING_MEMORY_CONFIG.CONVERSATION_TTL_SECONDS).toBe(expectedSeconds);
  });

  it('should be readonly', () => {
    // TypeScript enforces this at compile time, but we can check it exists
    expect(WORKING_MEMORY_CONFIG).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE STRUCTURE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Message Type Structure', () => {
  it('should accept valid user message', () => {
    const message: Message = {
      id: 'msg-123',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    };
    expect(message.role).toBe('user');
  });

  it('should accept valid assistant message with metadata', () => {
    const message: Message = {
      id: 'msg-456',
      role: 'assistant',
      content: 'Hi there!',
      timestamp: Date.now(),
      metadata: {
        stance: 'LENS',
        status: 'complete',
        tokensUsed: 50,
        liveData: true,
      },
    };
    expect(message.metadata?.stance).toBe('LENS');
    expect(message.metadata?.tokensUsed).toBe(50);
  });

  it('should accept system messages', () => {
    const message: Message = {
      id: 'msg-789',
      role: 'system',
      content: 'System prompt',
      timestamp: Date.now(),
    };
    expect(message.role).toBe('system');
  });
});

describe('Conversation Type Structure', () => {
  it('should accept valid conversation', () => {
    const conv: Conversation = {
      id: 'conv-123',
      userId: 'user-456',
      title: 'Test Conversation',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 5,
      totalTokens: 500,
    };
    expect(conv.id).toBe('conv-123');
    expect(conv.messageCount).toBe(5);
  });

  it('should accept conversation with metadata', () => {
    const conv: Conversation = {
      id: 'conv-123',
      userId: 'user-456',
      title: 'Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      totalTokens: 0,
      metadata: {
        lastStance: 'SWORD',
        tags: ['learning', 'python'],
      },
    };
    expect(conv.metadata?.tags).toContain('python');
  });
});

describe('ConversationWithMessages Type Structure', () => {
  it('should extend Conversation with messages array', () => {
    const fullConv: ConversationWithMessages = {
      id: 'conv-123',
      userId: 'user-456',
      title: 'Test',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 2,
      totalTokens: 100,
      messages: [
        { id: 'msg-1', role: 'user', content: 'Hi', timestamp: Date.now() },
        { id: 'msg-2', role: 'assistant', content: 'Hello!', timestamp: Date.now() },
      ],
    };
    expect(fullConv.messages.length).toBe(2);
  });
});

describe('ContextWindow Type Structure', () => {
  it('should have required properties', () => {
    const context: ContextWindow = {
      messages: [],
      totalTokens: 0,
      truncated: false,
      oldestIncluded: 0,
    };
    expect(context.truncated).toBe(false);
  });

  it('should indicate truncation', () => {
    const context: ContextWindow = {
      messages: [
        { id: 'msg-1', role: 'user', content: 'Recent', timestamp: Date.now() },
      ],
      totalTokens: 7500,
      truncated: true,
      oldestIncluded: Date.now() - 3600000,
    };
    expect(context.truncated).toBe(true);
    expect(context.totalTokens).toBeLessThan(WORKING_MEMORY_CONFIG.MAX_CONTEXT_TOKENS);
  });
});

describe('MessageMetadata Type Structure', () => {
  it('should accept all optional properties', () => {
    const metadata: MessageMetadata = {
      stance: 'SHIELD',
      status: 'warning',
      tokensUsed: 100,
      gateResults: { shield: { passed: true } },
      liveData: true,
    };
    expect(metadata.stance).toBe('SHIELD');
    expect(metadata.gateResults).toBeDefined();
  });

  it('should accept empty metadata', () => {
    const metadata: MessageMetadata = {};
    expect(metadata.stance).toBeUndefined();
  });
});

describe('ConversationMetadata Type Structure', () => {
  it('should accept all optional properties', () => {
    const metadata: ConversationMetadata = {
      lastStance: 'LENS',
      tags: ['finance', 'stocks'],
    };
    expect(metadata.tags?.length).toBe(2);
  });

  it('should accept empty metadata', () => {
    const metadata: ConversationMetadata = {};
    expect(metadata.lastStance).toBeUndefined();
  });
});
