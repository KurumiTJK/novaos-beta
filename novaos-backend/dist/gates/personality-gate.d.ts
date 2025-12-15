import { PipelineState, PipelineContext, GateResult, GateId, ValidatedOutput } from '../helpers/types.js';
export declare class PersonalityGate {
    readonly gateId: GateId;
    execute(state: PipelineState, context: PipelineContext): Promise<GateResult<ValidatedOutput>>;
    /**
     * Perform surgical edit on text for a violation.
     */
    private surgicalEdit;
    /**
     * Replace excessive "we" usage.
     */
    private replaceWe;
    /**
     * Neutralize emotional manipulation phrases.
     */
    private neutralizeEmotion;
}
//# sourceMappingURL=personality-gate.d.ts.map