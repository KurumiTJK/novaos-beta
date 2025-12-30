// ═══════════════════════════════════════════════════════════════════════════════
// CAPABILITY GATE — Registry
// Manages registered capabilities
// ═══════════════════════════════════════════════════════════════════════════════

import type { Capability, CapabilityType, SelectorInput, EvidenceItem } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CAPABILITY REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Registry for capability plugins.
 */
export class CapabilityRegistry {
  private readonly capabilities: Map<CapabilityType, Capability> = new Map();

  /**
   * Register a capability.
   */
  register(capability: Capability): void {
    this.capabilities.set(capability.name, capability);
  }

  /**
   * Unregister a capability.
   */
  unregister(name: CapabilityType): boolean {
    return this.capabilities.delete(name);
  }

  /**
   * Get a capability by name.
   */
  get(name: CapabilityType): Capability | undefined {
    return this.capabilities.get(name);
  }

  /**
   * Get all registered capabilities.
   */
  getAll(): Capability[] {
    return Array.from(this.capabilities.values());
  }

  /**
   * Get capability menu for LLM selector.
   * Returns array of { name, description } for prompt building.
   */
  getMenu(): Array<{ name: string; description: string }> {
    return this.getAll().map(cap => ({
      name: cap.name,
      description: cap.description,
    }));
  }

  /**
   * Execute selected capabilities in parallel.
   */
  async executeAll(
    names: CapabilityType[],
    input: SelectorInput
  ): Promise<{ evidenceItems: EvidenceItem[]; errors: string[] }> {
    const evidenceItems: EvidenceItem[] = [];
    const errors: string[] = [];

    // Execute in parallel
    const results = await Promise.allSettled(
      names.map(async name => {
        const capability = this.capabilities.get(name);
        if (!capability) {
          throw new Error(`Capability not found: ${name}`);
        }
        return { name, result: await capability.execute(input) };
      })
    );

    // Process results
    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.result) {
          evidenceItems.push(result.value.result);
        }
      } else {
        errors.push(result.reason?.message ?? String(result.reason));
      }
    }

    return { evidenceItems, errors };
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
 * Create a new capability registry (for testing).
 */
export function createCapabilityRegistry(): CapabilityRegistry {
  return new CapabilityRegistry();
}
