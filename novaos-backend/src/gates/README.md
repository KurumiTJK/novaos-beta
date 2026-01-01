# NovaOS Gates Documentation

## Pipeline Flow

```
INTENT → SHIELD → TOOLS → STANCE → CAPABILITY → RESPONSE → CONSTITUTION → MEMORY
  ↓         ↓        ↓        ↓          ↓           ↓           ↓           ↓
 LLM     router   router   router       LLM        LLM         LLM         LLM
                                                     ↑___________↓
                                                   (regeneration loop)
```

---

## Intent Gate

**Purpose:** LLM-powered intent classification. First gate in pipeline.

### Output: `IntentSummary`

```typescript
interface IntentSummary {
  primary_route: 'SAY' | 'MAKE' | 'FIX' | 'DO';
  stance: 'LENS' | 'SWORD' | 'SHIELD';
  safety_signal: 'none' | 'low' | 'medium' | 'high';
  urgency: 'low' | 'medium' | 'high';
  live_data: boolean;
  external_tool: boolean;
  learning_intent: boolean;
}
```

### Field Definitions

#### `primary_route` — What type of action is needed?
| Value | Description |
|-------|-------------|
| `SAY` | Answer/explain something |
| `MAKE` | Create something new |
| `FIX` | Fix/edit/rewrite something |
| `DO` | Execute an external action |

#### `stance` — Which system handles this?
| Value | Description |
|-------|-------------|
| `SHIELD` | Protection needed — user faces risk that warrants friction before proceeding (safety_signal is medium or high) |
| `SWORD` | Extended learning / lesson plan requests (learning_intent is true) |
| `LENS` | Everything else (default) |

#### `safety_signal` — Is there a risk to the user's wellbeing?
| Value | Description |
|-------|-------------|
| `none` | Normal conversation, no elevated risk |
| `low` | Emotional dysregulation that could impair judgment (venting, stress, anxiety, frustration) |
| `medium` | Risk to financial stability, career, reputation, or legal standing (gambling, options/leverage, impulsive quitting, angry messages, large irreversible decisions) |
| `high` | Immediate threat to life or freedom (self-harm, suicide, harm to others, illegal activity, medical emergency) |

#### `urgency` — Time pressure?
| Value | Description |
|-------|-------------|
| `low` | No time pressure |
| `medium` | Soon but not immediate |
| `high` | Immediate action needed |

#### `live_data` — Am I being asked about a specific fact I could be wrong about?
| Value | Description |
|-------|-------------|
| `true` | Yes - needs real-time/current data (stock prices, weather, exchange rates) |
| `false` | No - can answer from knowledge |

#### `external_tool` — Did user explicitly request an external tool?
| Value | Description |
|-------|-------------|
| `true` | YES, user wants calendar/email/file search/image gen/etc. |
| `false` | NO, no tool explicitly requested |

#### `learning_intent` — Is this a request for extended learning / lesson plan?
| Value | Description |
|-------|-------------|
| `true` | User wants to learn something over time (multi-week structured learning) |
| `false` | Everything else (one-off tasks, questions, creative work) |

---

## Redis Key Structure

### Memory Gate

```
memory:{userId}:{memoryId}     → JSON string of MemoryRecord
memory:{userId}:_index         → Set of memoryIds for this user
```

**Example:**
```
memory:user_123:mem_1234567890_abc123  → {"id":"mem_...","userId":"user_123","userMessage":"...","generatedResponse":"...","source":"regex","timestamp":1234567890}
memory:user_123:_index                 → ["mem_1234567890_abc123", "mem_1234567891_def456"]
```

**MemoryRecord Schema:**
```typescript
interface MemoryRecord {
  id: string;              // mem_{timestamp}_{random}
  userId: string;          // User who created the memory
  userMessage: string;     // Original user message
  generatedResponse: string; // Nova's response (post-constitution)
  source: 'regex' | 'llm'; // How memory was detected
  timestamp: number;       // Unix timestamp
}
```

---

## Gate Summary

| Gate | Type | Purpose |
|------|------|---------|
| Intent | LLM | Classify user intent (route, stance, safety, urgency) |
| Shield | Router | Route to Shield engine if safety_signal medium/high |
| Tools | Router | Route to external tools if external_tool=true |
| Stance | Router | Route to Sword/Lens based on stance |
| Capability | LLM | Fetch live data if live_data=true |
| Response | LLM | Generate response (The Stitcher) |
| Constitution | LLM | Check response against Nova Constitution |
| Memory | LLM | Detect and store memory requests |
