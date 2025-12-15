"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// PERSONALITY GATE — Output Validation & Surgical Editing
// Detects violations and triggers regeneration or edits
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersonalityGate = void 0;
const semantic_validator_js_1 = require("../helpers/semantic-validator.js");
// ─────────────────────────────────────────────────────────────────────────────────
// PERSONALITY GATE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────
class PersonalityGate {
    gateId = 'personality';
    async execute(state, context) {
        const start = Date.now();
        const { generation } = state;
        try {
            // ─────────────────────────────────────────────────────────────────────────
            // Step 1: Check if we have generation to validate
            // ─────────────────────────────────────────────────────────────────────────
            if (!generation?.text) {
                return {
                    gateId: this.gateId,
                    status: 'hard_fail',
                    output: null,
                    action: 'stop',
                    failureReason: 'No generation to validate',
                    executionTimeMs: Date.now() - start,
                };
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 2: Detect violations using semantic validator
            // ─────────────────────────────────────────────────────────────────────────
            const violations = (0, semantic_validator_js_1.detectViolationsWithSemantics)(generation.text, generation.constraints);
            // ─────────────────────────────────────────────────────────────────────────
            // Step 3: Handle high-severity violations -> regenerate
            // ─────────────────────────────────────────────────────────────────────────
            const highSeverity = violations.filter(v => v.severity === 'high');
            if (highSeverity.length > 0) {
                // Build regeneration constraints
                const regenerationConstraints = {
                    bannedPhrases: highSeverity.map(v => v.phrase),
                    maxWe: 0, // If "we" was a problem, ban it entirely
                    tone: 'neutral',
                    numericPrecisionAllowed: generation.constraints?.numericPrecisionAllowed ?? true,
                    actionRecommendationsAllowed: generation.constraints?.actionRecommendationsAllowed ?? true,
                };
                return {
                    gateId: this.gateId,
                    status: 'hard_fail',
                    output: {
                        text: generation.text,
                        violations,
                        edited: false,
                        regenerationConstraints,
                    },
                    action: 'regenerate',
                    failureReason: `High-severity violations: ${highSeverity.map(v => v.type).join(', ')}`,
                    executionTimeMs: Date.now() - start,
                };
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 4: Handle medium/low violations -> surgical edit
            // ─────────────────────────────────────────────────────────────────────────
            let processedText = generation.text;
            const edits = [];
            for (const violation of violations.filter(v => v.canSurgicalEdit)) {
                const result = this.surgicalEdit(processedText, violation);
                if (result.edited) {
                    processedText = result.text;
                    edits.push(result.edit);
                }
            }
            // ─────────────────────────────────────────────────────────────────────────
            // Step 5: Return validated output
            // ─────────────────────────────────────────────────────────────────────────
            return {
                gateId: this.gateId,
                status: violations.length > 0 ? 'soft_fail' : 'pass',
                output: {
                    text: processedText,
                    violations,
                    edited: edits.length > 0,
                    edits: edits.length > 0 ? edits : undefined,
                },
                action: 'continue',
                failureReason: violations.length > 0
                    ? `Minor violations detected: ${violations.map(v => v.type).join(', ')}`
                    : undefined,
                executionTimeMs: Date.now() - start,
            };
        }
        catch (error) {
            console.error('[PERSONALITY] Validation error:', error);
            // Return the original text on error
            return {
                gateId: this.gateId,
                status: 'soft_fail',
                output: {
                    text: state.generation?.text ?? '',
                    violations: [],
                    edited: false,
                },
                action: 'continue',
                failureReason: 'Validation error, passing through',
                executionTimeMs: Date.now() - start,
            };
        }
    }
    /**
     * Perform surgical edit on text for a violation.
     */
    surgicalEdit(text, violation) {
        const { type, phrase } = violation;
        // Define replacement strategies
        const replacements = {
            // "We" usage - replace with "You" or restructure
            excessive_we: () => this.replaceWe(text),
            // Emotional manipulation - neutralize
            emotional_manipulation: (p) => this.neutralizeEmotion(text, p),
            // Default - remove the phrase
            default: (p) => text.replace(new RegExp(p, 'gi'), ''),
        };
        const replacer = replacements[type] || replacements.default;
        const newText = replacer(phrase);
        if (newText !== text) {
            return {
                text: newText,
                edited: true,
                edit: {
                    original: phrase,
                    replacement: 'edited',
                    reason: `Removed ${type} violation`,
                },
            };
        }
        return {
            text,
            edited: false,
            edit: { original: '', replacement: '', reason: '' },
        };
    }
    /**
     * Replace excessive "we" usage.
     */
    replaceWe(text) {
        // Replace "we" with more appropriate alternatives
        const replacements = [
            { from: /\bwe can\b/gi, to: 'you can' },
            { from: /\bwe should\b/gi, to: 'consider' },
            { from: /\bwe'll\b/gi, to: "I'll help you" },
            { from: /\bour\b/gi, to: 'your' },
        ];
        let result = text;
        for (const { from, to } of replacements) {
            result = result.replace(from, to);
        }
        return result;
    }
    /**
     * Neutralize emotional manipulation phrases.
     */
    neutralizeEmotion(text, phrase) {
        const neutralReplacements = {
            "I'm so proud of you": "That's good progress",
            "Great job": "That's completed",
            "You're amazing": "You've handled that well",
            "You're incredible": "You've done well",
            "You're wonderful": "That's a positive outcome",
        };
        const neutral = neutralReplacements[phrase.toLowerCase()];
        if (neutral) {
            return text.replace(new RegExp(phrase, 'gi'), neutral);
        }
        // Default: just remove the phrase
        return text.replace(new RegExp(phrase, 'gi'), '');
    }
}
exports.PersonalityGate = PersonalityGate;
//# sourceMappingURL=personality-gate.js.map