// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY MODULE INDEX TESTS
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi } from 'vitest';

// Mock storage before importing
vi.mock('../../../storage/index.js', () => ({
  getStore: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    exists: vi.fn(),
    expire: vi.fn(),
    lpush: vi.fn(),
    lrange: vi.fn(),
    ltrim: vi.fn(),
    llen: vi.fn(),
  })),
}));

import * as memory from '../../../core/memory/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Memory Module Exports', () => {
  describe('Working Memory', () => {
    it('should export workingMemory service', () => {
      expect(memory.workingMemory).toBeDefined();
    });

    it('should export getWorkingMemoryStore', () => {
      expect(memory.getWorkingMemoryStore).toBeDefined();
      expect(typeof memory.getWorkingMemoryStore).toBe('function');
    });

    it('should export WorkingMemoryStore class', () => {
      expect(memory.WorkingMemoryStore).toBeDefined();
    });
  });

  describe('Types', () => {
    it('should export WORKING_MEMORY_CONFIG', () => {
      expect(memory.WORKING_MEMORY_CONFIG).toBeDefined();
      expect(memory.WORKING_MEMORY_CONFIG.MAX_CONTEXT_TOKENS).toBe(8000);
      expect(memory.WORKING_MEMORY_CONFIG.MAX_MESSAGES_IN_CONTEXT).toBe(50);
      expect(memory.WORKING_MEMORY_CONFIG.MAX_MESSAGES_STORED).toBe(1000);
    });
  });

  describe('No Broken Exports', () => {
    it('should not export semantic memory (removed)', () => {
      // These were removed as part of cleanup
      expect((memory as any).semanticStore).toBeUndefined();
      expect((memory as any).extractFacts).toBeUndefined();
      expect((memory as any).retrieveFacts).toBeUndefined();
    });

    it('should not export episodic memory (handled by gates)', () => {
      // Episodic memory is in gates/memory_gate, not here
      expect((memory as any).episodicStore).toBeUndefined();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// INTEGRATION
// ─────────────────────────────────────────────────────────────────────────────────

describe('Memory Module Integration', () => {
  it('workingMemory service should have expected methods', () => {
    const methods = [
      'getOrCreate',
      'get',
      'verifyOwnership',
      'list',
      'delete',
      'addUserMessage',
      'addAssistantMessage',
      'getMessages',
      'getFull',
      'buildContext',
      'updateTitle',
      'addTag',
    ];

    for (const method of methods) {
      expect(typeof (memory.workingMemory as any)[method]).toBe('function');
    }
  });
});
