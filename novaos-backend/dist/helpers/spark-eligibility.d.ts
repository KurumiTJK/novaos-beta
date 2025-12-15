import { PipelineState, PipelineContext, GateResult, GateId, Spark, SparkDecision, SparkIneligibilityReason } from './types';
export interface SparkMetrics {
    userId: string;
    sparksToday: number;
    recentIgnoreRate: number;
    lastSparkAt: Date | null;
    completionRate: number;
    totalSparks: number;
    totalCompleted: number;
    totalIgnored: number;
}
/**
 * Spark metrics store interface.
 * Implement with Redis, Postgres, etc.
 */
export interface SparkMetricsStore {
    getMetrics(userId: string): Promise<SparkMetrics>;
    recordSparkGenerated(userId: string): Promise<void>;
    recordSparkCompleted(userId: string): Promise<void>;
    recordSparkIgnored(userId: string): Promise<void>;
    recordSparkDeclined(userId: string): Promise<void>;
}
/**
 * In-memory metrics store for development.
 * DO NOT USE IN PRODUCTION.
 */
export declare class InMemorySparkMetricsStore implements SparkMetricsStore {
    private metrics;
    getMetrics(userId: string): Promise<SparkMetrics>;
    recordSparkGenerated(userId: string): Promise<void>;
    recordSparkCompleted(userId: string): Promise<void>;
    recordSparkIgnored(userId: string): Promise<void>;
    recordSparkDeclined(userId: string): Promise<void>;
}
export interface EligibilityResult {
    eligible: boolean;
    reason: SparkIneligibilityReason | null;
}
/**
 * Check if Spark generation is eligible.
 */
export declare function checkSparkEligibility(state: PipelineState, metrics: SparkMetrics): EligibilityResult;
/**
 * Generate a Spark action based on context.
 * This is a simple implementation — production would be more sophisticated.
 */
export declare function generateSpark(state: PipelineState, context: PipelineContext): Spark;
export declare class SparkGate {
    private metricsStore;
    readonly gateId: GateId;
    constructor(metricsStore: SparkMetricsStore);
    execute(state: PipelineState, context: PipelineContext): Promise<GateResult<SparkDecision>>;
}
export declare function handleSparkCompleted(userId: string, metricsStore: SparkMetricsStore): Promise<void>;
export declare function handleSparkIgnored(userId: string, metricsStore: SparkMetricsStore): Promise<void>;
export declare function handleSparkDeclined(userId: string, metricsStore: SparkMetricsStore): Promise<void>;
//# sourceMappingURL=spark-eligibility.d.ts.map