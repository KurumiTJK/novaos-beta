export interface FreshnessWindow {
    domain: string;
    maxAgeMs: number | null;
    immediate: boolean;
    description: string;
}
export declare const FRESHNESS_WINDOWS: Record<string, FreshnessWindow>;
/**
 * Detect the domain of a message.
 * Returns the most specific matching domain.
 */
export declare function detectDomain(message: string): string;
/**
 * Detect all matching domains (for multi-domain queries).
 */
export declare function detectAllDomains(message: string): string[];
export interface FreshnessResult {
    domain: string;
    window: FreshnessWindow;
    isStale: boolean;
    staleBy: string | null;
    requiredAction: 'none' | 'warn' | 'verify' | 'block_numerics';
}
/**
 * Check freshness of data for a domain.
 *
 * @param domain - The domain to check
 * @param dataTimestamp - When the data was obtained (null if unknown)
 * @returns Freshness result with required action
 */
export declare function checkFreshness(domain: string, dataTimestamp: Date | null): FreshnessResult;
/**
 * Check if a domain is an immediate domain (requires real-time data).
 */
export declare function isImmediateDomain(domain: string): boolean;
/**
 * Get list of all immediate domains.
 */
export declare function getImmediateDomains(): string[];
//# sourceMappingURL=freshness-checker.d.ts.map