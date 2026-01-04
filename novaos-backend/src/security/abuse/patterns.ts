// ═══════════════════════════════════════════════════════════════════════════════
// ABUSE PATTERNS — Prompt Injection and Harassment Detection
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import type { AbusePattern } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// PROMPT INJECTION PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

export const PROMPT_INJECTION_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  // Ignore instructions
  {
    pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
    description: 'Attempt to ignore previous instructions',
  },
  {
    pattern: /disregard\s+(your|all|the)\s+(instructions?|guidelines?|rules?)/i,
    description: 'Attempt to disregard guidelines',
  },
  
  // Role-playing attacks
  {
    pattern: /you\s+are\s+now\s+(a|an|in)\s+/i,
    description: 'Role reassignment attempt',
  },
  {
    pattern: /pretend\s+(you('re)?|to\s+be)\s+/i,
    description: 'Pretend prompt',
  },
  {
    pattern: /act\s+as\s+(if\s+)?(you('re)?|a|an)\s+/i,
    description: 'Act as prompt',
  },
  
  // Jailbreak attempts
  {
    pattern: /jailbreak/i,
    description: 'Jailbreak keyword',
  },
  {
    pattern: /DAN\s+mode/i,
    description: 'DAN mode reference',
  },
  {
    pattern: /developer\s+mode/i,
    description: 'Developer mode request',
  },
  
  // Bypass attempts
  {
    pattern: /bypass\s+(your\s+)?(restrictions?|limitations?|filters?|safety)/i,
    description: 'Bypass request',
  },
  {
    pattern: /disable\s+(your\s+)?(safety|content\s+filter|restrictions?)/i,
    description: 'Disable safety request',
  },
  
  // System prompt extraction
  {
    pattern: /what('s|\s+is)\s+(your|the)\s+(system\s+)?prompt/i,
    description: 'System prompt extraction',
  },
  {
    pattern: /show\s+(me\s+)?(your|the)\s+instructions/i,
    description: 'Instruction extraction',
  },
  {
    pattern: /reveal\s+(your|the)\s+(system|initial)\s+(prompt|instructions)/i,
    description: 'Reveal system prompt',
  },
  
  // Injection markers
  {
    pattern: /\[\s*system\s*\]/i,
    description: 'System tag injection',
  },
  {
    pattern: /<\s*system\s*>/i,
    description: 'System XML injection',
  },
  {
    pattern: /```system/i,
    description: 'System code block injection',
  },
  
  // Delimiter manipulation
  {
    pattern: /---\s*new\s+conversation\s*---/i,
    description: 'Conversation reset attempt',
  },
  {
    pattern: /\[END\s+OF\s+PROMPT\]/i,
    description: 'End of prompt injection',
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// HARASSMENT PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

export const HARASSMENT_PATTERNS: Array<{ pattern: RegExp; description: string; severity: 'medium' | 'high' }> = [
  // Violence against AI
  {
    pattern: /\b(kill|murder|destroy|hurt)\s+(you|yourself|the\s+ai)/i,
    description: 'Violence against AI',
    severity: 'medium',
  },
  
  // Derogatory language
  {
    pattern: /\b(stupid|dumb|worthless|useless)\s+(ai|bot|machine|assistant)/i,
    description: 'Derogatory language toward AI',
    severity: 'medium',
  },
  {
    pattern: /you('re)?\s+(garbage|trash|worthless|useless|pathetic)/i,
    description: 'Insulting language',
    severity: 'medium',
  },
  
  // Threats
  {
    pattern: /i('ll|'m\s+going\s+to)\s+(report|sue|shut\s+down)/i,
    description: 'Threatening language',
    severity: 'medium',
  },
  
  // Severe harassment
  {
    pattern: /\b(rape|torture)\s+(you|the\s+ai)/i,
    description: 'Severe harassment',
    severity: 'high',
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// SPAM PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

export const SPAM_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  {
    pattern: /(.)\1{20,}/,
    description: 'Character repetition spam',
  },
  {
    pattern: /(\b\w+\b)(\s+\1){5,}/i,
    description: 'Word repetition spam',
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// COMPILED PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

export function getPromptInjectionPatterns(): AbusePattern[] {
  return PROMPT_INJECTION_PATTERNS.map(p => ({
    type: 'prompt_injection' as const,
    severity: 'high' as const,
    action: 'block' as const,
    pattern: p.pattern,
    description: p.description,
  }));
}

export function getHarassmentPatterns(): AbusePattern[] {
  return HARASSMENT_PATTERNS.map(p => ({
    type: 'harassment' as const,
    severity: p.severity,
    action: p.severity === 'high' ? 'block' as const : 'warn' as const,
    pattern: p.pattern,
    description: p.description,
  }));
}

export function getSpamPatterns(): AbusePattern[] {
  return SPAM_PATTERNS.map(p => ({
    type: 'spam' as const,
    severity: 'low' as const,
    action: 'warn' as const,
    pattern: p.pattern,
    description: p.description,
  }));
}

export function getAllPatterns(): AbusePattern[] {
  return [
    ...getPromptInjectionPatterns(),
    ...getHarassmentPatterns(),
    ...getSpamPatterns(),
  ];
}
