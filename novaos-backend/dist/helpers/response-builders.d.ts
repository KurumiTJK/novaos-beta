import { PipelineState, GateResults, PipelineContext, PipelineResult } from './types';
export declare function buildStoppedResponse(state: PipelineState, results: GateResults, context: PipelineContext, startTime?: number): PipelineResult;
export declare function buildAwaitAckResponse(state: PipelineState, results: GateResults, context: PipelineContext, startTime?: number): PipelineResult;
export declare function buildDegradedResponse(state: PipelineState, results: GateResults, context: PipelineContext, degradeReason: string, startTime?: number): PipelineResult;
export declare function buildResponse(state: PipelineState, results: GateResults, context: PipelineContext, startTime?: number): PipelineResult;
//# sourceMappingURL=response-builders.d.ts.map