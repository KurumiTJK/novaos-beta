// ═══════════════════════════════════════════════════════════════════════════════
// DAILY PLAN GENERATION
// Route-specific content generation for each session
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';
import type {
  Node,
  DailyPlan,
  DailyPlanRow,
  GeneratedAsset,
  AssetType,
  Route,
  MaintenanceLayer,
} from '../types.js';
import { mapDailyPlan } from '../types.js';
import { 
  getSessionAssets, 
  getFinalSessionAssets,
  getAssetTimeEstimate,
} from '../shared/session-assets.js';
import { withCircuitBreaker } from '../shared/circuit-breaker.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN GENERATION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate a daily plan for a session
 */
export async function generateDailyPlan(
  node: Node,
  sessionNumber: number,
  date: string,
  dailyMinutes: number
): Promise<DailyPlan> {
  const isFinal = sessionNumber >= node.estimatedSessions;
  
  // Get asset types for this session
  const sessionAssets = isFinal 
    ? getFinalSessionAssets(node.route, dailyMinutes)
    : getSessionAssets(node.route, sessionNumber, node.estimatedSessions, dailyMinutes);

  // Generate with circuit breaker protection
  const { result: dailyPlan, usedFallback } = await withCircuitBreaker(
    'daily-plan-llm',
    () => generateWithLLM(node, sessionNumber, date, sessionAssets, isFinal, dailyMinutes),
    () => generateFallback(node, sessionNumber, date, sessionAssets, isFinal)
  );

  // Persist to database
  await persistDailyPlan(dailyPlan, usedFallback ? 'fallback' : 'llm');

  return dailyPlan;
}

// ─────────────────────────────────────────────────────────────────────────────────
// LLM GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate daily plan with LLM
 */
async function generateWithLLM(
  node: Node,
  sessionNumber: number,
  date: string,
  sessionAssets: { assets: AssetType[]; spark: AssetType },
  isFinal: boolean,
  dailyMinutes: number
): Promise<DailyPlan> {
  // ═══════════════════════════════════════════════════════════════════════════
  // TODO: Implement LLM call
  // 
  // Prompt structure based on route:
  // ```
  // Generate a ${dailyMinutes}-minute learning session for:
  // Node: ${node.title}
  // Objective: ${node.objective}
  // Route: ${node.route}
  // Session: ${sessionNumber}/${node.estimatedSessions}
  // 
  // Required assets: ${sessionAssets.assets.join(', ')}
  // Must include spark (< 5 min action)
  // 
  // ${isFinal ? 'This is the FINAL session - include mastery reflection.' : ''}
  // 
  // Available resources:
  // ${node.canonicalSources.map(s => `- ${s.title}: ${s.url}`).join('\n')}
  // 
  // Generate:
  // 1. overview: 1-2 sentence intro
  // 2. keyPoints: 3-5 key things to focus on
  // 3. assets: Array of learning activities
  // 4. spark: One tiny action (< 5 min)
  // 5. maintenanceLayer: quickRecall prompts and checkpoint
  // ```
  // ═══════════════════════════════════════════════════════════════════════════

  // For now, use template-based generation
  return generateFallback(node, sessionNumber, date, sessionAssets, isFinal);
}

// ─────────────────────────────────────────────────────────────────────────────────
// FALLBACK GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate fallback daily plan (no LLM)
 */
async function generateFallback(
  node: Node,
  sessionNumber: number,
  date: string,
  sessionAssets: { assets: AssetType[]; spark: AssetType },
  isFinal: boolean
): Promise<DailyPlan> {
  const id = generateId();

  // Generate assets
  const assets = generateAssetsFromSpecs(node, sessionAssets.assets, sessionNumber);

  // Generate spark (always required)
  const spark = generateSpark(node, sessionNumber);

  // Generate overview based on route and session
  const overview = generateOverview(node, sessionNumber, isFinal);

  // Generate key points
  const keyPoints = generateKeyPoints(node, sessionNumber);

  // Generate maintenance layer
  const maintenanceLayer = generateMaintenanceLayer(node, sessionNumber);

  return {
    id,
    nodeId: node.id,
    sessionNumber,
    planDate: date,
    route: node.route,
    overview,
    keyPoints,
    assets,
    spark,
    maintenanceLayer,
    isFinalSession: isFinal,
    masteryReflectionPrompt: isFinal ? node.masteryReflectionPrompt : undefined,
    generationSource: 'fallback',
    generatedAt: new Date(),
    isRefreshSession: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASSET GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate assets from asset specs
 */
function generateAssetsFromSpecs(
  node: Node,
  assetTypes: AssetType[],
  sessionNumber: number
): GeneratedAsset[] {
  const assets: GeneratedAsset[] = [];

  assetTypes.forEach((type, index) => {
    // Check for matching spec in node
    const spec = node.practiceAssetSpecs.find(s => s.type === type);
    
    // Check for fallback asset
    const fallback = node.fallbackAssets.find(f => f.type === type);

    const asset: GeneratedAsset = {
      id: `asset_${sessionNumber}_${index}`,
      type,
      title: fallback?.title || getAssetTitle(type, node.title),
      content: fallback?.content || generateAssetContent(type, node, sessionNumber),
      estimatedMinutes: spec?.estimatedMinutes || fallback?.estimatedMinutes || getAssetTimeEstimate(type),
      isSpark: false,
      resourceId: node.canonicalSources[0]?.id,
    };

    assets.push(asset);
  });

  return assets;
}

/**
 * Generate spark asset
 */
function generateSpark(node: Node, sessionNumber: number): GeneratedAsset {
  const progress = node.estimatedSessions > 1 
    ? (sessionNumber - 1) / (node.estimatedSessions - 1) 
    : 1;

  return {
    id: `spark_${sessionNumber}`,
    type: 'spark',
    title: `Quick Action: ${node.title}`,
    content: generateSparkContent(node, progress),
    estimatedMinutes: 3,
    isSpark: true,
  };
}

/**
 * Generate spark content based on route and progress
 */
function generateSparkContent(node: Node, progress: number): string {
  const routeSparks: Record<Route, string[]> = {
    recall: [
      `Write down 3 key terms related to ${node.title} from memory.`,
      `Explain ${node.title} to yourself in one sentence.`,
      `List what you remember about ${node.title} without looking.`,
    ],
    practice: [
      `Try one small exercise related to ${node.title}.`,
      `Practice the first step of ${node.title}.`,
      `Do a quick warm-up exercise for ${node.title}.`,
    ],
    diagnose: [
      `Spot one potential issue in a ${node.title} example.`,
      `Classify one aspect of ${node.title}.`,
      `Compare two approaches to ${node.title}.`,
    ],
    apply: [
      `Think of one real situation where ${node.title} applies.`,
      `Imagine applying ${node.title} to a different context.`,
      `Write one way ${node.title} solves a real problem.`,
    ],
    build: [
      `Sketch out one component of your ${node.title} project.`,
      `Write one line or one block for ${node.title}.`,
      `Define one acceptance criterion for ${node.title}.`,
    ],
    refine: [
      `Identify one thing to improve in your ${node.title} work.`,
      `Rate your work on ${node.title} against one rubric item.`,
      `Note one revision to make for ${node.title}.`,
    ],
    plan: [
      `Add one connection to your ${node.title} concept map.`,
      `Write one thing you learned about ${node.title} today.`,
      `Identify your next step for ${node.title}.`,
    ],
  };

  const sparks = routeSparks[node.route];
  const index = Math.min(Math.floor(progress * sparks.length), sparks.length - 1);
  const spark = sparks[index];
  return spark ?? `Complete a quick exercise for ${node.title}.`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTENT HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function generateOverview(node: Node, sessionNumber: number, isFinal: boolean): string {
  const sessionDesc = sessionNumber === 1 ? 'first' 
    : isFinal ? 'final' 
    : `session ${sessionNumber}`;

  return `Welcome to your ${sessionDesc} session on "${node.title}". ${node.objective}`;
}

function generateKeyPoints(node: Node, sessionNumber: number): string[] {
  return [
    `Focus on: ${node.objective}`,
    `Complete all exercises at your own pace`,
    `Don't skip the spark - it's important!`,
    sessionNumber === 1 
      ? 'Take notes on new concepts'
      : 'Build on what you learned before',
  ];
}

function generateMaintenanceLayer(node: Node, sessionNumber: number): MaintenanceLayer {
  return {
    quickRecall: sessionNumber > 1 ? [
      `What did you learn about ${node.title} last time?`,
      `What was challenging?`,
    ] : [],
    checkpoint: sessionNumber > 1 
      ? `Before continuing, make sure you understood session ${sessionNumber - 1}.`
      : 'Ready to start!',
  };
}

function getAssetTitle(type: AssetType, nodeTitle: string): string {
  const titles: Record<AssetType, string> = {
    active_recall_prompt: `Recall: ${nodeTitle}`,
    quiz: `Quiz: ${nodeTitle}`,
    spaced_review: `Review: ${nodeTitle}`,
    worked_example: `Example: ${nodeTitle}`,
    guided_problem: `Guided Practice: ${nodeTitle}`,
    independent_problem: `Practice: ${nodeTitle}`,
    spot_error: `Find the Error: ${nodeTitle}`,
    classify: `Classify: ${nodeTitle}`,
    compare_contrast: `Compare: ${nodeTitle}`,
    novel_scenario: `Apply: ${nodeTitle}`,
    case_question: `Case Study: ${nodeTitle}`,
    project_milestone: `Build: ${nodeTitle}`,
    integration_checklist: `Integrate: ${nodeTitle}`,
    rubric_check: `Evaluate: ${nodeTitle}`,
    revision_pass: `Revise: ${nodeTitle}`,
    concept_map: `Map: ${nodeTitle}`,
    error_log_review: `Review Errors: ${nodeTitle}`,
    spark: `Quick Action: ${nodeTitle}`,
    mastery_reflection: `Reflect: ${nodeTitle}`,
  };

  return titles[type] || nodeTitle;
}

function generateAssetContent(type: AssetType, node: Node, sessionNumber: number): string {
  // Check for fallback first
  const fallback = node.fallbackAssets.find(f => f.type === type);
  if (fallback) return fallback.content;

  // Generate generic content
  return `Complete this ${type.replace(/_/g, ' ')} exercise for ${node.title}. ` +
    `Use the provided resources if needed.`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// DATABASE OPERATIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Persist daily plan to database
 */
async function persistDailyPlan(
  plan: DailyPlan,
  source: 'llm' | 'fallback' | 'prefetch' | 'refresh'
): Promise<void> {
  if (!isSupabaseInitialized()) {
    return;
  }

  const supabase = getSupabase();

  await supabase
    .from('daily_plans')
    .upsert({
      id: plan.id,
      node_id: plan.nodeId,
      session_number: plan.sessionNumber,
      plan_date: plan.planDate,
      route: plan.route,
      overview: plan.overview,
      key_points: plan.keyPoints,
      assets: plan.assets,
      spark: plan.spark,
      maintenance_layer: plan.maintenanceLayer,
      is_final_session: plan.isFinalSession,
      mastery_reflection_prompt: plan.masteryReflectionPrompt,
      generation_source: source,
      generated_at: plan.generatedAt.toISOString(),
      is_refresh_session: plan.isRefreshSession,
    } as any, { onConflict: 'node_id,session_number,plan_date' });
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

function generateId(): string {
  return `dp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const DailyPlanGenerator = {
  generate: generateDailyPlan,
  generateFallback,
  generateSpark,
  persistDailyPlan,
};
