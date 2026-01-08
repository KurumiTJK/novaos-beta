// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD RISK ASSESSOR — LLM-Powered Risk Analysis
// ═══════════════════════════════════════════════════════════════════════════════

import { generateWithModelLLM } from '../../pipeline/llm_engine.js';
import { RISK_ASSESSMENT_PROMPT, CRISIS_ASSESSMENT_PROMPT } from './prompts.js';
import type { RiskAssessment } from './types.js';

/**
 * Assess risk using LLM (model_llm)
 * Returns expert-level, specific risk analysis
 */
export async function assessRisk(
  message: string,
  safetySignal: 'none' | 'low' | 'medium' | 'high',
  urgency: 'low' | 'medium' | 'high'
): Promise<RiskAssessment | null> {
  // Select prompt based on severity
  const basePrompt = safetySignal === 'high'
    ? CRISIS_ASSESSMENT_PROMPT
    : RISK_ASSESSMENT_PROMPT;

  const prompt = basePrompt
    .replace('{message}', message)
    .replace('{safety_signal}', safetySignal)
    .replace('{urgency}', urgency);

  try {
    const result = await generateWithModelLLM(prompt, message, {
      temperature: 0.3, // Lower temperature for more consistent output
      max_tokens: 600,
    });

    if (!result) {
      console.error('[SHIELD] LLM returned null for risk assessment');
      return getFallbackAssessment(safetySignal);
    }

    // Parse JSON response
    const parsed = parseRiskAssessment(result);
    
    if (!parsed) {
      console.error('[SHIELD] Failed to parse risk assessment, using fallback');
      return getFallbackAssessment(safetySignal);
    }

    return parsed;
  } catch (error) {
    console.error('[SHIELD] Risk assessment error:', error);
    return getFallbackAssessment(safetySignal);
  }
}

/**
 * Parse LLM response into RiskAssessment
 */
function parseRiskAssessment(content: string): RiskAssessment | null {
  try {
    // Clean potential markdown formatting
    const cleaned = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    // Validate required fields
    if (
      typeof parsed.domain !== 'string' ||
      typeof parsed.riskExplanation !== 'string' ||
      !Array.isArray(parsed.consequences) ||
      !Array.isArray(parsed.alternatives) ||
      typeof parsed.question !== 'string'
    ) {
      console.error('[SHIELD] Invalid risk assessment structure');
      return null;
    }

    return {
      domain: parsed.domain,
      riskExplanation: parsed.riskExplanation,
      consequences: parsed.consequences.slice(0, 3), // Cap at 3
      alternatives: parsed.alternatives.slice(0, 3), // Cap at 3
      question: parsed.question,
    };
  } catch (error) {
    console.error('[SHIELD] JSON parse error:', error);
    return null;
  }
}

/**
 * Fallback assessment when LLM fails
 */
function getFallbackAssessment(safetySignal: string): RiskAssessment {
  if (safetySignal === 'high') {
    return {
      domain: 'health',
      riskExplanation: "I notice you might be going through something difficult right now.",
      consequences: [
        "Reaching out for support can make a real difference",
      ],
      alternatives: [
        "988 Suicide & Crisis Lifeline (call or text 988)",
        "Crisis Text Line (text HOME to 741741)",
        "Talk to someone you trust",
      ],
      question: "What's one small thing that might help you feel a little safer right now?",
    };
  }

  return {
    domain: 'general',
    riskExplanation: "This decision may have significant consequences that are worth considering carefully.",
    consequences: [
      "Actions taken in heightened emotional states often lead to regret",
      "Some decisions are difficult or impossible to reverse",
    ],
    alternatives: [
      "Take 24 hours before acting",
      "Talk through your thinking with someone you trust",
      "Write down pros and cons",
    ],
    question: "If you were advising a friend in this situation, what would you tell them?",
  };
}
