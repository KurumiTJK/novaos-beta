// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD GATE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

import type { RiskAssessment } from '../../services/shield/types.js';

export type ShieldRoute = 'shield' | 'skip';
export type SafetySignal = 'none' | 'low' | 'medium' | 'high';
export type Urgency = 'low' | 'medium' | 'high';
export type ShieldGateAction = 'skip' | 'warn' | 'crisis';

export interface ShieldGateOutput {
  route: ShieldRoute;
  safety_signal: SafetySignal;
  urgency: Urgency;
  
  /** Triggers constitution check when true (set by Shield Service) */
  shield_acceptance: boolean;
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // NEW: Shield Service Integration
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /** Shield action taken: skip (none/low), warn (medium), crisis (high) */
  action?: ShieldGateAction;
  
  /** LLM-generated risk assessment (only for medium/high) */
  riskAssessment?: RiskAssessment;
  
  /** Crisis session ID (only for high - blocks all messages) */
  sessionId?: string;
  
  /** Activation ID for audit trail */
  activationId?: string;
  
  /** True if blocked by existing active crisis session */
  crisisBlocked?: boolean;
}
