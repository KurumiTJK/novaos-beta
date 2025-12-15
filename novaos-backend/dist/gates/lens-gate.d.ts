import { PipelineState, PipelineContext, GateResult, GateId, VerificationPlan } from '../helpers/types.js';
import { WebFetcher } from '../helpers/verification-executor.js';
export declare class LensGate {
    private webFetcher;
    readonly gateId: GateId;
    constructor(webFetcher: WebFetcher | null);
    execute(state: PipelineState, context: PipelineContext): Promise<GateResult<VerificationPlan>>;
    /**
     * Check if verification is needed based on message content.
     */
    private checkVerificationNeeded;
    /**
     * Determine final stakes level combining verification needs and Shield assessment.
     */
    private determineStakes;
    /**
     * Compare stakes levels.
     */
    private compareStakes;
    /**
     * Execute verification using web fetcher.
     */
    private executeVerification;
    /**
     * Build verification plan from result.
     */
    private buildVerificationPlan;
}
//# sourceMappingURL=lens-gate.d.ts.map