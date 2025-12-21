// ═══════════════════════════════════════════════════════════════════════════════
// KNOWN SOURCES REGISTRY — Pre-Verified Official Documentation
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════
//
// The known sources registry contains pre-verified, trusted sources:
//   - Official documentation sites
//   - Authoritative tutorial platforms
//   - Verified community resources
//
// Each source has:
//   - Authority level (official, authoritative, community, user)
//   - Health status (last check, availability)
//   - HMAC signature for integrity
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Result } from '../../../../types/result.js';
import { ok, err } from '../../../../types/result.js';
import type { TopicId, CanonicalURL, ResourceProvider, HMACSignature } from '../types.js';
import { createTopicId, createCanonicalURL, createHMACSignature } from '../types.js';
import { signData, verifyEnvelope, type SignedEnvelope, type IntegrityConfig } from './integrity.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Authority level of a known source.
 */
export type AuthorityLevel =
  | 'official'       // Official documentation (e.g., docs.rust-lang.org)
  | 'authoritative'  // Widely recognized authority (e.g., MDN)
  | 'community'      // Trusted community resource (e.g., Rust by Example)
  | 'curated';       // Manually curated/reviewed

/**
 * Health status of a known source.
 */
export type HealthStatus =
  | 'healthy'        // Recently verified accessible
  | 'degraded'       // Accessible but slow or with issues
  | 'unhealthy'      // Not accessible
  | 'unknown';       // Not yet checked

/**
 * Known source definition.
 */
export interface KnownSource {
  /** Unique source ID */
  readonly id: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Base URL for this source */
  readonly baseUrl: CanonicalURL;
  
  /** URL pattern for matching (prefix match) */
  readonly urlPattern: string;
  
  /** Provider type */
  readonly provider: ResourceProvider;
  
  /** Authority level */
  readonly authority: AuthorityLevel;
  
  /** Topics covered by this source */
  readonly topics: readonly TopicId[];
  
  /** Primary language */
  readonly language: string;
  
  /** Description */
  readonly description: string;
  
  /** Whether this source is active */
  readonly active: boolean;
  
  /** Health check configuration */
  readonly healthCheck: {
    readonly url: string;
    readonly intervalSeconds: number;
    readonly timeoutSeconds: number;
  };
  
  /** Current health status */
  readonly health: {
    readonly status: HealthStatus;
    readonly lastCheck?: Date;
    readonly lastSuccess?: Date;
    readonly consecutiveFailures: number;
    readonly responseTimeMs?: number;
  };
  
  /** Metadata */
  readonly metadata: {
    readonly createdAt: Date;
    readonly updatedAt: Date;
    readonly version: number;
  };
}

/**
 * Signed known source (with HMAC).
 */
export type SignedKnownSource = SignedEnvelope<KnownSource>;

/**
 * Known source match result.
 */
export interface KnownSourceMatch {
  readonly source: KnownSource;
  readonly matchType: 'exact' | 'prefix' | 'domain';
  readonly confidence: number;
}

/**
 * Registry error codes.
 */
export type KnownSourceErrorCode =
  | 'SOURCE_NOT_FOUND'
  | 'SOURCE_EXISTS'
  | 'INVALID_SOURCE'
  | 'INTEGRITY_FAILED'
  | 'STORAGE_ERROR';

/**
 * Registry error.
 */
export interface KnownSourceError {
  readonly code: KnownSourceErrorCode;
  readonly message: string;
  readonly sourceId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// BUILT-IN SOURCES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Built-in known sources.
 */
const BUILTIN_SOURCES: readonly Omit<KnownSource, 'health' | 'metadata'>[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // Official Rust Documentation
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'rust-book',
    name: 'The Rust Programming Language',
    baseUrl: createCanonicalURL('https://doc.rust-lang.org/book/'),
    urlPattern: 'https://doc.rust-lang.org/book/',
    provider: 'rust_docs',
    authority: 'official',
    topics: [createTopicId('language:rust')],
    language: 'en',
    description: 'The official Rust book, comprehensive guide to learning Rust',
    active: true,
    healthCheck: {
      url: 'https://doc.rust-lang.org/book/',
      intervalSeconds: 3600,
      timeoutSeconds: 10,
    },
  },
  {
    id: 'rust-by-example',
    name: 'Rust by Example',
    baseUrl: createCanonicalURL('https://doc.rust-lang.org/rust-by-example/'),
    urlPattern: 'https://doc.rust-lang.org/rust-by-example/',
    provider: 'rust_docs',
    authority: 'official',
    topics: [createTopicId('language:rust')],
    language: 'en',
    description: 'Learn Rust with examples',
    active: true,
    healthCheck: {
      url: 'https://doc.rust-lang.org/rust-by-example/',
      intervalSeconds: 3600,
      timeoutSeconds: 10,
    },
  },
  {
    id: 'rust-std',
    name: 'Rust Standard Library',
    baseUrl: createCanonicalURL('https://doc.rust-lang.org/std/'),
    urlPattern: 'https://doc.rust-lang.org/std/',
    provider: 'rust_docs',
    authority: 'official',
    topics: [createTopicId('language:rust')],
    language: 'en',
    description: 'Rust standard library API documentation',
    active: true,
    healthCheck: {
      url: 'https://doc.rust-lang.org/std/',
      intervalSeconds: 3600,
      timeoutSeconds: 10,
    },
  },
  {
    id: 'docs-rs',
    name: 'docs.rs',
    baseUrl: createCanonicalURL('https://docs.rs/'),
    urlPattern: 'https://docs.rs/',
    provider: 'rust_docs',
    authority: 'official',
    topics: [createTopicId('language:rust')],
    language: 'en',
    description: 'Documentation for Rust crates',
    active: true,
    healthCheck: {
      url: 'https://docs.rs/',
      intervalSeconds: 3600,
      timeoutSeconds: 10,
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // TypeScript/JavaScript Documentation
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'typescript-docs',
    name: 'TypeScript Documentation',
    baseUrl: createCanonicalURL('https://www.typescriptlang.org/docs/'),
    urlPattern: 'https://www.typescriptlang.org/docs/',
    provider: 'official_docs',
    authority: 'official',
    topics: [createTopicId('language:typescript')],
    language: 'en',
    description: 'Official TypeScript documentation',
    active: true,
    healthCheck: {
      url: 'https://www.typescriptlang.org/docs/',
      intervalSeconds: 3600,
      timeoutSeconds: 10,
    },
  },
  {
    id: 'mdn-web-docs',
    name: 'MDN Web Docs',
    baseUrl: createCanonicalURL('https://developer.mozilla.org/'),
    urlPattern: 'https://developer.mozilla.org/',
    provider: 'mdn',
    authority: 'authoritative',
    topics: [
      createTopicId('language:javascript'),
      createTopicId('language:typescript'),
    ],
    language: 'en',
    description: 'Comprehensive web development documentation',
    active: true,
    healthCheck: {
      url: 'https://developer.mozilla.org/en-US/',
      intervalSeconds: 3600,
      timeoutSeconds: 10,
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Python Documentation
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'python-docs',
    name: 'Python Documentation',
    baseUrl: createCanonicalURL('https://docs.python.org/3/'),
    urlPattern: 'https://docs.python.org/',
    provider: 'python_docs',
    authority: 'official',
    topics: [createTopicId('language:python')],
    language: 'en',
    description: 'Official Python documentation',
    active: true,
    healthCheck: {
      url: 'https://docs.python.org/3/',
      intervalSeconds: 3600,
      timeoutSeconds: 10,
    },
  },
  {
    id: 'real-python',
    name: 'Real Python',
    baseUrl: createCanonicalURL('https://realpython.com/'),
    urlPattern: 'https://realpython.com/',
    provider: 'official_docs',
    authority: 'authoritative',
    topics: [createTopicId('language:python')],
    language: 'en',
    description: 'Python tutorials and articles',
    active: true,
    healthCheck: {
      url: 'https://realpython.com/',
      intervalSeconds: 3600,
      timeoutSeconds: 10,
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Video Platforms (Curated Channels)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'youtube-traversy',
    name: 'Traversy Media',
    baseUrl: createCanonicalURL('https://www.youtube.com/@TraversyMedia'),
    urlPattern: 'https://www.youtube.com/@TraversyMedia',
    provider: 'youtube',
    authority: 'community',
    topics: [
      createTopicId('language:javascript'),
      createTopicId('language:typescript'),
    ],
    language: 'en',
    description: 'Web development tutorials',
    active: true,
    healthCheck: {
      url: 'https://www.youtube.com/@TraversyMedia',
      intervalSeconds: 86400,
      timeoutSeconds: 15,
    },
  },
  {
    id: 'youtube-fireship',
    name: 'Fireship',
    baseUrl: createCanonicalURL('https://www.youtube.com/@Fireship'),
    urlPattern: 'https://www.youtube.com/@Fireship',
    provider: 'youtube',
    authority: 'community',
    topics: [
      createTopicId('language:javascript'),
      createTopicId('language:typescript'),
    ],
    language: 'en',
    description: 'Quick, informative development content',
    active: true,
    healthCheck: {
      url: 'https://www.youtube.com/@Fireship',
      intervalSeconds: 86400,
      timeoutSeconds: 15,
    },
  },
  {
    id: 'youtube-lets-get-rusty',
    name: "Let's Get Rusty",
    baseUrl: createCanonicalURL('https://www.youtube.com/@letsgetrusty'),
    urlPattern: 'https://www.youtube.com/@letsgetrusty',
    provider: 'youtube',
    authority: 'community',
    topics: [createTopicId('language:rust')],
    language: 'en',
    description: 'Rust programming tutorials',
    active: true,
    healthCheck: {
      url: 'https://www.youtube.com/@letsgetrusty',
      intervalSeconds: 86400,
      timeoutSeconds: 15,
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // GitHub Learning Resources
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'github-rust-learning',
    name: 'Rust Learning Resources',
    baseUrl: createCanonicalURL('https://github.com/ctjhoa/rust-learning'),
    urlPattern: 'https://github.com/ctjhoa/rust-learning',
    provider: 'github',
    authority: 'community',
    topics: [createTopicId('language:rust')],
    language: 'en',
    description: 'Curated list of Rust learning resources',
    active: true,
    healthCheck: {
      url: 'https://github.com/ctjhoa/rust-learning',
      intervalSeconds: 86400,
      timeoutSeconds: 15,
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// KNOWN SOURCES REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Registry for known sources.
 */
export class KnownSourcesRegistry {
  private readonly sources: Map<string, KnownSource>;
  private readonly urlIndex: Map<string, string[]>; // domain -> source IDs
  private readonly topicIndex: Map<TopicId, string[]>;
  private readonly integrityConfig: IntegrityConfig;
  
  constructor(config?: IntegrityConfig) {
    this.sources = new Map();
    this.urlIndex = new Map();
    this.topicIndex = new Map();
    this.integrityConfig = config ?? { allowDevKey: true };
  }
  
  /**
   * Initialize with built-in sources.
   */
  async initialize(): Promise<void> {
    const now = new Date();
    
    for (const sourceData of BUILTIN_SOURCES) {
      const source: KnownSource = {
        ...sourceData,
        health: {
          status: 'unknown',
          consecutiveFailures: 0,
        },
        metadata: {
          createdAt: now,
          updatedAt: now,
          version: 1,
        },
      };
      
      this.addSource(source);
    }
  }
  
  /**
   * Add a source to the registry.
   */
  private addSource(source: KnownSource): void {
    this.sources.set(source.id, source);
    
    // Index by domain
    try {
      const url = new URL(source.baseUrl);
      const domain = url.hostname;
      const existing = this.urlIndex.get(domain) ?? [];
      if (!existing.includes(source.id)) {
        existing.push(source.id);
        this.urlIndex.set(domain, existing);
      }
    } catch {
      // Invalid URL, skip indexing
    }
    
    // Index by topic
    for (const topicId of source.topics) {
      const existing = this.topicIndex.get(topicId) ?? [];
      if (!existing.includes(source.id)) {
        existing.push(source.id);
        this.topicIndex.set(topicId, existing);
      }
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Query Methods
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get a source by ID.
   */
  get(sourceId: string): KnownSource | undefined {
    return this.sources.get(sourceId);
  }
  
  /**
   * Get all sources.
   */
  getAll(): KnownSource[] {
    return Array.from(this.sources.values());
  }
  
  /**
   * Get active sources.
   */
  getActive(): KnownSource[] {
    return this.getAll().filter(s => s.active);
  }
  
  /**
   * Get healthy sources.
   */
  getHealthy(): KnownSource[] {
    return this.getActive().filter(
      s => s.health.status === 'healthy' || s.health.status === 'unknown'
    );
  }
  
  /**
   * Get sources by authority level.
   */
  getByAuthority(authority: AuthorityLevel): KnownSource[] {
    return this.getActive().filter(s => s.authority === authority);
  }
  
  /**
   * Get sources for a topic.
   */
  getByTopic(topicId: TopicId): KnownSource[] {
    const sourceIds = this.topicIndex.get(topicId) ?? [];
    return sourceIds
      .map(id => this.sources.get(id))
      .filter((s): s is KnownSource => s !== undefined && s.active);
  }
  
  /**
   * Match a URL against known sources.
   */
  matchUrl(url: string): KnownSourceMatch | null {
    try {
      const parsed = new URL(url);
      const domain = parsed.hostname;
      const fullUrl = parsed.href;
      
      // Get candidate sources for this domain
      const sourceIds = this.urlIndex.get(domain) ?? [];
      
      for (const sourceId of sourceIds) {
        const source = this.sources.get(sourceId);
        if (!source || !source.active) continue;
        
        // Check exact URL pattern match
        if (fullUrl.startsWith(source.urlPattern)) {
          return {
            source,
            matchType: fullUrl === source.urlPattern ? 'exact' : 'prefix',
            confidence: 1.0,
          };
        }
      }
      
      // Check for domain-only match
      for (const sourceId of sourceIds) {
        const source = this.sources.get(sourceId);
        if (!source || !source.active) continue;
        
        return {
          source,
          matchType: 'domain',
          confidence: 0.7,
        };
      }
      
      return null;
    } catch {
      return null;
    }
  }
  
  /**
   * Check if a URL is from a known source.
   */
  isKnownSource(url: string): boolean {
    return this.matchUrl(url) !== null;
  }
  
  /**
   * Get authority level for a URL.
   */
  getAuthorityForUrl(url: string): AuthorityLevel | null {
    const match = this.matchUrl(url);
    return match?.source.authority ?? null;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Health Updates
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Update health status for a source.
   */
  updateHealth(
    sourceId: string,
    status: HealthStatus,
    responseTimeMs?: number
  ): void {
    const source = this.sources.get(sourceId);
    if (!source) return;
    
    const now = new Date();
    const wasHealthy = source.health.status === 'healthy';
    const isHealthy = status === 'healthy';
    
    const updatedSource: KnownSource = {
      ...source,
      health: {
        status,
        lastCheck: now,
        lastSuccess: isHealthy ? now : source.health.lastSuccess,
        consecutiveFailures: isHealthy ? 0 : source.health.consecutiveFailures + 1,
        responseTimeMs,
      },
      metadata: {
        ...source.metadata,
        updatedAt: now,
      },
    };
    
    this.sources.set(sourceId, updatedSource);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Signed Sources (Integrity)
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Sign a source for storage.
   */
  signSource(source: KnownSource): Result<SignedKnownSource, KnownSourceError> {
    const result = signData(source, this.integrityConfig);
    if (!result.ok) {
      return err({
        code: 'INTEGRITY_FAILED',
        message: result.error.message,
        sourceId: source.id,
      });
    }
    return ok(result.value);
  }
  
  /**
   * Verify and load a signed source.
   */
  verifyAndLoadSource(signed: SignedKnownSource): Result<KnownSource, KnownSourceError> {
    const result = verifyEnvelope(signed, this.integrityConfig);
    if (!result.ok) {
      return err({
        code: 'INTEGRITY_FAILED',
        message: result.error.message,
      });
    }
    
    const source = result.value;
    this.addSource(source);
    return ok(source);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Statistics
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get registry statistics.
   */
  getStats(): {
    total: number;
    active: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    byAuthority: Record<AuthorityLevel, number>;
    byProvider: Record<string, number>;
  } {
    const sources = this.getAll();
    
    const byAuthority: Record<AuthorityLevel, number> = {
      official: 0,
      authoritative: 0,
      community: 0,
      curated: 0,
    };
    
    const byProvider: Record<string, number> = {};
    
    let active = 0;
    let healthy = 0;
    let degraded = 0;
    let unhealthy = 0;
    
    for (const source of sources) {
      if (source.active) active++;
      
      switch (source.health.status) {
        case 'healthy':
        case 'unknown':
          healthy++;
          break;
        case 'degraded':
          degraded++;
          break;
        case 'unhealthy':
          unhealthy++;
          break;
      }
      
      byAuthority[source.authority]++;
      byProvider[source.provider] = (byProvider[source.provider] ?? 0) + 1;
    }
    
    return {
      total: sources.length,
      active,
      healthy,
      degraded,
      unhealthy,
      byAuthority,
      byProvider,
    };
  }
  
  /**
   * Check if registry has sources.
   */
  get isEmpty(): boolean {
    return this.sources.size === 0;
  }
  
  /**
   * Get source count.
   */
  get count(): number {
    return this.sources.size;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let registryInstance: KnownSourcesRegistry | null = null;

/**
 * Get the known sources registry singleton.
 */
export function getKnownSourcesRegistry(): KnownSourcesRegistry {
  if (!registryInstance) {
    registryInstance = new KnownSourcesRegistry();
  }
  return registryInstance;
}

/**
 * Initialize the known sources registry.
 */
export async function initKnownSourcesRegistry(
  config?: IntegrityConfig
): Promise<KnownSourcesRegistry> {
  registryInstance = new KnownSourcesRegistry(config);
  await registryInstance.initialize();
  return registryInstance;
}

/**
 * Reset the known sources registry (for testing).
 */
export function resetKnownSourcesRegistry(): void {
  registryInstance = null;
}
