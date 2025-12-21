// ═══════════════════════════════════════════════════════════════════════════════
// FALLBACK VERSIONING — Pattern Version Tracking
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════
//
// Tracks versions of fallback patterns for:
//   - Cache invalidation
//   - A/B testing
//   - Rollback capability
//   - Analytics
//
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// VERSION INFO
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Current version of fallback patterns.
 */
export const PATTERNS_VERSION = {
  /** Major version - breaking changes */
  major: 1,
  
  /** Minor version - new patterns added */
  minor: 0,
  
  /** Patch version - bug fixes, text changes */
  patch: 0,
  
  /** Build timestamp */
  buildDate: '2024-01-01',
  
  /** Version string */
  get version(): string {
    return `${this.major}.${this.minor}.${this.patch}`;
  },
  
  /** Full version with build date */
  get fullVersion(): string {
    return `${this.version} (${this.buildDate})`;
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// PATTERN METADATA
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Metadata for a pattern set.
 */
export interface PatternSetMetadata {
  /** Pattern set name */
  readonly name: string;
  
  /** Version */
  readonly version: string;
  
  /** Number of patterns */
  readonly count: number;
  
  /** Last updated */
  readonly lastUpdated: string;
  
  /** Author/source */
  readonly author: string;
  
  /** Description */
  readonly description: string;
}

/**
 * Metadata for all pattern sets.
 */
export const PATTERN_METADATA: Readonly<Record<string, PatternSetMetadata>> = {
  exercises: {
    name: 'Exercise Templates',
    version: '1.0.0',
    count: 18,
    lastUpdated: '2024-01-01',
    author: 'NovaOS',
    description: 'Pre-written exercise templates for practice, quiz, project, reflection, and discussion activities.',
  },
  objectives: {
    name: 'Objective Templates',
    version: '1.0.0',
    count: 7,
    lastUpdated: '2024-01-01',
    author: 'NovaOS',
    description: 'Learning objective templates for curriculum days.',
  },
  dayStructures: {
    name: 'Day Structure Templates',
    version: '1.0.0',
    count: 6,
    lastUpdated: '2024-01-01',
    author: 'NovaOS',
    description: 'Pre-defined day structures for different curriculum phases.',
  },
  selfGuided: {
    name: 'Self-Guided Notes',
    version: '1.0.0',
    count: 4,
    lastUpdated: '2024-01-01',
    author: 'NovaOS',
    description: 'Guidance notes for self-directed learning when LLM is unavailable.',
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// VERSION CHECKING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Parse a version string into components.
 */
export function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  
  return {
    major: parseInt(match[1]!, 10),
    minor: parseInt(match[2]!, 10),
    patch: parseInt(match[3]!, 10),
  };
}

/**
 * Compare two version strings.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  
  if (!va || !vb) return 0;
  
  if (va.major !== vb.major) {
    return va.major < vb.major ? -1 : 1;
  }
  
  if (va.minor !== vb.minor) {
    return va.minor < vb.minor ? -1 : 1;
  }
  
  if (va.patch !== vb.patch) {
    return va.patch < vb.patch ? -1 : 1;
  }
  
  return 0;
}

/**
 * Check if a version is compatible (same major version).
 */
export function isCompatible(version: string, requiredVersion: string): boolean {
  const v = parseVersion(version);
  const rv = parseVersion(requiredVersion);
  
  if (!v || !rv) return false;
  
  return v.major === rv.major;
}

/**
 * Check if patterns need update.
 */
export function needsUpdate(currentVersion: string, latestVersion: string): boolean {
  return compareVersions(currentVersion, latestVersion) < 0;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VERSION HISTORY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Version history entry.
 */
export interface VersionHistoryEntry {
  /** Version */
  readonly version: string;
  
  /** Release date */
  readonly date: string;
  
  /** Changes */
  readonly changes: readonly string[];
}

/**
 * Version history for patterns.
 */
export const VERSION_HISTORY: readonly VersionHistoryEntry[] = [
  {
    version: '1.0.0',
    date: '2024-01-01',
    changes: [
      'Initial release',
      '18 exercise templates (practice, quiz, project, reflection, discussion)',
      '7 objective templates',
      '6 day structure templates',
      'Self-guided learning notes',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// CACHE KEY GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate a cache key that includes version.
 */
export function generateCacheKey(prefix: string, ...parts: string[]): string {
  const version = PATTERNS_VERSION.version;
  return `${prefix}:v${version}:${parts.join(':')}`;
}

/**
 * Check if a cache key is for current version.
 */
export function isCacheKeyCurrent(key: string): boolean {
  const versionPattern = `:v${PATTERNS_VERSION.version}:`;
  return key.includes(versionPattern);
}

// ─────────────────────────────────────────────────────────────────────────────────
// FALLBACK USAGE TRACKING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Reason for using fallback patterns.
 */
export type FallbackReason =
  | 'llm_unavailable'      // LLM service not reachable
  | 'circuit_open'         // Circuit breaker is open
  | 'timeout'              // LLM request timed out
  | 'validation_failed'    // LLM response failed validation
  | 'rate_limited'         // Rate limit exceeded
  | 'user_preference';     // User explicitly requested fallback

/**
 * Fallback usage record.
 */
export interface FallbackUsageRecord {
  /** Timestamp */
  readonly timestamp: Date;
  
  /** Patterns version used */
  readonly patternsVersion: string;
  
  /** Reason for fallback */
  readonly reason: FallbackReason;
  
  /** Number of days generated */
  readonly daysGenerated: number;
  
  /** User ID (if available) */
  readonly userId?: string;
}

/**
 * Create a fallback usage record.
 */
export function createFallbackUsageRecord(
  reason: FallbackReason,
  daysGenerated: number,
  userId?: string
): FallbackUsageRecord {
  return {
    timestamp: new Date(),
    patternsVersion: PATTERNS_VERSION.version,
    reason,
    daysGenerated,
    userId,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  PATTERNS_VERSION as default,
};
