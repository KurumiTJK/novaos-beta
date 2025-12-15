import { PipelineState, GateResult, PipelineContext, PipelineResult, UserInput, GateId } from '../helpers/types.js';
import { AuditLogger } from '../helpers/audit-logger.js';
import { SparkMetricsStore } from '../helpers/spark-eligibility.js';
import { NonceStore } from '../helpers/ack-token.js';
export interface Gate<TOutput> {
    readonly gateId: GateId;
    execute(state: PipelineState, context: PipelineContext): Promise<GateResult<TOutput>>;
}
export interface PipelineConfig {
    nonceStore: NonceStore;
    sparkMetricsStore: SparkMetricsStore;
    auditLogger?: AuditLogger;
    ackTokenSecret: string;
    webFetcher?: {
        search: (query: string, options?: {
            limit?: number;
        }) => Promise<any[]>;
        fetch: (url: string) => Promise<any>;
    } | null;
}
export declare class ExecutionPipeline {
    private gates;
    private config;
    constructor(config: PipelineConfig);
    /**
     * Execute the full pipeline for a user input.
     */
    execute(input: UserInput): Promise<PipelineResult>;
    /**
     * Execute regeneration sequence (model → personality → spark).
     * Max 2 attempts.
     */
    private executeRegeneration;
    /**
     * Build success response with safety rendering and invariant checks.
     */
    private buildSuccessResponse;
    /**
     * Finalize response with audit logging.
     */
    private finalizeResponse;
    /**
     * Apply gate result to pipeline state.
     */
    private applyResult;
    /**
     * Log gate result for debugging/monitoring.
     */
    private logGateResult;
}
/**
 * Create a pipeline with default in-memory stores.
 * For production, use Redis/DB-backed stores.
 */
export declare function createPipeline(config?: Partial<PipelineConfig>): ExecutionPipeline;
//# sourceMappingURL=execution-pipeline.d.ts.map