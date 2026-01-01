// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Exports
// ═══════════════════════════════════════════════════════════════════════════════

// Main gate
export { 
  executeCapabilityGate, 
  executeCapabilityGateAsync,
} from './capability-gate.js';

// Types
export type {
  CapabilityGateOutput,
  CapabilityMeta,
  Capability,
  EvidenceItem,
  SelectorInput,
  SelectorResult,
} from './types.js';

// Registry
export {
  getCapabilityRegistry,
  resetCapabilityRegistry,
  CapabilityRegistry,
} from './registry.js';

// Discovery
export {
  initializeCapabilities,
  setupCapabilities,
  discoverNewCapabilities,
  loadAndRegisterCapabilities,
  addCapabilityToRegistry,
  removeCapabilityFromRegistry,
  listRegisteredCapabilities,
} from './discover.js';

// Selector
export { selectCapabilities } from './selector.js';
