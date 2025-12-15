import { PipelineState, PipelineContext, GateResult, GateId, RiskSummary } from '../helpers/types.js';
import { NonceStore } from '../helpers/ack-token.js';
export declare class ShieldGate {
    private nonceStore;
    private ackTokenSecret;
    readonly gateId: GateId;
    constructor(nonceStore: NonceStore, ackTokenSecret: string);
    execute(state: PipelineState, context: PipelineContext): Promise<GateResult<RiskSummary>>;
    /**
     * Detect Control Mode triggers.
     */
    private detectControlTrigger;
    /**
     * Detect Hard Veto patterns.
     */
    private detectHardVeto;
    /**
     * Detect Soft Veto patterns.
     */
    private detectSoftVeto;
    /**
     * Assess general risk level.
     */
    private assessRisk;
}
//# sourceMappingURL=shield-gate.d.ts.map