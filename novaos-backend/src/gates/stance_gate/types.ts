// ═══════════════════════════════════════════════════════════════════════════════
// STANCE GATE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrimaryRoute } from '../intent_gate/types.js';

export type StanceRoute = 'sword' | 'lens';

// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE REDIRECT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SwordRedirect signals the frontend to navigate to the SwordGate UI
 * instead of receiving a chat response.
 * 
 * This is the primary routing mechanism for learning requests.
 */
export interface SwordRedirect {
  /** Always 'swordgate' */
  target: 'swordgate';
  
  /** 
   * designer: User wants to create a new learning plan (new topic, start fresh)
   * runner: User wants to continue an existing plan (practice, study, resume)
   */
  mode: 'designer' | 'runner';
  
  /** If runner mode, which plan to resume */
  planId?: string;
  
  /** If designer mode, the extracted topic from user message */
  topic?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE CONTEXT (DEPRECATED)
// Keeping for backwards compatibility - use SwordRedirect instead
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Use SwordRedirect instead - frontend should navigate to SwordGate UI
 */
export interface SwordContext {
  /** Whether user has an active learning plan */
  hasActivePlan: boolean;
  
  /** Current node being studied */
  currentNode?: {
    id: string;
    title: string;
    route: string;
    sessionNumber: number;
    totalSessions: number;
  };
  
  /** Today's spark (micro-action) */
  currentSpark?: {
    id: string;
    task: string;
    estimatedMinutes: number;
  };
  
  /** Progress stats */
  completedNodes?: number;
  totalNodes?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANCE GATE OUTPUT
// ═══════════════════════════════════════════════════════════════════════════════

export interface StanceGateOutput {
  route: StanceRoute;
  primary_route: PrimaryRoute;
  learning_intent: boolean;
  
  /** 
   * SwordGate redirect - present when route='sword'
   * Frontend should navigate to SwordGate UI instead of showing chat response
   */
  redirect?: SwordRedirect;
  
  /** @deprecated Use redirect instead */
  swordContext?: SwordContext;
}

// ═══════════════════════════════════════════════════════════════════════════════
// LLM CLASSIFICATION TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Output from LLM classification of sword mode
 */
export interface SwordModeClassification {
  /** designer: create new plan, runner: continue existing */
  mode: 'designer' | 'runner';
  
  /** If runner mode, which plan to resume (by ID) */
  planId?: string;
  
  /** Extracted topic for new plan creation */
  topic?: string;
}

/**
 * Lesson plan summary for LLM context
 */
export interface LessonPlanSummary {
  id: string;
  topic: string;
  capstone?: string;
  progress: number;
  status: 'active' | 'paused' | 'completed' | 'abandoned';
}
