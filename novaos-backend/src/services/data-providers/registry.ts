// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER REGISTRY — Maps Categories to Providers
// Central registry for provider lookup and management
// ═══════════════════════════════════════════════════════════════════════════════

import type { LiveCategory, ProviderData } from '../../types/index.js';

import {
  BaseProvider,
  TimeProvider,
  FxProvider,
  CryptoProvider,
  FinnhubProvider,
  WeatherProvider,
  getTimeProvider,
  getFxProvider,
  getCryptoProvider,
  getFinnhubProvider,
  getWeatherProvider,
  type ProviderHealth,
} from './providers/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Provider registration entry.
 */
export interface ProviderRegistration {
  /** The provider instance */
  readonly provider: BaseProvider;
  /** Priority (lower = higher priority) */
  readonly priority: number;
  /** Whether this is the primary provider for the category */
  readonly isPrimary: boolean;
}

/**
 * Registry status for a category.
 */
export interface CategoryStatus {
  /** The category */
  readonly category: LiveCategory;
  /** Whether any provider is available */
  readonly hasAvailableProvider: boolean;
  /** Primary provider name (if available) */
  readonly primaryProvider: string | null;
  /** All registered provider names */
  readonly registeredProviders: readonly string[];
  /** Available provider names (those with isAvailable() === true) */
  readonly availableProviders: readonly string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER REGISTRY CLASS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Provider registry for managing data providers.
 * 
 * Features:
 * - Maps categories to providers
 * - Supports multiple providers per category with priority
 * - Automatic fallback to available providers
 * - Health status aggregation
 * 
 * @example
 * const registry = getProviderRegistry();
 * 
 * // Get provider for a category
 * const provider = registry.getProvider('market');
 * if (provider) {
 *   const result = await provider.fetch({ query: 'AAPL' });
 * }
 * 
 * // Check category status
 * const status = registry.getCategoryStatus('weather');
 * if (!status.hasAvailableProvider) {
 *   console.log('Weather provider not configured');
 * }
 */
export class ProviderRegistry {
  /** Registry: category → registrations */
  private readonly registry: Map<LiveCategory, ProviderRegistration[]> = new Map();
  
  /** Provider lookup by name */
  private readonly providersByName: Map<string, BaseProvider> = new Map();
  
  constructor() {
    this.registerDefaultProviders();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // REGISTRATION
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Register a provider for a category.
   * 
   * @param category - The category to register for
   * @param provider - The provider instance
   * @param priority - Priority (lower = higher priority, default: 100)
   * @param isPrimary - Whether this is the primary provider (default: false)
   */
  register(
    category: LiveCategory,
    provider: BaseProvider,
    priority: number = 100,
    isPrimary: boolean = false
  ): void {
    // Get or create registrations for category
    let registrations = this.registry.get(category);
    if (!registrations) {
      registrations = [];
      this.registry.set(category, registrations);
    }
    
    // Check if already registered
    const existingIndex = registrations.findIndex(r => r.provider.name === provider.name);
    if (existingIndex >= 0) {
      // Update existing registration
      registrations[existingIndex] = { provider, priority, isPrimary };
    } else {
      // Add new registration
      registrations.push({ provider, priority, isPrimary });
    }
    
    // Sort by priority (lower first)
    registrations.sort((a, b) => a.priority - b.priority);
    
    // Track provider by name
    this.providersByName.set(provider.name, provider);
  }
  
  /**
   * Unregister a provider from a category.
   * 
   * @param category - The category
   * @param providerName - The provider name
   * @returns True if unregistered, false if not found
   */
  unregister(category: LiveCategory, providerName: string): boolean {
    const registrations = this.registry.get(category);
    if (!registrations) return false;
    
    const index = registrations.findIndex(r => r.provider.name === providerName);
    if (index < 0) return false;
    
    registrations.splice(index, 1);
    return true;
  }
  
  /**
   * Register default providers.
   */
  private registerDefaultProviders(): void {
    // Time - always available
    this.register('time', getTimeProvider(), 1, true);
    
    // FX - Frankfurter (free, no key)
    this.register('fx', getFxProvider(), 1, true);
    
    // Crypto - CoinGecko
    this.register('crypto', getCryptoProvider(), 1, true);
    
    // Market - Finnhub (requires API key)
    this.register('market', getFinnhubProvider(), 1, true);
    
    // Weather - OpenWeatherMap (requires API key)
    this.register('weather', getWeatherProvider(), 1, true);
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // PROVIDER LOOKUP
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get the best available provider for a category.
   * 
   * Returns the highest-priority provider that is available.
   * 
   * @param category - The category
   * @returns The provider, or null if none available
   */
  getProvider(
    category: LiveCategory
  ): BaseProvider | null {
    const registrations = this.registry.get(category);
    if (!registrations || registrations.length === 0) {
      return null;
    }
    
    // Find first available provider (already sorted by priority)
    for (const registration of registrations) {
      if (registration.provider.isAvailable()) {
        return registration.provider as BaseProvider;
      }
    }
    
    return null;
  }
  
  /**
   * Get the primary provider for a category (may not be available).
   * 
   * @param category - The category
   * @returns The primary provider, or null if none registered
   */
  getPrimaryProvider(
    category: LiveCategory
  ): BaseProvider | null {
    const registrations = this.registry.get(category);
    if (!registrations || registrations.length === 0) {
      return null;
    }
    
    // Find primary provider
    const primary = registrations.find(r => r.isPrimary);
    if (primary) {
      return primary.provider as BaseProvider;
    }
    
    // Fall back to highest priority
    return registrations[0]?.provider as BaseProvider ?? null;
  }
  
  /**
   * Get all providers for a category.
   * 
   * @param category - The category
   * @param onlyAvailable - If true, only return available providers
   * @returns Array of providers
   */
  getProvidersForCategory(
    category: LiveCategory,
    onlyAvailable: boolean = false
  ): readonly BaseProvider[] {
    const registrations = this.registry.get(category);
    if (!registrations) return [];
    
    let providers = registrations.map(r => r.provider as BaseProvider);
    
    if (onlyAvailable) {
      providers = providers.filter(p => p.isAvailable());
    }
    
    return providers;
  }
  
  /**
   * Get a provider by name.
   * 
   * @param name - The provider name
   * @returns The provider, or null if not found
   */
  getProviderByName(
    name: string
  ): BaseProvider | null {
    return (this.providersByName.get(name) as BaseProvider) ?? null;
  }
  
  /**
   * Get all registered providers.
   * 
   * @param onlyAvailable - If true, only return available providers
   * @returns Array of all providers
   */
  getAllProviders(onlyAvailable: boolean = false): readonly BaseProvider[] {
    const providers = Array.from(this.providersByName.values());
    
    if (onlyAvailable) {
      return providers.filter(p => p.isAvailable());
    }
    
    return providers;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════
  // STATUS & HEALTH
  // ═══════════════════════════════════════════════════════════════════════════
  
  /**
   * Get status for a category.
   * 
   * @param category - The category
   * @returns Category status
   */
  getCategoryStatus(category: LiveCategory): CategoryStatus {
    const registrations = this.registry.get(category) ?? [];
    const providers = registrations.map(r => r.provider);
    const availableProviders = providers.filter(p => p.isAvailable());
    const primaryReg = registrations.find(r => r.isPrimary);
    
    return {
      category,
      hasAvailableProvider: availableProviders.length > 0,
      primaryProvider: primaryReg?.provider.isAvailable() 
        ? primaryReg.provider.name 
        : (availableProviders[0]?.name ?? null),
      registeredProviders: providers.map(p => p.name),
      availableProviders: availableProviders.map(p => p.name),
    };
  }
  
  /**
   * Get status for all categories.
   * 
   * @returns Map of category → status
   */
  getAllCategoryStatuses(): ReadonlyMap<LiveCategory, CategoryStatus> {
    const categories: LiveCategory[] = ['time', 'weather', 'market', 'crypto', 'fx'];
    const statuses = new Map<LiveCategory, CategoryStatus>();
    
    for (const category of categories) {
      statuses.set(category, this.getCategoryStatus(category));
    }
    
    return statuses;
  }
  
  /**
   * Get health status for all providers.
   * 
   * @returns Map of provider name → health status
   */
  async getAllHealthStatuses(): Promise<ReadonlyMap<string, ProviderHealth>> {
    const healthMap = new Map<string, ProviderHealth>();
    
    const providers = this.getAllProviders();
    
    await Promise.all(
      providers.map(async provider => {
        const health = await provider.getHealthStatus();
        healthMap.set(provider.name, health);
      })
    );
    
    return healthMap;
  }
  
  /**
   * Check if a category has an available provider.
   * 
   * @param category - The category
   * @returns True if at least one provider is available
   */
  hasAvailableProvider(category: LiveCategory): boolean {
    return this.getProvider(category) !== null;
  }
  
  /**
   * Get list of categories without available providers.
   * 
   * @returns Array of categories missing providers
   */
  getMissingCategories(): readonly LiveCategory[] {
    const categories: LiveCategory[] = ['time', 'weather', 'market', 'crypto', 'fx'];
    return categories.filter(c => !this.hasAvailableProvider(c));
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON INSTANCE
// ─────────────────────────────────────────────────────────────────────────────────

let registryInstance: ProviderRegistry | null = null;

/**
 * Get the singleton provider registry.
 */
export function getProviderRegistry(): ProviderRegistry {
  if (!registryInstance) {
    registryInstance = new ProviderRegistry();
  }
  return registryInstance;
}

/**
 * Create a new provider registry (for testing).
 */
export function createProviderRegistry(): ProviderRegistry {
  return new ProviderRegistry();
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get provider for a category from the default registry.
 * 
 * @param category - The category
 * @returns The best available provider, or null
 */
export function getProviderForCategory(
  category: LiveCategory
): BaseProvider | null {
  return getProviderRegistry().getProvider(category);
}

/**
 * Check if a category has an available provider.
 * 
 * @param category - The category
 * @returns True if available
 */
export function isCategoryAvailable(category: LiveCategory): boolean {
  return getProviderRegistry().hasAvailableProvider(category);
}

/**
 * Get all available categories.
 * 
 * @returns Array of categories with available providers
 */
export function getAvailableCategories(): readonly LiveCategory[] {
  const categories: LiveCategory[] = ['time', 'weather', 'market', 'crypto', 'fx'];
  return categories.filter(c => isCategoryAvailable(c));
}
