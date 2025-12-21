// ═══════════════════════════════════════════════════════════════════════════════
// HALLUCINATION DETECTOR TESTS — Fabrication Detection Tests
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  detectHallucinations,
  hasCriticalHallucinations,
  hasAnyUrls,
  extractUrls,
  normalizeUrl,
  detectFabricatedIndices,
  detectFabricatedUrls,
  detectSuspiciousReferences,
} from '../hallucination-detector.js';
import type { RawCurriculumOutput } from '../types.js';
import type { VerifiedResource } from '../../resource-discovery/types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES
// ─────────────────────────────────────────────────────────────────────────────────

function createMockResources(count: number): VerifiedResource[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `resource-${i + 1}` as any,
    originalUrl: `https://example.com/resource-${i + 1}`,
    canonicalUrl: `https://example.com/resource-${i + 1}`,
    provider: 'youtube' as any,
    providerId: `vid-${i + 1}`,
    matchedTopics: ['typescript'] as any[],
    confidence: 0.9,
    fromKnownSource: false,
    discoveredAt: new Date(),
    enrichment: {
      title: `Resource ${i + 1}`,
      description: 'Test resource',
      fetchedAt: new Date(),
    },
    qualitySignals: {
      difficulty: 'intermediate' as any,
    },
    verification: {
      accessible: true,
      verifiedAt: new Date(),
      httpStatus: 200,
      hasContentWall: false,
      usabilityScore: 0.9,
    },
  })) as any;
}

function createValidCurriculum(resourceCount: number): RawCurriculumOutput {
  return {
    title: 'Test Curriculum',
    description: 'A test curriculum',
    days: [
      {
        day: 1,
        theme: 'Introduction',
        resources: [
          { index: 1, minutes: 30 },
          { index: 2, minutes: 30 },
        ],
        totalMinutes: 60,
      },
      {
        day: 2,
        theme: 'Deep Dive',
        resources: [
          { index: 3, minutes: 45 },
        ],
        exercises: [
          { type: 'practice', description: 'Try the concepts', minutes: 15 },
        ],
        totalMinutes: 60,
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// INDEX DETECTION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('detectFabricatedIndices', () => {
  it('should detect index below valid range', () => {
    const curriculum: RawCurriculumOutput = {
      days: [
        {
          day: 1,
          theme: 'Test',
          resources: [{ index: 0, minutes: 30 }], // Invalid: index 0
          totalMinutes: 30,
        },
      ],
    };
    
    const hallucinations = detectFabricatedIndices(curriculum, 5);
    
    expect(hallucinations).toHaveLength(1);
    expect(hallucinations[0]!.type).toBe('fabricated_index');
    expect(hallucinations[0]!.severity).toBe('critical');
    expect(hallucinations[0]!.fabricatedContent).toBe('0');
  });

  it('should detect index above valid range', () => {
    const curriculum: RawCurriculumOutput = {
      days: [
        {
          day: 1,
          theme: 'Test',
          resources: [{ index: 10, minutes: 30 }], // Invalid: only 5 resources
          totalMinutes: 30,
        },
      ],
    };
    
    const hallucinations = detectFabricatedIndices(curriculum, 5);
    
    expect(hallucinations).toHaveLength(1);
    expect(hallucinations[0]!.validRange).toBe('1-5');
  });

  it('should pass valid indices', () => {
    const curriculum = createValidCurriculum(5);
    const hallucinations = detectFabricatedIndices(curriculum, 5);
    
    expect(hallucinations).toHaveLength(0);
  });

  it('should detect invalid indices in exercise relatedResources', () => {
    const curriculum: RawCurriculumOutput = {
      days: [
        {
          day: 1,
          theme: 'Test',
          resources: [{ index: 1, minutes: 30 }],
          exercises: [
            {
              type: 'practice',
              description: 'Test',
              minutes: 15,
              relatedResources: [99], // Invalid
            },
          ],
          totalMinutes: 45,
        },
      ],
    };
    
    const hallucinations = detectFabricatedIndices(curriculum, 5);
    
    expect(hallucinations).toHaveLength(1);
    expect(hallucinations[0]!.severity).toBe('high');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// URL DETECTION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('extractUrls', () => {
  it('should extract full URLs', () => {
    const text = 'Check out https://example.com/page for more info';
    const urls = extractUrls(text);
    
    expect(urls).toContain('https://example.com/page');
  });

  it('should extract YouTube URLs', () => {
    const text = 'Watch youtube.com/watch?v=abc123 for the tutorial';
    const urls = extractUrls(text);
    
    expect(urls.some(u => u.includes('youtube.com'))).toBe(true);
  });

  it('should extract GitHub URLs', () => {
    const text = 'See github.com/user/repo for the code';
    const urls = extractUrls(text);
    
    expect(urls.some(u => u.includes('github.com'))).toBe(true);
  });

  it('should extract www URLs', () => {
    const text = 'Visit www.example.com';
    const urls = extractUrls(text);
    
    expect(urls).toHaveLength(1);
  });

  it('should handle multiple URLs', () => {
    const text = 'See https://a.com and https://b.com and https://c.com';
    const urls = extractUrls(text);
    
    expect(urls.length).toBe(3);
  });

  it('should return empty array for no URLs', () => {
    const text = 'This text has no URLs in it';
    const urls = extractUrls(text);
    
    expect(urls).toHaveLength(0);
  });
});

describe('normalizeUrl', () => {
  it('should remove protocol', () => {
    expect(normalizeUrl('https://example.com')).toBe('example.com');
    expect(normalizeUrl('http://example.com')).toBe('example.com');
  });

  it('should remove www prefix', () => {
    expect(normalizeUrl('www.example.com')).toBe('example.com');
  });

  it('should remove trailing slash', () => {
    expect(normalizeUrl('example.com/')).toBe('example.com');
  });

  it('should lowercase', () => {
    expect(normalizeUrl('EXAMPLE.COM')).toBe('example.com');
  });
});

describe('detectFabricatedUrls', () => {
  it('should detect URLs not in verified list', () => {
    const curriculum: RawCurriculumOutput = {
      description: 'Check https://malicious.com/bad for details',
      days: [
        {
          day: 1,
          theme: 'Test',
          resources: [{ index: 1, minutes: 30 }],
          totalMinutes: 30,
        },
      ],
    };
    
    const verifiedUrls = new Set(['example.com/resource-1']);
    const hallucinations = detectFabricatedUrls(curriculum, verifiedUrls);
    
    expect(hallucinations).toHaveLength(1);
    expect(hallucinations[0]!.type).toBe('fabricated_url');
    expect(hallucinations[0]!.severity).toBe('critical');
  });

  it('should allow URLs that match verified list', () => {
    const curriculum: RawCurriculumOutput = {
      description: 'Resource at example.com/resource-1',
      days: [
        {
          day: 1,
          theme: 'Test',
          resources: [{ index: 1, minutes: 30 }],
          totalMinutes: 30,
        },
      ],
    };
    
    const verifiedUrls = new Set(['example.com/resource-1']);
    const hallucinations = detectFabricatedUrls(curriculum, verifiedUrls);
    
    expect(hallucinations).toHaveLength(0);
  });

  it('should check all text fields', () => {
    const curriculum: RawCurriculumOutput = {
      title: 'See https://bad1.com',
      description: 'Visit https://bad2.com',
      days: [
        {
          day: 1,
          theme: 'Check https://bad3.com',
          notes: 'Also https://bad4.com',
          resources: [
            {
              index: 1,
              minutes: 30,
              notes: 'Resource at https://bad5.com',
            },
          ],
          exercises: [
            {
              type: 'practice',
              description: 'Go to https://bad6.com',
              minutes: 15,
            },
          ],
          totalMinutes: 45,
        },
      ],
    };
    
    const verifiedUrls = new Set(['example.com/good']);
    const hallucinations = detectFabricatedUrls(curriculum, verifiedUrls);
    
    expect(hallucinations.length).toBeGreaterThanOrEqual(6);
  });
});

describe('hasAnyUrls', () => {
  it('should detect https URLs', () => {
    expect(hasAnyUrls('Visit https://example.com')).toBe(true);
  });

  it('should detect http URLs', () => {
    expect(hasAnyUrls('Visit http://example.com')).toBe(true);
  });

  it('should detect www URLs', () => {
    expect(hasAnyUrls('Visit www.example.com')).toBe(true);
  });

  it('should return false for clean text', () => {
    expect(hasAnyUrls('This text has no URLs')).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SUSPICIOUS REFERENCE TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('detectSuspiciousReferences', () => {
  it('should detect fake statistics', () => {
    const curriculum: RawCurriculumOutput = {
      description: '95% of users find this helpful',
      days: [
        {
          day: 1,
          theme: 'Test',
          resources: [{ index: 1, minutes: 30 }],
          totalMinutes: 30,
        },
      ],
    };
    
    const hallucinations = detectSuspiciousReferences(curriculum);
    
    expect(hallucinations.some(h => h.type === 'suspicious_claim')).toBe(true);
  });

  it('should detect fake citations', () => {
    const curriculum: RawCurriculumOutput = {
      days: [
        {
          day: 1,
          theme: 'Test',
          notes: 'As noted by (Smith, 2023)',
          resources: [{ index: 1, minutes: 30 }],
          totalMinutes: 30,
        },
      ],
    };
    
    const hallucinations = detectSuspiciousReferences(curriculum);
    
    expect(hallucinations.some(h => 
      h.fabricatedContent.includes('Smith')
    )).toBe(true);
  });

  it('should have low severity for suspicious claims', () => {
    const curriculum: RawCurriculumOutput = {
      description: 'Chapter 5 covers this topic',
      days: [
        {
          day: 1,
          theme: 'Test',
          resources: [{ index: 1, minutes: 30 }],
          totalMinutes: 30,
        },
      ],
    };
    
    const hallucinations = detectSuspiciousReferences(curriculum);
    
    if (hallucinations.length > 0) {
      expect(hallucinations[0]!.severity).toBe('low');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN DETECTOR TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('detectHallucinations', () => {
  it('should return clean result for valid curriculum', () => {
    const resources = createMockResources(5);
    const curriculum = createValidCurriculum(5);
    
    const result = detectHallucinations(curriculum, resources);
    
    expect(result.hasHallucinations).toBe(false);
    expect(result.hasCritical).toBe(false);
    expect(result.hallucinations).toHaveLength(0);
  });

  it('should detect critical hallucinations', () => {
    const resources = createMockResources(3);
    const curriculum: RawCurriculumOutput = {
      days: [
        {
          day: 1,
          theme: 'Test',
          resources: [{ index: 99, minutes: 30 }], // Invalid index
          totalMinutes: 30,
        },
      ],
    };
    
    const result = detectHallucinations(curriculum, resources);
    
    expect(result.hasHallucinations).toBe(true);
    expect(result.hasCritical).toBe(true);
    expect(result.countBySeverity.critical).toBeGreaterThan(0);
  });

  it('should count hallucinations by type', () => {
    const resources = createMockResources(3);
    const curriculum: RawCurriculumOutput = {
      description: 'Visit https://fake.com',
      days: [
        {
          day: 1,
          theme: 'Test',
          resources: [
            { index: 99, minutes: 30 },
            { index: 100, minutes: 30 },
          ],
          totalMinutes: 60,
        },
      ],
    };
    
    const result = detectHallucinations(curriculum, resources);
    
    expect(result.countByType.fabricated_index).toBe(2);
    expect(result.countByType.fabricated_url).toBe(1);
  });
});

describe('hasCriticalHallucinations', () => {
  it('should return true for invalid indices', () => {
    const resources = createMockResources(3);
    const curriculum: RawCurriculumOutput = {
      days: [
        {
          day: 1,
          theme: 'Test',
          resources: [{ index: 99, minutes: 30 }],
          totalMinutes: 30,
        },
      ],
    };
    
    expect(hasCriticalHallucinations(curriculum, resources)).toBe(true);
  });

  it('should return true for URLs in output', () => {
    const resources = createMockResources(3);
    const curriculum: RawCurriculumOutput = {
      description: 'See https://example.com',
      days: [
        {
          day: 1,
          theme: 'Test',
          resources: [{ index: 1, minutes: 30 }],
          totalMinutes: 30,
        },
      ],
    };
    
    expect(hasCriticalHallucinations(curriculum, resources)).toBe(true);
  });

  it('should return false for clean curriculum', () => {
    const resources = createMockResources(5);
    const curriculum = createValidCurriculum(5);
    
    expect(hasCriticalHallucinations(curriculum, resources)).toBe(false);
  });
});
