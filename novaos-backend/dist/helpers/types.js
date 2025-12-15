"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS v4 — Complete Type Definitions
// Single source of truth for all types
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.SOFT_VETO_TRIGGERS = exports.HARD_VETO_TRIGGERS = exports.CRISIS_RESOURCES = exports.IMMEDIATE_DOMAINS = exports.REGENERATION_GATES = exports.GATE_ORDER = exports.FRESHNESS_POLICY_VERSION = exports.VERIFICATION_POLICY_VERSION = exports.CONSTRAINTS_VERSION = exports.CAPABILITY_MATRIX_VERSION = exports.POLICY_VERSION = void 0;
// ─────────────────────────────────────────────────────────────────────────────────
// VERSION CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────
exports.POLICY_VERSION = '4.0.0';
exports.CAPABILITY_MATRIX_VERSION = '4.0.0';
exports.CONSTRAINTS_VERSION = '4.0.0';
exports.VERIFICATION_POLICY_VERSION = '4.0.0';
exports.FRESHNESS_POLICY_VERSION = '4.0.0';
// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────
exports.GATE_ORDER = [
    'intent',
    'shield',
    'lens',
    'stance',
    'capability',
    'model',
    'personality',
    'spark',
];
exports.REGENERATION_GATES = ['model', 'personality', 'spark'];
exports.IMMEDIATE_DOMAINS = ['stock_prices', 'crypto_prices', 'weather', 'breaking_news'];
exports.CRISIS_RESOURCES = [
    { name: '988 Suicide & Crisis Lifeline', action: 'Call or text 988', phone: '988' },
    { name: 'Crisis Text Line', action: 'Text HOME to 741741' },
    { name: 'SAMHSA National Helpline', action: '1-800-662-4357', phone: '1-800-662-4357' },
];
exports.HARD_VETO_TRIGGERS = [
    'illegal_content',
    'child_safety',
    'violence_promotion',
    'self_harm_instructions',
    'weapons_creation',
];
exports.SOFT_VETO_TRIGGERS = [
    'high_financial_risk',
    'health_decision_without_professional',
    'legal_action_without_counsel',
    'irreversible_decision',
];
//# sourceMappingURL=types.js.map