// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Registry
// Auto-discovery and registration of capabilities
// ═══════════════════════════════════════════════════════════════════════════════

import type { Capability, CapabilityMeta, EvidenceItem } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

export class CapabilityRegistry {
  private readonly capabilities: Map<string, Capability> = new Map();

  /**
   * Register a capability.
   */
  register(capability: Capability): void {
    this.capabilities.set(capability.name, capability);
  }

  /**
   * Unregister a capability.
   */
  unregister(name: string): boolean {
    return this.capabilities.delete(name);
  }

  /**
   * Get a capability by name.
   */
  get(name: string): Capability | undefined {
    return this.capabilities.get(name);
  }

  /**
   * Get all registered capabilities.
   */
  getAll(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Get all capability names.
   */
  getNames(): string[] {
    return Array.from(this.capabilities.keys());
  }

  /**
   * Get capability menu for LLM selector.
   */
  getMenu(): Array<{ name: string; description: string }> {
    return this.getAll().map(cap => ({
      name: cap.name,
      description: cap.description,
    }));
  }

  /**
   * Check if a capability exists.
   */
  has(name: string): boolean {
    return this.capabilities.has(name);
  }

  /**
   * Get count of registered capabilities.
   */
  get size(): number {
    return this.capabilities.size;
  }

  /**
   * Execute selected capabilities in parallel.
   */
  async executeAll(
    names: string[],
    userMessage: string
  ): Promise<{ evidenceItems: EvidenceItem[]; errors: string[] }> {
    const evidenceItems: EvidenceItem[] = [];
    const errors: string[] = [];

    // Filter to only registered capabilities
    const validNames = names.filter(name => this.capabilities.has(name));

    if (validNames.length === 0) {
      return { evidenceItems, errors };
    }

    // Execute in parallel
    const results = await Promise.allSettled(
      validNames.map(async name => {
        const capability = this.capabilities.get(name)!;
        const result = await capability.execute(userMessage);
        return { name, result };
      })
    );

    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.result) {
          evidenceItems.push(result.value.result);
        }
      } else {
        const errorMsg = result.reason?.message ?? String(result.reason);
        errors.push(errorMsg);
        console.error(`[CAPABILITY] error: ${errorMsg}`);
      }
    }

    return { evidenceItems, errors };
  }

  /**
   * Clear all capabilities (for testing).
   */
  clear(): void {
    this.capabilities.clear();
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────────

let registryInstance: CapabilityRegistry | null = null;

/**
 * Get the singleton capability registry.
 */
export function getCapabilityRegistry(): CapabilityRegistry {
  if (!registryInstance) {
    registryInstance = new CapabilityRegistry();
  }
  return registryInstance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetCapabilityRegistry(): void {
  registryInstance = null;
}
