// ═══════════════════════════════════════════════════════════════════════════════
// IDEMPOTENCY MIDDLEWARE — Prevent duplicate mutations
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from 'express';
import type { KeyValueStore } from '../storage/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface IdempotencyConfig {
  /** TTL for cached responses in seconds */
  ttlSeconds: number;
  /** Header name for idempotency key */
  headerName: string;
  /** HTTP methods to apply idempotency to */
  methods: string[];
}

const DEFAULT_CONFIG: IdempotencyConfig = {
  ttlSeconds: 24 * 60 * 60, // 24 hours
  headerName: 'idempotency-key',
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
};

let config: IdempotencyConfig = { ...DEFAULT_CONFIG };
let store: KeyValueStore | null = null;

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Initialize the idempotency store.
 * Must be called before using the idempotency middleware.
 */
export function initIdempotencyStore(
  kvStore: KeyValueStore,
  customConfig?: Partial<IdempotencyConfig>
): void {
  store = kvStore;
  if (customConfig) {
    config = { ...DEFAULT_CONFIG, ...customConfig };
  }
  console.log('[SECURITY] Idempotency middleware initialized', {
    ttl: `${config.ttlSeconds}s`,
    header: config.headerName,
    methods: config.methods.join(', '),
  });
}

/**
 * Get the current idempotency configuration.
 */
export function getIdempotencyConfig(): IdempotencyConfig {
  return { ...config };
}

// ─────────────────────────────────────────────────────────────────────────────────
// KEY GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

function getKey(userId: string, idempotencyKey: string): string {
  return `idempotency:${userId}:${idempotencyKey}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface CachedResponse {
  statusCode: number;
  body: unknown;
  headers?: Record<string, string>;
  cachedAt: number;
}

export interface IdempotencyMiddlewareOptions {
  /** Override default methods */
  methods?: string[];
  /** Skip idempotency for certain paths */
  skipPaths?: string[];
  /** Custom function to extract user ID from request */
  getUserId?: (req: Request) => string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Idempotency middleware factory.
 * 
 * Caches successful responses and replays them for duplicate requests
 * with the same idempotency key.
 * 
 * @example
 * // Apply to all routes
 * app.use(idempotency());
 * 
 * // Apply to specific route
 * router.post('/transfer', idempotency(), transferHandler);
 * 
 * // With options
 * router.post('/payments', idempotency({
 *   skipPaths: ['/payments/webhook'],
 *   getUserId: (req) => req.userId || 'anonymous',
 * }), paymentHandler);
 */
export function idempotency(options: IdempotencyMiddlewareOptions = {}) {
  const {
    methods = config.methods,
    skipPaths = [],
    getUserId = (req) => (req as any).userId ?? 'anonymous',
  } = options;

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Skip if store not initialized
    if (!store) {
      return next();
    }

    // Skip non-mutation methods
    if (!methods.includes(req.method.toUpperCase())) {
      return next();
    }

    // Skip certain paths
    if (skipPaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    // Get idempotency key from header (case-insensitive)
    const idempotencyKey = req.headers[config.headerName] as string
      ?? req.headers[config.headerName.toLowerCase()] as string;
    
    // No key provided - proceed without idempotency
    if (!idempotencyKey) {
      return next();
    }

    // Validate key format (basic sanity check)
    if (idempotencyKey.length > 256 || !/^[\w\-:.]+$/.test(idempotencyKey)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Invalid idempotency key format. Use alphanumeric characters, dashes, underscores, colons, or dots.',
        },
      });
      return;
    }

    const userId = getUserId(req);
    const cacheKey = getKey(userId, idempotencyKey);

    // Check for cached response
    try {
      const cached = await store.get(cacheKey);
      
      if (cached) {
        const parsedCache: CachedResponse = JSON.parse(cached);
        
        // Set replay headers
        res.set('X-Idempotent-Replay', 'true');
        res.set('X-Idempotent-Cached-At', new Date(parsedCache.cachedAt).toISOString());
        
        // Replay cached headers (excluding problematic ones)
        if (parsedCache.headers) {
          for (const [key, value] of Object.entries(parsedCache.headers)) {
            const lowerKey = key.toLowerCase();
            if (!['content-length', 'transfer-encoding', 'connection'].includes(lowerKey)) {
              res.set(key, value);
            }
          }
        }
        
        // Replay cached response
        res.status(parsedCache.statusCode).json(parsedCache.body);
        return;
      }
    } catch (error) {
      // Cache read error - proceed without idempotency
      console.error('[IDEMPOTENCY] Cache read error:', error);
    }

    // Store original json method
    const originalJson = res.json.bind(res);
    
    // Intercept response to cache it
    res.json = function(body: unknown): Response {
      // Only cache successful responses (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const toCache: CachedResponse = {
          statusCode: res.statusCode,
          body,
          cachedAt: Date.now(),
        };

        // Cache asynchronously (don't block response)
        store!.set(cacheKey, JSON.stringify(toCache), config.ttlSeconds)
          .catch(err => console.error('[IDEMPOTENCY] Cache write error:', err));
      }

      return originalJson(body);
    };

    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Manually invalidate a cached idempotency response.
 * 
 * @param userId - The user ID
 * @param idempotencyKey - The idempotency key to invalidate
 * @returns true if the key was deleted, false otherwise
 */
export async function invalidateIdempotencyKey(
  userId: string,
  idempotencyKey: string
): Promise<boolean> {
  if (!store) {
    return false;
  }
  
  const cacheKey = getKey(userId, idempotencyKey);
  return store.delete(cacheKey);
}

/**
 * Check if an idempotency key has a cached response.
 * 
 * @param userId - The user ID
 * @param idempotencyKey - The idempotency key to check
 * @returns true if a cached response exists, false otherwise
 */
export async function hasIdempotencyKey(
  userId: string,
  idempotencyKey: string
): Promise<boolean> {
  if (!store) {
    return false;
  }
  
  const cacheKey = getKey(userId, idempotencyKey);
  return store.exists(cacheKey);
}

/**
 * Get a cached idempotency response (for debugging/admin).
 * 
 * @param userId - The user ID
 * @param idempotencyKey - The idempotency key
 * @returns The cached response or null
 */
export async function getIdempotencyResponse(
  userId: string,
  idempotencyKey: string
): Promise<CachedResponse | null> {
  if (!store) {
    return null;
  }
  
  const cacheKey = getKey(userId, idempotencyKey);
  const data = await store.get(cacheKey);
  
  if (!data) {
    return null;
  }
  
  return JSON.parse(data);
}

/**
 * Generate a unique idempotency key.
 * Useful for client-side key generation.
 */
export function generateIdempotencyKey(prefix: string = 'idem'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}
