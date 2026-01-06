// ═══════════════════════════════════════════════════════════════════════════════
// SHARED TYPES — Novaux
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// CHAT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type MessageRole = 'user' | 'assistant' | 'system';

export type Stance = 'control' | 'shield' | 'lens' | 'sword';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: Date;
  stance?: Stance;
  isLoading?: boolean;
}

export interface ChatResponse {
  response: string;
  stance: Stance;
  status: 'completed' | 'stopped' | 'error';
  conversationId: string;
  isNewConversation: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface AuthState {
  token: string | null;
  userId: string | null;
  isAuthenticated: boolean;
}

export interface RegisterResponse {
  userId: string;
  token: string;
}

export interface AuthStatusResponse {
  authenticated: boolean;
  userId?: string;
  tier?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MODULE TYPES (Dashboard Widgets)
// ─────────────────────────────────────────────────────────────────────────────────

export type ModuleType = 'finance' | 'health' | 'calendar' | 'reminders' | 'weather' | 'email';

export interface ModuleData {
  title: string;
  hero: {
    value: string;
    label: string;
  };
  cards: Array<{
    label: string;
    value: string;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// UI TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type TabId = 'home' | 'modules' | 'skills' | 'settings';

export interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}
