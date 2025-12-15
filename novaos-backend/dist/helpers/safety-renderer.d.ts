import { CrisisResource, PipelineState } from './types';
export declare const CRISIS_RESOURCES: CrisisResource[];
/**
 * Generate the immutable crisis resources block.
 * This text is NEVER passed through or modified by the model.
 */
export declare function renderCrisisResourceBlock(): string;
/**
 * Pre-rendered block for performance.
 * Generated once at module load, never changes.
 */
declare const CRISIS_RESOURCE_BLOCK: string;
export interface SafetyRenderResult {
    text: string;
    crisisResourcesProvided: boolean;
    resourceBlockHash: string;
}
/**
 * Apply safety rendering to a model response.
 *
 * CRITICAL: This runs AFTER PersonalityGate, BEFORE response is sent.
 * Resources are hard-prepended, not model-generated.
 *
 * @param modelOutput - The validated model output text
 * @param state - Current pipeline state
 * @returns Rendered text with safety resources if required
 */
export declare function applySafetyRendering(modelOutput: string, state: PipelineState): SafetyRenderResult;
/**
 * Verify that crisis resources are present in a response.
 * Used by invariant checker.
 *
 * SECURITY: Checks that the EXACT resource block appears at the START.
 * Simple substring matching is insufficient — adversarial outputs could
 * include phone numbers in negative context.
 *
 * @param responseText - The final response text
 * @returns true if resources are correctly present
 */
export declare function verifyCrisisResourcesPresent(responseText: string): boolean;
/**
 * Verify resource block integrity.
 * Used for audit trail verification.
 */
export declare function verifyResourceBlockIntegrity(responseText: string, expectedHash: string): boolean;
export { CRISIS_RESOURCE_BLOCK };
//# sourceMappingURL=safety-renderer.d.ts.map