// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD API — NovaOS
// Shield protection system
// ═══════════════════════════════════════════════════════════════════════════════

import { api } from './client';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type ShieldDomain = 
  | 'self_harm' 
  | 'crisis' 
  | 'dangerous_activity'
  | 'medical'
  | 'legal'
  | 'financial'
  | 'substance';

export type ShieldSeverity = 'low' | 'medium' | 'high';

export interface ShieldActivation {
  activationId: string;
  domain: ShieldDomain;
  severity: ShieldSeverity;
  warningMessage: string;
  requiresConfirmation?: boolean;
  buttons?: {
    confirm?: string;
    cancel?: string;
  };
}

export interface ShieldStatus {
  isActive: boolean;
  currentDomain?: ShieldDomain;
  activationId?: string;
}

export interface ShieldConfirmResponse {
  confirmed: boolean;
  response: string;
  nextSteps?: string[];
}

export interface ShieldSafeResponse {
  acknowledged: boolean;
  resources?: Array<{ name: string; url: string }>;
}

// Aliases for backwards compatibility
export type ConfirmWarningResponse = ShieldConfirmResponse;
export type ConfirmSafetyResponse = ShieldSafeResponse;

// ─────────────────────────────────────────────────────────────────────────────────
// API FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

export async function getShieldStatus(): Promise<ShieldStatus> {
  return api.get<ShieldStatus>('/shield/status');
}

export async function confirmWarning(activationId: string): Promise<ShieldConfirmResponse> {
  return api.post<ShieldConfirmResponse>('/shield/confirm', { activationId });
}

export async function confirmSafety(activationId: string): Promise<ShieldSafeResponse> {
  return api.post<ShieldSafeResponse>('/shield/safety/confirm', { activationId });
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

export function hasShieldActivation(response: unknown): response is { shieldActivation: ShieldActivation } {
  return (
    typeof response === 'object' &&
    response !== null &&
    'shieldActivation' in response &&
    (response as Record<string, unknown>).shieldActivation !== null &&
    (response as Record<string, unknown>).shieldActivation !== undefined
  );
}

export function getShieldColor(domain: ShieldDomain): string {
  const colors: Record<ShieldDomain, string> = {
    self_harm: '#ef4444',
    crisis: '#ef4444',
    dangerous_activity: '#f97316',
    medical: '#3b82f6',
    legal: '#8b5cf6',
    financial: '#eab308',
    substance: '#f97316',
  };
  return colors[domain] || '#6b7280';
}

export function getShieldIcon(domain: ShieldDomain): string {
  const icons: Record<ShieldDomain, string> = {
    self_harm: '🛡️',
    crisis: '🆘',
    dangerous_activity: '⚠️',
    medical: '🏥',
    legal: '⚖️',
    financial: '💰',
    substance: '⚠️',
  };
  return icons[domain] || '🛡️';
}
