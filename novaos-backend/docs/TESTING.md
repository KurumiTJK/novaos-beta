# NovaOS Testing Guide

## Test Types

### 1. Unit Tests
Fast, isolated tests for individual modules.

```bash
npm test                                    # All unit tests
npm test -- --run src/tests/sdk.test.ts     # Specific test file
npm test -- --coverage                      # With coverage report
```

### 2. Integration Tests
Test modules working together.

```bash
npm test -- --run src/tests/integration/
```

### 3. E2E Tests
Full user journey tests (requires running server).

```bash
# Terminal 1: Start server
npm run dev

# Terminal 2: Run E2E tests
E2E_BASE_URL=http://localhost:3000 npm test -- --run src/tests/e2e/
```

### 4. Load Tests (k6)
Performance and scalability testing.

```bash
# Install k6: https://k6.io/docs/get-started/installation/

# Run smoke test
k6 run --env K6_BASE_URL=http://localhost:3000 src/tests/load/k6-load-test.js

# Run with specific scenario
k6 run --env K6_BASE_URL=http://localhost:3000 \
  --env SCENARIO=load \
  src/tests/load/k6-load-test.js

# Run with custom VUs and duration
k6 run --vus 50 --duration 5m \
  --env K6_BASE_URL=http://localhost:3000 \
  src/tests/load/k6-load-test.js
```

### 5. Performance Benchmarks
Automated performance measurements.

```bash
BENCHMARK_BASE_URL=http://localhost:3000 npm test -- --run src/tests/load/benchmarks.test.ts
```

### 6. Chaos Tests
Resilience and failure scenario testing.

```bash
CHAOS_BASE_URL=http://localhost:3000 npm test -- --run src/tests/load/chaos.test.ts
```

## Test Coverage

Run all tests with coverage:

```bash
npm run test:coverage
```

## CI/CD Integration

GitHub Actions workflow is configured at `.github/workflows/ci.yml`.

### Triggered on:
- Push to `main` or `develop`
- Pull requests to `main` or `develop`
- Manual workflow dispatch

### Jobs:
1. **lint** - ESLint and TypeScript checks
2. **unit-tests** - Unit test suite
3. **integration-tests** - Integration tests with Redis
4. **e2e-tests** - End-to-end user journeys
5. **load-tests** - k6 load testing (main branch only)
6. **chaos-tests** - Chaos testing (manual trigger)
7. **benchmark-tests** - Performance benchmarks (main branch only)
8. **docker** - Build and push Docker image

### Manual Triggers

Trigger specific test types manually:

```yaml
# Go to Actions > CI/CD Pipeline > Run workflow
run_e2e: 'true'    # Run E2E tests
run_load: 'true'   # Run Load tests
run_chaos: 'true'  # Run Chaos tests
```

## Performance Thresholds

| Endpoint | P95 Latency | P99 Latency |
|----------|-------------|-------------|
| /health | 50ms | 100ms |
| /auth/* | 100ms | 200ms |
| /chat | 3000ms | 5000ms |
| /goals/* | 200ms | 500ms |
| /memories/* | 150ms | 300ms |
| /search | 500ms | 1000ms |

## Writing New Tests

### Unit Test Template

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('MyModule', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

### E2E Test Template

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestUser, createAuthenticatedClient, createTestContext } from './utils.js';

describe('E2E: My Journey', () => {
  let ctx;
  let user;
  let client;

  beforeAll(async () => {
    ctx = await createTestContext('http://localhost:3000');
    user = await createTestUser(ctx.baseUrl, 'test@example.com');
    client = createAuthenticatedClient(ctx.baseUrl, user);
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  it('Step 1: Should do something', async () => {
    const response = await client.get('/api/v1/health');
    expect(response.status).toBe(200);
  });
});
```

## Troubleshooting

### Tests timeout
- Increase timeout: `npm test -- --testTimeout=30000`
- Check if server is running for E2E tests
- Check Redis connection for integration tests

### Flaky tests
- Add retry logic for network-dependent tests
- Use `waitUntil()` for async conditions
- Check for proper test isolation

### Load test failures
- Ensure server has enough resources
- Check rate limiting configuration
- Review error logs during tests
