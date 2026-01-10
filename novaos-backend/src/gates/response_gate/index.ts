// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE GATE — Barrel Export
// ═══════════════════════════════════════════════════════════════════════════════

export {
  executeResponseGateAsync,
  stitchPrompt,
  DEFAULT_PERSONALITY,
  type ResponseGateOutput,
  type ResponseGateConfig,
  type Personality,
  type StitchedPrompt,
  type CapabilityGateOutput,
} from './response-gate.js';

export { PERSONALITY_DESCRIPTORS } from './personality_descriptor.js';

// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export {
  executeStreamingResponse,
  executeFakeStreamingResponse,
  sendThinkingEvent,
  isHighRisk,
  type StreamEvent,
  type StreamExecutor,
  type StreamingResult,
  type FakeStreamOptions,
} from './streaming/index.js';
