// ═══════════════════════════════════════════════════════════════════════════════
// CURRICULUM VALIDATOR — Output Validation
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════
//
// Validates LLM-generated curriculum output:
//   - Schema validation (Zod)
//   - Resource index bounds checking
//   - Day sequence validation
//   - Minutes consistency
//   - Structural integrity
//
// This is separate from hallucination detection which checks for fabrication.
//
// ═══════════════════════════════════════════════════════════════════════════════

import { getLogger } from '../../../observability/logging/index.js';
import { incCounter } from '../../../observability/metrics/index.js';

import type {
  CurriculumValidationResult,
  ValidationIssue,
  ValidationSeverity,
  RawCurriculumOutput,
  StructuredCurriculum,
} from './types.js';
import { CURRICULUM_CONSTRAINTS } from './types.js';

import {
  parseRawCurriculumOutput,
  validateResourceIndices,
  validateDaySequence,
  validateMinutesSum,
  isAsciiPrintable,
} from './schemas.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'curriculum-validator' });

// ─────────────────────────────────────────────────────────────────────────────────
// ISSUE BUILDER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a validation issue.
 */
function issue(
  severity: ValidationSeverity,
  path: string,
  code: string,
  message: string,
  suggestion?: string
): ValidationIssue {
  return { severity, path, code, message, suggestion };
}

/**
 * Create an error issue.
 */
function errorIssue(path: string, code: string, message: string, suggestion?: string): ValidationIssue {
  return issue('error', path, code, message, suggestion);
}

/**
 * Create a warning issue.
 */
function warningIssue(path: string, code: string, message: string, suggestion?: string): ValidationIssue {
  return issue('warning', path, code, message, suggestion);
}

// ─────────────────────────────────────────────────────────────────────────────────
// SCHEMA VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate raw output against schema.
 */
function validateSchema(input: unknown): { valid: boolean; issues: ValidationIssue[]; data?: RawCurriculumOutput } {
  const issues: ValidationIssue[] = [];
  
  const result = parseRawCurriculumOutput(input);
  
  if (!result.success) {
    for (const zodIssue of result.error.errors) {
      issues.push(errorIssue(
        zodIssue.path.join('.') || 'root',
        'SCHEMA_ERROR',
        zodIssue.message
      ));
    }
    return { valid: false, issues };
  }
  
  return { valid: true, issues, data: result.data };
}

// ─────────────────────────────────────────────────────────────────────────────────
// STRUCTURAL VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate curriculum structure.
 */
function validateStructure(curriculum: RawCurriculumOutput, resourceCount: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Check days array
  if (!curriculum.days || curriculum.days.length === 0) {
    issues.push(errorIssue('days', 'NO_DAYS', 'Curriculum must have at least one day'));
    return issues;
  }
  
  if (curriculum.days.length > CURRICULUM_CONSTRAINTS.MAX_DAYS) {
    issues.push(errorIssue(
      'days',
      'TOO_MANY_DAYS',
      `Curriculum has ${curriculum.days.length} days, maximum is ${CURRICULUM_CONSTRAINTS.MAX_DAYS}`
    ));
  }
  
  // Validate day sequence
  const sequenceResult = validateDaySequence(curriculum.days);
  if (!sequenceResult.valid) {
    if (sequenceResult.gaps.length > 0) {
      issues.push(errorIssue(
        'days',
        'DAY_SEQUENCE_GAPS',
        `Missing days in sequence: ${sequenceResult.gaps.join(', ')}`,
        'Days must be numbered sequentially starting from 1'
      ));
    }
    if (sequenceResult.duplicates.length > 0) {
      issues.push(errorIssue(
        'days',
        'DAY_SEQUENCE_DUPLICATES',
        `Duplicate day numbers: ${sequenceResult.duplicates.join(', ')}`
      ));
    }
  }
  
  // Validate each day
  for (let i = 0; i < curriculum.days.length; i++) {
    const day = curriculum.days[i]!;
    const dayPath = `days[${i}]`;
    
    // Check resources
    if (!day.resources || day.resources.length === 0) {
      issues.push(errorIssue(
        `${dayPath}.resources`,
        'NO_RESOURCES',
        `Day ${day.day} has no resources assigned`
      ));
    } else if (day.resources.length > CURRICULUM_CONSTRAINTS.MAX_RESOURCES_PER_DAY) {
      issues.push(warningIssue(
        `${dayPath}.resources`,
        'TOO_MANY_RESOURCES',
        `Day ${day.day} has ${day.resources.length} resources, recommended maximum is ${CURRICULUM_CONSTRAINTS.MAX_RESOURCES_PER_DAY}`
      ));
    }
    
    // Validate resource indices
    for (let j = 0; j < (day.resources?.length ?? 0); j++) {
      const resource = day.resources![j]!;
      
      if (resource.index < 1 || resource.index > resourceCount) {
        issues.push(errorIssue(
          `${dayPath}.resources[${j}].index`,
          'INVALID_RESOURCE_INDEX',
          `Resource index ${resource.index} is out of bounds (must be 1-${resourceCount})`,
          'Use only indices from the provided resource list'
        ));
      }
      
      if (resource.minutes < CURRICULUM_CONSTRAINTS.MIN_MINUTES_PER_RESOURCE) {
        issues.push(warningIssue(
          `${dayPath}.resources[${j}].minutes`,
          'MINUTES_TOO_LOW',
          `Resource allocated only ${resource.minutes} minutes, minimum recommended is ${CURRICULUM_CONSTRAINTS.MIN_MINUTES_PER_RESOURCE}`
        ));
      }
      
      if (resource.minutes > CURRICULUM_CONSTRAINTS.MAX_MINUTES_PER_RESOURCE) {
        issues.push(warningIssue(
          `${dayPath}.resources[${j}].minutes`,
          'MINUTES_TOO_HIGH',
          `Resource allocated ${resource.minutes} minutes, maximum recommended is ${CURRICULUM_CONSTRAINTS.MAX_MINUTES_PER_RESOURCE}`
        ));
      }
    }
    
    // Validate minutes sum
    const minutesResult = validateMinutesSum(day);
    if (!minutesResult.valid) {
      issues.push(warningIssue(
        `${dayPath}.totalMinutes`,
        'MINUTES_MISMATCH',
        `Declared totalMinutes (${minutesResult.declared}) differs from computed (${minutesResult.computed}) by ${minutesResult.difference}`,
        'Resource + exercise minutes should sum to totalMinutes'
      ));
    }
    
    // Validate total minutes
    if (day.totalMinutes > CURRICULUM_CONSTRAINTS.MAX_MINUTES_PER_DAY) {
      issues.push(warningIssue(
        `${dayPath}.totalMinutes`,
        'DAY_TOO_LONG',
        `Day ${day.day} is ${day.totalMinutes} minutes, maximum recommended is ${CURRICULUM_CONSTRAINTS.MAX_MINUTES_PER_DAY}`
      ));
    }
    
    // Validate theme
    if (!day.theme || day.theme.trim().length === 0) {
      issues.push(warningIssue(
        `${dayPath}.theme`,
        'MISSING_THEME',
        `Day ${day.day} has no theme`
      ));
    } else if (day.theme.length > CURRICULUM_CONSTRAINTS.MAX_THEME_LENGTH) {
      issues.push(warningIssue(
        `${dayPath}.theme`,
        'THEME_TOO_LONG',
        `Theme is ${day.theme.length} characters, maximum is ${CURRICULUM_CONSTRAINTS.MAX_THEME_LENGTH}`
      ));
    }
    
    // Validate prerequisite days
    if (day.prerequisiteDays) {
      for (const prereq of day.prerequisiteDays) {
        if (prereq >= day.day) {
          issues.push(errorIssue(
            `${dayPath}.prerequisiteDays`,
            'INVALID_PREREQUISITE',
            `Day ${day.day} cannot have day ${prereq} as prerequisite (must be earlier)`
          ));
        }
      }
    }
  }
  
  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTENT VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate content for security issues.
 */
function validateContent(curriculum: RawCurriculumOutput): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  
  // Check title
  if (curriculum.title && !isAsciiPrintable(curriculum.title)) {
    issues.push(warningIssue(
      'title',
      'NON_ASCII_CONTENT',
      'Title contains non-ASCII characters'
    ));
  }
  
  // Check description
  if (curriculum.description && !isAsciiPrintable(curriculum.description)) {
    issues.push(warningIssue(
      'description',
      'NON_ASCII_CONTENT',
      'Description contains non-ASCII characters'
    ));
  }
  
  // Check days for non-ASCII content
  for (let i = 0; i < curriculum.days.length; i++) {
    const day = curriculum.days[i]!;
    const dayPath = `days[${i}]`;
    
    if (day.theme && !isAsciiPrintable(day.theme)) {
      issues.push(warningIssue(
        `${dayPath}.theme`,
        'NON_ASCII_CONTENT',
        `Day ${day.day} theme contains non-ASCII characters`
      ));
    }
    
    if (day.notes && !isAsciiPrintable(day.notes)) {
      issues.push(warningIssue(
        `${dayPath}.notes`,
        'NON_ASCII_CONTENT',
        `Day ${day.day} notes contain non-ASCII characters`
      ));
    }
    
    // Check exercises
    for (let j = 0; j < (day.exercises?.length ?? 0); j++) {
      const exercise = day.exercises![j]!;
      if (!isAsciiPrintable(exercise.description)) {
        issues.push(warningIssue(
          `${dayPath}.exercises[${j}].description`,
          'NON_ASCII_CONTENT',
          `Exercise description contains non-ASCII characters`
        ));
      }
    }
  }
  
  return issues;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN VALIDATOR
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate curriculum output.
 */
export function validateCurriculumOutput(
  input: unknown,
  resourceCount: number
): CurriculumValidationResult {
  const allIssues: ValidationIssue[] = [];
  
  // Step 1: Schema validation
  const schemaResult = validateSchema(input);
  allIssues.push(...schemaResult.issues);
  
  if (!schemaResult.valid || !schemaResult.data) {
    return {
      valid: false,
      issues: allIssues,
      errorCount: allIssues.filter(i => i.severity === 'error').length,
      warningCount: allIssues.filter(i => i.severity === 'warning').length,
    };
  }
  
  const curriculum = schemaResult.data;
  
  // Step 2: Structural validation
  const structureIssues = validateStructure(curriculum, resourceCount);
  allIssues.push(...structureIssues);
  
  // Step 3: Content validation
  const contentIssues = validateContent(curriculum);
  allIssues.push(...contentIssues);
  
  // Count issues
  const errorCount = allIssues.filter(i => i.severity === 'error').length;
  const warningCount = allIssues.filter(i => i.severity === 'warning').length;
  
  // Log results
  if (errorCount > 0) {
    logger.warn('Curriculum validation failed', {
      errorCount,
      warningCount,
      errors: allIssues.filter(i => i.severity === 'error').map(i => i.code),
    });
    incCounter('curriculum_validation_total', { result: 'error' });
  } else if (warningCount > 0) {
    logger.info('Curriculum validation passed with warnings', { warningCount });
    incCounter('curriculum_validation_total', { result: 'warning' });
  } else {
    logger.debug('Curriculum validation passed');
    incCounter('curriculum_validation_total', { result: 'success' });
  }
  
  return {
    valid: errorCount === 0,
    issues: allIssues,
    errorCount,
    warningCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  validateSchema,
  validateStructure,
  validateContent,
  issue,
  errorIssue,
  warningIssue,
};
