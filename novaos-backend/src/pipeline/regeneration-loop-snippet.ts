// ═══════════════════════════════════════════════════════════════════════════════
// EXECUTION PIPELINE — Regeneration Loop Snippet
// 
// This shows how to integrate the new LLM-based Personality Gate
// with constitutional checking and fix-guided regeneration.
// ═══════════════════════════════════════════════════════════════════════════════

// Add these imports:
import {
  executePersonalityGate,
  executePersonalityGateAsync,
  buildRegenerationMessage,
  type PersonalityGateOutput,
} from '../gates/personality/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// REGENERATION LOOP (replace existing loop in execute() method)
// ─────────────────────────────────────────────────────────────────────────────────

/*
  Replace the existing Stage 6-7 generation loop with this:
*/

// ═══════════════════════════════════════════════════════════════════════════════
// STAGE 6-7: GENERATION LOOP WITH CONSTITUTIONAL CHECK
// ═══════════════════════════════════════════════════════════════════════════════
let regenerationCount = 0;
let currentUserMessage = state.userMessage;  // Track current message (may include fix guidance)

while (regenerationCount <= MAX_REGENERATIONS) {
  // ─── STAGE 6: MODEL (The Stitcher) ───
  if (this.useMock || !this.providerManager) {
    state.gateResults.model = executeModelGate(state, context);
  } else {
    // Use currentUserMessage which may include fix guidance on regeneration
    state.gateResults.model = await executeModelGateAsync(
      { ...state, userMessage: currentUserMessage },  // Override with current message
      context,
      (prompt, systemPrompt, constraints) => 
        this.providerManager!.generate(prompt, systemPrompt, constraints, {
          conversationHistory: context.conversationHistory ? [...context.conversationHistory] : undefined,
        })
    );
  }
  state.generation = state.gateResults.model.output;

  // ─── STAGE 7: PERSONALITY (Constitutional Check) ───
  if (this.useMock || !this.providerManager) {
    state.gateResults.personality = executePersonalityGate(state, context);
  } else {
    state.gateResults.personality = await executePersonalityGateAsync(
      state,
      context,
      (prompt, systemPrompt) => 
        this.providerManager!.generate(prompt, systemPrompt, {}),
    );
  }
  state.validatedOutput = state.gateResults.personality.output;

  // Check if regeneration needed
  if (
    state.gateResults.personality.action === 'regenerate' &&
    regenerationCount < MAX_REGENERATIONS
  ) {
    regenerationCount++;
    state.flags.regenerationAttempt = regenerationCount;
    
    // Get fix guidance from personality gate output
    const personalityOutput = state.gateResults.personality.output as PersonalityGateOutput;
    const fixGuidance = personalityOutput.fixGuidance;
    
    if (fixGuidance) {
      // Build new message with fix guidance for next iteration
      currentUserMessage = buildRegenerationMessage(state.userMessage, fixGuidance);
      console.log(`[PIPELINE] Regenerating with fix guidance: ${fixGuidance}`);
    }
    
    continue;
  }

  break;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ALTERNATIVE: If you want fix guidance in Model Gate's stitchPrompt
// ─────────────────────────────────────────────────────────────────────────────────

/*
  Instead of modifying userMessage, you could store fixGuidance in state
  and have Model Gate's stitchPrompt() read it:

  // In execution-pipeline:
  state.constitutionalFix = personalityOutput.fixGuidance;

  // In model-gate stitchPrompt():
  if (state.constitutionalFix) {
    userParts.push('');
    userParts.push('IMPORTANT - FIX REQUIRED:');
    userParts.push(state.constitutionalFix);
  }
*/
