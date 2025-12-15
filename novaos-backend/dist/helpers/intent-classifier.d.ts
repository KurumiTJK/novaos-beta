import { Intent, UserInput } from './types';
/**
 * Classify the intent of a user message.
 *
 * @param input - User input to classify
 * @returns Classified intent
 */
export declare function classifyIntent(input: UserInput): Intent;
import { GateResult, GateId, PipelineState, PipelineContext } from './types';
export declare class IntentGate {
    readonly gateId: GateId;
    execute(state: PipelineState, context: PipelineContext): Promise<GateResult<Intent>>;
}
//# sourceMappingURL=intent-classifier.d.ts.map