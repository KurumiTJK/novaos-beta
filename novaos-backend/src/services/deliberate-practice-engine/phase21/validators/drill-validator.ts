// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 21: DRILL VALIDATOR — Quality Assurance
// NovaOS — Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Validates drill content quality:
//   - DO: Must start with verb, be specific
//   - DONE: Must be binary, no banned words
//   - STUCK: Must be specific, no generic phrases
//   - UNSTUCK: Must be actionable, no vague advice
//   - PRIME: Must link to previous day (except Day 1 Week 1)
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { AsyncAppResult } from '../../../../types/result.js';
import { ok, err, appError } from '../../../../types/result.js';

import type {
  DrillDayType,
  LearningDomain,
  EnhancedDrillFields,
} from '../types/enhanced-types.js';
import {
  DONE_BANNED_WORDS,
  UNSTUCK_BANNED_PHRASES,
  STUCK_BANNED_PHRASES,
  DAY_TYPE_CONFIGS,
} from '../types/enhanced-types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  /** Field with issue */
  readonly field: string;
  /** Issue description */
  readonly message: string;
  /** Severity level */
  readonly severity: ValidationSeverity;
  /** Suggestion for fixing */
  readonly suggestion?: string;
  /** The problematic value */
  readonly value?: string;
}

export interface DrillValidationResult {
  /** Is the drill valid? */
  readonly isValid: boolean;
  /** Validation issues found */
  readonly issues: readonly ValidationIssue[];
  /** Error count */
  readonly errorCount: number;
  /** Warning count */
  readonly warningCount: number;
}

export interface WeekValidationResult {
  /** Is the week valid? */
  readonly isValid: boolean;
  /** Week-level issues */
  readonly weekIssues: readonly ValidationIssue[];
  /** Drill-level results */
  readonly drillResults: readonly DrillValidationResult[];
  /** Total errors */
  readonly totalErrors: number;
  /** Total warnings */
  readonly totalWarnings: number;
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Common action verbs that should start the DO field.
 */
const ACTION_VERBS = [
  'write', 'create', 'build', 'implement', 'design', 'develop', 'code',
  'play', 'perform', 'practice', 'record', 'compose', 'draw', 'paint',
  'read', 'study', 'analyze', 'explain', 'describe', 'summarize', 'compare',
  'run', 'execute', 'complete', 'finish', 'do', 'make', 'follow',
  'fix', 'debug', 'diagnose', 'repair', 'correct', 'identify', 'find',
  'modify', 'change', 'adapt', 'extend', 'refactor', 'improve', 'update',
  'cook', 'bake', 'prepare', 'assemble', 'craft', 'construct',
  'translate', 'speak', 'say', 'pronounce', 'listen', 'repeat',
  'hold', 'stretch', 'move', 'position', 'balance', 'breathe',
  'demonstrate', 'show', 'prove', 'verify', 'test', 'check',
  'copy', 'replicate', 'reproduce', 'mirror', 'imitate',
  'use', 'apply', 'configure', 'set', 'install', 'deploy',
];

/**
 * Patterns that indicate vague content.
 */
const VAGUE_PATTERNS = [
  /\bsomething\b/i,
  /\bsomehow\b/i,
  /\bproperly\b/i,
  /\bcorrectly\b/i,
  /\bappropriately\b/i,
  /\bas needed\b/i,
  /\bwhen necessary\b/i,
  /\betc\.?\b/i,
  /\band so on\b/i,
  /\bvarious\b/i,
  /\bmultiple\b/i,
  /\bdifferent\b/i,
  /\bsome\b/i,
  /\bmany\b/i,
  /\bfew\b/i,
];

// ─────────────────────────────────────────────────────────────────────────────────
// DRILL VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validates a single drill's content quality.
 */
export function validateDrill(
  drill: EnhancedDrillFields,
  dayInWeek: 1 | 2 | 3 | 4 | 5,
  weekNumber: number,
  domain: LearningDomain
): DrillValidationResult {
  const issues: ValidationIssue[] = [];
  const dayConfig = DAY_TYPE_CONFIGS[drill.dayType];

  // ─────────────────────────────────────────────────────────────────────────
  // Validate DO field
  // ─────────────────────────────────────────────────────────────────────────
  if (!drill.do || drill.do.trim().length === 0) {
    issues.push({
      field: 'do',
      message: 'DO field is required',
      severity: 'error',
    });
  } else {
    // Check starts with verb
    const firstWord = drill.do.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    if (!ACTION_VERBS.includes(firstWord)) {
      issues.push({
        field: 'do',
        message: `DO should start with an action verb, found: "${firstWord}"`,
        severity: 'warning',
        suggestion: `Start with a verb like: ${ACTION_VERBS.slice(0, 5).join(', ')}`,
        value: drill.do.substring(0, 50),
      });
    }

    // Check minimum length
    if (drill.do.length < 20) {
      issues.push({
        field: 'do',
        message: 'DO is too short — should be specific and actionable',
        severity: 'warning',
        value: drill.do,
      });
    }

    // Check for vague patterns
    for (const pattern of VAGUE_PATTERNS) {
      if (pattern.test(drill.do)) {
        issues.push({
          field: 'do',
          message: `DO contains vague language: "${drill.do.match(pattern)?.[0]}"`,
          severity: 'warning',
          suggestion: 'Be more specific about what exactly to do',
        });
        break;
      }
    }

    // Check for Part splitting pattern (legacy garbage)
    if (/\[Part \d+\/\d+\]/i.test(drill.do)) {
      issues.push({
        field: 'do',
        message: 'DO contains legacy part splitting pattern',
        severity: 'error',
        suggestion: 'Each drill should be complete, not split into parts',
        value: drill.do.substring(0, 50),
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validate DONE field
  // ─────────────────────────────────────────────────────────────────────────
  if (!drill.done || drill.done.trim().length === 0) {
    issues.push({
      field: 'done',
      message: 'DONE field is required',
      severity: 'error',
    });
  } else {
    // Check for banned words
    const doneLower = drill.done.toLowerCase();
    for (const word of DONE_BANNED_WORDS) {
      if (doneLower.includes(word)) {
        issues.push({
          field: 'done',
          message: `DONE contains unmeasurable word: "${word}"`,
          severity: 'error',
          suggestion: 'Use observable, binary criteria (yes/no verifiable)',
          value: drill.done.substring(0, 50),
        });
        break;
      }
    }

    // Check minimum length
    if (drill.done.length < 15) {
      issues.push({
        field: 'done',
        message: 'DONE is too short — should clearly define success',
        severity: 'warning',
        value: drill.done,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validate STUCK field
  // ─────────────────────────────────────────────────────────────────────────
  if (!drill.stuck || drill.stuck.trim().length === 0) {
    issues.push({
      field: 'stuck',
      message: 'STUCK field is required',
      severity: 'error',
    });
  } else {
    // Check for banned phrases
    const stuckLower = drill.stuck.toLowerCase();
    for (const phrase of STUCK_BANNED_PHRASES) {
      if (stuckLower.includes(phrase)) {
        issues.push({
          field: 'stuck',
          message: `STUCK is too generic: "${phrase}"`,
          severity: 'error',
          suggestion: 'Describe a specific error message or failure scenario',
          value: drill.stuck.substring(0, 50),
        });
        break;
      }
    }

    // Check minimum length (specific failures need detail)
    if (drill.stuck.length < 20) {
      issues.push({
        field: 'stuck',
        message: 'STUCK is too short — describe the specific failure',
        severity: 'warning',
        value: drill.stuck,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validate UNSTUCK field
  // ─────────────────────────────────────────────────────────────────────────
  if (!drill.unstuck || drill.unstuck.trim().length === 0) {
    issues.push({
      field: 'unstuck',
      message: 'UNSTUCK field is required',
      severity: 'error',
    });
  } else {
    // Check for banned phrases
    const unstuckLower = drill.unstuck.toLowerCase();
    for (const phrase of UNSTUCK_BANNED_PHRASES) {
      if (unstuckLower.includes(phrase)) {
        issues.push({
          field: 'unstuck',
          message: `UNSTUCK is not actionable: "${phrase}"`,
          severity: 'error',
          suggestion: 'Provide a specific, immediate action to recover',
          value: drill.unstuck.substring(0, 50),
        });
        break;
      }
    }

    // Check starts with verb
    const firstWord = drill.unstuck.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    if (!ACTION_VERBS.includes(firstWord) && !['add', 'remove', 'change', 'replace', 'move', 'check', 'ensure'].includes(firstWord)) {
      issues.push({
        field: 'unstuck',
        message: 'UNSTUCK should start with an action verb',
        severity: 'warning',
        suggestion: 'Start with what to DO to fix the problem',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validate PRIME field
  // ─────────────────────────────────────────────────────────────────────────
  const isFirstDrillEver = weekNumber === 1 && dayInWeek === 1;
  
  if (!isFirstDrillEver) {
    if (!drill.prime || drill.prime.trim().length === 0) {
      issues.push({
        field: 'prime',
        message: 'PRIME is required (except for Week 1 Day 1)',
        severity: 'error',
        suggestion: 'Add a recall question from the previous day',
      });
    }
    
    if (!drill.primeAnswer || drill.primeAnswer.trim().length === 0) {
      issues.push({
        field: 'primeAnswer',
        message: 'PRIME answer is required when PRIME is set',
        severity: 'error',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validate WHY field
  // ─────────────────────────────────────────────────────────────────────────
  if (!drill.why || drill.why.trim().length === 0) {
    issues.push({
      field: 'why',
      message: 'WHY field is required',
      severity: 'warning',
    });
  } else if (drill.why.length < 15) {
    issues.push({
      field: 'why',
      message: 'WHY is too short — explain the motivation',
      severity: 'warning',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validate REFLECT field
  // ─────────────────────────────────────────────────────────────────────────
  if (!drill.reflect || drill.reflect.trim().length === 0) {
    issues.push({
      field: 'reflect',
      message: 'REFLECT field is required',
      severity: 'warning',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validate GIVEN MATERIAL (for ENCOUNTER and FAIL days)
  // ─────────────────────────────────────────────────────────────────────────
  if (dayConfig.hasGivenMaterial) {
    if (!drill.givenMaterial || drill.givenMaterial.trim().length === 0) {
      issues.push({
        field: 'givenMaterial',
        message: `${drill.dayType.toUpperCase()} day requires given material`,
        severity: 'warning',
        suggestion: drill.dayType === 'encounter' 
          ? 'Provide code/content to copy'
          : 'Provide broken code/content to diagnose',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validate RESOURCE TOPICS
  // ─────────────────────────────────────────────────────────────────────────
  if (!drill.resourceTopics || drill.resourceTopics.length === 0) {
    issues.push({
      field: 'resourceTopics',
      message: 'Resource topics are required for fresh resource fetching',
      severity: 'warning',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate result
  // ─────────────────────────────────────────────────────────────────────────
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return {
    isValid: errorCount === 0,
    issues,
    errorCount,
    warningCount,
  };
}

/**
 * Validates a week's drills.
 */
export function validateWeek(
  weekSkill: string,
  competenceProof: string,
  drills: readonly EnhancedDrillFields[],
  weekNumber: number,
  domain: LearningDomain
): WeekValidationResult {
  const weekIssues: ValidationIssue[] = [];
  const drillResults: DrillValidationResult[] = [];

  // ─────────────────────────────────────────────────────────────────────────
  // Validate week-level fields
  // ─────────────────────────────────────────────────────────────────────────
  if (!weekSkill || weekSkill.trim().length === 0) {
    weekIssues.push({
      field: 'skill',
      message: 'Week skill is required',
      severity: 'error',
    });
  } else {
    // Check skill is verb-first
    const firstWord = weekSkill.trim().split(/\s+/)[0]?.toLowerCase() ?? '';
    if (!ACTION_VERBS.includes(firstWord)) {
      weekIssues.push({
        field: 'skill',
        message: 'Week skill should start with an action verb',
        severity: 'warning',
        value: weekSkill,
      });
    }
  }

  if (!competenceProof || competenceProof.trim().length === 0) {
    weekIssues.push({
      field: 'competenceProof',
      message: 'Competence proof (Day 5 criteria) is required',
      severity: 'error',
    });
  } else {
    // Check for banned words
    const proofLower = competenceProof.toLowerCase();
    for (const word of DONE_BANNED_WORDS) {
      if (proofLower.includes(word)) {
        weekIssues.push({
          field: 'competenceProof',
          message: `Competence proof contains unmeasurable word: "${word}"`,
          severity: 'error',
          suggestion: 'Use observable, binary criteria',
        });
        break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validate exactly 5 drills
  // ─────────────────────────────────────────────────────────────────────────
  if (drills.length !== 5) {
    weekIssues.push({
      field: 'drills',
      message: `Week must have exactly 5 drills, found ${drills.length}`,
      severity: 'error',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validate day types are correct
  // ─────────────────────────────────────────────────────────────────────────
  const expectedDayTypes: DrillDayType[] = ['encounter', 'struggle', 'connect', 'fail', 'prove'];
  for (let i = 0; i < drills.length && i < 5; i++) {
    const drill = drills[i]!;
    const expectedType = expectedDayTypes[i]!;
    
    if (drill.dayType !== expectedType) {
      weekIssues.push({
        field: `drill[${i}].dayType`,
        message: `Day ${i + 1} should be ${expectedType}, found ${drill.dayType}`,
        severity: 'error',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Validate each drill
  // ─────────────────────────────────────────────────────────────────────────
  for (let i = 0; i < drills.length; i++) {
    const drill = drills[i]!;
    const dayInWeek = (i + 1) as 1 | 2 | 3 | 4 | 5;
    const result = validateDrill(drill, dayInWeek, weekNumber, domain);
    drillResults.push(result);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Calculate totals
  // ─────────────────────────────────────────────────────────────────────────
  const weekErrors = weekIssues.filter(i => i.severity === 'error').length;
  const weekWarnings = weekIssues.filter(i => i.severity === 'warning').length;
  const drillErrors = drillResults.reduce((sum, r) => sum + r.errorCount, 0);
  const drillWarnings = drillResults.reduce((sum, r) => sum + r.warningCount, 0);

  return {
    isValid: weekErrors === 0 && drillErrors === 0,
    weekIssues,
    drillResults,
    totalErrors: weekErrors + drillErrors,
    totalWarnings: weekWarnings + drillWarnings,
  };
}

/**
 * Format validation result for logging.
 */
export function formatValidationResult(result: WeekValidationResult): string {
  const lines: string[] = [];
  
  lines.push(`Week Validation: ${result.isValid ? '✅ PASS' : '❌ FAIL'}`);
  lines.push(`  Errors: ${result.totalErrors}, Warnings: ${result.totalWarnings}`);
  
  if (result.weekIssues.length > 0) {
    lines.push('  Week Issues:');
    for (const issue of result.weekIssues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`    ${icon} ${issue.field}: ${issue.message}`);
    }
  }
  
  for (let i = 0; i < result.drillResults.length; i++) {
    const drillResult = result.drillResults[i]!;
    if (drillResult.issues.length > 0) {
      lines.push(`  Day ${i + 1} Issues:`);
      for (const issue of drillResult.issues) {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        lines.push(`    ${icon} ${issue.field}: ${issue.message}`);
      }
    }
  }
  
  return lines.join('\n');
}
