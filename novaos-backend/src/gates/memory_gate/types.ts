// ═══════════════════════════════════════════════════════════════════════════════
// MEMORY GATE — Types
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// MEMORY RECORD
// ─────────────────────────────────────────────────────────────────────────────────

export interface MemoryRecord {
  id: string;
  userId: string;
  /** The original user message */
  userMessage: string;
  /** Nova's response (post-constitution check) */
  generatedResponse: string;
  /** How memory was detected */
  source: 'regex' | 'llm';
  /** When memory was created */
  timestamp: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GATE OUTPUT
// ─────────────────────────────────────────────────────────────────────────────────

export interface MemoryGateOutput {
  /** Pass through response text */
  text: string;
  /** Was memory intent detected? */
  memoryDetected: boolean;
  /** Was memory successfully stored? */
  memoryStored: boolean;
  /** The stored memory record (if any) */
  memoryRecord?: MemoryRecord;
  /** Why gate was skipped (if skipped) */
  skipReason?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GATE CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

export interface MemoryGateConfig {
  /** Force skip memory detection */
  forceSkip?: boolean;
  /** Force run memory detection (bypass router) */
  forceRun?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LLM CHECK RESULT
// ─────────────────────────────────────────────────────────────────────────────────

export interface MemoryCheckResult {
  isMemoryRequest: boolean;
}
