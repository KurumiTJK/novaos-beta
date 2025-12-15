import { PipelineState, PipelineContext, GateResult, GateId, Stance } from '../helpers/types.js';
export declare class StanceGate {
    readonly gateId: GateId;
    execute(state: PipelineState, context: PipelineContext): Promise<GateResult<Stance>>;
    /**
     * Determine the appropriate stance based on pipeline state.
     */
    private determineStance;
}
/**
 * Compare stance priority.
 * Returns positive if a is higher priority than b.
 */
export declare function compareStancePriority(a: Stance, b: Stance): number;
/**
 * Get the higher priority stance.
 */
export declare function getHigherPriorityStance(a: Stance, b: Stance): Stance;
/**
 * Check if a stance is above a threshold.
 */
export declare function isStanceAtLeast(stance: Stance, threshold: Stance): boolean;
//# sourceMappingURL=stance-gate.d.ts.map