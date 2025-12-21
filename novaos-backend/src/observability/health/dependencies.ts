// ═══════════════════════════════════════════════════════════════════════════════
// DEPENDENCY HEALTH — Redis, LLM, External Service Health Checks
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════

import type { ComponentHealth } from './types.js';
import {
  createRedisHealthCheck,
  createLLMHealthCheck,
  createExternalAPIHealthCheck,
  healthy,
  degraded,
} from './checks.js';

// ─────────────────────────────────────────────────────────────────────────────────
// DEPENDENCY REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Registered dependency health checks.
 */
const dependencyChecks = new Map<string, () => Promise<ComponentHealth>>();

/**
 * Register a dependency health check.
 */
export function registerDependency(
  name: string,
  check: () => Promise<ComponentHealth>
): void {
  dependencyChecks.set(name, check);
}

/**
 * Unregister a dependency health check.
 */
export function unregisterDependency(name: string): boolean {
  return dependencyChecks.delete(name);
}

/**
 * Get all registered dependency checks.
 */
export function getDependencyChecks(): Map<string, () => Promise<ComponentHealth>> {
  return new Map(dependencyChecks);
}

/**
 * Clear all registered dependency checks.
 */
export function clearDependencyChecks(): void {
  dependencyChecks.clear();
}

// ─────────────────────────────────────────────────────────────────────────────────
// REDIS DEPENDENCY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Redis store interface for health checks.
 */
export interface RedisStoreInterface {
  isConnected: () => boolean;
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string, ttl?: number) => Promise<void>;
}

/**
 * Store getter function type.
 */
type StoreGetter = () => RedisStoreInterface | null;

let redisStoreGetter: StoreGetter | null = null;

/**
 * Configure Redis health check with store getter.
 */
export function configureRedisHealth(getStore: StoreGetter): void {
  redisStoreGetter = getStore;
  
  const check = createRedisHealthCheck({ getStore });
  registerDependency('redis', check);
}

/**
 * Get Redis health check function.
 */
export function getRedisHealthCheck(): (() => Promise<ComponentHealth>) | null {
  if (!redisStoreGetter) return null;
  return createRedisHealthCheck({ getStore: redisStoreGetter });
}

// ─────────────────────────────────────────────────────────────────────────────────
// LLM DEPENDENCIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * LLM provider configuration.
 */
export interface LLMProviderConfig {
  /** Provider name */
  name: string;
  
  /** Check if API key is configured */
  isConfigured: () => boolean;
  
  /** Optional ping function */
  ping?: () => Promise<boolean>;
}

const llmProviders = new Map<string, LLMProviderConfig>();

/**
 * Register an LLM provider for health checks.
 */
export function registerLLMProvider(config: LLMProviderConfig): void {
  llmProviders.set(config.name, config);
  
  const check = createLLMHealthCheck({
    provider: config.name,
    isAvailable: config.isConfigured,
    ping: config.ping,
  });
  
  registerDependency(`llm_${config.name}`, check);
}

/**
 * Configure OpenAI health check.
 */
export function configureOpenAIHealth(apiKey?: string): void {
  registerLLMProvider({
    name: 'openai',
    isConfigured: () => !!apiKey || !!process.env.OPENAI_API_KEY,
  });
}

/**
 * Configure Gemini health check.
 */
export function configureGeminiHealth(apiKey?: string): void {
  registerLLMProvider({
    name: 'gemini',
    isConfigured: () => !!apiKey || !!process.env.GEMINI_API_KEY,
  });
}

/**
 * Get LLM health summary.
 */
export async function checkLLMProviders(): Promise<ComponentHealth> {
  if (llmProviders.size === 0) {
    return degraded('llm', 'No LLM providers configured');
  }
  
  const configured: string[] = [];
  const notConfigured: string[] = [];
  
  for (const [name, config] of llmProviders) {
    if (config.isConfigured()) {
      configured.push(name);
    } else {
      notConfigured.push(name);
    }
  }
  
  if (configured.length === 0) {
    return degraded('llm', 'No LLM providers have API keys configured', {
      details: { providers: notConfigured },
    });
  }
  
  return healthy('llm', {
    message: `${configured.length} provider(s) configured`,
    details: { configured, notConfigured },
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXTERNAL API DEPENDENCIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * External API configuration.
 */
export interface ExternalAPIConfig {
  /** API name */
  name: string;
  
  /** Check if API is configured */
  isConfigured: () => boolean;
  
  /** Optional health check URL */
  healthUrl?: string;
}

const externalAPIs = new Map<string, ExternalAPIConfig>();

/**
 * Register an external API for health checks.
 */
export function registerExternalAPI(config: ExternalAPIConfig): void {
  externalAPIs.set(config.name, config);
  
  const check = createExternalAPIHealthCheck({
    name: config.name,
    isConfigured: config.isConfigured,
    url: config.healthUrl,
  });
  
  registerDependency(`api_${config.name}`, check);
}

/**
 * Configure Finnhub API health check.
 */
export function configureFinnhubHealth(): void {
  registerExternalAPI({
    name: 'finnhub',
    isConfigured: () => !!process.env.FINNHUB_API_KEY,
  });
}

/**
 * Configure OpenWeatherMap API health check.
 */
export function configureWeatherHealth(): void {
  registerExternalAPI({
    name: 'openweathermap',
    isConfigured: () => !!process.env.OPENWEATHERMAP_API_KEY,
  });
}

/**
 * Configure CoinGecko API health check (no key required).
 */
export function configureCoinGeckoHealth(): void {
  registerExternalAPI({
    name: 'coingecko',
    isConfigured: () => true, // CoinGecko doesn't require API key for basic usage
    healthUrl: 'https://api.coingecko.com/api/v3/ping',
  });
}

/**
 * Get external API health summary.
 */
export async function checkExternalAPIs(): Promise<ComponentHealth> {
  if (externalAPIs.size === 0) {
    return healthy('external_apis', {
      message: 'No external APIs registered',
      details: { count: 0 },
    });
  }
  
  const configured: string[] = [];
  const notConfigured: string[] = [];
  
  for (const [name, config] of externalAPIs) {
    if (config.isConfigured()) {
      configured.push(name);
    } else {
      notConfigured.push(name);
    }
  }
  
  return healthy('external_apis', {
    message: `${configured.length}/${externalAPIs.size} API(s) configured`,
    details: { configured, notConfigured },
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZE ALL DEPENDENCIES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Configuration for initializing all dependencies.
 */
export interface DependencyHealthConfig {
  /** Redis store getter */
  redis?: {
    getStore: StoreGetter;
  };
  
  /** LLM providers */
  llm?: {
    openai?: boolean;
    gemini?: boolean;
  };
  
  /** External APIs */
  externalAPIs?: {
    finnhub?: boolean;
    openweathermap?: boolean;
    coingecko?: boolean;
  };
}

/**
 * Initialize all dependency health checks.
 */
export function initializeDependencyHealth(config: DependencyHealthConfig): void {
  // Clear existing
  clearDependencyChecks();
  
  // Redis
  if (config.redis) {
    configureRedisHealth(config.redis.getStore);
  }
  
  // LLM Providers
  if (config.llm?.openai !== false) {
    configureOpenAIHealth();
  }
  if (config.llm?.gemini !== false) {
    configureGeminiHealth();
  }
  
  // External APIs
  if (config.externalAPIs?.finnhub !== false) {
    configureFinnhubHealth();
  }
  if (config.externalAPIs?.openweathermap !== false) {
    configureWeatherHealth();
  }
  if (config.externalAPIs?.coingecko) {
    configureCoinGeckoHealth();
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// RUN ALL DEPENDENCY CHECKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Run all registered dependency health checks.
 */
export async function checkAllDependencies(): Promise<Map<string, ComponentHealth>> {
  const results = new Map<string, ComponentHealth>();
  
  const checkPromises = Array.from(dependencyChecks.entries()).map(
    async ([name, check]): Promise<[string, ComponentHealth]> => {
      try {
        const result = await check();
        return [name, result];
      } catch (error) {
        return [name, {
          name,
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Check failed',
          checkedAt: new Date().toISOString(),
        }];
      }
    }
  );
  
  const checkResults = await Promise.all(checkPromises);
  
  for (const [name, result] of checkResults) {
    results.set(name, result);
  }
  
  return results;
}
