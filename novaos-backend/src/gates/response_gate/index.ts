// ═══════════════════════════════════════════════════════════════════════════════
// RESPONSE GATE — Barrel Export
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Gate function
  executeResponseGateAsync,
  stitchPrompt,
  
  // Constants
  DEFAULT_PERSONALITY,
  
  // Types
  type ResponseGateOutput,
  type ResponseGateConfig,
  type Personality,
  type StitchedPrompt,
  type EvidenceItem,
  type CapabilityGateOutput,
} from './response-gate.js';

// Personality descriptors (edit personality_descriptor.ts to customize)
export { PERSONALITY_DESCRIPTORS } from './personality_descriptor.js';
