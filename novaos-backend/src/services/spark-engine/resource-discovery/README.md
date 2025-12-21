# Phase 6: Resource Discovery

**NovaOS Spark Engine — Learning Resource Discovery System**

## Overview

Phase 6 implements a comprehensive resource discovery pipeline for finding, enriching, and verifying external learning resources. The system is designed with security-first principles including SSRF protection (Phase 5), HMAC integrity verification, and token-based matching to prevent ReDoS attacks.

## Installation

```bash
# Copy the resource-discovery directory to your project
cp -r src/services/spark-engine/resource-discovery /path/to/your/project/src/services/spark-engine/

# Install dependencies (if not already present)
npm install
```

## Prerequisites

This module depends on:
- Phase 5 SSRF Protection Layer (`src/security/ssrf/`)
- Result pattern (`src/types/result.ts`)
- Logging infrastructure (`src/observability/logging/`)
- Metrics infrastructure (`src/observability/metrics/`)

## Directory Structure

```
src/services/spark-engine/resource-discovery/
├── index.ts                 # Main module exports
├── types.ts                 # Core type definitions
├── canonicalize.ts          # URL canonicalization
├── provider-id.ts           # Provider detection & ID extraction
├── orchestrator.ts          # Main pipeline coordinator
├── taxonomy/
│   ├── index.ts
│   ├── types.ts             # Topic taxonomy types
│   ├── validator.ts         # Topic ID validation
│   ├── matcher.ts           # Token-based matching
│   └── registry.ts          # Topic registry
├── known-sources/
│   ├── index.ts
│   ├── integrity.ts         # HMAC signing/verification
│   ├── registry.ts          # Known sources registry
│   └── health-check.ts      # Source availability monitoring
├── api-keys/
│   ├── index.ts
│   └── manager.ts           # API key rotation & quotas
└── cache/
    ├── index.ts
    └── resource-cache.ts    # Multi-tier LRU cache
```

## Quick Start

```typescript
import { 
  initResourceDiscovery,
  discoverResources,
  processResourceUrl,
} from './resource-discovery';

// Initialize all components
await initResourceDiscovery();

// Discover resources for topics
const result = await discoverResources({
  topics: ['language:rust', 'language:rust:ownership'],
  maxResults: 10,
});

if (result.ok) {
  for (const resource of result.value.resources) {
    console.log(`${resource.title}`);
    console.log(`  URL: ${resource.displayUrl}`);
    console.log(`  Provider: ${resource.provider}`);
    console.log(`  Quality: ${resource.usability.score}`);
  }
}

// Process a single URL
const resource = await processResourceUrl(
  'https://doc.rust-lang.org/book/ch04-01-what-is-ownership.html'
);
```

## Configuration

### Environment Variables

```bash
# API Keys (single or multiple for rotation)
YOUTUBE_API_KEY=AIza...
YOUTUBE_API_KEY_1=AIza...
YOUTUBE_API_KEY_2=AIza...

GITHUB_TOKEN=ghp_...
GITHUB_TOKEN_1=ghp_...

# HMAC key for integrity verification
NOVA_HMAC_KEY=<base64-encoded-32-byte-key>

# Generate a new key:
# node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Orchestrator Configuration

```typescript
import { initResourceDiscoveryOrchestrator } from './resource-discovery';

initResourceDiscoveryOrchestrator({
  maxConcurrency: 5,
  enableCache: true,
  enableKnownSources: true,
  enableEnrichment: true,
  enableVerification: true,
  enrichmentTimeoutMs: 10000,
  verificationTimeoutMs: 5000,
  sources: [
    { type: 'known_source', enabled: true, priority: 1, maxResults: 20 },
    { type: 'youtube_api', enabled: true, priority: 3, maxResults: 10 },
    { type: 'github_api', enabled: true, priority: 4, maxResults: 10 },
  ],
});
```

## Components

### 1. URL Canonicalization

Normalizes URLs for deduplication:
- Removes 50+ tracking parameters (UTM, fbclid, etc.)
- Preserves content-affecting parameters
- Provider-specific normalization (youtu.be → youtube.com)

```typescript
import { canonicalizeURL, urlsAreEquivalent } from './resource-discovery';

const result = canonicalizeURL(
  'https://www.youtube.com/watch?v=ABC123&utm_source=twitter'
);
// result.canonical = 'https://youtube.com/watch?v=ABC123'

urlsAreEquivalent(
  'https://youtu.be/ABC123',
  'https://www.youtube.com/watch?v=ABC123'
); // true
```

### 2. Provider Detection

Identifies resource providers and extracts IDs:

```typescript
import { detectProvider, extractYouTubeId } from './resource-discovery';

const provider = detectProvider('https://github.com/rust-lang/rust');
// { provider: 'github', confidence: 'high' }

const ytId = extractYouTubeId('https://youtu.be/ABC123?t=120');
// { type: 'video', videoId: 'ABC123', timestamp: 120 }
```

### 3. Topic Taxonomy

Hierarchical topics with token-based matching (no regex):

```typescript
import { getTopicRegistry, validateTopicId } from './resource-discovery';

const registry = getTopicRegistry();
const matcher = registry.getMatcher();

// Match text to topics
const matches = matcher.match('Learn Rust ownership and borrowing');
// [{ topicId: 'language:rust:ownership', score: 5.5, confidence: 'high' }]

// Validate topic IDs (injection prevention)
const result = validateTopicId('language:rust');
// { ok: true, value: 'language:rust' }
```

### 4. Known Sources Registry

Pre-verified official documentation with HMAC integrity:

```typescript
import { getKnownSourcesRegistry } from './resource-discovery';

const registry = getKnownSourcesRegistry();

// Check if URL is from known source
registry.isKnownSource('https://doc.rust-lang.org/book/');
// true

// Get authority level
registry.getAuthorityForUrl('https://developer.mozilla.org/...');
// 'authoritative'
```

### 5. API Key Management

Multi-key rotation with quota tracking:

```typescript
import { getApiKey, recordApiKeyUsage } from './resource-discovery';

const result = getApiKey('youtube');
if (result.ok) {
  const { keyId, key, remainingQuota } = result.value;
  
  // Use the key...
  
  // Record usage
  recordApiKeyUsage(keyId, 100); // 100 quota units
}
```

### 6. Resource Cache

Multi-tier caching with TTL per resource stage:

```typescript
import { getResourceCache } from './resource-discovery';

const cache = getResourceCache();

// TTLs by stage:
// - candidate: 1 hour
// - enriched: 24 hours
// - verified: 7 days
// - known_source: 30 days

await cache.setEnriched(url, enrichedResource);
const cached = await cache.getEnriched(url);
```

## Resource Lifecycle

```
RawResourceCandidate → EnrichedResource → VerifiedResource
     (URL found)        (API metadata)     (Accessibility confirmed)
```

## Security Features

1. **SSRF Protection**: Uses Phase 5 SSRF-safe HTTP client
2. **HMAC Integrity**: Known sources signed with HMAC-SHA256
3. **Token-Based Matching**: No regex (prevents ReDoS)
4. **Injection Prevention**: Topic ID validation blocks SQL/command injection
5. **Key Rotation**: Multiple API keys with automatic selection

## Built-in Known Sources

| Source | Authority | Topics |
|--------|-----------|--------|
| The Rust Book | official | language:rust |
| Rust by Example | official | language:rust |
| docs.rs | official | language:rust |
| TypeScript Docs | official | language:typescript |
| MDN Web Docs | authoritative | language:javascript |
| Python Docs | official | language:python |
| Real Python | authoritative | language:python |

## Statistics

- **16 files**
- **~9,550 lines of code**
- **~322 KB total**

## Testing

```typescript
import { 
  resetResourceDiscovery,
  initResourceDiscovery,
} from './resource-discovery';

beforeEach(async () => {
  resetResourceDiscovery();
  await initResourceDiscovery();
});
```

## Next Steps

Phase 6 provides the foundation for:
- **YouTube API Client**: Fetch video metadata, channel info
- **GitHub API Client**: Repository details, README content
- **Spark Engine Integration**: Resource selection for learning goals

## License

Part of NovaOS — Anthropic Internal
