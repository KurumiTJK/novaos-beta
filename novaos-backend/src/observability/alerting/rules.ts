// ═══════════════════════════════════════════════════════════════════════════════
// ALERT RULES — Predefined Alert Rules for NovaOS
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════

import type { AlertRule } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// HEALTH ALERT RULES
// ─────────────────────────────────────────────────────────────────────────────────

export const HEALTH_RULES: AlertRule[] = [
  {
    id: 'health-redis-down',
    name: 'Redis Connection Lost',
    description: 'Redis is not connected or not responding',
    severity: 'critical',
    source: 'health',
    conditions: [
      {
        metric: 'redis_connected',
        operator: 'eq',
        threshold: 0,
        for: '1m',
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'redis' },
  },
  {
    id: 'health-memory-critical',
    name: 'Critical Memory Usage',
    description: 'Memory usage has exceeded 95%',
    severity: 'critical',
    source: 'health',
    conditions: [
      {
        metric: 'process_memory_percent',
        operator: 'gte',
        threshold: 95,
        for: '2m',
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'memory' },
  },
  {
    id: 'health-memory-warning',
    name: 'High Memory Usage',
    description: 'Memory usage has exceeded 80%',
    severity: 'warning',
    source: 'health',
    conditions: [
      {
        metric: 'process_memory_percent',
        operator: 'gte',
        threshold: 80,
        for: '5m',
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'memory' },
  },
  {
    id: 'health-event-loop-lag',
    name: 'High Event Loop Lag',
    description: 'Event loop lag is affecting performance',
    severity: 'warning',
    source: 'health',
    conditions: [
      {
        metric: 'nodejs_eventloop_lag_seconds',
        operator: 'gte',
        threshold: 0.1,
        for: '1m',
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'nodejs' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// PERFORMANCE ALERT RULES
// ─────────────────────────────────────────────────────────────────────────────────

export const PERFORMANCE_RULES: AlertRule[] = [
  {
    id: 'perf-high-latency',
    name: 'High API Latency',
    description: 'API response times are elevated',
    severity: 'warning',
    source: 'performance',
    conditions: [
      {
        metric: 'http_request_duration_seconds_p95',
        operator: 'gte',
        threshold: 2,
        for: '5m',
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'api' },
  },
  {
    id: 'perf-llm-slow',
    name: 'Slow LLM Responses',
    description: 'LLM API calls are taking longer than expected',
    severity: 'warning',
    source: 'performance',
    conditions: [
      {
        metric: 'llm_request_duration_seconds_p95',
        operator: 'gte',
        threshold: 30,
        for: '5m',
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'llm' },
  },
  {
    id: 'perf-redis-slow',
    name: 'Slow Redis Operations',
    description: 'Redis operations are taking longer than expected',
    severity: 'warning',
    source: 'performance',
    conditions: [
      {
        metric: 'redis_operation_duration_seconds_p95',
        operator: 'gte',
        threshold: 0.1,
        for: '2m',
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'redis' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// SECURITY ALERT RULES
// ─────────────────────────────────────────────────────────────────────────────────

export const SECURITY_RULES: AlertRule[] = [
  {
    id: 'sec-auth-failures-spike',
    name: 'Authentication Failure Spike',
    description: 'High number of authentication failures detected',
    severity: 'warning',
    source: 'security',
    conditions: [
      {
        metric: 'auth_failure_total_rate_5m',
        operator: 'gte',
        threshold: 10,
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'auth' },
    cooldown: '15m',
  },
  {
    id: 'sec-rate-limit-abuse',
    name: 'Rate Limit Abuse',
    description: 'Excessive rate limit hits from single source',
    severity: 'warning',
    source: 'security',
    conditions: [
      {
        metric: 'rate_limit_hits_total_rate_5m',
        operator: 'gte',
        threshold: 50,
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'rate_limit' },
    cooldown: '10m',
  },
  {
    id: 'sec-ssrf-blocks',
    name: 'SSRF Protection Activated',
    description: 'SSRF protection has blocked suspicious requests',
    severity: 'info',
    source: 'security',
    conditions: [
      {
        metric: 'security_ssrf_decisions_total',
        operator: 'gte',
        threshold: 5,
        labels: { decision: 'block' },
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'ssrf' },
    cooldown: '30m',
  },
  {
    id: 'sec-security-violation',
    name: 'Security Violation Detected',
    description: 'A security violation has been detected',
    severity: 'critical',
    source: 'security',
    conditions: [
      {
        metric: 'security_violations_total',
        operator: 'gte',
        threshold: 1,
        labels: { severity: 'high' },
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'security' },
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR ALERT RULES
// ─────────────────────────────────────────────────────────────────────────────────

export const ERROR_RULES: AlertRule[] = [
  {
    id: 'err-5xx-spike',
    name: '5xx Error Spike',
    description: 'High number of server errors',
    severity: 'critical',
    source: 'metrics',
    conditions: [
      {
        metric: 'http_requests_total_rate_5m',
        operator: 'gte',
        threshold: 10,
        labels: { status_code: '5xx' },
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'api' },
  },
  {
    id: 'err-llm-failures',
    name: 'LLM API Failures',
    description: 'LLM API is returning errors',
    severity: 'warning',
    source: 'metrics',
    conditions: [
      {
        metric: 'llm_errors_total_rate_5m',
        operator: 'gte',
        threshold: 5,
      },
    ],
    conditionLogic: 'and',
    enabled: true,
    labels: { component: 'llm' },
    cooldown: '10m',
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// BUSINESS ALERT RULES (Sword System)
// ─────────────────────────────────────────────────────────────────────────────────

export const BUSINESS_RULES: AlertRule[] = [
  {
    id: 'biz-spark-completion-low',
    name: 'Low Spark Completion Rate',
    description: 'Users are not completing their sparks',
    severity: 'info',
    source: 'business',
    conditions: [
      {
        metric: 'sword_spark_completion_rate',
        operator: 'lt',
        threshold: 0.2,
        for: '1h',
      },
    ],
    conditionLogic: 'and',
    enabled: false, // Disabled by default - enable for production
    labels: { component: 'sword' },
    cooldown: '6h',
  },
  {
    id: 'biz-reminder-escalation',
    name: 'High Reminder Escalation',
    description: 'Many reminders are reaching escalation level 3',
    severity: 'info',
    source: 'business',
    conditions: [
      {
        metric: 'sword_reminder_sends_total',
        operator: 'gte',
        threshold: 10,
        labels: { escalation_level: '3' },
      },
    ],
    conditionLogic: 'and',
    enabled: false,
    labels: { component: 'sword' },
    cooldown: '1h',
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// ALL RULES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * All predefined alert rules.
 */
export const ALL_ALERT_RULES: AlertRule[] = [
  ...HEALTH_RULES,
  ...PERFORMANCE_RULES,
  ...SECURITY_RULES,
  ...ERROR_RULES,
  ...BUSINESS_RULES,
];

/**
 * Get rules by source.
 */
export function getRulesBySource(source: string): AlertRule[] {
  return ALL_ALERT_RULES.filter(r => r.source === source);
}

/**
 * Get rules by severity.
 */
export function getRulesBySeverity(severity: string): AlertRule[] {
  return ALL_ALERT_RULES.filter(r => r.severity === severity);
}

/**
 * Get enabled rules only.
 */
export function getEnabledRules(): AlertRule[] {
  return ALL_ALERT_RULES.filter(r => r.enabled);
}

/**
 * Get rule by ID.
 */
export function getRuleById(id: string): AlertRule | undefined {
  return ALL_ALERT_RULES.find(r => r.id === id);
}
