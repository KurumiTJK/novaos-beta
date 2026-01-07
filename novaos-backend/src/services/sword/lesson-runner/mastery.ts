// ═══════════════════════════════════════════════════════════════════════════════
// MASTERY VERIFICATION
// Hybrid approach: all assets + mastery reflection
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase, isSupabaseInitialized } from '../../../db/index.js';
import type {
  Node,
  NodeProgress,
  DailyPlan,
  MasteryCheck,
  GeneratedAsset,
} from '../types.js';
import { completeNode, getNodeProgress } from './nodes.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MASTERY REQUIREMENTS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if mastery requirements are met
 * 
 * Requirements:
 * 1. All assets in daily plan completed
 * 2. On final session: mastery reflection provided
 */
export async function checkMasteryRequirements(
  userId: string,
  nodeId: string,
  dailyPlan: DailyPlan
): Promise<MasteryCheck> {
  if (!isSupabaseInitialized()) {
    return {
      canCompleteMastery: false,
      assetsCompleted: false,
      reflectionRequired: dailyPlan.isFinalSession,
      reflectionProvided: false,
    };
  }

  const supabase = getSupabase();

  // Check asset completion
  const allAssetIds = [
    ...dailyPlan.assets.map(a => a.id),
    dailyPlan.spark.id,
  ];

  const { data: progress } = await supabase
    .from('asset_progress')
    .select('asset_id, completed')
    .eq('user_id', userId)
    .eq('daily_plan_id', dailyPlan.id)
    .in('asset_id', allAssetIds);

  const completedSet = new Set(
    (progress || [])
      .filter((p: any) => p.completed)
      .map((p: any) => p.asset_id)
  );

  const assetsCompleted = allAssetIds.every(id => completedSet.has(id));

  // Check reflection (only required on final session)
  const nodeProgress = await getNodeProgress(userId, nodeId);
  const reflectionProvided = !!nodeProgress?.masteryReflection;
  const reflectionRequired = dailyPlan.isFinalSession;

  const canComplete = assetsCompleted && 
    (!reflectionRequired || reflectionProvided);

  return {
    canCompleteMastery: canComplete,
    assetsCompleted,
    reflectionRequired,
    reflectionProvided,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASSET COMPLETION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Mark an asset as complete
 */
export async function completeAsset(
  userId: string,
  dailyPlanId: string,
  assetId: string,
  score?: number
): Promise<void> {
  if (!isSupabaseInitialized()) return;

  const supabase = getSupabase();

  await supabase
    .from('asset_progress')
    .upsert({
      user_id: userId,
      daily_plan_id: dailyPlanId,
      asset_id: assetId,
      completed: true,
      completed_at: new Date().toISOString(),
      score,
      attempts: 1,
    } as any, {
      onConflict: 'user_id,daily_plan_id,asset_id',
    });
}

/**
 * Get completion status for all assets in a daily plan
 */
export async function getAssetCompletionStatus(
  userId: string,
  dailyPlanId: string
): Promise<Map<string, { completed: boolean; completedAt?: Date; score?: number }>> {
  if (!isSupabaseInitialized()) return new Map();

  const supabase = getSupabase();

  const { data } = await supabase
    .from('asset_progress')
    .select('asset_id, completed, completed_at, score')
    .eq('user_id', userId)
    .eq('daily_plan_id', dailyPlanId);

  const statusMap = new Map();
  (data || []).forEach((row: any) => {
    statusMap.set(row.asset_id, {
      completed: row.completed,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      score: row.score,
    });
  });

  return statusMap;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MASTERY REFLECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Submit mastery reflection and complete node
 */
export async function submitMasteryReflection(
  userId: string,
  nodeId: string,
  reflection: string
): Promise<NodeProgress> {
  // Validate reflection
  if (!reflection || reflection.trim().length < 20) {
    throw new Error('Reflection must be at least 20 characters');
  }

  // Complete the node
  return completeNode(userId, nodeId, reflection);
}

/**
 * Get mastery reflection prompt for a node
 */
export function getMasteryReflectionPrompt(node: Node): string {
  return node.masteryReflectionPrompt || 
    `Reflect on your learning of ${node.title}:\n\n` +
    `1. What was the most challenging part?\n` +
    `2. How would you explain this to a beginner?\n` +
    `3. How will you use this knowledge?`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// MASTERY DISPLAY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate mastery reflection asset
 */
export function createMasteryReflectionAsset(node: Node): GeneratedAsset {
  return {
    id: 'mastery_reflection',
    type: 'mastery_reflection',
    title: 'Mastery Reflection',
    content: getMasteryReflectionPrompt(node),
    estimatedMinutes: 5,
    isSpark: false,
  };
}

/**
 * Get mastery status message
 */
export function getMasteryStatusMessage(check: MasteryCheck): string {
  if (check.canCompleteMastery) {
    return 'Ready to complete! All requirements met.';
  }

  const missing: string[] = [];
  
  if (!check.assetsCompleted) {
    missing.push('complete all assets');
  }
  
  if (check.reflectionRequired && !check.reflectionProvided) {
    missing.push('submit your mastery reflection');
  }

  return `To complete, you need to: ${missing.join(' and ')}.`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const MasteryService = {
  checkRequirements: checkMasteryRequirements,
  completeAsset,
  getAssetStatus: getAssetCompletionStatus,
  submitReflection: submitMasteryReflection,
  getReflectionPrompt: getMasteryReflectionPrompt,
  createReflectionAsset: createMasteryReflectionAsset,
  getStatusMessage: getMasteryStatusMessage,
};
