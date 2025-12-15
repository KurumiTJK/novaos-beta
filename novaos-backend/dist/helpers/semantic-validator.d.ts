import { LinguisticViolation, GenerationConstraints } from './types';
export interface SemanticValidationResult {
    hasActionRecommendation: boolean;
    hasPreciseNumbers: boolean;
    confidence: number;
    matchedPatterns: string[];
    violations: LinguisticViolation[];
}
/**
 * Detect if text contains action recommendations.
 * Uses pattern matching + heuristics.
 */
export declare function detectActionRecommendation(text: string): {
    detected: boolean;
    confidence: number;
    patterns: string[];
};
/**
 * Detect precise financial numbers in text.
 * Returns matches for audit logging.
 */
export declare function detectPreciseNumbers(text: string): {
    detected: boolean;
    matches: string[];
};
/**
 * Run semantic validation on generated text.
 *
 * @param text - Generated text to validate
 * @param constraints - Current generation constraints
 * @returns Validation result with violations
 */
export declare function validateSemantics(text: string, constraints: GenerationConstraints): SemanticValidationResult;
/**
 * Enhanced violation detection that includes semantic analysis.
 * Call this from PersonalityGate.detectViolations().
 */
export declare function detectViolationsWithSemantics(text: string, constraints: GenerationConstraints): LinguisticViolation[];
//# sourceMappingURL=semantic-validator.d.ts.map