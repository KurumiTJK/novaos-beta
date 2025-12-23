# Phase 17: Integration & Testing

NovaOS Sword System v3.0 — Test Infrastructure and E2E Verification

## Overview

Phase 17 provides comprehensive testing infrastructure for the Sword System, including:
- Test setup and configuration
- Mock implementations for Redis and LLM
- Reusable test fixtures
- Integration tests for core flows
- End-to-end tests for complete user journeys

## Directory Structure

```
src/tests/
├── setup.ts                    # Global test setup
├── index.ts                    # Central exports
├── mocks/
│   ├── index.ts               # Mock exports
│   ├── redis.ts               # MockRedisClient
│   └── llm.ts                 # MockLLMProvider
├── fixtures/
│   ├── index.ts               # Fixture exports
│   ├── users.ts               # User fixtures
│   └── goals.ts               # Goal/Quest/Step/Spark fixtures
├── integration/
│   ├── index.ts               # Integration test docs
│   ├── auth-flow.test.ts      # Authentication tests
│   ├── goal-creation.test.ts  # Goal lifecycle tests
│   └── spark-completion.test.ts # Spark lifecycle tests
└── e2e/
    ├── index.ts               # E2E test docs
    └── learn-rust-flow.test.ts # Complete user journey

vitest.config.ts               # Test runner configuration
```

## Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/tests/integration/auth-flow.test.ts

# Run in watch mode
npm run test:watch

# Run only integration tests
npm test -- src/tests/integration/

# Run only E2E tests
npm test -- src/tests/e2e/
```

## Test Configuration

### vitest.config.ts

The test runner is configured with:
- **Environment**: Node.js
- **Setup File**: `src/tests/setup.ts`
- **Coverage Provider**: V8
- **Coverage Thresholds**: 70% statements, 60% branches, 70% functions/lines
- **Test Timeout**: 10 seconds
- **Reporter**: Verbose

### Environment Variables

Set automatically in `setup.ts`:
- `NODE_ENV=test`
- `REDIS_DISABLED=true`
- `USE_MOCK_PROVIDER=true`
- `METRICS_DISABLED=true`
- `JWT_SECRET=test-jwt-secret-do-not-use-in-production`

## Mocks

### MockRedisClient

In-memory Redis implementation for testing.

```typescript
import { createMockRedis, getMockRedis } from './mocks/index.js';

// Get singleton instance
const redis = getMockRedis();

// Create isolated instance
const redis = createMockRedis();

// With call tracking
const redis = createSpyRedis();
redis._spies.get.mock.calls; // Access call history

// Test utilities
redis.seedData('key', 'value', 60); // Pre-populate
redis.inspectData(); // View all data
redis.getAllKeys(); // List keys
redis.reset(); // Clear between tests
```

**Supported Operations:**
- Basic: get, set, delete, exists, incr, expire, keys
- Hashes: hset, hget, hgetall, hmset, hdel
- Lists: rpush, lpush, lpop, lrange, llen
- Sets: sadd, srem, smembers, sismember
- Sorted Sets: zadd, zrangebyscore, zremrangebyscore, zcard
- Lua Scripts: rateLimit, acquireLock, releaseLock, createIfNotExists, conditionalUpdate

### MockLLMProvider

Configurable LLM mock for testing.

```typescript
import { createMockLLM, getMockLLM } from './mocks/index.js';

const llm = createMockLLM();

// Queue specific responses
llm.queueText('Hello world');
llm.queueJSON({ quests: [...] });
llm.queueError(new Error('API failed'));

// Set default behavior
llm.setDefaultCurriculum();
llm.setDefaultSpark();

// Custom response handler
llm.setDefaultResponse({
  handler: (req) => ({
    content: JSON.stringify({ ... }),
    finishReason: 'stop',
    usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    model: 'mock-v1',
  }),
});

// Inspect calls
llm.getCallCount();
llm.getLastCall();
llm.wasCalledWith('curriculum');
llm.getCalls();

// Reset
llm.reset();
```

## Fixtures

### User Fixtures

```typescript
import {
  createTestUser,
  createFreeUser,
  createProUser,
  createEnterpriseUser,
  createAdminUser,
  createTestRequestContext,
  TEST_USERS,
  TEST_USER_IDS,
} from './fixtures/index.js';

// Create users
const user = createFreeUser();
const proUser = createProUser({ email: 'custom@example.com' });

// Pre-defined users
TEST_USERS.alice  // Free tier
TEST_USERS.bob    // Pro tier
TEST_USERS.carol  // Enterprise tier
TEST_USERS.admin  // Admin user

// Request contexts
const ctx = createTestRequestContext(user);
const anonCtx = createAnonymousRequestContext();
```

### Goal/Entity Fixtures

```typescript
import {
  createTestGoal,
  createTestQuest,
  createTestStep,
  createTestSpark,
  createQuestSequence,
  createStepSequence,
  createLearnRustScenario,
} from './fixtures/index.js';

// Individual entities
const goal = createTestGoal(userId);
const quest = createTestQuest(goalId);
const step = createTestStep(questId);
const spark = createTestSpark(stepId);

// Sequences
const quests = createQuestSequence(goalId, 3);  // 3 quests
const steps = createStepSequence(questId, 5);   // 5 days

// Complete scenario
const scenario = createLearnRustScenario(userId);
// Returns: { goal, quests, steps, sparks, reminders }
```

## Test Categories

### Integration Tests

Test component interactions with mocked dependencies.

**auth-flow.test.ts**
- Token generation and validation
- Protected route access
- Token expiry and revocation
- User tier verification
- Request context creation

**goal-creation.test.ts**
- Goal creation with validation
- Quest generation via LLM
- Step generation and scheduling
- Initial spark creation
- Goal status transitions
- Quota enforcement
- Redis persistence

**spark-completion.test.ts**
- Spark completion flow
- Spark skipping with escalation
- Step/Quest/Goal completion cascades
- Difficulty rating
- Progress calculation
- Today's content retrieval

### E2E Tests

Test complete user journeys.

**learn-rust-flow.test.ts**
- Full registration → goal completion cycle
- Spark escalation (full → reduced → minimal)
- Progress tracking across days
- LLM integration
- Data persistence verification

## Writing New Tests

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ok, err } from '../../../types/result.js';
import { createMockRedis, createMockLLM } from '../../mocks/index.js';
import { createTestGoal, TEST_USERS } from '../../fixtures/index.js';

describe('Feature Name', () => {
  let redis: MockRedisClient;
  let llm: MockLLMProvider;
  
  beforeEach(() => {
    redis = createMockRedis();
    llm = createMockLLM();
    // Setup default responses
  });
  
  afterEach(() => {
    redis.reset();
    llm.reset();
  });
  
  describe('Sub-feature', () => {
    it('does something specific', async () => {
      // Arrange
      const goal = createTestGoal(TEST_USERS.alice.id);
      
      // Act
      const result = await someFunction(goal);
      
      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('active');
      }
    });
  });
});
```

### Patterns

**Result Pattern Assertions:**
```typescript
const result = await operation();
expect(result.ok).toBe(true);
if (result.ok) {
  expect(result.value.field).toBe('expected');
}

// For errors
expect(result.ok).toBe(false);
if (!result.ok) {
  expect(result.error.code).toBe('NOT_FOUND');
}
```

**Mock LLM Responses:**
```typescript
llm.setDefaultResponse({
  handler: (req) => {
    const prompt = req.messages.find(m => m.role === 'user')?.content ?? '';
    
    if (prompt.includes('curriculum')) {
      return { content: JSON.stringify({ quests: [...] }), ... };
    }
    
    return { content: '{}', ... };
  },
});
```

**Seeding Test Data:**
```typescript
engine.seedGoal(goal);
engine.seedQuest(quest);
engine.seedStep(step);
engine.seedSpark(spark);
```

## Coverage Requirements

| Metric     | Threshold |
|------------|-----------|
| Statements | 70%       |
| Branches   | 60%       |
| Functions  | 70%       |
| Lines      | 70%       |

## Utilities

From `setup.ts`:
```typescript
import {
  sleep,
  nextTick,
  createDeferred,
  randomString,
  toDateString,
  todayString,
  dateOffset,
} from './setup.js';

await sleep(100);        // Wait 100ms
await nextTick();        // Wait for next event loop tick
const today = todayString();     // '2025-01-15'
const tomorrow = dateOffset(1);  // '2025-01-16'
```

## Phase 17 Deliverables

| Step | File | Description |
|------|------|-------------|
| 1 | `vitest.config.ts` | Test runner configuration |
| 1 | `src/tests/setup.ts` | Global test setup |
| 1 | `src/tests/mocks/redis.ts` | Redis mock |
| 1 | `src/tests/mocks/llm.ts` | LLM mock |
| 1 | `src/tests/fixtures/users.ts` | User fixtures |
| 1 | `src/tests/fixtures/goals.ts` | Entity fixtures |
| 2 | `src/tests/integration/auth-flow.test.ts` | Auth tests |
| 3 | `src/tests/integration/goal-creation.test.ts` | Goal tests |
| 4 | `src/tests/integration/spark-completion.test.ts` | Spark tests |
| 5 | `src/tests/e2e/learn-rust-flow.test.ts` | E2E test |
| 6 | `README.md` | This documentation |
