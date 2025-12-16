# NovaOS Production Deployment Guide

Version 1.0 — Phase 20: Production Hardening

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Configuration](#environment-configuration)
4. [Security Checklist](#security-checklist)
5. [Deployment Options](#deployment-options)
6. [Monitoring & Observability](#monitoring--observability)
7. [Performance Tuning](#performance-tuning)
8. [Disaster Recovery](#disaster-recovery)
9. [Troubleshooting](#troubleshooting)

---

## Overview

NovaOS is an enforcement-first AI kernel implementing the Nova Constitution with Shield, Lens, and Sword capabilities. This guide covers production deployment best practices, security hardening, and operational considerations.

### Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            Load Balancer (HTTPS)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                            API Gateway / Ingress                            │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  NovaOS     │  │  NovaOS     │  │  NovaOS     │  │  NovaOS     │        │
│  │  Instance 1 │  │  Instance 2 │  │  Instance 3 │  │  Instance N │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
├─────────┼─────────────────┼─────────────────┼─────────────────┼────────────┤
│         └─────────────────┴─────────────────┴─────────────────┘            │
│                              Redis Cluster                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                           LLM Provider APIs                                 │
│                     (OpenAI / Gemini / Anthropic)                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| Memory | 2 GB | 4+ GB |
| Disk | 10 GB SSD | 50+ GB SSD |
| Node.js | 20.x | 20.x LTS |

### Required Services

- **Redis 7+** — Session storage, rate limiting, caching
- **LLM Provider** — OpenAI API key or Gemini API key
- **SSL Certificate** — For HTTPS termination

### Optional Services

- **PostgreSQL** — For persistent audit logs
- **Prometheus** — Metrics collection
- **Grafana** — Dashboards
- **Elasticsearch** — Log aggregation

---

## Environment Configuration

### Required Environment Variables

```bash
# ═══════════════════════════════════════════════════════════════════════════════
# CORE CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

# Environment
NODE_ENV=production
PORT=3000

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY (CRITICAL)
# ═══════════════════════════════════════════════════════════════════════════════

# JWT Secret — MUST be unique and secure (min 32 chars)
JWT_SECRET=your-unique-secret-key-minimum-32-characters-long

# Allowed origins for CORS (comma-separated)
ALLOWED_ORIGINS=https://yourdomain.com,https://app.yourdomain.com

# ═══════════════════════════════════════════════════════════════════════════════
# AUTHENTICATION
# ═══════════════════════════════════════════════════════════════════════════════

# Require authentication for all API calls
REQUIRE_AUTH=true

# JWT token expiry
JWT_EXPIRY=24h

# ═══════════════════════════════════════════════════════════════════════════════
# REDIS
# ═══════════════════════════════════════════════════════════════════════════════

# Redis connection URL (with password)
REDIS_URL=redis://:password@redis-host:6379/0

# Optional: Redis cluster mode
# REDIS_CLUSTER_NODES=host1:6379,host2:6379,host3:6379

# ═══════════════════════════════════════════════════════════════════════════════
# LLM PROVIDERS
# ═══════════════════════════════════════════════════════════════════════════════

# Preferred provider: openai, gemini, or mock
PREFERRED_PROVIDER=openai

# OpenAI API key
OPENAI_API_KEY=sk-your-openai-api-key

# Gemini API key (backup)
GEMINI_API_KEY=your-gemini-api-key

# ═══════════════════════════════════════════════════════════════════════════════
# RATE LIMITING
# ═══════════════════════════════════════════════════════════════════════════════

# Custom rate limits per tier (requests per minute)
RATE_LIMIT_FREE=10
RATE_LIMIT_PRO=60
RATE_LIMIT_ENTERPRISE=300

# ═══════════════════════════════════════════════════════════════════════════════
# SECURITY HEADERS
# ═══════════════════════════════════════════════════════════════════════════════

# HSTS configuration
HSTS_MAX_AGE=63072000
HSTS_INCLUDE_SUBDOMAINS=true
HSTS_PRELOAD=true

# Trust proxy (set to true behind load balancer)
TRUST_PROXY=true

# ═══════════════════════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════════════════════

# Log level: debug, info, warn, error
LOG_LEVEL=info

# Redact PII from logs
REDACT_PII=true

# Audit log storage: memory, file, database
AUDIT_STORAGE_TYPE=file
AUDIT_FILE_PATH=/var/log/novaos/audit

# ═══════════════════════════════════════════════════════════════════════════════
# VERIFICATION (Web Fetch)
# ═══════════════════════════════════════════════════════════════════════════════

# Enable web verification
ENABLE_WEB_FETCH=true

# Timeouts
WEB_FETCH_CONNECT_TIMEOUT_MS=5000
WEB_FETCH_READ_TIMEOUT_MS=10000
WEB_FETCH_TOTAL_TIMEOUT_MS=15000

# Security
WEB_FETCH_ALLOW_PRIVATE_IPS=false
WEB_FETCH_ALLOW_LOCALHOST=false
WEB_FETCH_VALIDATE_CERTS=true
```

### Secret Management

**Never commit secrets to version control!**

Recommended approaches:
1. **Kubernetes Secrets** — For K8s deployments
2. **AWS Secrets Manager** — For AWS deployments
3. **HashiCorp Vault** — For multi-cloud
4. **Environment files** — For simple deployments (not in repo)

```bash
# Create .env.production file (do NOT commit)
cp .env.example .env.production
# Edit with your production values
```

---

## Security Checklist

### Pre-Deployment Checklist

- [ ] **JWT_SECRET** is unique and at least 32 characters
- [ ] **ALLOWED_ORIGINS** is set to your actual domains only
- [ ] **REQUIRE_AUTH** is set to `true`
- [ ] **NODE_ENV** is set to `production`
- [ ] Redis password is configured
- [ ] SSL/TLS certificates are valid and not expired
- [ ] All API keys are from production accounts
- [ ] Audit logging is enabled
- [ ] PII redaction is enabled
- [ ] Rate limiting is configured appropriately

### Security Headers Verification

After deployment, verify security headers:

```bash
# Check security headers
curl -I https://your-api.com/health

# Expected headers:
# Strict-Transport-Security: max-age=63072000; includeSubDomains
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
# Content-Security-Policy: default-src 'none'; frame-ancestors 'none'
# Referrer-Policy: strict-origin-when-cross-origin
```

### SSL/TLS Configuration

Recommended cipher suites:

```nginx
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_prefer_server_ciphers on;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 1d;
ssl_session_tickets off;
ssl_stapling on;
ssl_stapling_verify on;
```

---

## Deployment Options

### Docker Deployment

```bash
# Build the image
docker build -t novaos-backend:latest .

# Run with environment file
docker run -d \
  --name novaos \
  -p 3000:3000 \
  --env-file .env.production \
  --restart unless-stopped \
  novaos-backend:latest

# With resource limits
docker run -d \
  --name novaos \
  -p 3000:3000 \
  --env-file .env.production \
  --memory="2g" \
  --cpus="2" \
  --restart unless-stopped \
  novaos-backend:latest
```

### Docker Compose

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  novaos:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.production
    depends_on:
      - redis
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis-data:/data
    deploy:
      resources:
        limits:
          memory: 1G

volumes:
  redis-data:
```

### Kubernetes Deployment

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: novaos
  labels:
    app: novaos
spec:
  replicas: 3
  selector:
    matchLabels:
      app: novaos
  template:
    metadata:
      labels:
        app: novaos
    spec:
      containers:
      - name: novaos
        image: ghcr.io/your-org/novaos-backend:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: novaos-secrets
        - configMapRef:
            name: novaos-config
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          readOnlyRootFilesystem: true
          allowPrivilegeEscalation: false
---
apiVersion: v1
kind: Service
metadata:
  name: novaos
spec:
  selector:
    app: novaos
  ports:
  - port: 80
    targetPort: 3000
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: novaos
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: novaos
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

## Monitoring & Observability

### Health Endpoints

| Endpoint | Purpose | Expected Response |
|----------|---------|-------------------|
| `GET /health` | Liveness check | `{"status": "ok"}` |
| `GET /ready` | Readiness check | `{"status": "ready", "checks": {...}}` |
| `GET /api/v1/health` | API health | Detailed status with Redis/LLM checks |

### Metrics Endpoint

The `/metrics` endpoint provides Prometheus-compatible metrics:

```bash
# Prometheus scrape config
scrape_configs:
  - job_name: 'novaos'
    static_configs:
      - targets: ['novaos:3000']
    metrics_path: '/metrics'
```

### Key Metrics to Monitor

| Metric | Type | Alert Threshold |
|--------|------|-----------------|
| `http_request_duration_seconds` | Histogram | p95 > 2s |
| `http_requests_total` | Counter | Error rate > 5% |
| `circuit_breaker_state` | Gauge | open = 1 |
| `rate_limit_exceeded_total` | Counter | Spike detection |
| `llm_token_usage_total` | Counter | Budget alerts |

### Logging Best Practices

```typescript
// Structured logging format
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "requestId": "req_abc123",
  "userId": "usr_xyz", // Redacted if REDACT_PII=true
  "component": "pipeline",
  "message": "Request processed",
  "duration": 245,
  "stance": "lens",
  "gatesExecuted": ["intent", "shield", "lens", "stance", "capability", "model", "personality", "spark"]
}
```

---

## Performance Tuning

### Node.js Configuration

```bash
# Production Node.js settings
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=2048 --max-http-header-size=16384"
UV_THREADPOOL_SIZE=16
```

### Rate Limiting Recommendations

| Tier | Requests/min | Tokens/min | Concurrent |
|------|--------------|------------|------------|
| Free | 10 | 10,000 | 2 |
| Pro | 60 | 100,000 | 10 |
| Enterprise | 300 | 500,000 | 50 |

### Redis Configuration

```redis
# Recommended Redis settings for NovaOS
maxmemory 1gb
maxmemory-policy allkeys-lru
tcp-keepalive 300
timeout 0
```

### Connection Pooling

The application maintains connection pools for:
- Redis: 10 connections by default
- HTTP (LLM APIs): Keep-alive enabled

---

## Disaster Recovery

### Backup Strategy

1. **Redis RDB Snapshots** — Every 15 minutes
2. **Redis AOF** — Every second (if persistence critical)
3. **Audit Logs** — Replicated to S3/GCS daily

### Recovery Procedures

#### Redis Failure

```bash
# NovaOS will automatically fall back to in-memory storage
# when Redis is unavailable. Monitor logs for:
# [STORAGE] Redis connection failed, using in-memory fallback

# To restore:
# 1. Fix Redis instance
# 2. NovaOS will reconnect automatically
```

#### LLM Provider Failure

```bash
# Circuit breaker will open after 3 consecutive failures
# Fallback to secondary provider if configured

# Manual intervention:
# 1. Check LLM provider status
# 2. If prolonged outage, switch PREFERRED_PROVIDER
# 3. Restart instances or wait for circuit reset (60s)
```

### High Availability Setup

For HA deployments:

1. **Multiple instances** behind load balancer
2. **Redis Cluster** or Redis Sentinel for HA
3. **Health checks** for automatic failover
4. **Geographic distribution** for DR

---

## Troubleshooting

### Common Issues

#### 1. High Latency

**Symptoms:** Response times > 2s

**Checks:**
```bash
# Check LLM circuit breaker status
curl https://your-api.com/api/v1/health | jq '.circuits'

# Check Redis latency
redis-cli --latency

# Check system resources
top -p $(pgrep node)
```

**Solutions:**
- Scale horizontally
- Increase LLM timeout
- Enable response caching

#### 2. Rate Limiting Too Aggressive

**Symptoms:** Users getting 429 errors frequently

**Checks:**
```bash
# Check current rate limit headers
curl -I https://your-api.com/api/v1/chat \
  -H "Authorization: Bearer token"
# Look for X-RateLimit-* headers
```

**Solutions:**
- Increase tier limits
- Adjust RATE_LIMIT_* env vars
- Consider per-endpoint limits

#### 3. Circuit Breaker Opens

**Symptoms:** 503 errors with "Circuit open"

**Checks:**
```bash
# Check circuit status
curl https://your-api.com/api/v1/health/circuits

# Check LLM provider status
curl https://status.openai.com/api/v2/status.json
```

**Solutions:**
- Wait for automatic reset (30-60s)
- Check LLM provider status
- Manual reset if stuck

#### 4. Memory Issues

**Symptoms:** Process restarts, OOM errors

**Checks:**
```bash
# Check memory usage
node --expose-gc -e "console.log(process.memoryUsage())"

# Check for leaks
node --inspect your-app.js
# Use Chrome DevTools to profile
```

**Solutions:**
- Increase memory limit
- Check for conversation memory leaks
- Enable Redis for session storage

### Log Analysis

```bash
# Search for errors
grep -E "ERROR|FATAL" /var/log/novaos/*.log

# Check shield interventions
grep "hard_veto\|soft_veto" /var/log/novaos/audit/*.log

# Monitor circuit breakers
grep "CIRCUIT_BREAKER" /var/log/novaos/*.log | tail -100
```

---

## Support

For issues:
1. Check this guide
2. Review application logs
3. Check monitoring dashboards
4. Open GitHub issue with:
   - NovaOS version
   - Deployment type (Docker/K8s/etc.)
   - Relevant logs (redacted)
   - Steps to reproduce

---

*Document Version: 1.0*  
*Last Updated: Phase 20 Production Hardening*
