import { PipelineState, PipelineContext, GateResult, GateId, GenerationResult } from '../helpers/types.js';
export declare class ModelGate {
    readonly gateId: GateId;
    execute(state: PipelineState, context: PipelineContext): Promise<GateResult<GenerationResult>>;
    /**
     * Build structured generation constraints.
     */
    private buildConstraints;
    /**
     * Build system prompt with constraints.
     */
    private buildSystemPrompt;
    /**
     * Select model based on stance and complexity.
     */
    private selectModel;
    /**
     * Invoke the model for generation.
     * In production, this would call the actual LLM API.
     */
    private invokeModel;
    /**
     * Invoke fallback model.
     */
    private invokeFallbackModel;
}
//# sourceMappingURL=model-gate.d.ts.map