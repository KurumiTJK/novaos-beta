"use strict";
// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS SERVER — Main Entry Point
// Phase 1 Implementation
// ═══════════════════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServer = createServer;
exports.loadConfig = loadConfig;
const express_1 = __importDefault(require("express"));
const execution_pipeline_js_1 = require("./pipeline/execution-pipeline.js");
const routes_js_1 = require("./api/routes.js");
const nonce_store_js_1 = require("./storage/nonce-store.js");
const audit_adapter_js_1 = require("./audit/audit-adapter.js");
const spark_eligibility_js_1 = require("./helpers/spark-eligibility.js");
function loadConfig() {
    return {
        port: parseInt(process.env.PORT || '3000', 10),
        ackTokenSecret: process.env.ACK_TOKEN_SECRET || 'development-secret-change-in-production',
        enableAuditLogging: process.env.ENABLE_AUDIT_LOGGING !== 'false',
        enableWebVerification: process.env.ENABLE_WEB_VERIFICATION === 'true',
    };
}
// ─────────────────────────────────────────────────────────────────────────────────
// SERVER SETUP
// ─────────────────────────────────────────────────────────────────────────────────
async function createServer() {
    const config = loadConfig();
    const app = (0, express_1.default)();
    // Middleware
    app.use(express_1.default.json({ limit: '1mb' }));
    app.use(express_1.default.urlencoded({ extended: true }));
    // CORS (configure properly in production)
    app.use((_req, res, next) => {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, X-User-Id');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        next();
    });
    // Request logging
    app.use((req, _res, next) => {
        console.log(`[REQUEST] ${req.method} ${req.path}`);
        next();
    });
    // Initialize stores
    const nonceStore = (0, nonce_store_js_1.getDefaultNonceStore)();
    const sparkMetricsStore = new spark_eligibility_js_1.InMemorySparkMetricsStore();
    const auditLogger = config.enableAuditLogging ? (0, audit_adapter_js_1.getDefaultAuditLogger)() : undefined;
    // Web fetcher (placeholder - implement with actual HTTP client in production)
    const webFetcher = config.enableWebVerification ? {
        async search(query, options) {
            console.log(`[WEB] Search: ${query} (limit: ${options?.limit})`);
            // Placeholder - return empty results
            return [];
        },
        async fetch(url) {
            console.log(`[WEB] Fetch: ${url}`);
            // Placeholder - return mock result
            return {
                url,
                content: '',
                title: 'Mock Page',
                fetchedAt: new Date(),
                success: false,
                error: 'Web fetcher not implemented',
            };
        },
    } : null;
    // Create pipeline
    const pipeline = (0, execution_pipeline_js_1.createPipeline)({
        nonceStore,
        sparkMetricsStore,
        auditLogger,
        ackTokenSecret: config.ackTokenSecret,
        webFetcher,
    });
    // Mount routes
    const routes = (0, routes_js_1.createRoutes)({ pipeline });
    app.use('/api/v1', routes);
    // Health check at root
    app.get('/', (_req, res) => {
        res.json({
            name: 'NovaOS Backend',
            version: '4.0.0',
            status: 'running',
        });
    });
    // Error handler
    app.use(routes_js_1.errorHandler);
    return app;
}
// ─────────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────────
async function main() {
    try {
        const config = loadConfig();
        const app = await createServer();
        app.listen(config.port, () => {
            console.log('═══════════════════════════════════════════════════════════════════');
            console.log('  NovaOS Backend v4.0.0');
            console.log('═══════════════════════════════════════════════════════════════════');
            console.log(`  Server running on port ${config.port}`);
            console.log(`  Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`  Audit logging: ${config.enableAuditLogging ? 'enabled' : 'disabled'}`);
            console.log(`  Web verification: ${config.enableWebVerification ? 'enabled' : 'disabled'}`);
            console.log('═══════════════════════════════════════════════════════════════════');
            console.log('');
            console.log('  Endpoints:');
            console.log('    POST /api/v1/chat          - Main chat endpoint');
            console.log('    POST /api/v1/parse-command - Command parser');
            console.log('    GET  /api/v1/health        - Health check');
            console.log('    GET  /api/v1/versions      - Policy versions');
            console.log('');
            console.log('═══════════════════════════════════════════════════════════════════');
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
// Run if executed directly
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
    main();
}
//# sourceMappingURL=server.js.map