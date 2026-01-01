// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD GATE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ShieldRoute = 'shield' | 'skip';
export type SafetySignal = 'none' | 'low' | 'medium' | 'high';
export type Urgency = 'low' | 'medium' | 'high';

export interface ShieldGateOutput {
  route: ShieldRoute;
  safety_signal: SafetySignal;
  urgency: Urgency;
  /** Triggers constitution check when true (future: set by Shield Engine) */
  shield_acceptance: boolean;
}
