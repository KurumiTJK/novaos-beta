// ═══════════════════════════════════════════════════════════════════════════════
// SESSION ASSETS TESTS
// Tests for asset generation formulas based on route and session
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

type Route = 'recall' | 'practice' | 'diagnose' | 'apply' | 'build' | 'refine' | 'plan';

type AssetType =
  // Recall
  | 'active_recall_prompt'
  | 'quiz'
  | 'spaced_review'
  // Practice
  | 'worked_example'
  | 'guided_problem'
  | 'independent_problem'
  // Diagnose
  | 'spot_error'
  | 'classify'
  | 'compare_contrast'
  // Apply
  | 'novel_scenario'
  | 'case_question'
  // Build
  | 'project_milestone'
  | 'integration_checklist'
  // Refine
  | 'rubric_check'
  | 'revision_pass'
  // Plan
  | 'concept_map'
  | 'error_log_review'
  // Universal
  | 'spark'
  | 'mastery_reflection';

// ─────────────────────────────────────────────────────────────────────────────────
// ASSET GENERATION FUNCTIONS (mirroring session-assets.ts)
// ─────────────────────────────────────────────────────────────────────────────────

const ROUTE_ASSET_PROGRESSION: Record<Route, AssetType[][]> = {
  recall: [
    ['active_recall_prompt'],
    ['quiz', 'active_recall_prompt'],
    ['spaced_review', 'quiz'],
  ],
  practice: [
    ['worked_example'],
    ['guided_problem', 'worked_example'],
    ['independent_problem', 'guided_problem'],
    ['independent_problem', 'independent_problem'],
  ],
  diagnose: [
    ['spot_error'],
    ['classify', 'spot_error'],
    ['compare_contrast', 'classify'],
  ],
  apply: [
    ['novel_scenario'],
    ['case_question', 'novel_scenario'],
    ['case_question', 'case_question'],
  ],
  build: [
    ['project_milestone'],
    ['project_milestone', 'integration_checklist'],
    ['project_milestone', 'project_milestone'],
  ],
  refine: [
    ['rubric_check'],
    ['revision_pass', 'rubric_check'],
    ['revision_pass', 'revision_pass'],
  ],
  plan: [
    ['concept_map'],
    ['error_log_review', 'concept_map'],
  ],
};

function getAssetsForSession(
  route: Route,
  sessionNumber: number,
  totalSessions: number
): AssetType[] {
  const progression = ROUTE_ASSET_PROGRESSION[route];
  if (!progression || progression.length === 0) {
    return ['spark'];
  }

  // Map session number to progression index
  const progressionIndex = Math.min(
    Math.floor((sessionNumber - 1) / Math.max(1, Math.ceil(totalSessions / progression.length))),
    progression.length - 1
  );

  const assets = progression[progressionIndex] || progression[0];
  
  // Always include spark
  if (!assets.includes('spark')) {
    return [...assets, 'spark'];
  }
  
  return assets;
}

function getSparkForSession(
  route: Route,
  sessionNumber: number,
  totalSessions: number
): { type: 'spark'; context: string } {
  const isFirstSession = sessionNumber === 1;
  const isLastSession = sessionNumber === totalSessions;
  const progress = sessionNumber / totalSessions;

  let context: string;
  
  if (isFirstSession) {
    context = `First session for ${route}. Focus on building momentum.`;
  } else if (isLastSession) {
    context = `Final session for ${route}. Consolidate and prepare for mastery check.`;
  } else if (progress < 0.3) {
    context = `Early stage (${Math.round(progress * 100)}%). Focus on fundamentals.`;
  } else if (progress < 0.7) {
    context = `Mid stage (${Math.round(progress * 100)}%). Build on foundations.`;
  } else {
    context = `Late stage (${Math.round(progress * 100)}%). Refine and integrate.`;
  }

  return { type: 'spark', context };
}

function getMasteryReflectionPrompt(route: Route): string {
  const prompts: Record<Route, string> = {
    recall: 'What key concepts can you now explain without looking at notes?',
    practice: 'What procedures can you now execute confidently?',
    diagnose: 'What patterns can you now recognize quickly?',
    apply: 'How would you apply this knowledge to a new situation?',
    build: 'What did you create and what did you learn in the process?',
    refine: 'How has your work improved through revision?',
    plan: 'How has your understanding of the learning path evolved?',
  };
  
  return prompts[route];
}

// ─────────────────────────────────────────────────────────────────────────────────
// TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('getAssetsForSession', () => {
  describe('Recall Route', () => {
    it('should return active_recall_prompt for first session', () => {
      const assets = getAssetsForSession('recall', 1, 3);
      expect(assets).toContain('active_recall_prompt');
    });

    it('should include quiz in later sessions', () => {
      const assets = getAssetsForSession('recall', 2, 3);
      expect(assets).toContain('quiz');
    });

    it('should include spaced_review in final sessions', () => {
      const assets = getAssetsForSession('recall', 3, 3);
      expect(assets).toContain('spaced_review');
    });

    it('should always include spark', () => {
      for (let i = 1; i <= 5; i++) {
        const assets = getAssetsForSession('recall', i, 5);
        expect(assets).toContain('spark');
      }
    });
  });

  describe('Practice Route', () => {
    it('should progress from worked_example to independent_problem', () => {
      const session1 = getAssetsForSession('practice', 1, 4);
      expect(session1).toContain('worked_example');
      
      const session2 = getAssetsForSession('practice', 2, 4);
      expect(session2).toContain('guided_problem');
      
      const session4 = getAssetsForSession('practice', 4, 4);
      expect(session4).toContain('independent_problem');
    });

    it('should handle single session', () => {
      const assets = getAssetsForSession('practice', 1, 1);
      expect(assets).toContain('worked_example');
      expect(assets).toContain('spark');
    });
  });

  describe('Diagnose Route', () => {
    it('should include spot_error in early sessions', () => {
      const assets = getAssetsForSession('diagnose', 1, 3);
      expect(assets).toContain('spot_error');
    });

    it('should include classify in middle sessions', () => {
      const assets = getAssetsForSession('diagnose', 2, 3);
      expect(assets).toContain('classify');
    });

    it('should include compare_contrast in later sessions', () => {
      const assets = getAssetsForSession('diagnose', 3, 3);
      expect(assets).toContain('compare_contrast');
    });
  });

  describe('Build Route', () => {
    it('should always include project_milestone', () => {
      for (let i = 1; i <= 5; i++) {
        const assets = getAssetsForSession('build', i, 5);
        expect(assets).toContain('project_milestone');
      }
    });

    it('should include integration_checklist in later sessions', () => {
      const assets = getAssetsForSession('build', 2, 3);
      expect(assets).toContain('integration_checklist');
    });
  });

  describe('Edge Cases', () => {
    it('should handle session number greater than total', () => {
      const assets = getAssetsForSession('recall', 10, 3);
      // Should use last progression
      expect(assets).toContain('spaced_review');
    });

    it('should handle zero total sessions', () => {
      const assets = getAssetsForSession('practice', 1, 0);
      expect(assets).toContain('spark');
    });

    it('should handle all routes', () => {
      const routes: Route[] = ['recall', 'practice', 'diagnose', 'apply', 'build', 'refine', 'plan'];
      
      for (const route of routes) {
        const assets = getAssetsForSession(route, 1, 3);
        expect(assets.length).toBeGreaterThan(0);
        expect(assets).toContain('spark');
      }
    });
  });
});

describe('getSparkForSession', () => {
  it('should provide first session context', () => {
    const spark = getSparkForSession('practice', 1, 5);
    expect(spark.type).toBe('spark');
    expect(spark.context).toContain('First session');
  });

  it('should provide last session context', () => {
    const spark = getSparkForSession('practice', 5, 5);
    expect(spark.context).toContain('Final session');
  });

  it('should provide early stage context', () => {
    const spark = getSparkForSession('practice', 2, 10);
    expect(spark.context).toContain('Early stage');
    expect(spark.context).toContain('20%');
  });

  it('should provide mid stage context', () => {
    const spark = getSparkForSession('practice', 5, 10);
    expect(spark.context).toContain('Mid stage');
    expect(spark.context).toContain('50%');
  });

  it('should provide late stage context', () => {
    const spark = getSparkForSession('practice', 8, 10);
    expect(spark.context).toContain('Late stage');
    expect(spark.context).toContain('80%');
  });

  it('should include route in context', () => {
    const spark = getSparkForSession('diagnose', 1, 3);
    expect(spark.context).toContain('diagnose');
  });
});

describe('getMasteryReflectionPrompt', () => {
  it('should return appropriate prompt for recall', () => {
    const prompt = getMasteryReflectionPrompt('recall');
    expect(prompt).toContain('concepts');
    expect(prompt).toContain('explain');
  });

  it('should return appropriate prompt for practice', () => {
    const prompt = getMasteryReflectionPrompt('practice');
    expect(prompt).toContain('procedures');
    expect(prompt).toContain('execute');
  });

  it('should return appropriate prompt for diagnose', () => {
    const prompt = getMasteryReflectionPrompt('diagnose');
    expect(prompt).toContain('patterns');
    expect(prompt).toContain('recognize');
  });

  it('should return appropriate prompt for build', () => {
    const prompt = getMasteryReflectionPrompt('build');
    expect(prompt).toContain('create');
  });

  it('should return non-empty prompts for all routes', () => {
    const routes: Route[] = ['recall', 'practice', 'diagnose', 'apply', 'build', 'refine', 'plan'];
    
    for (const route of routes) {
      const prompt = getMasteryReflectionPrompt(route);
      expect(prompt).toBeTruthy();
      expect(prompt.length).toBeGreaterThan(10);
    }
  });
});

describe('Asset Count Validation', () => {
  it('should return 1-3 assets per session', () => {
    const routes: Route[] = ['recall', 'practice', 'diagnose', 'apply', 'build', 'refine', 'plan'];
    
    for (const route of routes) {
      for (let session = 1; session <= 5; session++) {
        const assets = getAssetsForSession(route, session, 5);
        expect(assets.length).toBeGreaterThanOrEqual(1);
        expect(assets.length).toBeLessThanOrEqual(4);
      }
    }
  });
});
