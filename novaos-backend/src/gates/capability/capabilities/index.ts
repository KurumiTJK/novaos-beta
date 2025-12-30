// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITIES — Register All
// ═══════════════════════════════════════════════════════════════════════════════

import { getCapabilityRegistry } from '../registry.js';

// Import all capabilities
import { stockCapability } from './stock.js';
import { weatherCapability } from './weather.js';
import { cryptoCapability } from './crypto.js';
import { fxCapability } from './fx.js';
import { timeCapability } from './time.js';
import { webSearchCapability } from './web-search.js';

// ─────────────────────────────────────────────────────────────────────────────────
// REGISTER ALL CAPABILITIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Register all built-in capabilities with the registry.
 * Call this once at application startup.
 */
export function registerAllCapabilities(): void {
  const registry = getCapabilityRegistry();

  registry.register(stockCapability);
  registry.register(weatherCapability);
  registry.register(cryptoCapability);
  registry.register(fxCapability);
  registry.register(timeCapability);
  registry.register(webSearchCapability);

  console.log('[CAPABILITIES] Registered:', registry.getAll().map(c => c.name).join(', '));
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  stockCapability,
  weatherCapability,
  cryptoCapability,
  fxCapability,
  timeCapability,
  webSearchCapability,
};
