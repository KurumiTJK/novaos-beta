// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY GATE — Store
// Storage for user memories using KeyValueStore interface
// ═══════════════════════════════════════════════════════════════════════════════

import type { KeyValueStore } from '../../storage/types.js';
import type { MemoryRecord } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// REDIS KEY STRUCTURE
// ─────────────────────────────────────────────────────────────────────────────────
// 
// memory:{userId}:{memoryId}     → JSON string of MemoryRecord
// memory:{userId}:_index         → Set of memoryIds for this user
//
// Example:
//   memory:user_123:mem_1234567890_abc123  → {"id":"mem_...","userId":"user_123",...}
//   memory:user_123:_index                 → ["mem_1234567890_abc123", "mem_..."]
//
// ─────────────────────────────────────────────────────────────────────────────────

const MEMORY_PREFIX = 'memory';

function memoryKey(userId: string, memoryId: string): string {
  return `${MEMORY_PREFIX}:${userId}:${memoryId}`;
}

function userMemoryIndexKey(userId: string): string {
  return `${MEMORY_PREFIX}:${userId}:_index`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MEMORY STORE CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class MemoryStore {
  private kvStore: KeyValueStore;

  constructor(store: KeyValueStore) {
    this.kvStore = store;
  }

  /**
   * Store a new memory.
   */
  async store(record: MemoryRecord): Promise<void> {
    const key = memoryKey(record.userId, record.id);
    
    // Store the record as JSON
    await this.kvStore.set(key, JSON.stringify(record));
    
    // Add to user's memory index
    const indexKey = userMemoryIndexKey(record.userId);
    await this.kvStore.sadd(indexKey, record.id);
    
    console.log(`[MEMORY] Stored: "${record.userMessage.slice(0, 50)}..." (id: ${record.id})`);
  }

  /**
   * Get all memories for a user.
   */
  async getAll(userId: string): Promise<MemoryRecord[]> {
    const indexKey = userMemoryIndexKey(userId);
    const memoryIds = await this.kvStore.smembers(indexKey);
    
    const results: MemoryRecord[] = [];
    for (const memoryId of memoryIds) {
      const record = await this.get(userId, memoryId);
      if (record) {
        results.push(record);
      }
    }
    
    // Sort by timestamp descending (newest first)
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get a specific memory by ID.
   */
  async get(userId: string, memoryId: string): Promise<MemoryRecord | null> {
    const key = memoryKey(userId, memoryId);
    const data = await this.kvStore.get(key);
    
    if (!data) return null;
    
    try {
      return JSON.parse(data) as MemoryRecord;
    } catch {
      console.error(`[MEMORY] Failed to parse memory: ${key}`);
      return null;
    }
  }

  /**
   * Delete a memory.
   */
  async delete(userId: string, memoryId: string): Promise<boolean> {
    const key = memoryKey(userId, memoryId);
    const indexKey = userMemoryIndexKey(userId);
    
    const deleted = await this.kvStore.delete(key);
    await this.kvStore.srem(indexKey, memoryId);
    
    if (deleted) {
      console.log(`[MEMORY] Deleted: ${memoryId}`);
    }
    
    return deleted;
  }

  /**
   * Get count of memories for a user.
   */
  async count(userId: string): Promise<number> {
    const indexKey = userMemoryIndexKey(userId);
    return await this.kvStore.scard(indexKey);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// STORE SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let memoryStore: MemoryStore | null = null;

/**
 * Initialize the memory store with a KeyValueStore backend.
 */
export function initializeMemoryStore(store: KeyValueStore): MemoryStore {
  memoryStore = new MemoryStore(store);
  console.log('[MEMORY] Memory store initialized');
  return memoryStore;
}

/**
 * Get the memory store instance.
 * Throws if not initialized.
 */
export function getMemoryStore(): MemoryStore {
  if (!memoryStore) {
    throw new Error('[MEMORY] Memory store not initialized. Call initializeMemoryStore first.');
  }
  return memoryStore;
}

/**
 * Check if memory store is initialized.
 */
export function isMemoryStoreInitialized(): boolean {
  return memoryStore !== null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MEMORY ID GENERATOR
// ─────────────────────────────────────────────────────────────────────────────────

export function generateMemoryId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
