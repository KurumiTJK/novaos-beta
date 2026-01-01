// ═══════════════════════════════════════════════════════════════════════════════
// INTENT GATE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type PrimaryRoute = 'SAY' | 'MAKE' | 'FIX' | 'DO';
export type Stance = 'LENS' | 'SWORD' | 'SHIELD';
export type SafetySignal = 'none' | 'low' | 'medium' | 'high';
export type Urgency = 'low' | 'medium' | 'high';

export interface IntentSummary {
  primary_route: PrimaryRoute;
  stance: Stance;
  safety_signal: SafetySignal;
  urgency: Urgency;
  live_data: boolean;
  external_tool: boolean;
  learning_intent: boolean;
}
