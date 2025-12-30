// ═══════════════════════════════════════════════════════════════════════════════
// MODEL GATE — Barrel Export
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Gate functions
  executeModelGate,
  executeModelGateAsync,
  stitchPrompt,
  
  // Constants
  DEFAULT_PERSONALITY,
  
  // Types
  type ModelGateOutput,
  type ModelGateConfig,
  type Personality,
  type StitchedPrompt,
  type EvidenceItem,
  type CapabilityGateOutput,
} from './model-gate.js';

// Personality descriptors (edit personality_descriptor.ts to customize)
export { PERSONALITY_DESCRIPTORS } from './personality_descriptor.js';
