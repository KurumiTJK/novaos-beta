// ═══════════════════════════════════════════════════════════════════════════════
// SHARED TYPES — Global Type Definitions
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// CORE ENUMS & CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

export type Stance = 'control' | 'shield' | 'lens' | 'sword';
export type SafetySignal = 'low' | 'medium' | 'high';
export type AppMode = 'normal' | 'control' | 'sword';
export type ModuleType = 'finance' | 'health' | 'calendar' | 'weather' | 'reminders' | 'email' | 'maps' | 'abilities';

// ─────────────────────────────────────────────────────────────────────────────────
// PIPELINE TYPES (matches backend execution-pipeline.ts)
// ─────────────────────────────────────────────────────────────────────────────────

export interface IntentSummary {
  classification: string;
  safety_signal: SafetySignal;
  requires_tools: boolean;
  tool_hints: string[];
  user_intent: string;
  emotional_state?: string;
  urgency_level?: 'low' | 'medium' | 'high';
  learning_intent?: boolean;
}

export interface GateResults {
  intent?: IntentSummary;
  shield?: {
    action: 'proceed' | 'warn' | 'block' | 'halt';
    risk_level: string;
    warnings: string[];
    interest_conflicts: Array<{
      higher: string;
      lower: string;
      description: string;
    }>;
  };
  tools?: {
    tools_called: string[];
    results: Record<string, unknown>;
  };
  stance?: {
    selected_stance: Stance;
    reasoning: string;
  };
  capability?: {
    can_respond: boolean;
    limitations: string[];
    suggested_tools: string[];
  };
  response?: {
    content: string;
    confidence: number;
    freshness: 'verified' | 'cached' | 'uncertain';
    sources?: string[];
  };
  constitution?: {
    compliant: boolean;
    violations: string[];
    suggestions: string[];
  };
  memory?: {
    stored: boolean;
    key_facts: string[];
  };
}

export interface PipelineResult {
  status: 'success' | 'blocked' | 'halted' | 'error';
  response: string;
  stance: Stance;
  gateResults: GateResults;
  metadata: {
    processingTime: number;
    regenerationCount: number;
    model: string;
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CHAT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface ChatResponse extends PipelineResult {
  conversationId: string;
  isNewConversation: boolean;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  stance?: Stance;
  gateResults?: GateResults;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
  lastMessage?: string;
  tags?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// UI MESSAGE TYPE (frontend display)
// ─────────────────────────────────────────────────────────────────────────────────

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  stance?: Stance;
  confidence?: number;
  freshness?: 'verified' | 'cached' | 'uncertain';
  gateResults?: GateResults;
  isLoading?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// NOTIFICATION TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
  duration?: number;
}
