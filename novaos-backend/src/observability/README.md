# NovaOS Observability Layer — Phase 3

Comprehensive observability infrastructure for NovaOS including structured logging, metrics, tracing, health checks, and alerting.

## Installation

```bash
# Extract to your project root
unzip novaos-observability-phase3.zip -d .

# Install dependencies (if not already present)
npm install pino pino-pretty prom-client
```

## Quick Start

```typescript
import express from 'express';
import {
  initializeObservability,
  requestMiddleware,
  metricsMiddleware,
  metricsEndpoint,
  createHealthRouter,
  getLogger,
} from './observability/index.js';

const app = express();

// Initialize all observability components
initializeObservability({
  logging: { level: 'info', pretty: true },
  metrics: { enabled: true },
  tracing: { enabled: false },
  enableConsoleAlerts: true,
});

// Apply middleware
app.use(requestMiddleware());
app.use(metricsMiddleware());

// Health endpoints
app.use(createHealthRouter());

// Metrics endpoint
app.get('/metrics', metricsEndpoint());

// Use logging
const logger = getLogger({ component: 'app' });
logger.info('Server starting');
```

## Module Structure

```
src/observability/
├── logging/
│   ├── context.ts        # AsyncLocalStorage for correlation IDs
│   ├── redaction.ts      # PII redaction rules
│   ├── logger.ts         # Pino-based structured logger
│   ├── middleware.ts     # Express request logging
│   └── index.ts
│
├── metrics/
│   ├── definitions.ts    # Prometheus metric definitions
│   ├── collector.ts      # Metrics registry
│   ├── middleware.ts     # Request metrics & /metrics endpoint
│   └── index.ts
│
├── tracing/
│   ├── tracer.ts         # OpenTelemetry-compatible tracer stub
│   ├── middleware.ts     # Express tracing middleware
│   └── index.ts
│
├── health/
│   ├── types.ts          # Health check types
│   ├── checks.ts         # Health check implementations
│   ├── dependencies.ts   # Redis, LLM, API health checks
│   ├── endpoint.ts       # /health, /ready, /status endpoints
│   └── index.ts
│
├── alerting/
│   ├── types.ts          # Alert types and configuration
│   ├── channels.ts       # Slack, PagerDuty, webhook channels
│   ├── rules.ts          # Predefined alert rules
│   ├── service.ts        # Alert service
│   └── index.ts
│
└── index.ts              # Main exports
```

## Features

### Logging

**Structured JSON logging** with automatic context injection:

```typescript
import { getLogger, runWithContext, createContext } from './observability/index.js';

const logger = getLogger({ component: 'auth' });

// Context is automatically included
logger.info('User logged in', { userId: '123' });
// Output: {"level":"info","time":"...","msg":"User logged in","component":"auth","requestId":"...","correlationId":"...","userId":"123"}
```

**PII Redaction**:
```typescript
import { redact, redactEmail } from './observability/index.js';

const safe = redact({ password: 'secret', email: 'john@example.com' });
// { password: '[REDACTED]', email: 'j***@example.com' }
```

### Metrics

**Prometheus-compatible metrics**:

```typescript
import { 
  incCounter, 
  observeHistogram, 
  startTimer,
  recordLLMRequest 
} from './observability/index.js';

// Manual recording
incCounter('custom_events_total', { type: 'signup' });
observeHistogram('custom_duration_seconds', 0.5, { operation: 'process' });

// Timer helper
const endTimer = startTimer('operation_duration_seconds');
await doOperation();
endTimer(); // Automatically records duration

// Specialized helpers
recordLLMRequest('openai', 'gpt-4o', 'chat', 1.5, 'success');
recordSparkCompletion('completed', 'daily');
```

**Predefined metrics**:
- `http_request_duration_seconds` - Request latency histogram
- `http_requests_total` - Request counter by method/path/status
- `auth_success_total`, `auth_failure_total` - Auth metrics
- `llm_request_duration_seconds`, `llm_tokens_used_total` - LLM metrics
- `sword_spark_completions_total`, `sword_reminder_sends_total` - Sword metrics
- `cache_hits_total`, `cache_misses_total` - Cache metrics
- `security_ssrf_decisions_total` - Security metrics

### Health Checks

**Kubernetes-compatible endpoints**:

```typescript
import { createHealthRouter, configureRedisHealth } from './observability/index.js';

// Configure dependencies
configureRedisHealth(() => storeManager.getStore());

// Add routes
app.use(createHealthRouter({
  version: '10.0.0',
  criticalChecks: ['redis'],
}));
```

**Endpoints**:
- `GET /health` - Full health check (200 or 503)
- `GET /health/live` - Liveness probe (always 200 if running)
- `GET /health/ready` - Readiness probe (200 if critical deps OK)
- `GET /status` - Detailed status with resources

**Programmatic checks**:
```typescript
import { isReady, isHealthy, checkHealth } from './observability/index.js';

if (await isReady()) {
  console.log('Service ready');
}

const health = await checkHealth();
console.log(health.summary); // { total: 5, healthy: 4, degraded: 1, unhealthy: 0 }
```

### Tracing

**OpenTelemetry-compatible spans** (stub implementation):

```typescript
import { withSpan, startSpan, configureTracer } from './observability/index.js';

// Enable tracing
configureTracer({ enabled: true, serviceName: 'novaos' });

// Automatic span management
const result = await withSpan('processOrder', async (span) => {
  span.setAttribute('order.id', orderId);
  return await processOrder(orderId);
});

// Manual span management
const span = startSpan('customOperation');
try {
  await doWork();
  span.setStatus('ok');
} catch (error) {
  span.recordException(error);
} finally {
  span.end();
}
```

### Alerting

**Fire alerts programmatically**:

```typescript
import { 
  fireCritical, 
  fireWarning,
  registerChannelConfig,
} from './observability/index.js';

// Register Slack channel
registerChannelConfig({
  id: 'slack-alerts',
  type: 'slack',
  name: 'Slack Alerts',
  enabled: true,
  webhookUrl: process.env.SLACK_WEBHOOK_URL!,
  channel: '#alerts',
});

// Fire alerts
await fireCritical('Database Connection Lost', 'Cannot connect to primary database', {
  source: 'health',
  labels: { component: 'database' },
});

await fireWarning('High Memory Usage', 'Memory usage exceeded 80%', {
  source: 'health',
  annotations: { usagePercent: 85 },
});
```

**Predefined alert rules** for health, security, performance, and business metrics.

## Environment Variables

```bash
# Logging
LOG_LEVEL=info              # trace, debug, info, warn, error, fatal
NODE_ENV=production         # Enables JSON output

# Metrics
METRICS_AUTH_TOKEN=xxx      # Bearer token for /metrics endpoint
METRICS_AUTH_USER=prometheus
METRICS_AUTH_PASS=xxx

# Alerting
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
PAGERDUTY_ROUTING_KEY=xxx
```

## Middleware Stack

Recommended order:

```typescript
// 1. Request context (correlation IDs)
app.use(requestMiddleware());

// 2. Metrics (before routes)
app.use(metricsMiddleware());

// 3. Tracing (optional)
app.use(tracingMiddleware());

// 4. Health routes
app.use(createHealthRouter());

// 5. Metrics endpoint
app.get('/metrics', metricsEndpoint());

// 6. Your routes...
app.use('/api', apiRouter);

// 7. Error logging (after routes)
app.use(errorLoggingMiddleware());
```

## Backward Compatibility

The logging module maintains backward compatibility with the existing API:

```typescript
// Old API still works
import { getLogger, logRequest } from './logging/index.js';

const logger = getLogger({ component: 'app' });
logger.info('Hello');
```

## Dependencies

Required (add to package.json):
```json
{
  "dependencies": {
    "pino": "^8.x",
    "pino-pretty": "^10.x"
  }
}
```

Optional (for full prom-client support):
```json
{
  "dependencies": {
    "prom-client": "^15.x"
  }
}
```

## File Listing

```
observability/
├── logging/
│   ├── context.ts        (320 lines)
│   ├── redaction.ts      (602 lines)
│   ├── logger.ts         (400 lines)
│   ├── middleware.ts     (300 lines)
│   └── index.ts          (120 lines)
├── metrics/
│   ├── definitions.ts    (600 lines)
│   ├── collector.ts      (450 lines)
│   ├── middleware.ts     (350 lines)
│   └── index.ts          (100 lines)
├── tracing/
│   ├── tracer.ts         (280 lines)
│   ├── middleware.ts     (150 lines)
│   └── index.ts          (40 lines)
├── health/
│   ├── types.ts          (200 lines)
│   ├── checks.ts         (350 lines)
│   ├── dependencies.ts   (300 lines)
│   ├── endpoint.ts       (300 lines)
│   └── index.ts          (100 lines)
├── alerting/
│   ├── types.ts          (250 lines)
│   ├── channels.ts       (400 lines)
│   ├── rules.ts          (250 lines)
│   ├── service.ts        (350 lines)
│   └── index.ts          (100 lines)
└── index.ts              (250 lines)
```

Total: ~22 TypeScript files, ~5,500 lines of code
