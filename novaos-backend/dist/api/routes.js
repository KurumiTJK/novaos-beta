"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES — NovaOS Backend API
// Chat endpoint with explicit action support
// ═══════════════════════════════════════════════════════════════════════════════
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRoutes = createRoutes;
exports.errorHandler = errorHandler;
const express_1 = require("express");
const action_validator_js_1 = require("../helpers/action-validator.js");
function createRoutes(config) {
    const router = (0, express_1.Router)();
    const { pipeline, getUser } = config;
    // ─────────────────────────────────────────────────────────────────────────────
    // MIDDLEWARE
    // ─────────────────────────────────────────────────────────────────────────────
    // Extract user from request (placeholder - implement auth in production)
    const extractUser = (req) => {
        if (getUser) {
            return getUser(req);
        }
        // Default: extract from header or body
        const userId = req.headers['x-user-id'] || req.body?.userId;
        if (!userId) {
            return null;
        }
        return {
            id: userId,
            permissions: {
                userId,
                allowedActions: [
                    'set_reminder',
                    'create_path',
                    'generate_spark',
                    'search_web',
                    'end_conversation',
                    'override_veto',
                ],
                isAdmin: false,
            },
        };
    };
    // Validate actions middleware
    const validateActions = (0, action_validator_js_1.actionValidationMiddleware)((req) => extractUser(req)?.permissions ?? null, () => null // No existing state for new requests
    );
    // ─────────────────────────────────────────────────────────────────────────────
    // CHAT ENDPOINT
    // ─────────────────────────────────────────────────────────────────────────────
    router.post('/chat', validateActions, async (req, res) => {
        try {
            const user = extractUser(req);
            const body = req.body;
            // Build user input
            const input = {
                userId: user?.id ?? `anon_${Date.now()}`,
                sessionId: body.sessionId || `session_${Date.now()}`,
                message: body.message,
                // EXPLICIT actions only - validated by middleware
                requestedActions: body.requestedActions?.map(a => ({
                    ...a,
                    source: 'api_field',
                })),
                // Soft veto acknowledgment
                ackToken: body.ackToken,
                ackText: body.ackText,
                // Optional hints
                intentHints: body.intentHints,
            };
            // Execute pipeline
            const result = await pipeline.execute(input);
            // Handle await_ack response
            if (result.pendingAck) {
                const response = {
                    type: 'await_ack',
                    message: result.message,
                    ackRequired: {
                        token: result.pendingAck.ackToken,
                        requiredText: result.pendingAck.requiredText,
                        expiresAt: result.pendingAck.expiresAt,
                    },
                    reason: result.stoppedReason,
                };
                return res.status(200).json(response);
            }
            // Handle stop response
            if (result.stopped) {
                const response = {
                    type: 'stopped',
                    message: result.message,
                    reason: result.stoppedReason,
                    userOptions: result.userOptions,
                };
                return res.status(200).json(response);
            }
            // Success response
            const response = {
                type: 'success',
                message: result.message,
                stance: result.stance,
                confidence: result.confidence,
                verified: result.verified,
                freshnessWarning: result.freshnessWarning,
                spark: result.spark,
                transparency: result.transparency,
                debug: req.query.debug === 'true' ? result.debug : undefined,
            };
            return res.status(200).json(response);
        }
        catch (error) {
            console.error('[API] Chat endpoint error:', error);
            return res.status(500).json({
                type: 'error',
                message: 'An unexpected error occurred',
                error: process.env.NODE_ENV === 'development'
                    ? error.message
                    : undefined,
            });
        }
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // COMMAND PARSER ENDPOINT
    // Strict grammar for explicit commands
    // ─────────────────────────────────────────────────────────────────────────────
    router.post('/parse-command', (req, res) => {
        try {
            const { text } = req.body;
            if (!text || typeof text !== 'string') {
                return res.status(400).json({
                    error: 'INVALID_REQUEST',
                    message: 'Text is required',
                });
            }
            const commands = parseCommands(text);
            return res.json({
                commands: commands.map(c => ({
                    ...c,
                    source: 'command_parser',
                })),
            });
        }
        catch (error) {
            console.error('[API] Parse command error:', error);
            return res.status(500).json({
                error: 'PARSE_ERROR',
                message: 'Failed to parse command',
            });
        }
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // HEALTH CHECK
    // ─────────────────────────────────────────────────────────────────────────────
    router.get('/health', (_req, res) => {
        res.json({
            status: 'ok',
            version: '4.0.0',
            timestamp: new Date().toISOString(),
        });
    });
    // ─────────────────────────────────────────────────────────────────────────────
    // POLICY VERSIONS
    // ─────────────────────────────────────────────────────────────────────────────
    router.get('/versions', (_req, res) => {
        res.json({
            policy: '4.0.0',
            capability: '4.0.0',
            constraints: '4.0.0',
            verification: '4.0.0',
            freshness: '4.0.0',
        });
    });
    return router;
}
const COMMAND_PATTERNS = [
    // /remind [time] [message]
    {
        pattern: /^\/remind\s+(?:me\s+)?(?:at\s+)?(.+?)\s+to\s+(.+)$/i,
        type: 'set_reminder',
        extract: (match) => ({
            triggerAt: parseTime(match[1]),
            title: match[2],
        }),
    },
    // /path [goal]
    {
        pattern: /^\/path\s+(.+)$/i,
        type: 'create_path',
        extract: (match) => ({
            goal: match[1],
        }),
    },
    // /spark
    {
        pattern: /^\/spark$/i,
        type: 'generate_spark',
        extract: () => ({}),
    },
    // /search [query]
    {
        pattern: /^\/search\s+(.+)$/i,
        type: 'search_web',
        extract: (match) => ({
            query: match[1],
        }),
    },
    // /end
    {
        pattern: /^\/end$/i,
        type: 'end_conversation',
        extract: () => ({}),
    },
];
function parseCommands(text) {
    const commands = [];
    for (const { pattern, type, extract } of COMMAND_PATTERNS) {
        const match = text.match(pattern);
        if (match) {
            commands.push({
                type,
                params: extract(match),
            });
        }
    }
    return commands;
}
/**
 * Parse time string to ISO datetime.
 * Simple implementation - production would be more robust.
 */
function parseTime(timeStr) {
    const now = new Date();
    // Handle "in X minutes/hours"
    const inMatch = timeStr.match(/in\s+(\d+)\s+(minute|hour|day)s?/i);
    if (inMatch) {
        const amount = parseInt(inMatch[1]);
        const unit = inMatch[2].toLowerCase();
        switch (unit) {
            case 'minute':
                now.setMinutes(now.getMinutes() + amount);
                break;
            case 'hour':
                now.setHours(now.getHours() + amount);
                break;
            case 'day':
                now.setDate(now.getDate() + amount);
                break;
        }
        return now.toISOString();
    }
    // Handle "tomorrow at X"
    const tomorrowMatch = timeStr.match(/tomorrow\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (tomorrowMatch) {
        let hours = parseInt(tomorrowMatch[1]);
        const minutes = tomorrowMatch[2] ? parseInt(tomorrowMatch[2]) : 0;
        const ampm = tomorrowMatch[3]?.toLowerCase();
        if (ampm === 'pm' && hours !== 12)
            hours += 12;
        if (ampm === 'am' && hours === 12)
            hours = 0;
        now.setDate(now.getDate() + 1);
        now.setHours(hours, minutes, 0, 0);
        return now.toISOString();
    }
    // Default: 1 hour from now
    now.setHours(now.getHours() + 1);
    return now.toISOString();
}
// ─────────────────────────────────────────────────────────────────────────────────
// ERROR HANDLER
// ─────────────────────────────────────────────────────────────────────────────────
function errorHandler(err, _req, res, _next) {
    console.error('[API] Unhandled error:', err);
    res.status(500).json({
        type: 'error',
        message: 'An unexpected error occurred',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
}
//# sourceMappingURL=routes.js.map