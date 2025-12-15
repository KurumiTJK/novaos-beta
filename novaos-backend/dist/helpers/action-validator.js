"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// ACTION VALIDATOR — Fix B-5
// Validates and authorizes RequestedActions at API boundary
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.RequestedActionsSchema = void 0;
exports.isUserAuthorized = isUserAuthorized;
exports.isActionValidInState = isActionValidInState;
exports.validateRequestedActions = validateRequestedActions;
exports.actionValidationMiddleware = actionValidationMiddleware;
const zod_1 = require("zod");
// ─────────────────────────────────────────────────────────────────────────────────
// SCHEMA DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────────
/**
 * Valid action types.
 * SECURITY: Only these action types are accepted.
 */
const ActionTypeSchema = zod_1.z.enum([
    'set_reminder',
    'create_path',
    'generate_spark',
    'search_web',
    'end_conversation',
    'override_veto',
]);
/**
 * Valid action sources.
 * SECURITY: Only explicit sources accepted, never 'nl_inference'.
 */
const ActionSourceSchema = zod_1.z.enum([
    'ui_button',
    'command_parser',
    'api_field',
]);
/**
 * Action-specific parameter schemas.
 * Each action type has its own validated parameter structure.
 */
const ActionParamsSchemas = {
    set_reminder: zod_1.z.object({
        title: zod_1.z.string().min(1).max(200),
        triggerAt: zod_1.z.string().datetime(),
        body: zod_1.z.string().max(1000).optional(),
        repeatPattern: zod_1.z.string().optional(),
    }),
    create_path: zod_1.z.object({
        goal: zod_1.z.string().min(1).max(500),
        targetDate: zod_1.z.string().datetime().optional(),
    }),
    generate_spark: zod_1.z.object({
        context: zod_1.z.string().max(1000).optional(),
    }),
    search_web: zod_1.z.object({
        query: zod_1.z.string().min(1).max(500),
    }),
    end_conversation: zod_1.z.object({
        reason: zod_1.z.string().max(200).optional(),
    }),
    override_veto: zod_1.z.object({
        ackToken: zod_1.z.string().min(1),
        ackText: zod_1.z.string().min(1),
    }),
};
/**
 * Full RequestedAction schema.
 */
const RequestedActionSchema = zod_1.z.object({
    type: ActionTypeSchema,
    params: zod_1.z.record(zod_1.z.unknown()),
    source: ActionSourceSchema,
}).refine((data) => {
    // Validate params against action-specific schema
    const paramsSchema = ActionParamsSchemas[data.type];
    if (!paramsSchema)
        return false;
    const result = paramsSchema.safeParse(data.params);
    return result.success;
}, {
    message: 'Invalid parameters for action type',
});
/**
 * Schema for array of actions in API request.
 */
exports.RequestedActionsSchema = zod_1.z.array(RequestedActionSchema).max(10);
/**
 * Permission requirements per action type.
 */
const ACTION_PERMISSIONS = {
    set_reminder: { requiresAuth: true, adminOnly: false },
    create_path: { requiresAuth: true, adminOnly: false },
    generate_spark: { requiresAuth: false, adminOnly: false },
    search_web: { requiresAuth: false, adminOnly: false },
    end_conversation: { requiresAuth: false, adminOnly: false },
    override_veto: { requiresAuth: true, adminOnly: false }, // Requires auth + valid ackToken
};
/**
 * Check if user is authorized for an action.
 */
function isUserAuthorized(actionType, permissions) {
    const requirements = ACTION_PERMISSIONS[actionType];
    // Check if auth required
    if (requirements.requiresAuth && !permissions) {
        return false;
    }
    // Check admin requirement
    if (requirements.adminOnly && !permissions?.isAdmin) {
        return false;
    }
    // Check explicit allow list (if using fine-grained permissions)
    if (permissions?.allowedActions && permissions.allowedActions.length > 0) {
        return permissions.allowedActions.includes(actionType);
    }
    return true;
}
const ACTION_STATE_VALIDATORS = {
    set_reminder: () => true, // Always valid
    create_path: () => true,
    generate_spark: () => true,
    search_web: () => true,
    end_conversation: (state) => {
        // Can only end if session is active
        return state?.input?.sessionId != null && !state?.sessionEnded;
    },
    override_veto: (state) => {
        // Can only override if there's a pending soft veto
        return state?.pendingAck != null;
    },
};
/**
 * Check if action is valid given current pipeline state.
 */
function isActionValidInState(actionType, state) {
    const validator = ACTION_STATE_VALIDATORS[actionType];
    return validator(state);
}
// ─────────────────────────────────────────────────────────────────────────────────
// MAIN VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────────
/**
 * Validate and authorize an array of RequestedActions at API boundary.
 *
 * This should be called BEFORE any pipeline processing.
 * Invalid or unauthorized actions are rejected at this layer.
 *
 * @param rawActions - Actions from API request body
 * @param permissions - User's permissions (null if unauthenticated)
 * @param state - Current pipeline state (null for new requests)
 * @returns Validation result with valid actions or errors
 */
function validateRequestedActions(rawActions, permissions, state = null) {
    const errors = [];
    const validActions = [];
    // Handle null/undefined
    if (!rawActions) {
        return { valid: true, errors: [], validActions: [] };
    }
    // Must be array
    if (!Array.isArray(rawActions)) {
        return {
            valid: false,
            errors: [{ index: -1, reason: 'requestedActions must be an array', code: 'INVALID_TYPE' }],
            validActions: [],
        };
    }
    // Validate each action
    for (let i = 0; i < rawActions.length; i++) {
        const raw = rawActions[i];
        // ─────────────────────────────────────────────────────────────────────
        // Step 1: Schema validation
        // ─────────────────────────────────────────────────────────────────────
        const schemaResult = RequestedActionSchema.safeParse(raw);
        if (!schemaResult.success) {
            const firstError = schemaResult.error.errors[0];
            let code = 'INVALID_PARAMS';
            if (firstError?.path.includes('type')) {
                code = 'INVALID_TYPE';
            }
            else if (firstError?.path.includes('source')) {
                code = 'INVALID_SOURCE';
            }
            errors.push({
                index: i,
                action: raw?.type,
                reason: firstError?.message || 'Invalid action format',
                code,
            });
            continue;
        }
        const action = schemaResult.data;
        // ─────────────────────────────────────────────────────────────────────
        // Step 2: Authorization check
        // ─────────────────────────────────────────────────────────────────────
        if (!isUserAuthorized(action.type, permissions)) {
            errors.push({
                index: i,
                action: action.type,
                reason: `User not authorized for action: ${action.type}`,
                code: 'UNAUTHORIZED',
            });
            continue;
        }
        // ─────────────────────────────────────────────────────────────────────
        // Step 3: State validation
        // ─────────────────────────────────────────────────────────────────────
        if (!isActionValidInState(action.type, state)) {
            errors.push({
                index: i,
                action: action.type,
                reason: `Action not valid in current state: ${action.type}`,
                code: 'INVALID_STATE',
            });
            continue;
        }
        // All checks passed
        validActions.push(action);
    }
    return {
        valid: errors.length === 0,
        errors,
        validActions,
    };
}
// ─────────────────────────────────────────────────────────────────────────────────
// EXPRESS/API MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────
/**
 * Express middleware for action validation.
 * Rejects requests with invalid actions before reaching pipeline.
 */
function actionValidationMiddleware(getPermissions, getState) {
    return (req, res, next) => {
        const permissions = getPermissions(req);
        const state = getState(req);
        const result = validateRequestedActions(req.body?.requestedActions, permissions, state);
        if (!result.valid) {
            return res.status(400).json({
                error: 'INVALID_ACTIONS',
                message: 'One or more requested actions are invalid',
                details: result.errors,
            });
        }
        // Replace raw actions with validated ones
        req.body.requestedActions = result.validActions;
        next();
    };
}
//# sourceMappingURL=action-validator.js.map