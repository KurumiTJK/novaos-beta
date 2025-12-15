import { VerificationPlan, ConfidenceLevel, Citation, VerificationTrigger } from './types';
export interface ExtractedClaim {
    id: string;
    text: string;
    type: 'factual' | 'temporal' | 'numeric' | 'attribution';
    confidence: number;
    domain: string;
    requiresVerification: boolean;
}
export interface VerificationSource {
    url: string;
    title: string;
    domain: string;
    fetchedAt: Date;
    content: string;
    trustScore: number;
}
export interface ClaimVerificationResult {
    claimId: string;
    verified: boolean;
    confidence: number;
    sources: Citation[];
    conflict: boolean;
    conflictDetails?: string;
}
export interface VerificationResult {
    status: 'complete' | 'partial' | 'failed' | 'skipped';
    allClaimsVerified: boolean;
    verifiedCount: number;
    totalClaims: number;
    citations: Citation[];
    derivedConfidence: ConfidenceLevel;
    freshnessWarning?: string;
    claimResults: ClaimVerificationResult[];
}
/**
 * Extract verifiable claims from a message.
 */
export declare function extractClaims(message: string): ExtractedClaim[];
/**
 * Validate a URL for SSRF safety.
 * @param url - URL to validate
 * @returns Object with valid flag and reason if invalid
 */
export declare function validateUrlForFetch(url: string): {
    valid: boolean;
    reason?: string;
};
/**
 * Web fetcher interface — implement with actual HTTP client.
 */
export interface WebFetcher {
    search(query: string, options?: {
        limit?: number;
    }): Promise<SearchResult[]>;
    fetch(url: string): Promise<FetchResult>;
}
export interface SearchResult {
    url: string;
    title: string;
    snippet: string;
    domain: string;
}
export interface FetchResult {
    url: string;
    content: string;
    title: string;
    fetchedAt: Date;
    success: boolean;
    error?: string;
}
export interface VerificationExecutorOptions {
    webFetcher: WebFetcher;
    maxSources: number;
    timeoutMs: number;
}
/**
 * Execute verification for a message.
 * This is the main entry point that actually does verification.
 */
export declare function executeVerification(message: string, triggers: VerificationTrigger[], options: VerificationExecutorOptions): Promise<VerificationResult>;
/**
 * Updated LensGate execution that actually verifies.
 * This shows how to integrate the verification executor.
 */
export declare function executeLensGateWithVerification(state: any, context: any, webFetcher: WebFetcher | null): Promise<{
    plan: VerificationPlan;
    result: VerificationResult | null;
}>;
//# sourceMappingURL=verification-executor.d.ts.map