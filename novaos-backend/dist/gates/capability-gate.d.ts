import { PipelineState, PipelineContext, GateResult, GateId, CapabilityCheckResult, ActionType, Stance, CapabilityLevel } from '../helpers/types.js';
export declare class CapabilityGate {
    readonly gateId: GateId;
    execute(state: PipelineState, context: PipelineContext): Promise<GateResult<CapabilityCheckResult>>;
    /**
     * Get actions from EXPLICIT sources only.
     * SECURITY: NEVER infer actions from natural language.
     */
    private getExplicitActions;
}
/**
 * Check if an action is allowed in a given stance.
 */
export declare function isActionAllowed(action: ActionType, stance: Stance): boolean;
/**
 * Get the capability level for an action in a stance.
 */
export declare function getCapabilityLevel(action: ActionType, stance: Stance): CapabilityLevel | null;
//# sourceMappingURL=capability-gate.d.ts.map