// ═══════════════════════════════════════════════════════════════════════════════
// RETENTION POLICY MANAGER — Retention Policy Configuration
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════
//
// Manages retention policies for different data categories:
//   - Load default policies
//   - Override policies per category
//   - Query policy for a category
//
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  RetentionPolicy,
  RetentionCategory,
  RetentionAction,
} from './types.js';
import {
  DEFAULT_RETENTION_POLICIES,
  ALL_RETENTION_CATEGORIES,
} from './types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// RETENTION POLICY MANAGER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Manages retention policies for all data categories.
 */
export class RetentionPolicyManager {
  private readonly policies: Map<RetentionCategory, RetentionPolicy>;

  constructor(customPolicies?: readonly RetentionPolicy[]) {
    this.policies = new Map();

    // Load default policies
    for (const policy of DEFAULT_RETENTION_POLICIES) {
      this.policies.set(policy.category, policy);
    }

    // Apply custom overrides
    if (customPolicies) {
      for (const policy of customPolicies) {
        this.policies.set(policy.category, policy);
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // QUERY METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Get policy for a category.
   */
  getPolicy(category: RetentionCategory): RetentionPolicy | undefined {
    return this.policies.get(category);
  }

  /**
   * Get all policies.
   */
  getAllPolicies(): readonly RetentionPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Get enabled policies only.
   */
  getEnabledPolicies(): readonly RetentionPolicy[] {
    return Array.from(this.policies.values()).filter(p => p.enabled);
  }

  /**
   * Get policies by action type.
   */
  getPoliciesByAction(action: RetentionAction): readonly RetentionPolicy[] {
    return Array.from(this.policies.values()).filter(p => p.action === action);
  }

  /**
   * Check if a category has a policy.
   */
  hasPolicy(category: RetentionCategory): boolean {
    return this.policies.has(category);
  }

  /**
   * Get retention days for a category.
   */
  getRetentionDays(category: RetentionCategory): number | undefined {
    return this.policies.get(category)?.retentionDays;
  }

  /**
   * Check if a category requires archiving before deletion.
   */
  requiresArchive(category: RetentionCategory): boolean {
    const policy = this.policies.get(category);
    return policy?.archiveBeforeDelete ?? false;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // MODIFICATION METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Set or override a policy.
   */
  setPolicy(policy: RetentionPolicy): void {
    this.policies.set(policy.category, policy);
  }

  /**
   * Enable a policy.
   */
  enablePolicy(category: RetentionCategory): boolean {
    const policy = this.policies.get(category);
    if (!policy) return false;

    this.policies.set(category, { ...policy, enabled: true });
    return true;
  }

  /**
   * Disable a policy.
   */
  disablePolicy(category: RetentionCategory): boolean {
    const policy = this.policies.get(category);
    if (!policy) return false;

    this.policies.set(category, { ...policy, enabled: false });
    return true;
  }

  /**
   * Update retention days for a category.
   */
  setRetentionDays(category: RetentionCategory, days: number): boolean {
    const policy = this.policies.get(category);
    if (!policy) return false;

    this.policies.set(category, { ...policy, retentionDays: days });
    return true;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // VALIDATION
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Validate all policies are configured.
   */
  validateComplete(): { valid: boolean; missing: RetentionCategory[] } {
    const missing: RetentionCategory[] = [];

    for (const category of ALL_RETENTION_CATEGORIES) {
      if (!this.policies.has(category)) {
        missing.push(category);
      }
    }

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Get summary statistics.
   */
  getSummary(): RetentionPolicySummary {
    const policies = Array.from(this.policies.values());

    return {
      totalPolicies: policies.length,
      enabledPolicies: policies.filter(p => p.enabled).length,
      disabledPolicies: policies.filter(p => !p.enabled).length,
      byAction: {
        delete: policies.filter(p => p.action === 'delete').length,
        archive: policies.filter(p => p.action === 'archive').length,
        anonymize: policies.filter(p => p.action === 'anonymize').length,
        flag: policies.filter(p => p.action === 'flag').length,
      },
      shortestRetention: Math.min(...policies.map(p => p.retentionDays).filter(d => d > 0)),
      longestRetention: Math.max(...policies.map(p => p.retentionDays)),
    };
  }
}

/**
 * Summary of retention policies.
 */
export interface RetentionPolicySummary {
  totalPolicies: number;
  enabledPolicies: number;
  disabledPolicies: number;
  byAction: {
    delete: number;
    archive: number;
    anonymize: number;
    flag: number;
  };
  shortestRetention: number;
  longestRetention: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a RetentionPolicyManager with optional custom policies.
 */
export function createRetentionPolicyManager(
  customPolicies?: readonly RetentionPolicy[]
): RetentionPolicyManager {
  return new RetentionPolicyManager(customPolicies);
}
