// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD SERVICE — Protection Layer for NovaOS
// ═══════════════════════════════════════════════════════════════════════════════
//
// Shield provides friction before risky actions:
// - LOW: Skip (emotional, not blocking)
// - MEDIUM: Warning overlay with response (user must acknowledge)
// - HIGH: Crisis mode (blocks all messages until user confirms safety)
//
// ═══════════════════════════════════════════════════════════════════════════════

import { isSupabaseInitialized, getSupabase } from '../../db/index.js';
import { assessRisk } from './risk-assessor.js';
import {
  getActiveCrisisSession,
  createCrisisSession,
  resolveCrisisSession,
  getCrisisSession,
} from './crisis-session.js';
import type { ShieldEvaluation, ShieldAction, RiskAssessment } from './types.js';

export class ShieldService {
  // ═══════════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Check if user has an active crisis session
   * If blocked, ALL messages are blocked until resolved
   */
  async checkCrisisBlock(userId: string): Promise<{
    blocked: boolean;
    sessionId?: string;
  }> {
    const session = await getActiveCrisisSession(userId);
    if (session) {
      return { blocked: true, sessionId: session.id };
    }
    return { blocked: false };
  }

  /**
   * Evaluate risk and determine shield action
   * Called by Shield Gate when safety_signal is detected
   */
  async evaluate(
    userId: string,
    message: string,
    safetySignal: 'none' | 'low' | 'medium' | 'high',
    urgency: 'low' | 'medium' | 'high'
  ): Promise<ShieldEvaluation> {
    // Skip for none/low - no intervention needed
    if (safetySignal === 'none' || safetySignal === 'low') {
      return {
        action: 'skip',
        safetySignal,
        urgency,
      };
    }

    // Assess risk using LLM
    const riskAssessment = await assessRisk(message, safetySignal, urgency);

    // Determine action type for audit
    const actionTaken = safetySignal === 'high' ? 'crisis' : 'warning';

    // Create audit record
    const activationId = await this.createActivation(
      userId,
      message,
      safetySignal,
      urgency,
      riskAssessment,
      actionTaken
    );

    // HIGH: Create crisis session (blocks all messages)
    if (safetySignal === 'high') {
      const session = activationId
        ? await createCrisisSession(userId, activationId)
        : null;

      console.log(`[SHIELD] CRISIS activated for user: ${userId}`);

      return {
        action: 'crisis',
        safetySignal,
        urgency,
        riskAssessment: riskAssessment ?? undefined,
        sessionId: session?.id,
        activationId: activationId ?? undefined,
      };
    }

    // MEDIUM: Warning only (pipeline continues, frontend shows overlay)
    console.log(`[SHIELD] WARNING for user: ${userId}`);

    return {
      action: 'warn',
      safetySignal,
      urgency,
      riskAssessment: riskAssessment ?? undefined,
      activationId: activationId ?? undefined,
    };
  }

  /**
   * Confirm acceptance of warning (medium)
   * Records resolution for audit, no other effect
   */
  async confirmAcceptance(activationId: string): Promise<boolean> {
    console.log(`[SHIELD] Warning acknowledged: ${activationId}`);
    return this.resolveActivation(activationId);
  }

  /**
   * Confirm safety (high)
   * Resolves crisis session, allows normal operation
   */
  async confirmSafety(userId: string, sessionId: string): Promise<boolean> {
    // Verify session belongs to user
    const session = await getCrisisSession(sessionId);
    if (!session || session.userId !== userId) {
      console.error(`[SHIELD] Invalid session for user: ${userId}`);
      return false;
    }

    // Resolve the crisis session
    const resolved = await resolveCrisisSession(sessionId);
    
    if (resolved) {
      // Also resolve the activation
      await this.resolveActivation(session.activationId);
      console.log(`[SHIELD] Crisis resolved for user: ${userId}`);
    }

    return resolved;
  }

  /**
   * Get user's shield status
   * Returns active crisis session if any
   */
  async getStatus(userId: string): Promise<{
    inCrisis: boolean;
    sessionId?: string;
    createdAt?: Date;
  }> {
    const session = await getActiveCrisisSession(userId);
    if (session) {
      return {
        inCrisis: true,
        sessionId: session.id,
        createdAt: session.createdAt,
      };
    }
    return { inCrisis: false };
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE: Audit Helpers
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Create activation record for audit
   */
  private async createActivation(
    userId: string,
    message: string,
    safetySignal: string,
    urgency: string,
    riskAssessment: RiskAssessment | null,
    actionTaken: 'warning' | 'crisis'
  ): Promise<string | null> {
    if (!isSupabaseInitialized()) {
      console.warn('[SHIELD] Supabase not initialized, skipping audit');
      return null;
    }

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('shield_activations')
        .insert({
          user_id: userId,
          safety_signal: safetySignal,
          urgency,
          trigger_message: message,
          risk_assessment: riskAssessment ? JSON.stringify(riskAssessment) : null,
          action_taken: actionTaken,
        })
        .select('id')
        .single();

      if (error) {
        console.error('[SHIELD] Failed to create activation:', error);
        return null;
      }

      console.log(`[SHIELD] Activation created: ${data?.id}`);
      return data?.id ?? null;
    } catch (error) {
      console.error('[SHIELD] Error creating activation:', error);
      return null;
    }
  }

  /**
   * Mark activation as resolved
   */
  private async resolveActivation(activationId: string): Promise<boolean> {
    if (!isSupabaseInitialized()) {
      return false;
    }

    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('shield_activations')
        .update({ resolved_at: new Date().toISOString() })
        .eq('id', activationId);

      if (error) {
        console.error('[SHIELD] Failed to resolve activation:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[SHIELD] Error resolving activation:', error);
      return false;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let shieldServiceInstance: ShieldService | null = null;

export function getShieldService(): ShieldService {
  if (!shieldServiceInstance) {
    shieldServiceInstance = new ShieldService();
  }
  return shieldServiceInstance;
}

export function resetShieldService(): void {
  shieldServiceInstance = null;
}
