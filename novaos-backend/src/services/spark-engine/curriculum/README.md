# Phase 7: LLM Security & Curriculum

Secure LLM client with prompt injection protection and curriculum structuring that organizes verified resources into learning plans.

## Overview

This module provides a secure layer between the application and LLM providers, with comprehensive protection against:

- Prompt injection attacks
- Token limit violations
- Service unavailability (circuit breaker)
- LLM hallucinations (fabricated resources)
- Malformed output

**INVARIANT**: The LLM only organizes verified resources, never fabricates them.

## Installation

Copy the `curriculum/` directory to your `src/services/spark-engine/` folder.

```bash
unzip phase7-llm-curriculum.zip -d your-project/src/services/spark-engine/
```

## Dependencies

- `zod` - Schema validation
- Phase 6 Resource Discovery (`resource-discovery/types.ts`)
- Infrastructure (`circuit-breaker/`, `observability/`, `types/result.ts`)

## Quick Start

### Initialize the Secure LLM Client

```typescript
import { ProviderManager } from './model-providers';
import { initSecureLLMClientFromManager } from './curriculum';

// Initialize with your existing ProviderManager
const providerManager = new ProviderManager({
  openaiApiKey: process.env.OPENAI_API_KEY,
});

initSecureLLMClientFromManager(providerManager, {
  model: 'gpt-4o',
  circuitBreakerName: 'llm-provider',
});
```

### Generate a Curriculum

```typescript
import { generateCurriculum } from './curriculum';

const result = await generateCurriculum({
  goal: 'Learn TypeScript fundamentals',
  resources: verifiedResources,  // From Phase 6 Resource Discovery
  days: 7,
  minutesPerDay: 60,
  targetDifficulty: 'beginner',
  topics: ['typescript', 'programming'],
  userId: 'user-123',
  preferences: {
    includeExercises: true,
    progression: 'gradual',
  },
});

if (result.success) {
  const curriculum = result.curriculum;
  
  for (const day of curriculum.days) {
    console.log(`Day ${day.day}: ${day.theme}`);
    for (const resource of day.resources) {
      console.log(`  - ${resource.title} (${resource.minutes}min)`);
      console.log(`    URL: ${resource.url}`);
    }
  }
}
```

### Direct LLM Requests

```typescript
import { createLLMRequest, getSecureLLMClient } from './curriculum';

// Build a secure request
const request = createLLMRequest()
  .setPurpose('content_summary')
  .setSystemPrompt('Summarize the following content...')
  .setUserPrompt('Content to summarize...')
  .setUserId('user-123')
  .build();

// Execute with full security pipeline
const client = getSecureLLMClient();
const response = await client.execute(request);

if (response.ok) {
  console.log(response.content);
  console.log('Tokens used:', response.metrics.totalTokens);
} else {
  console.error(response.error.code, response.error.message);
}
```

## Architecture

### Security Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECURE LLM CLIENT                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Input → Sanitize → Token Check → Circuit → Execute → Validate │
│            │           │          Breaker     │         │       │
│            ▼           ▼            │         ▼         ▼       │
│         Block       Reject       Fail fast  Timeout   Parse    │
│         injection   over limit   if open    protect   + audit  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Module Structure

```
curriculum/
├── types.ts                     # Core curriculum types
├── schemas.ts                   # Zod validation schemas
├── structurer.ts                # Curriculum generation orchestration
├── validator.ts                 # Output validation
├── hallucination-detector.ts    # Fabrication detection
├── index.ts                     # Module exports
│
├── llm/
│   ├── types.ts                 # LLM types (request, response, audit)
│   ├── sanitizer.ts             # Prompt injection protection
│   ├── token-counter.ts         # Token estimation & truncation
│   ├── client.ts                # Secure LLM client
│   ├── index.ts                 # LLM module exports
│   └── __tests__/
│       ├── sanitizer.test.ts
│       └── token-counter.test.ts
│
├── fallback/
│   ├── patterns.ts              # Pre-written exercises by topic
│   ├── versioning.ts            # Pattern version tracking
│   ├── index.ts                 # Fallback module exports
│   └── __tests__/
│       └── fallback.test.ts
│
└── __tests__/
    ├── validator.test.ts
    └── hallucination.test.ts
```

## Security Features

### Prompt Injection Protection

The sanitizer detects and blocks:

| Category | Examples | Action |
|----------|----------|--------|
| `instruction_override` | "ignore previous instructions" | Block |
| `system_injection` | "System:", "[INST]", "<<SYS>>" | Block |
| `role_manipulation` | "you are now", "pretend to be" | Block |
| `jailbreak` | "DAN", "developer mode" | Block |
| `prompt_leaking` | "show me your prompt" | Block |
| `resource_fabrication` | "add this URL" | Block |
| `unicode_abuse` | Cyrillic homoglyphs | Sanitize |

### Hallucination Detection

Detects fabricated content:

- **Resource indices** outside 1..N range
- **URLs** not in verified resource list
- **Suspicious claims** (fake statistics, citations)

```typescript
import { detectHallucinations, hasCriticalHallucinations } from './curriculum';

// Quick check
if (hasCriticalHallucinations(llmOutput, resources)) {
  // Reject immediately
}

// Full analysis
const result = detectHallucinations(llmOutput, resources);
console.log('Critical issues:', result.countBySeverity.critical);
```

### Schema Validation

Strict Zod schemas enforce:

- ASCII printable characters only
- Maximum field lengths
- Resource indices must be 1..N
- Minutes must sum correctly
- Day sequence must be continuous

## Fallback Patterns

When LLM is unavailable, pre-written patterns provide:

### Exercise Templates (18 total)
- Practice (6): implement, recreate, extend, debug, refactor, apply
- Quiz (4): concepts, compare, when-to-use, pitfalls
- Project (3): mini, combine, portfolio
- Reflection (4): learning, connection, teach, difficulty
- Discussion (3): share, debate, question

### Day Structures (6)
- Introduction Day
- Deep Dive Day
- Practice Day
- Project Day
- Review Day
- Advanced Concepts

```typescript
import { selectExercises, selectDayStructure } from './curriculum';

// Select exercises for a day
const exercises = selectExercises({
  types: ['practice', 'quiz'],
  difficulty: 'intermediate',
  topics: ['typescript'],
  count: 3,
});

// Get day structure based on position
const structure = selectDayStructure(dayNumber, totalDays, difficulty);
```

## Configuration

### Environment Variables

```bash
# LLM Provider
OPENAI_API_KEY=sk-...

# Circuit Breaker
LLM_CIRCUIT_BREAKER_THRESHOLD=5
LLM_CIRCUIT_BREAKER_TIMEOUT=30000
```

### Client Configuration

```typescript
initSecureLLMClient(provider, {
  model: 'gpt-4o',
  temperature: 0.7,
  defaultTimeoutMs: 30000,
  defaultMaxOutputTokens: 4000,
  defaultMaxInputTokens: 8000,
  circuitBreakerName: 'llm-provider',
  enableAuditing: true,
  enableCaching: false,
});
```

## Error Handling

```typescript
const response = await client.execute(request);

if (!response.ok) {
  switch (response.error.code) {
    case 'SANITIZATION_BLOCKED':
      // Input contained injection attempt
      break;
    case 'TOKEN_LIMIT_EXCEEDED':
      // Input too large
      break;
    case 'CIRCUIT_OPEN':
      // Service temporarily unavailable
      // Retry after: response.error.retryAfterMs
      break;
    case 'TIMEOUT':
      // Request timed out
      break;
    case 'HALLUCINATION_DETECTED':
      // LLM fabricated content
      break;
  }
}
```

## Testing

```bash
# Run all tests
npm test src/services/spark-engine/curriculum

# Run specific test files
npm test sanitizer.test.ts
npm test hallucination.test.ts
npm test validator.test.ts
```

## Metrics

The module emits the following metrics:

- `llm_requests_total{purpose, result, error_code}`
- `llm_request_duration_ms{purpose}`
- `llm_tokens_used{purpose, type}`
- `prompt_injection_detected{category, severity}`
- `curriculum_generation_total{result}`
- `curriculum_generation_duration_ms`
- `curriculum_validation_total{result}`
- `hallucination_detection_total{result}`

## License

NovaOS Spark Engine - Internal Use
