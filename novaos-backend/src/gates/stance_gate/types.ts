// ═══════════════════════════════════════════════════════════════════════════════
// STANCE GATE TYPES
// ═══════════════════════════════════════════════════════════════════════════════

import type { PrimaryRoute } from '../intent_gate/types.js';

export type StanceRoute = 'sword' | 'lens';

export interface StanceGateOutput {
  route: StanceRoute;
  primary_route: PrimaryRoute;
  learning_intent: boolean;
}
