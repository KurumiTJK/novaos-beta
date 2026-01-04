// ═══════════════════════════════════════════════════════════════════════════════
// CHAT SCHEMAS TESTS — Chat Request Validation
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  ChatMessageSchema,
  ParseCommandSchema,
  ConversationIdParamSchema,
  UpdateConversationSchema,
  ConversationQuerySchema,
  type ChatMessageInput,
  type ParseCommandInput,
  type UpdateConversationInput,
  type ConversationQueryInput,
} from '../../../../security/validation/schemas/chat.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ChatMessageSchema TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ChatMessageSchema', () => {
  it('should accept valid chat message', () => {
    const result = ChatMessageSchema.parse({
      message: 'Hello, Nova!',
    });
    
    expect(result.message).toBe('Hello, Nova!');
  });

  it('should trim message', () => {
    const result = ChatMessageSchema.parse({
      message: '  Hello  ',
    });
    
    expect(result.message).toBe('Hello');
  });

  it('should accept optional conversationId', () => {
    const result = ChatMessageSchema.parse({
      message: 'Hello',
      conversationId: 'conv-123',
    });
    
    expect(result.conversationId).toBe('conv-123');
  });

  it('should accept optional ackToken', () => {
    const result = ChatMessageSchema.parse({
      message: 'Hello',
      ackToken: 'token-abc',
    });
    
    expect(result.ackToken).toBe('token-abc');
  });

  it('should accept optional context', () => {
    const result = ChatMessageSchema.parse({
      message: 'Hello',
      context: {
        timezone: 'America/New_York',
        locale: 'en-US',
      },
    });
    
    expect(result.context?.timezone).toBe('America/New_York');
    expect(result.context?.locale).toBe('en-US');
  });

  it('should reject empty message', () => {
    expect(() => ChatMessageSchema.parse({
      message: '',
    })).toThrow();
  });

  it('should reject whitespace-only message', () => {
    expect(() => ChatMessageSchema.parse({
      message: '   ',
    })).toThrow();
  });

  it('should reject message too long', () => {
    const longMessage = 'a'.repeat(100001);
    expect(() => ChatMessageSchema.parse({
      message: longMessage,
    })).toThrow();
  });

  it('should accept maximum length message', () => {
    const maxMessage = 'a'.repeat(100000);
    const result = ChatMessageSchema.parse({
      message: maxMessage,
    });
    
    expect(result.message.length).toBe(100000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ParseCommandSchema TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ParseCommandSchema', () => {
  it('should accept valid command', () => {
    const result = ParseCommandSchema.parse({
      command: '/goal create Learn TypeScript',
      source: 'command_parser',
    });
    
    expect(result.command).toBe('/goal create Learn TypeScript');
    expect(result.source).toBe('command_parser');
  });

  it('should trim command', () => {
    const result = ParseCommandSchema.parse({
      command: '  /help  ',
      source: 'ui_button',
    });
    
    expect(result.command).toBe('/help');
  });

  it('should accept all valid sources', () => {
    expect(ParseCommandSchema.parse({ command: '/help', source: 'ui_button' }).source).toBe('ui_button');
    expect(ParseCommandSchema.parse({ command: '/help', source: 'command_parser' }).source).toBe('command_parser');
    expect(ParseCommandSchema.parse({ command: '/help', source: 'api_field' }).source).toBe('api_field');
  });

  it('should accept optional conversationId', () => {
    const result = ParseCommandSchema.parse({
      command: '/help',
      source: 'ui_button',
      conversationId: 'conv-123',
    });
    
    expect(result.conversationId).toBe('conv-123');
  });

  it('should reject empty command', () => {
    expect(() => ParseCommandSchema.parse({
      command: '',
      source: 'ui_button',
    })).toThrow();
  });

  it('should reject command too long', () => {
    const longCommand = 'a'.repeat(10001);
    expect(() => ParseCommandSchema.parse({
      command: longCommand,
      source: 'ui_button',
    })).toThrow();
  });

  it('should reject invalid source', () => {
    expect(() => ParseCommandSchema.parse({
      command: '/help',
      source: 'invalid_source',
    })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ConversationIdParamSchema TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ConversationIdParamSchema', () => {
  it('should accept valid conversation ID', () => {
    const result = ConversationIdParamSchema.parse({
      id: 'conv-abc123',
    });
    
    expect(result.id).toBe('conv-abc123');
  });

  it('should reject empty ID', () => {
    expect(() => ConversationIdParamSchema.parse({
      id: '',
    })).toThrow();
  });

  it('should reject missing ID', () => {
    expect(() => ConversationIdParamSchema.parse({})).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// UpdateConversationSchema TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('UpdateConversationSchema', () => {
  it('should accept valid update', () => {
    const result = UpdateConversationSchema.parse({
      title: 'New Title',
      tags: ['tag1', 'tag2'],
    });
    
    expect(result.title).toBe('New Title');
    expect(result.tags).toEqual(['tag1', 'tag2']);
  });

  it('should trim title', () => {
    const result = UpdateConversationSchema.parse({
      title: '  My Title  ',
    });
    
    expect(result.title).toBe('My Title');
  });

  it('should trim tags', () => {
    const result = UpdateConversationSchema.parse({
      tags: ['  tag1  ', '  tag2  '],
    });
    
    expect(result.tags).toEqual(['tag1', 'tag2']);
  });

  it('should allow empty object', () => {
    const result = UpdateConversationSchema.parse({});
    
    expect(result.title).toBeUndefined();
    expect(result.tags).toBeUndefined();
  });

  it('should reject title too short', () => {
    expect(() => UpdateConversationSchema.parse({
      title: '',
    })).toThrow();
  });

  it('should reject title too long', () => {
    const longTitle = 'a'.repeat(201);
    expect(() => UpdateConversationSchema.parse({
      title: longTitle,
    })).toThrow();
  });

  it('should reject empty tag', () => {
    expect(() => UpdateConversationSchema.parse({
      tags: ['valid', ''],
    })).toThrow();
  });

  it('should reject tag too long', () => {
    const longTag = 'a'.repeat(51);
    expect(() => UpdateConversationSchema.parse({
      tags: [longTag],
    })).toThrow();
  });

  it('should reject too many tags', () => {
    const tooManyTags = Array(11).fill('tag');
    expect(() => UpdateConversationSchema.parse({
      tags: tooManyTags,
    })).toThrow();
  });

  it('should accept maximum tags', () => {
    const maxTags = Array(10).fill('tag');
    const result = UpdateConversationSchema.parse({
      tags: maxTags,
    });
    
    expect(result.tags?.length).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// ConversationQuerySchema TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ConversationQuerySchema', () => {
  it('should accept valid query', () => {
    const result = ConversationQuerySchema.parse({
      limit: 50,
      offset: 10,
    });
    
    expect(result.limit).toBe(50);
    expect(result.offset).toBe(10);
  });

  it('should apply defaults', () => {
    const result = ConversationQuerySchema.parse({});
    
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it('should coerce string values', () => {
    const result = ConversationQuerySchema.parse({
      limit: '30',
      offset: '5',
    });
    
    expect(result.limit).toBe(30);
    expect(result.offset).toBe(5);
  });

  it('should reject limit below min', () => {
    expect(() => ConversationQuerySchema.parse({
      limit: 0,
    })).toThrow();
  });

  it('should reject limit above max', () => {
    expect(() => ConversationQuerySchema.parse({
      limit: 101,
    })).toThrow();
  });

  it('should reject negative offset', () => {
    expect(() => ConversationQuerySchema.parse({
      offset: -1,
    })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  describe('ChatMessageInput', () => {
    it('should match schema output', () => {
      const input: ChatMessageInput = {
        message: 'Hello',
        conversationId: 'conv-123',
        ackToken: 'token-abc',
        context: {
          timezone: 'UTC',
          locale: 'en',
        },
      };
      
      expect(input.message).toBe('Hello');
    });
  });

  describe('ParseCommandInput', () => {
    it('should match schema output', () => {
      const input: ParseCommandInput = {
        command: '/help',
        source: 'ui_button',
        conversationId: 'conv-123',
      };
      
      expect(input.command).toBe('/help');
    });
  });

  describe('UpdateConversationInput', () => {
    it('should match schema output', () => {
      const input: UpdateConversationInput = {
        title: 'Title',
        tags: ['tag1'],
      };
      
      expect(input.title).toBe('Title');
    });
  });

  describe('ConversationQueryInput', () => {
    it('should match schema output', () => {
      const input: ConversationQueryInput = {
        limit: 20,
        offset: 0,
      };
      
      expect(input.limit).toBe(20);
    });
  });
});
