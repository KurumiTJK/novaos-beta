import { PipelineState } from './types';
/**
 * Known preconditions that can be checked.
 * Adding new preconditions requires explicit implementation.
 */
type KnownPrecondition = 'resources_provided' | 'verification_complete' | 'user_authenticated' | 'session_active' | 'no_pending_veto';
/**
 * Check if a precondition is met given the current pipeline state.
 *
 * SECURITY: Unknown preconditions FAIL CLOSED (return false).
 * This prevents bypasses via undefined precondition strings.
 *
 * @param precondition - The precondition identifier to check
 * @param state - Current pipeline state
 * @returns true if precondition is met, false otherwise
 */
export declare function checkPrecondition(precondition: string, state: PipelineState): boolean;
/**
 * Check multiple preconditions, returning details about which failed.
 * Useful for generating informative error messages.
 */
export declare function checkPreconditions(preconditions: string[], state: PipelineState): {
    allMet: boolean;
    failed: string[];
};
/**
 * Type guard to check if a string is a known precondition.
 * Useful for validation at API boundaries.
 */
export declare function isKnownPrecondition(value: string): value is KnownPrecondition;
export {};
//# sourceMappingURL=precondition-checker.d.ts.map