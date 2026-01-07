// ═══════════════════════════════════════════════════════════════════════════════
// SESSION ASSETS
// Generic formula for route-specific asset generation
// ═══════════════════════════════════════════════════════════════════════════════

import type { Route, AssetType, SessionAssets } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ASSET TYPE DEFINITIONS BY ROUTE
// ─────────────────────────────────────────────────────────────────────────────────

// Assets appropriate for each route
const ROUTE_ASSET_POOL: Record<Route, {
  early: AssetType[];
  mid: AssetType[];
  late: AssetType[];
}> = {
  recall: {
    early: ['active_recall_prompt', 'quiz'],
    mid: ['quiz', 'spaced_review'],
    late: ['spaced_review', 'active_recall_prompt'],
  },
  practice: {
    early: ['worked_example', 'guided_problem'],
    mid: ['guided_problem', 'independent_problem'],
    late: ['independent_problem'],
  },
  diagnose: {
    early: ['spot_error', 'classify'],
    mid: ['classify', 'compare_contrast'],
    late: ['compare_contrast', 'spot_error'],
  },
  apply: {
    early: ['novel_scenario'],
    mid: ['novel_scenario', 'case_question'],
    late: ['case_question'],
  },
  build: {
    early: ['project_milestone'],
    mid: ['project_milestone', 'integration_checklist'],
    late: ['integration_checklist'],
  },
  refine: {
    early: ['rubric_check'],
    mid: ['rubric_check', 'revision_pass'],
    late: ['revision_pass'],
  },
  plan: {
    early: ['concept_map'],
    mid: ['concept_map', 'error_log_review'],
    late: ['error_log_review'],
  },
};

// ─────────────────────────────────────────────────────────────────────────────────
// ASSET COUNT CALCULATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Calculate number of assets based on available time
 */
function calculateAssetCount(dailyMinutes: number, route: Route): number {
  // Base calculation: roughly one asset per 15 minutes
  const base = Math.max(2, Math.floor(dailyMinutes / 15));
  
  // Adjust based on route - build/refine need fewer, larger assets
  switch (route) {
    case 'build':
    case 'refine':
      return Math.max(1, Math.ceil(base / 2));
    case 'practice':
      return Math.min(5, base + 1); // Practice benefits from more reps
    default:
      return Math.min(4, base);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN FORMULA
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generic session progression formula
 * Works for any route and any number of sessions
 * 
 * @param route - The node's route type
 * @param sessionNumber - Current session (1-indexed)
 * @param totalSessions - Total sessions for this node
 * @param dailyMinutes - User's daily time budget
 * @returns Assets and spark for the session
 */
export function getSessionAssets(
  route: Route,
  sessionNumber: number,
  totalSessions: number,
  dailyMinutes: number
): SessionAssets {
  // Calculate progress through node (0.0 to 1.0)
  const progress = totalSessions === 1 
    ? 1.0 
    : (sessionNumber - 1) / (totalSessions - 1);
  
  // Determine phase: early (0-0.33), mid (0.33-0.66), late (0.66-1.0)
  const pool = ROUTE_ASSET_POOL[route];
  let assetPool: AssetType[];
  
  if (progress < 0.33) {
    assetPool = pool.early;
  } else if (progress < 0.66) {
    assetPool = pool.mid;
  } else {
    assetPool = pool.late;
  }
  
  // Calculate number of assets
  const count = calculateAssetCount(dailyMinutes, route);
  
  // Fill assets array with null checks
  const assets: AssetType[] = [];
  for (let i = 0; i < count; i++) {
    const asset = assetPool[i % assetPool.length];
    if (asset !== undefined) {
      assets.push(asset);
    }
  }
  
  // Spark is always included
  return {
    assets,
    spark: 'spark',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPECIALIZED FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get assets for a refresh session
 * Always focuses on recall/review regardless of node route
 */
export function getRefreshAssets(dailyMinutes: number): SessionAssets {
  return {
    assets: ['spaced_review', 'active_recall_prompt'],
    spark: 'spark',
  };
}

/**
 * Get assets for a method node
 */
export function getMethodNodeAssets(
  methodType: 'error_review' | 'mixed_practice' | 'spaced_review',
  dailyMinutes: number
): SessionAssets {
  switch (methodType) {
    case 'error_review':
      return {
        assets: ['error_log_review', 'concept_map'],
        spark: 'spark',
      };
    case 'mixed_practice':
      return {
        assets: ['novel_scenario', 'independent_problem', 'compare_contrast'],
        spark: 'spark',
      };
    case 'spaced_review':
      return {
        assets: ['spaced_review', 'quiz', 'active_recall_prompt'],
        spark: 'spark',
      };
  }
}

/**
 * Get assets for final session (includes mastery reflection)
 */
export function getFinalSessionAssets(
  route: Route,
  dailyMinutes: number
): SessionAssets {
  const base = getSessionAssets(route, 1, 1, dailyMinutes); // Full progress
  
  // Add mastery reflection to the assets
  return {
    assets: [...base.assets, 'mastery_reflection'],
    spark: 'spark',
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASSET TIME ESTIMATES
// ─────────────────────────────────────────────────────────────────────────────────

const ASSET_TIME_ESTIMATES: Record<AssetType, number> = {
  // Recall (5-10 min)
  active_recall_prompt: 5,
  quiz: 10,
  spaced_review: 5,
  
  // Practice (10-20 min)
  worked_example: 10,
  guided_problem: 15,
  independent_problem: 20,
  
  // Diagnose (10-15 min)
  spot_error: 10,
  classify: 10,
  compare_contrast: 15,
  
  // Apply (15-20 min)
  novel_scenario: 20,
  case_question: 15,
  
  // Build (20-30 min)
  project_milestone: 30,
  integration_checklist: 20,
  
  // Refine (15-20 min)
  rubric_check: 15,
  revision_pass: 20,
  
  // Plan (10-15 min)
  concept_map: 15,
  error_log_review: 10,
  
  // Universal
  spark: 3,
  mastery_reflection: 5,
};

/**
 * Get estimated time for an asset type
 */
export function getAssetTimeEstimate(assetType: AssetType): number {
  return ASSET_TIME_ESTIMATES[assetType] || 10;
}

/**
 * Calculate total time for a session's assets
 */
export function calculateSessionTime(assets: AssetType[]): number {
  return assets.reduce((sum, asset) => sum + getAssetTimeEstimate(asset), 0);
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const SessionAssetsGenerator = {
  getSessionAssets,
  getRefreshAssets,
  getMethodNodeAssets,
  getFinalSessionAssets,
  getAssetTimeEstimate,
  calculateSessionTime,
  ROUTE_ASSET_POOL,
  ASSET_TIME_ESTIMATES,
};

export default SessionAssetsGenerator;
