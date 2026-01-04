// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY MODULE — Working Memory Only
// ═══════════════════════════════════════════════════════════════════════════════
//
// CLEANED: Removed broken semantic memory exports (extractor, retriever, store)
//
// This module now only exports Working Memory (conversation history).
// Episodic Memory is handled by gates/memory_gate/ (in pipeline).
//
// Future: Semantic Memory (long-term facts, profile, preferences) — TODO
//
// ═══════════════════════════════════════════════════════════════════════════════

// Working Memory (conversation context)
export {
  workingMemory,
  getWorkingMemoryStore,
  WorkingMemoryStore,
} from './working_memory/index.js';

export type {
  Message,
  MessageMetadata,
  Conversation,
  ConversationMetadata,
  ConversationWithMessages,
  ContextWindow,
} from './working_memory/types.js';

export { WORKING_MEMORY_CONFIG } from './working_memory/types.js';
