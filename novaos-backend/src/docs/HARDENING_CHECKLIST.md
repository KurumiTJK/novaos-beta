# NovaOS Production Hardening Checklist

Version 1.0 — Phase 20 Final Checklist

---

## Overview

This checklist ensures NovaOS is properly hardened for production deployment. Complete all items before going live.

---

## 1. Security Configuration

### 1.1 Authentication & Authorization

- [ ] `JWT_SECRET` is unique and at least 32 characters
- [ ] `JWT_SECRET` is stored securely (not in code or version control)
- [ ] `REQUIRE_AUTH=true` is set
- [ ] `JWT_EXPIRY` is set to appropriate value (recommended: 24h or less)
- [ ] API key rotation strategy is documented
- [ ] Admin endpoints are protected
- [ ] Role-based access control is configured

### 1.2 CORS & Origins

- [ ] `ALLOWED_ORIGINS` contains only trusted domains
- [ ] Wildcard (`*`) is NOT used in production
- [ ] Credentials are only allowed for specific origins
- [ ] Preflight requests are handled correctly

### 1.3 Security Headers

All headers verified via `curl -I`:

- [ ] `Strict-Transport-Security` (HSTS) is present
- [ ] `X-Content-Type-Options: nosniff` is present
- [ ] `X-Frame-Options: DENY` is present
- [ ] `X-XSS-Protection: 1; mode=block` is present
- [ ] `Content-Security-Policy` is configured
- [ ] `Referrer-Policy` is set
- [ ] `Permissions-Policy` restricts unnecessary features
- [ ] `X-Powered-By` is removed

### 1.4 HTTPS/TLS

- [ ] HTTPS is enforced (HTTP redirects to HTTPS)
- [ ] TLS 1.2+ only (TLS 1.0/1.1 disabled)
- [ ] Strong cipher suites configured
- [ ] SSL certificates are valid and not expiring soon
- [ ] Certificate chain is complete
- [ ] HSTS preload considered

### 1.5 Input Validation

- [ ] Request body size limits are enforced
- [ ] URL length limits are enforced
- [ ] Query parameter count limits are enforced
- [ ] JSON parsing has depth limits
- [ ] File upload limits are configured (if applicable)
- [ ] Input sanitization middleware is active
- [ ] HTML/script stripping is enabled
- [ ] Path traversal protection is active

---

## 2. Rate Limiting & Abuse Prevention

### 2.1 Rate Limits

- [ ] Per-tier rate limits are configured
- [ ] Rate limit headers are exposed to clients
- [ ] Sliding window or token bucket algorithm is used
- [ ] Rate limits are stored in Redis (not in-memory)
- [ ] Rate limit bypass for health checks

### 2.2 Abuse Detection

- [ ] Prompt injection patterns are detected
- [ ] Harassment patterns are detected
- [ ] Repeated veto violations trigger blocks
- [ ] Auto-blocking after threshold exceeded
- [ ] Admin can manually block/unblock users

### 2.3 DDoS Protection

- [ ] Load balancer has DDoS protection
- [ ] Connection limits are configured
- [ ] Slowloris protection is enabled
- [ ] Geographic blocking available (if needed)

---

## 3. Data Protection

### 3.1 PII Handling

- [ ] `REDACT_PII=true` is set for logs
- [ ] IP addresses are anonymized in logs
- [ ] User data is encrypted at rest
- [ ] Sensitive fields are not logged
- [ ] Session data has appropriate TTL

### 3.2 Secrets Management

- [ ] All secrets are in environment variables or secret manager
- [ ] No secrets in code, configs, or logs
- [ ] Secrets are rotated regularly
- [ ] Secret access is audited
- [ ] Different secrets per environment

### 3.3 Audit Logging

- [ ] Audit logging is enabled
- [ ] Audit logs include request IDs
- [ ] Audit logs include gate execution details
- [ ] Audit logs are stored securely
- [ ] Audit log retention policy is defined
- [ ] Audit logs are tamper-evident

---

## 4. Infrastructure

### 4.1 Network Security

- [ ] Internal services not exposed publicly
- [ ] Redis not accessible from internet
- [ ] Firewall rules are minimal (deny by default)
- [ ] Network segmentation is implemented
- [ ] VPN/private networking for sensitive traffic

### 4.2 Container Security

- [ ] Running as non-root user
- [ ] Read-only root filesystem
- [ ] No privileged containers
- [ ] Resource limits are set
- [ ] Security scanning of images
- [ ] Base image is minimal and up-to-date

### 4.3 Kubernetes Security (if applicable)

- [ ] Network policies restrict pod communication
- [ ] Pod security policies/standards enforced
- [ ] Secrets are encrypted in etcd
- [ ] RBAC is configured properly
- [ ] Service accounts have minimal permissions

---

## 5. Resilience

### 5.1 Circuit Breakers

- [ ] LLM circuit breaker is configured
- [ ] Redis circuit breaker is configured
- [ ] External API circuit breakers are configured
- [ ] Circuit breaker thresholds are tuned
- [ ] Circuit breaker status is monitored

### 5.2 Health Checks

- [ ] `/health` endpoint returns quickly
- [ ] `/ready` endpoint checks dependencies
- [ ] Load balancer health checks configured
- [ ] Kubernetes probes configured
- [ ] Health checks don't overload system

### 5.3 Graceful Degradation

- [ ] Fallback LLM provider is configured
- [ ] In-memory fallback for Redis failure
- [ ] Verification degradation works correctly
- [ ] Error responses are user-friendly
- [ ] Partial failures don't crash the system

### 5.4 Scaling

- [ ] Horizontal scaling is configured
- [ ] Auto-scaling rules are defined
- [ ] Resource requests/limits are appropriate
- [ ] Session affinity not required (stateless)
- [ ] Load balancer distributes evenly

---

## 6. Monitoring & Alerting

### 6.1 Metrics

- [ ] `/metrics` endpoint is available
- [ ] Prometheus/metrics collector is configured
- [ ] Key metrics are collected:
  - [ ] Request latency (p50, p95, p99)
  - [ ] Error rate
  - [ ] Request rate
  - [ ] Circuit breaker state
  - [ ] Rate limit hits
  - [ ] LLM token usage

### 6.2 Logging

- [ ] Structured JSON logging
- [ ] Log aggregation configured
- [ ] Log retention policy defined
- [ ] Log levels appropriate for production
- [ ] Request IDs are logged for tracing

### 6.3 Alerting

- [ ] High error rate alert
- [ ] High latency alert
- [ ] Circuit breaker open alert
- [ ] Memory/CPU threshold alerts
- [ ] Certificate expiry alert
- [ ] On-call rotation defined

---

## 7. Testing

### 7.1 Pre-Production Testing

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E tests pass in staging
- [ ] Load testing completed
- [ ] Security scan completed
- [ ] Penetration testing completed (if required)

### 7.2 Production Verification

- [ ] Smoke tests pass in production
- [ ] Health endpoints respond correctly
- [ ] Authentication works
- [ ] Rate limiting works
- [ ] Circuit breakers trigger correctly
- [ ] Logs are being collected
- [ ] Metrics are being scraped

---

## 8. Documentation

### 8.1 Operational Documentation

- [ ] Deployment guide is complete
- [ ] Runbook for common issues exists
- [ ] Escalation procedures documented
- [ ] Architecture diagram is current
- [ ] API documentation is current

### 8.2 Compliance Documentation

- [ ] Data flow diagram exists
- [ ] Privacy policy updated
- [ ] Terms of service updated
- [ ] Incident response plan exists
- [ ] Audit requirements documented

---

## 9. Backup & Recovery

### 9.1 Backups

- [ ] Redis backups configured
- [ ] Audit log backups configured
- [ ] Backup frequency is appropriate
- [ ] Backups are tested regularly
- [ ] Backups are stored securely (encrypted)

### 9.2 Recovery

- [ ] RTO (Recovery Time Objective) defined
- [ ] RPO (Recovery Point Objective) defined
- [ ] Recovery procedures documented
- [ ] Recovery tested in staging
- [ ] Rollback procedure documented

---

## 10. Go-Live Checklist

### Final Pre-Launch

- [ ] All checklist items above completed
- [ ] Staging environment mirrors production
- [ ] DNS configured correctly
- [ ] SSL certificate installed
- [ ] Monitoring dashboards ready
- [ ] Alert channels configured
- [ ] On-call team informed
- [ ] Rollback plan prepared

### Launch Day

- [ ] Deploy to production
- [ ] Verify health endpoints
- [ ] Run smoke tests
- [ ] Monitor error rates
- [ ] Monitor latency
- [ ] Check logs for issues
- [ ] Verify metrics collection
- [ ] Test critical user flows

### Post-Launch

- [ ] Monitor for 24-48 hours
- [ ] Review error logs
- [ ] Check performance metrics
- [ ] Gather user feedback
- [ ] Document any issues
- [ ] Update runbook as needed
- [ ] Schedule post-mortem if issues occurred

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| Security Review | | | |
| Operations | | | |
| Product Owner | | | |

---

*Checklist Version: 1.0*  
*Last Updated: Phase 20 Production Hardening*
