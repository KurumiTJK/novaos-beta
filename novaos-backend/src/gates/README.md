# Adding New Capabilities to NovaOS

This guide explains how to add new AI providers/capabilities to the NovaOS pipeline.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PIPELINE FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

User Message
     │
     ▼
┌─────────────┐
│ Intent Gate │ ──► Classifies intent, extracts topic
└─────────────┘
     │
     ▼
┌──────────────────┐
│ Capability Gate  │ ──► Decides WHICH provider to use (Gemini, OpenAI, etc.)
│                  │     Does NOT execute — just routes
│  ┌────────────┐  │
│  │ Providers  │  │     Files: src/gates/capability_gate/providers/
│  │ (matchers) │  │       - gemini-grounded.provider.ts
│  └────────────┘  │       - openai.provider.ts
└──────────────────┘       - [your-new-provider].provider.ts  ◄── ADD HERE
     │
     ▼
┌──────────────────┐
│  Response Gate   │ ──► EXECUTES the chosen provider, applies personality
│                  │
│  ┌────────────┐  │
│  │ Executors  │  │     Files: src/gates/response_gate/executors/
│  │ (callers)  │  │       - gemini-grounded.executor.ts
│  └────────────┘  │       - openai.executor.ts
└──────────────────┘       - [your-new-provider].executor.ts  ◄── ADD HERE
     │
     ▼
Response to User
```

---

## File Structure

```
src/gates/
├── capability_gate/
│   ├── capability-gate.ts      # Main gate (loads providers, runs matching)
│   ├── types.ts                # ProviderName, ProviderConfig, Provider types
│   ├── index.ts                # Exports
│   └── providers/              # ◄── PROVIDER FILES GO HERE
│       ├── gemini-grounded.provider.ts
│       ├── openai.provider.ts
│       └── [your-provider].provider.ts
│
├── response_gate/
│   ├── response-gate.ts        # Main gate (routes to executors)
│   ├── types.ts                # ResponseGateOutput, ProviderExecutor types
│   ├── index.ts                # Exports
│   └── executors/              # ◄── EXECUTOR FILES GO HERE
│       ├── gemini-grounded.executor.ts
│       ├── openai.executor.ts
│       └── [your-provider].executor.ts
```

---

## Step-by-Step: Adding a New Provider

### Example: Adding Claude Code Provider

We'll add a provider that uses Claude for code generation when the user asks to "make" something code-related.

---

### Step 1: Update Types

**File:** `src/gates/capability_gate/types.ts`

Add your provider name to the `ProviderName` type:

```typescript
// BEFORE
export type ProviderName = 'gemini_grounded' | 'openai';

// AFTER
export type ProviderName = 'gemini_grounded' | 'openai' | 'claude_code';
```

---

### Step 2: Create Provider File

**File:** `src/gates/capability_gate/providers/claude-code.provider.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE CODE PROVIDER
// Used when primary_route=MAKE and code-related intent detected
// ═══════════════════════════════════════════════════════════════════════════════

import type { IntentSummary } from '../../intent_gate/types.js';
import type { Provider, ProviderConfig } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PROVIDER METADATA
// ─────────────────────────────────────────────────────────────────────────────────

export const name = 'claude_code';

// Priority determines matching order (higher = checked first)
// Current priorities:
//   - gemini_grounded: 10 (live_data searches)
//   - openai: 0 (default fallback)
// Set higher than gemini_grounded if you want this checked first
export const priority = 15;

// ─────────────────────────────────────────────────────────────────────────────────
// MATCH FUNCTION
// Returns true if this provider should handle the intent
// ─────────────────────────────────────────────────────────────────────────────────

export function match(intent: IntentSummary): boolean {
  // Only handle MAKE requests
  if (intent.primary_route !== 'MAKE') {
    return false;
  }
  
  // You could add more sophisticated matching here:
  // - Check for code-related keywords in the topic
  // - Check for specific flags in intent
  // - etc.
  
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GET CONFIG FUNCTION
// Returns the configuration needed by the executor
// ─────────────────────────────────────────────────────────────────────────────────

export function getConfig(intent: IntentSummary, userMessage: string): ProviderConfig {
  return {
    provider: 'claude_code',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.3,  // Lower temp for code
    maxTokens: 4096,   // Higher for code output
    topic: intent.topic,
    // Add any custom config your executor needs
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORT AS PROVIDER OBJECT
// ─────────────────────────────────────────────────────────────────────────────────

const provider: Provider = { name, priority, match, getConfig };
export default provider;
```

---

### Step 3: Register Provider in Capability Gate

**File:** `src/gates/capability_gate/capability-gate.ts`

```typescript
// Add import at top
import claudeCode from './providers/claude-code.provider.js';

// Add to providers array
const providers: Provider[] = [
  claudeCode,        // priority: 15 (checked first)
  geminiGrounded,    // priority: 10
  openai,            // priority: 0 (default)
].sort((a, b) => b.priority - a.priority);
```

---

### Step 4: Create Executor File

**File:** `src/gates/response_gate/executors/claude-code.executor.ts`

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// CLAUDE CODE EXECUTOR
// Calls Anthropic Claude API for code generation
// ═══════════════════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk';
import type { ConversationMessage } from '../../../types/index.js';
import type { ProviderConfig } from '../../capability_gate/types.js';
import type { ResponseGateOutput } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────────

export async function callClaudeCode(
  systemPrompt: string,
  userPrompt: string,
  config: ProviderConfig,
  conversationHistory?: readonly ConversationMessage[]
): Promise<ResponseGateOutput> {
  const anthropic = getClient();

  if (!anthropic) {
    console.error('[CLAUDE] No ANTHROPIC_API_KEY');
    return {
      text: 'Anthropic API key not configured.',
      model: 'unavailable',
      tokensUsed: 0,
    };
  }

  try {
    // Build messages array
    const messages: Anthropic.MessageParam[] = [];

    // Add conversation history
    if (conversationHistory?.length) {
      for (const msg of conversationHistory) {
        messages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        });
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: userPrompt });

    // Call Claude
    const response = await anthropic.messages.create({
      model: config.model,
      system: systemPrompt,
      messages,
      max_tokens: config.maxTokens ?? 4096,
    });

    // Extract text from response
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    const tokensUsed = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

    return {
      text,
      model: config.model,
      tokensUsed,
    };

  } catch (error) {
    console.error('[CLAUDE] Error:', error);
    return {
      text: 'I encountered an error generating code. Please try again.',
      model: 'error',
      tokensUsed: 0,
    };
  }
}
```

---

### Step 5: Register Executor in Response Gate

**File:** `src/gates/response_gate/response-gate.ts`

```typescript
// Add import at top
import { callClaudeCode } from './executors/claude-code.executor.js';

// Add to executors registry
const executors: Record<ProviderName, ProviderExecutor> = {
  'gemini_grounded': callGeminiGrounded,
  'openai': callOpenAI,
  'claude_code': callClaudeCode,  // ◄── ADD THIS
};
```

---

### Step 6: Install SDK & Add API Key

```bash
npm install @anthropic-ai/sdk
```

Add to `.env`:
```
ANTHROPIC_API_KEY=your_key_here
```

---

## Provider File Template

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// [PROVIDER_NAME] PROVIDER
// [Description of when this provider is used]
// ═══════════════════════════════════════════════════════════════════════════════

import type { IntentSummary } from '../../intent_gate/types.js';
import type { Provider, ProviderConfig } from '../types.js';

export const name = '[provider_name]';  // Must match ProviderName type
export const priority = [number];        // Higher = checked first

export function match(intent: IntentSummary): boolean {
  // Return true if this provider should handle the intent
  // Check intent.primary_route, intent.live_data, intent.topic, etc.
  return false;
}

export function getConfig(intent: IntentSummary, userMessage: string): ProviderConfig {
  return {
    provider: '[provider_name]',
    model: '[model_name]',
    temperature: 0.7,
    maxTokens: 2048,
    topic: intent.topic,
    // Add any custom config
  };
}

const provider: Provider = { name, priority, match, getConfig };
export default provider;
```

---

## Executor File Template

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// [PROVIDER_NAME] EXECUTOR
// [Description of what API this calls]
// ═══════════════════════════════════════════════════════════════════════════════

import type { ConversationMessage } from '../../../types/index.js';
import type { ProviderConfig } from '../../capability_gate/types.js';
import type { ResponseGateOutput } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CLIENT
// ─────────────────────────────────────────────────────────────────────────────────

let client: YourSDKClient | null = null;

function getClient(): YourSDKClient | null {
  if (!client && process.env.YOUR_API_KEY) {
    client = new YourSDKClient({ apiKey: process.env.YOUR_API_KEY });
  }
  return client;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTOR
// ─────────────────────────────────────────────────────────────────────────────────

export async function callYourProvider(
  systemPrompt: string,
  userPrompt: string,
  config: ProviderConfig,
  conversationHistory?: readonly ConversationMessage[]
): Promise<ResponseGateOutput> {
  const sdk = getClient();

  if (!sdk) {
    console.error('[YOUR_PROVIDER] No API key');
    return {
      text: 'API key not configured.',
      model: 'unavailable',
      tokensUsed: 0,
    };
  }

  try {
    // 1. Build messages array from conversationHistory
    // 2. Call your API
    // 3. Extract text from response
    // 4. Return ResponseGateOutput

    return {
      text: 'response text',
      model: config.model,
      tokensUsed: 0,
      // Optional: sources, artifacts, etc.
    };

  } catch (error) {
    console.error('[YOUR_PROVIDER] Error:', error);
    return {
      text: 'Error message for user.',
      model: 'error',
      tokensUsed: 0,
    };
  }
}
```

---

## Checklist for Adding a New Provider

- [ ] 1. Add provider name to `ProviderName` type in `capability_gate/types.ts`
- [ ] 2. Create provider file in `capability_gate/providers/[name].provider.ts`
- [ ] 3. Import and add provider to array in `capability_gate/capability-gate.ts`
- [ ] 4. Create executor file in `response_gate/executors/[name].executor.ts`
- [ ] 5. Import and add executor to registry in `response_gate/response-gate.ts`
- [ ] 6. Install any required SDK: `npm install [sdk-package]`
- [ ] 7. Add API key to `.env`: `[PROVIDER]_API_KEY=your_key`
- [ ] 8. Test with a message that triggers your provider's `match()` function

---

## Priority Guide

| Priority | Use Case |
|----------|----------|
| 20+ | Highest priority, specialized tasks |
| 15 | High priority (e.g., code generation) |
| 10 | Medium priority (e.g., web search) |
| 5 | Low priority |
| 0 | Default fallback (OpenAI) |

The first provider whose `match()` returns `true` wins.

---

## Available Intent Fields for Matching

```typescript
interface IntentSummary {
  primary_route: 'SAY' | 'MAKE' | 'FIX' | 'DO';
  stance: 'LENS' | 'SWORD' | 'SHIELD';
  safety_signal: 'none' | 'low' | 'medium' | 'high';
  urgency: 'low' | 'medium' | 'high';
  live_data: boolean;
  external_tool: boolean;
  learning_intent: boolean;
  topic?: string;
}
```

### Common Match Patterns

```typescript
// Match web search needs
intent.live_data === true

// Match code creation
intent.primary_route === 'MAKE'

// Match learning requests
intent.learning_intent === true

// Match external tool requests
intent.external_tool === true

// Match high urgency
intent.urgency === 'high'

// Combine conditions
intent.primary_route === 'MAKE' && intent.topic?.includes('code')
```

---

## Extending ProviderConfig

If your provider needs custom config fields, extend the type:

**File:** `src/gates/capability_gate/types.ts`

```typescript
export interface ProviderConfig {
  provider: ProviderName;
  model: string;
  tools?: unknown[];
  temperature?: number;
  maxTokens?: number;
  topic?: string;
  // Add your custom fields:
  customField?: string;
  anotherField?: number;
}
```

Then use them in your provider's `getConfig()` and executor.
