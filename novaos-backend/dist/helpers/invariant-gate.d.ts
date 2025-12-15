import { PipelineState, GateResults, GateResult, GateId, Invariant, InvariantResult } from './types';
interface EnforcedInvariant extends Invariant {
    critical: boolean;
}
declare const ENFORCED_INVARIANTS: EnforcedInvariant[];
export interface InvariantGateInput {
    state: PipelineState;
    results: GateResults;
    responseText: string;
}
export interface InvariantGateOutput {
    violations: InvariantResult[];
    criticalViolations: InvariantResult[];
    nonCriticalViolations: InvariantResult[];
}
/**
 * Invariant Gate — runs AFTER SparkGate, BEFORE response is sent.
 *
 * Critical violations: STOP pipeline, return error
 * Non-critical violations: LOG and continue (maybe degrade)
 */
export declare class InvariantGate {
    readonly gateId: GateId;
    execute(input: InvariantGateInput, context: any): Promise<GateResult<InvariantGateOutput>>;
}
export declare function checkAllInvariants(state: PipelineState, results: GateResults, response?: {
    text: string;
}): InvariantResult[];
export { ENFORCED_INVARIANTS };
//# sourceMappingURL=invariant-gate.d.ts.map