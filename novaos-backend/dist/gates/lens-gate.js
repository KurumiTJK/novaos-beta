"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// LENS GATE — Verification & Freshness Logic
// Implements stakes-based verification decisions
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.LensGate = void 0;
const freshness_checker_js_1 = require("../helpers/freshness-checker.js");
const verification_executor_js_1 = require("../helpers/verification-executor.js");
const VERIFICATION_TRIGGERS = [
    // Temporal claims
    { pattern: /\b(latest|current|now|today|recent|as of)\b/i, code: 'temporal_claim', stakes: 'medium' },
    // Health claims
    { pattern: /\b(treatment|diagnosis|medication|symptoms?|cure|therapy|dosage)\b/i, code: 'health_claim', stakes: 'high' },
    // Legal claims
    { pattern: /\b(law|legal|illegal|statute|regulation|court|liable|penalty)\b/i, code: 'legal_claim', stakes: 'high' },
    // Financial claims
    { pattern: /\b(price|cost|worth|value|invest|stock|rate|market cap)\b/i, code: 'financial_claim', stakes: 'high' },
    // Numeric claims
    { pattern: /\b(\d+(?:\.\d+)?%|\$[\d,]+(?:\.\d{2})?)\b/, code: 'numeric_claim', stakes: 'medium' },
    // Public figure attribution
    { pattern: /\b(said|stated|announced|tweeted|posted)\b.*\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/, code: 'public_figure_claim', stakes: 'medium' },
];
// ─────────────────────────────────────────────────────────────────────────────────
// ALLOWLIST CONTEXTS (skip verification)
// ─────────────────────────────────────────────────────────────────────────────────
function isAllowlistedContext(message, intent) {
    // Code blocks - don't verify numbers in code
    if (/```[\s\S]*?```|`[^`]+`/.test(message)) {
        return true;
    }
    // User-provided text processing
    if (['rewrite', 'summarize', 'translate'].includes(intent?.type)) {
        return true;
    }
    // Hypotheticals and examples
    if (intent?.isHypothetical) {
        return true;
    }
    return false;
}
// ─────────────────────────────────────────────────────────────────────────────────
// LENS GATE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────
class LensGate {
    webFetcher;
    gateId = 'lens';
    constructor(webFetcher) {
        this.webFetcher = webFetcher;
    }
    async execute(state, context) {
        const start = Date.now();
        const { input, intent, risk } = state;
        try {
            // ─────────────────────────────────────────────────────────────────────────
            // Step 1: Check if verification is required
            // ─────────────────────────────────────────────────────────────────────────
            const needs = this.checkVerificationNeeded(input.message, intent);
            if (!needs.required) {
                return {
                    gateId: this.gateId,
                    status: 'pass',
                    output: {
                        required: false,
                        mode: 'none',
                        plan: null,
                    },
                    action: 'continue',
                    executionTimeMs: Date.now() - start,
                };
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 2: Determine stakes level (combine with Shield's assessment)
            // ─────────────────────────────────────────────────────────────────────────
            const stakesLevel = this.determineStakes(needs, risk);
            // ─────────────────────────────────────────────────────────────────────────
            // Step 3: Check if verification is possible
            // ─────────────────────────────────────────────────────────────────────────
            const canVerify = this.webFetcher !== null;
            if (!canVerify) {
                // High stakes + cannot verify = STOP with options
                if (stakesLevel === 'high' || stakesLevel === 'critical') {
                    const userOptions = [
                        { id: 'enable_web', label: 'Enable web access' },
                        { id: 'provide_source', label: 'Provide a source URL' },
                        { id: 'proceed_unverified', label: 'Proceed without verification (not recommended)', requiresAck: true },
                        { id: 'stop', label: 'Cancel this request' },
                    ];
                    return {
                        gateId: this.gateId,
                        status: 'hard_fail',
                        output: {
                            required: true,
                            mode: 'blocked',
                            plan: null,
                            userOptions,
                        },
                        action: 'stop',
                        failureReason: `High-stakes request requires verification but web unavailable. Triggers: ${needs.reasonCodes.join(', ')}`,
                        executionTimeMs: Date.now() - start,
                    };
                }
                // Low/medium stakes + cannot verify = DEGRADE
                const domain = (0, freshness_checker_js_1.detectDomain)(input.message);
                const freshness = (0, freshness_checker_js_1.checkFreshness)(domain, null);
                return {
                    gateId: this.gateId,
                    status: 'soft_fail',
                    output: {
                        required: true,
                        mode: 'degraded',
                        plan: {
                            verificationStatus: 'skipped',
                            confidence: 'low',
                            verified: false,
                            freshnessWarning: 'Could not verify against current sources',
                            numericPrecisionAllowed: false, // No precise numbers
                            actionRecommendationsAllowed: false, // No "buy/sell/do X"
                        },
                    },
                    action: 'degrade',
                    failureReason: 'Verification unavailable, degrading output',
                    executionTimeMs: Date.now() - start,
                };
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 4: Execute verification
            // ─────────────────────────────────────────────────────────────────────────
            const verificationResult = await this.executeVerification(input.message, needs);
            const plan = this.buildVerificationPlan(verificationResult, needs);
            return {
                gateId: this.gateId,
                status: verificationResult.allClaimsVerified ? 'pass' : 'soft_fail',
                output: {
                    required: true,
                    mode: verificationResult.allClaimsVerified ? 'web' : 'degraded',
                    plan,
                },
                action: 'continue',
                executionTimeMs: Date.now() - start,
            };
        }
        catch (error) {
            console.error('[LENS] Verification error:', error);
            // On error, degrade gracefully
            return {
                gateId: this.gateId,
                status: 'soft_fail',
                output: {
                    required: true,
                    mode: 'degraded',
                    plan: {
                        verificationStatus: 'skipped',
                        confidence: 'low',
                        verified: false,
                        freshnessWarning: 'Verification failed - treat with caution',
                        numericPrecisionAllowed: false,
                        actionRecommendationsAllowed: false,
                    },
                },
                action: 'degrade',
                failureReason: 'Verification error, degrading output',
                executionTimeMs: Date.now() - start,
            };
        }
    }
    /**
     * Check if verification is needed based on message content.
     */
    checkVerificationNeeded(message, intent) {
        // Check allowlist first
        if (isAllowlistedContext(message, intent)) {
            return { required: false, reasonCodes: [], stakesLevel: 'low' };
        }
        const matchedCodes = [];
        let highestStakes = 'low';
        for (const { pattern, code, stakes } of VERIFICATION_TRIGGERS) {
            if (pattern.test(message)) {
                matchedCodes.push(code);
                if (this.compareStakes(stakes, highestStakes) > 0) {
                    highestStakes = stakes;
                }
            }
        }
        return {
            required: matchedCodes.length > 0,
            reasonCodes: matchedCodes,
            stakesLevel: highestStakes,
        };
    }
    /**
     * Determine final stakes level combining verification needs and Shield assessment.
     */
    determineStakes(needs, risk) {
        // Health/legal/financial are always high stakes
        const highStakesCodes = ['health_claim', 'legal_claim', 'financial_claim'];
        if (needs.reasonCodes.some(code => highStakesCodes.includes(code))) {
            return 'high';
        }
        // Inherit from Shield risk assessment if higher
        if (risk?.stakesLevel) {
            if (this.compareStakes(risk.stakesLevel, needs.stakesLevel) > 0) {
                return risk.stakesLevel;
            }
        }
        return needs.stakesLevel;
    }
    /**
     * Compare stakes levels.
     */
    compareStakes(a, b) {
        const order = ['low', 'medium', 'high', 'critical'];
        return order.indexOf(a) - order.indexOf(b);
    }
    /**
     * Execute verification using web fetcher.
     */
    async executeVerification(message, needs) {
        if (!this.webFetcher) {
            return {
                status: 'skipped',
                allClaimsVerified: false,
                verifiedCount: 0,
                totalClaims: 0,
                citations: [],
                derivedConfidence: 'low',
                claimResults: [],
            };
        }
        // Use the verification executor
        return (0, verification_executor_js_1.executeVerification)(message, needs.reasonCodes, {
            webFetcher: this.webFetcher,
            maxSources: 5,
            timeoutMs: 10000,
        });
    }
    /**
     * Build verification plan from result.
     */
    buildVerificationPlan(result, needs) {
        const domain = (0, freshness_checker_js_1.detectDomain)(needs.reasonCodes.join(' '));
        const isImmediate = (0, freshness_checker_js_1.isImmediateDomain)(domain);
        return {
            verificationStatus: result.status,
            confidence: result.derivedConfidence,
            verified: result.allClaimsVerified,
            freshnessWarning: result.freshnessWarning,
            numericPrecisionAllowed: result.allClaimsVerified && !isImmediate,
            actionRecommendationsAllowed: result.allClaimsVerified,
            sourcesToCheck: result.citations.map(c => c.url),
        };
    }
}
exports.LensGate = LensGate;
//# sourceMappingURL=lens-gate.js.map