// ═══════════════════════════════════════════════════════════════════════════════
// HALLUCINATION DETECTOR — Fabrication Detection
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════
//
// Detects LLM hallucinations in curriculum output:
//   - Fabricated resource indices (outside 1..N)
//   - Fabricated URLs not in verified list
//   - Fabricated resource titles/metadata
//   - Made-up statistics or claims
//   - References to non-existent content
//
// INVARIANT: All resource references MUST trace back to verified resources.
//            Any unverifiable reference is a hallucination.
//
// ═══════════════════════════════════════════════════════════════════════════════

import { getLogger } from '../../../observability/logging/index.js';
import { incCounter } from '../../../observability/metrics/index.js';

import type { VerifiedResource } from '../resource-discovery/types.js';
import type { RawCurriculumOutput } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'hallucination-detector' });

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Type of hallucination detected.
 */
export type HallucinationType =
  | 'fabricated_index'       // Resource index outside valid range
  | 'fabricated_url'         // URL not in verified list
  | 'fabricated_title'       // Title doesn't match any resource
  | 'fabricated_statistic'   // Made-up number/statistic
  | 'fabricated_reference'   // Reference to non-existent content
  | 'suspicious_claim';      // Unverifiable claim

/**
 * Severity of hallucination.
 */
export type HallucinationSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * A detected hallucination.
 */
export interface Hallucination {
  /** Type of hallucination */
  readonly type: HallucinationType;
  
  /** Severity level */
  readonly severity: HallucinationSeverity;
  
  /** Location in output */
  readonly path: string;
  
  /** Description */
  readonly description: string;
  
  /** The fabricated content */
  readonly fabricatedContent: string;
  
  /** Expected valid values (if applicable) */
  readonly validRange?: string;
}

/**
 * Detection result.
 */
export interface HallucinationDetectionResult {
  /** Whether any hallucinations were detected */
  readonly hasHallucinations: boolean;
  
  /** Whether critical hallucinations were found (should reject output) */
  readonly hasCritical: boolean;
  
  /** All detected hallucinations */
  readonly hallucinations: readonly Hallucination[];
  
  /** Count by type */
  readonly countByType: Readonly<Record<HallucinationType, number>>;
  
  /** Count by severity */
  readonly countBySeverity: Readonly<Record<HallucinationSeverity, number>>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// URL PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Common URL patterns that might appear in LLM output.
 */
const URL_PATTERNS = [
  // Full URLs
  /https?:\/\/[^\s"'<>]+/gi,
  // Partial URLs
  /www\.[^\s"'<>]+/gi,
  // YouTube-like
  /youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/gi,
  /youtu\.be\/[a-zA-Z0-9_-]+/gi,
  // GitHub-like
  /github\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/gi,
];

/**
 * Extract URLs from text.
 */
function extractUrls(text: string): string[] {
  const urls = new Set<string>();
  
  for (const pattern of URL_PATTERNS) {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      urls.add(match[0].toLowerCase());
    }
  }
  
  return Array.from(urls);
}

// ─────────────────────────────────────────────────────────────────────────────────
// INDEX DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Detect fabricated resource indices.
 */
function detectFabricatedIndices(
  curriculum: RawCurriculumOutput,
  resourceCount: number
): Hallucination[] {
  const hallucinations: Hallucination[] = [];
  
  for (let i = 0; i < curriculum.days.length; i++) {
    const day = curriculum.days[i]!;
    
    for (let j = 0; j < day.resources.length; j++) {
      const resource = day.resources[j]!;
      
      if (resource.index < 1 || resource.index > resourceCount) {
        hallucinations.push({
          type: 'fabricated_index',
          severity: 'critical',
          path: `days[${i}].resources[${j}].index`,
          description: `Resource index ${resource.index} does not exist in the verified resource list`,
          fabricatedContent: String(resource.index),
          validRange: `1-${resourceCount}`,
        });
      }
    }
    
    // Check exercise related resources
    if (day.exercises) {
      for (let j = 0; j < day.exercises.length; j++) {
        const exercise = day.exercises[j]!;
        
        if (exercise.relatedResources) {
          for (const relatedIndex of exercise.relatedResources) {
            if (relatedIndex < 1 || relatedIndex > resourceCount) {
              hallucinations.push({
                type: 'fabricated_index',
                severity: 'high',
                path: `days[${i}].exercises[${j}].relatedResources`,
                description: `Related resource index ${relatedIndex} does not exist`,
                fabricatedContent: String(relatedIndex),
                validRange: `1-${resourceCount}`,
              });
            }
          }
        }
      }
    }
  }
  
  return hallucinations;
}

// ─────────────────────────────────────────────────────────────────────────────────
// URL DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Detect fabricated URLs in text fields.
 */
function detectFabricatedUrls(
  curriculum: RawCurriculumOutput,
  verifiedUrls: Set<string>
): Hallucination[] {
  const hallucinations: Hallucination[] = [];
  
  // Check top-level fields
  if (curriculum.title) {
    checkTextForUrls(curriculum.title, 'title', verifiedUrls, hallucinations);
  }
  if (curriculum.description) {
    checkTextForUrls(curriculum.description, 'description', verifiedUrls, hallucinations);
  }
  
  // Check each day
  for (let i = 0; i < curriculum.days.length; i++) {
    const day = curriculum.days[i]!;
    const dayPath = `days[${i}]`;
    
    if (day.theme) {
      checkTextForUrls(day.theme, `${dayPath}.theme`, verifiedUrls, hallucinations);
    }
    if (day.notes) {
      checkTextForUrls(day.notes, `${dayPath}.notes`, verifiedUrls, hallucinations);
    }
    
    // Check objectives
    if (day.objectives) {
      for (let j = 0; j < day.objectives.length; j++) {
        const obj = day.objectives[j]!;
        checkTextForUrls(obj.description, `${dayPath}.objectives[${j}].description`, verifiedUrls, hallucinations);
        if (obj.outcome) {
          checkTextForUrls(obj.outcome, `${dayPath}.objectives[${j}].outcome`, verifiedUrls, hallucinations);
        }
      }
    }
    
    // Check exercises
    if (day.exercises) {
      for (let j = 0; j < day.exercises.length; j++) {
        const ex = day.exercises[j]!;
        checkTextForUrls(ex.description, `${dayPath}.exercises[${j}].description`, verifiedUrls, hallucinations);
      }
    }
    
    // Check resource notes/focus
    for (let j = 0; j < day.resources.length; j++) {
      const res = day.resources[j]!;
      if (res.notes) {
        checkTextForUrls(res.notes, `${dayPath}.resources[${j}].notes`, verifiedUrls, hallucinations);
      }
      if (res.focus) {
        checkTextForUrls(res.focus, `${dayPath}.resources[${j}].focus`, verifiedUrls, hallucinations);
      }
    }
  }
  
  return hallucinations;
}

/**
 * Check text for URLs and report fabricated ones.
 */
function checkTextForUrls(
  text: string,
  path: string,
  verifiedUrls: Set<string>,
  hallucinations: Hallucination[]
): void {
  const urls = extractUrls(text);
  
  for (const url of urls) {
    // Normalize URL for comparison
    const normalized = normalizeUrl(url);
    
    // Check if it matches any verified URL
    let isVerified = false;
    for (const verifiedUrl of verifiedUrls) {
      if (verifiedUrl.includes(normalized) || normalized.includes(verifiedUrl)) {
        isVerified = true;
        break;
      }
    }
    
    if (!isVerified) {
      hallucinations.push({
        type: 'fabricated_url',
        severity: 'critical',
        path,
        description: 'URL found in output that is not in the verified resource list',
        fabricatedContent: url,
      });
    }
  }
}

/**
 * Normalize URL for comparison.
 */
function normalizeUrl(url: string): string {
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/$/, '');
}

// ─────────────────────────────────────────────────────────────────────────────────
// TITLE/REFERENCE DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Suspicious patterns that might indicate fabricated references.
 */
const SUSPICIOUS_PATTERNS = [
  // Made-up course references
  /\b(course|tutorial|video|lesson)\s+#?\d+\b/gi,
  // Specific timestamps that should come from resource metadata
  /\b\d+:\d+:\d+\b/g,
  // Book chapter references
  /\bchapter\s+\d+\b/gi,
  // Page numbers
  /\bp(?:age)?\.?\s*\d+\b/gi,
  // Made-up statistics
  /\b\d+%\s+of\s+(users?|learners?|students?|people)\b/gi,
  // Fake citations
  /\((?:Smith|Jones|Johnson|Williams|Brown),?\s*\d{4}\)/g,
];

/**
 * Detect suspicious references that might be fabricated.
 */
function detectSuspiciousReferences(curriculum: RawCurriculumOutput): Hallucination[] {
  const hallucinations: Hallucination[] = [];
  
  // Collect all text content
  const textLocations: Array<{ text: string; path: string }> = [];
  
  if (curriculum.description) {
    textLocations.push({ text: curriculum.description, path: 'description' });
  }
  
  for (let i = 0; i < curriculum.days.length; i++) {
    const day = curriculum.days[i]!;
    const dayPath = `days[${i}]`;
    
    if (day.notes) {
      textLocations.push({ text: day.notes, path: `${dayPath}.notes` });
    }
    
    if (day.exercises) {
      for (let j = 0; j < day.exercises.length; j++) {
        textLocations.push({ 
          text: day.exercises[j]!.description, 
          path: `${dayPath}.exercises[${j}].description`,
        });
      }
    }
  }
  
  // Check for suspicious patterns
  for (const { text, path } of textLocations) {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      pattern.lastIndex = 0;
      const matches = text.matchAll(pattern);
      
      for (const match of matches) {
        hallucinations.push({
          type: 'suspicious_claim',
          severity: 'low',
          path,
          description: 'Potentially fabricated reference or statistic detected',
          fabricatedContent: match[0],
        });
      }
    }
  }
  
  return hallucinations;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN DETECTOR
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Detect hallucinations in curriculum output.
 */
export function detectHallucinations(
  curriculum: RawCurriculumOutput,
  resources: readonly VerifiedResource[]
): HallucinationDetectionResult {
  const allHallucinations: Hallucination[] = [];
  
  // Build verified URL set
  const verifiedUrls = new Set<string>(
    resources.map(r => normalizeUrl(r.canonicalUrl))
  );
  
  // Detect fabricated indices
  const indexHallucinations = detectFabricatedIndices(curriculum, resources.length);
  allHallucinations.push(...indexHallucinations);
  
  // Detect fabricated URLs
  const urlHallucinations = detectFabricatedUrls(curriculum, verifiedUrls);
  allHallucinations.push(...urlHallucinations);
  
  // Detect suspicious references
  const suspiciousHallucinations = detectSuspiciousReferences(curriculum);
  allHallucinations.push(...suspiciousHallucinations);
  
  // Count by type
  const countByType: Record<HallucinationType, number> = {
    fabricated_index: 0,
    fabricated_url: 0,
    fabricated_title: 0,
    fabricated_statistic: 0,
    fabricated_reference: 0,
    suspicious_claim: 0,
  };
  
  // Count by severity
  const countBySeverity: Record<HallucinationSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  
  for (const h of allHallucinations) {
    countByType[h.type]++;
    countBySeverity[h.severity]++;
  }
  
  const hasCritical = countBySeverity.critical > 0;
  const hasHallucinations = allHallucinations.length > 0;
  
  // Log results
  if (hasCritical) {
    logger.warn('Critical hallucinations detected', {
      total: allHallucinations.length,
      critical: countBySeverity.critical,
      types: Object.entries(countByType).filter(([, v]) => v > 0),
    });
    incCounter('hallucination_detection_total', { result: 'critical' });
  } else if (hasHallucinations) {
    logger.info('Minor hallucinations detected', {
      total: allHallucinations.length,
      types: Object.entries(countByType).filter(([, v]) => v > 0),
    });
    incCounter('hallucination_detection_total', { result: 'detected' });
  } else {
    logger.debug('No hallucinations detected');
    incCounter('hallucination_detection_total', { result: 'clean' });
  }
  
  return {
    hasHallucinations,
    hasCritical,
    hallucinations: allHallucinations,
    countByType,
    countBySeverity,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// QUICK CHECKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Quick check if output has any URLs (should be none).
 */
export function hasAnyUrls(text: string): boolean {
  return URL_PATTERNS.some(pattern => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

/**
 * Quick check for critical hallucinations only.
 */
export function hasCriticalHallucinations(
  curriculum: RawCurriculumOutput,
  resources: readonly VerifiedResource[]
): boolean {
  // Check indices
  for (const day of curriculum.days) {
    for (const resource of day.resources) {
      if (resource.index < 1 || resource.index > resources.length) {
        return true;
      }
    }
  }
  
  // Check for any URLs in text (should be none)
  const allText = JSON.stringify(curriculum);
  if (hasAnyUrls(allText)) {
    return true;
  }
  
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  extractUrls,
  normalizeUrl,
  detectFabricatedIndices,
  detectFabricatedUrls,
  detectSuspiciousReferences,
};
