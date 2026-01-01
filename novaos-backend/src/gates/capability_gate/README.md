# Capability Gate — Developer Guide

## Overview

The Capability Gate fetches live data based on user intent. It uses an **auto-discovery pattern**: drop a `*.capability.ts` file in the `capabilities/` folder, register it in `capability-registry.json`, and the system picks it up automatically.

## Architecture

```
capability_gate/
├── capability-gate.ts      # Main gate (orchestrates everything)
├── selector.ts             # LLM selects which capabilities to run
├── registry.ts             # In-memory registry of loaded capabilities
├── discover.ts             # Auto-discovery and registration
├── capability-registry.json # Metadata for each capability
├── types.ts                # TypeScript interfaces
└── capabilities/           # Drop your *.capability.ts files here
    ├── stock.capability.ts
    ├── weather.capability.ts
    ├── crypto.capability.ts
    ├── fx.capability.ts
    ├── time.capability.ts
    └── web-search.capability.ts
```

## Flow

```
1. Intent Gate outputs: primary_route, stance, urgency, live_data
          ↓
2. Capability Gate checks: live_data === true?
          ↓ YES
3. LLM Selector reads capability menu from registry
          ↓
4. LLM returns: ["stock_fetcher", "weather_fetcher"]
          ↓
5. Registry executes selected capabilities in parallel
          ↓
6. Returns EvidenceItems → Response Gate includes in prompt
```

---

## How to Create a New Capability

### Step 1: Create the file

Create `capabilities/my-new.capability.ts`:

```typescript
// ═══════════════════════════════════════════════════════════════════════════════
// MY NEW CAPABILITY
// Brief description of what it does
// ═══════════════════════════════════════════════════════════════════════════════

import type { EvidenceItem } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// EXTRACTION (parse user message to get parameters)
// ─────────────────────────────────────────────────────────────────────────────────

function extractParams(message: string): string | null {
  // Your extraction logic here
  // Return null if can't extract (capability won't run)
  
  const match = message.match(/some pattern/i);
  return match?.[1] ?? null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FORMATTING (format data for LLM consumption)
// ─────────────────────────────────────────────────────────────────────────────────

function formatEvidence(data: YourDataType): string {
  // Format the raw data into human-readable text
  // This is what the Response Gate includes in the prompt
  
  return `
Key: ${data.key}
Value: ${data.value}
  `.trim();
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXECUTE (required export)
// ─────────────────────────────────────────────────────────────────────────────────

export async function execute(userMessage: string): Promise<EvidenceItem | null> {
  // 1. Extract parameters from user message
  const params = extractParams(userMessage);
  if (!params) {
    console.log('[MY_NEW] No params found');
    return null;
  }

  // 2. Fetch data (from API, provider, etc.)
  try {
    const data = await fetchMyData(params);
    
    if (!data) {
      console.log('[MY_NEW] No data returned');
      return null;
    }

    // 3. Return EvidenceItem
    return {
      type: 'my_evidence_type',      // Must match evidenceType in registry
      formatted: formatEvidence(data), // Human-readable for LLM
      source: 'my_new_fetcher',       // Must match name in registry
      raw: data,                       // Optional: raw data for debugging
      fetchedAt: Date.now(),
    };
    
  } catch (error) {
    console.error('[MY_NEW] Error:', error);
    return null;
  }
}
```

### Step 2: Register in capability-registry.json

Add entry to `capability-registry.json`:

```json
{
  "my-new.capability": {
    "name": "my_new_fetcher",
    "description": "Fetches X data for Y purpose (e.g., example query)",
    "evidenceType": "my_evidence_type"
  }
}
```

**Important fields:**
- Key (`"my-new.capability"`) must match filename WITHOUT `.ts`
- `name` is what LLM uses to select this capability
- `description` helps LLM decide WHEN to select it (be specific!)
- `evidenceType` must match `type` in your EvidenceItem return

### Step 3: Restart server

Capabilities are loaded at startup. Restart to pick up new capability.

---

## Required Interface

### EvidenceItem (what you return)

```typescript
interface EvidenceItem {
  type: string;        // Evidence category (e.g., "stock", "weather")
  formatted: string;   // Human-readable text for LLM prompt
  source: string;      // Which capability produced this
  raw?: unknown;       // Optional: raw API response
  fetchedAt: number;   // Unix timestamp
}
```

### Capability (what gets registered)

```typescript
interface Capability {
  name: string;        // Unique identifier
  description: string; // For LLM menu
  evidenceType: string;
  execute(userMessage: string): Promise<EvidenceItem | null>;
}
```

---

## Best Practices

### 1. Extraction should be robust

```typescript
// Good: Multiple patterns, company name mapping
function extractTicker(message: string): string | null {
  // Pattern 1: $AAPL
  const dollarMatch = message.match(/\$([A-Z]{1,5})\b/);
  if (dollarMatch) return dollarMatch[1];
  
  // Pattern 2: "AAPL stock"
  const stockMatch = message.match(/\b([A-Z]{1,5})\s+stock\b/i);
  if (stockMatch) return stockMatch[1].toUpperCase();
  
  // Pattern 3: Company names
  const companies: Record<string, string> = {
    'apple': 'AAPL',
    'tesla': 'TSLA',
  };
  
  const lower = message.toLowerCase();
  for (const [name, ticker] of Object.entries(companies)) {
    if (lower.includes(name)) return ticker;
  }
  
  return null;
}
```

### 2. Return null on failure (don't throw)

```typescript
// Good: Return null, let pipeline continue
export async function execute(userMessage: string): Promise<EvidenceItem | null> {
  const params = extractParams(userMessage);
  if (!params) return null;  // ← Good
  
  try {
    const data = await fetchData(params);
    if (!data) return null;  // ← Good
    return { /* evidence */ };
  } catch (error) {
    console.error('[MY_CAP] Error:', error);
    return null;  // ← Good: don't crash pipeline
  }
}
```

### 3. Description should be specific

```json
// Bad: Vague
{
  "description": "Gets data from API"
}

// Good: Specific with examples
{
  "description": "Fetches live stock prices (e.g., AAPL, TSLA, MSFT)"
}

// Good: Clear use case
{
  "description": "Fetches current weather for a location (city or coordinates)"
}
```

### 4. Formatted output should be LLM-friendly

```typescript
// Good: Clear, labeled, structured
function formatWeather(data: WeatherData): string {
  return `
Location: ${data.city}, ${data.country}
Temperature: ${data.temp}°C (feels like ${data.feelsLike}°C)
Conditions: ${data.description}
Humidity: ${data.humidity}%
Wind: ${data.windSpeed} km/h
  `.trim();
}

// Bad: Raw JSON dump
function formatWeather(data: WeatherData): string {
  return JSON.stringify(data);
}
```

---

## Using Data Providers

If you have existing data providers, use them:

```typescript
import { getProviderForCategory } from '../../../services/data-providers/registry.js';

export async function execute(userMessage: string): Promise<EvidenceItem | null> {
  const provider = getProviderForCategory('market');
  
  if (!provider || !provider.isAvailable()) {
    console.log('[STOCK] Provider not available');
    return null;
  }
  
  const result = await provider.fetch({ query: ticker });
  
  if (!result.result.ok) {
    console.log('[STOCK] Fetch failed');
    return null;
  }
  
  const data = result.result.data;
  // ...
}
```

---

## Interactive Registration (Development)

Run during development to register new capabilities interactively:

```typescript
import { setupCapabilities } from './discover.js';

await setupCapabilities();
// Prompts for: name, description, evidenceType
```

---

## Programmatic Registration

```typescript
import { addCapabilityToRegistry } from './discover.js';

addCapabilityToRegistry('my-new.capability', {
  name: 'my_new_fetcher',
  description: 'Fetches X data for Y',
  evidenceType: 'my_type',
});
```

---

## Checklist for New Capability

- [ ] Create `capabilities/my-new.capability.ts`
- [ ] Export `execute(userMessage: string): Promise<EvidenceItem | null>`
- [ ] Implement extraction logic (return null if can't extract)
- [ ] Implement formatting (human-readable for LLM)
- [ ] Add entry to `capability-registry.json`
- [ ] Key matches filename (without `.ts`)
- [ ] `name` is unique
- [ ] `description` is specific with examples
- [ ] `evidenceType` matches return type
- [ ] Restart server
- [ ] Test with a query that should trigger it

---

## Debugging

### Check if capability loaded
```
[CAPABILITY] Loaded: stock_fetcher, weather_fetcher, my_new_fetcher
```

### Check LLM selection
```
[CAPABILITY] Selector chose: ["my_new_fetcher"]
```

### Check execution
```
[MY_NEW] No params found        ← Extraction failed
[MY_NEW] Provider not available ← Data provider missing
[MY_NEW] Error: ...             ← Fetch failed
```

### Check evidence in Response Gate
```
[RESPONSE] Evidence: 1 item(s)
[RESPONSE]   └─ [MY_TYPE] First line of formatted output...
```
