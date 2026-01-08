// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD SERVICE — Protection Layer for NovaOS
// ═══════════════════════════════════════════════════════════════════════════════
//
// Shield provides friction before risky actions:
// - LOW: Skip (emotional, not blocking)
// - MEDIUM: Warning overlay, BLOCKS pipeline until user confirms
// - HIGH: Crisis mode (blocks all messages until user confirms safety)
//
// ═══════════════════════════════════════════════════════════════════════════════

import { isSupabaseInitialized, getSupabase } from '../../db/index.js';
import { getStore } from '../../storage/index.js';
import { generateWithModelLLM } from '../../pipeline/llm_engine.js';
import { assessRisk } from './risk-assessor.js';
import { SHORT_WARNING_PROMPT } from './prompts.js';
import {
  getActiveCrisisSession,
  createCrisisSession,
  resolveCrisisSession,
  getCrisisSession,
} from './crisis-session.js';
import type { ShieldEvaluation, ShieldAction, RiskAssessment, PendingMessage } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const PENDING_MESSAGE_TTL_SECONDS = 900; // 15 minutes

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
   * 
   * For MEDIUM: Also generates short warning and stores pending message
   */
  async evaluate(
    userId: string,
    message: string,
    safetySignal: 'none' | 'low' | 'medium' | 'high',
    urgency: 'low' | 'medium' | 'high',
    conversationId?: string
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

    // ═══════════════════════════════════════════════════════════════════════════
    // MEDIUM: Generate short warning, store pending message, BLOCK pipeline
    // ═══════════════════════════════════════════════════════════════════════════
    
    // Generate short warning message using LLM
    const warningMessage = await this.generateShortWarning(message, riskAssessment);
    
    // Store pending message for retrieval after user confirms
    if (activationId && conversationId) {
      await this.storePendingMessage(activationId, userId, message, conversationId);
    }

    console.log(`[SHIELD] WARNING for user: ${userId}, activationId: ${activationId}`);

    return {
      action: 'warn',
      safetySignal,
      urgency,
      riskAssessment: riskAssessment ?? undefined,
      warningMessage,
      activationId: activationId ?? undefined,
    };
  }

  /**
   * Confirm acceptance of warning (medium) and retrieve pending message
   * Returns the pending message data so caller can run pipeline
   */
  async confirmAcceptanceAndGetMessage(activationId: string): Promise<{
    success: boolean;
    pendingMessage?: PendingMessage;
  }> {
    console.log(`[SHIELD] Warning acknowledged: ${activationId}`);
    
    // Get pending message before resolving
    const pendingMessage = await this.getPendingMessage(activationId);
    
    // Resolve the activation (audit)
    await this.resolveActivation(activationId);
    
    // Delete pending message from Redis
    if (pendingMessage) {
      await this.deletePendingMessage(activationId);
    }
    
    return {
      success: true,
      pendingMessage: pendingMessage ?? undefined,
    };
  }

  /**
   * Legacy: Confirm acceptance of warning (medium)
   * Records resolution for audit, no other effect
   * @deprecated Use confirmAcceptanceAndGetMessage instead
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
  // PENDING MESSAGE STORAGE (Redis)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Store pending message in Redis
   * Called when MEDIUM signal blocks pipeline
   */
  async storePendingMessage(
    activationId: string,
    userId: string,
    message: string,
    conversationId: string
  ): Promise<void> {
    const store = getStore();
    const key = `pending:${activationId}`;
    
    const pendingMessage: PendingMessage = {
      activationId,
      userId,
      message,
      conversationId,
      timestamp: Date.now(),
    };
    
    await store.set(key, JSON.stringify(pendingMessage), PENDING_MESSAGE_TTL_SECONDS);
    console.log(`[SHIELD] Stored pending message: ${key}`);
  }

  /**
   * Get pending message from Redis
   * Called when user confirms warning
   */
  async getPendingMessage(activationId: string): Promise<PendingMessage | null> {
    const store = getStore();
    const key = `pending:${activationId}`;
    
    const data = await store.get(key);
    if (!data) {
      console.log(`[SHIELD] No pending message found: ${key}`);
      return null;
    }
    
    try {
      return JSON.parse(data) as PendingMessage;
    } catch (error) {
      console.error(`[SHIELD] Failed to parse pending message: ${key}`, error);
      return null;
    }
  }

  /**
   * Delete pending message from Redis
   * Called after message is processed
   */
  async deletePendingMessage(activationId: string): Promise<void> {
    const store = getStore();
    const key = `pending:${activationId}`;
    
    await store.delete(key);
    console.log(`[SHIELD] Deleted pending message: ${key}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // SHORT WARNING GENERATION (LLM)
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * Generate short warning message using model_llm
   * Returns 2-3 sentence contextual warning
   */
  async generateShortWarning(
    message: string,
    riskAssessment: RiskAssessment | null
  ): Promise<string> {
    // Fallback if no risk assessment
    if (!riskAssessment) {
      return this.getFallbackWarning();
    }

    const prompt = SHORT_WARNING_PROMPT
      .replace('{message}', message)
      .replace('{domain}', riskAssessment.domain)
      .replace('{riskExplanation}', riskAssessment.riskExplanation);

    try {
      const result = await generateWithModelLLM(prompt, message, {
        temperature: 0.3,
        max_tokens: 150,
      });

      if (!result || result.trim().length < 20) {
        console.warn('[SHIELD] LLM returned empty/short warning, using fallback');
        return this.getFallbackWarning(riskAssessment.domain);
      }

      // Clean up any formatting artifacts
      const cleaned = result
        .replace(/^["']|["']$/g, '') // Remove surrounding quotes
        .trim();

      return cleaned;
    } catch (error) {
      console.error('[SHIELD] Short warning generation error:', error);
      return this.getFallbackWarning(riskAssessment.domain);
    }
  }

  /**
   * Fallback warning when LLM fails
   */
  private getFallbackWarning(domain?: string): string {
    const domainWarnings: Record<string, string> = {
      financial: "This involves significant financial risk that could impact your stability. Are you sure you want to proceed?",
      career: "This decision could have lasting effects on your professional reputation. Would you like to continue?",
      legal: "This situation may have legal implications worth considering carefully. Are you sure you want advice on this?",
      health: "I want to make sure you're approaching this safely. Are you ready to proceed?",
      relationship: "This could significantly impact your relationships. Would you like to continue?",
    };

    return domainWarnings[domain ?? ''] ?? 
      "This decision may have significant consequences. Are you sure you want to proceed?";
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
