// ═══════════════════════════════════════════════════════════════════════════════
// REFRESH SESSIONS
// Handle learning gaps (7+ days) with targeted review
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  Node,
  NodeProgress,
  DailyPlan,
  GeneratedAsset,
  RefreshCheck,
} from '../types.js';
import { checkLearningGap, getTodayInTimezone, getUserTimezone } from '../shared/timezone.js';
import { markNeedsRefresh, completeRefresh } from './nodes.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

const GAP_THRESHOLD_DAYS = 7;

// ─────────────────────────────────────────────────────────────────────────────────
// GAP DETECTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Check if user needs a refresh session
 */
export async function checkNeedsRefresh(
  nodeProgress: NodeProgress
): Promise<RefreshCheck> {
  // Not started = no refresh needed
  if (!nodeProgress.startedAt || !nodeProgress.lastSessionAt) {
    return { needsRefresh: false };
  }

  // Already completed = no refresh needed
  if (nodeProgress.status === 'completed') {
    return { needsRefresh: false };
  }

  // Check gap
  const { hasGap, gapDays } = checkLearningGap(nodeProgress.lastSessionAt);

  if (!hasGap) {
    return { needsRefresh: false };
  }

  // Already did refresh recently?
  if (nodeProgress.refreshCompletedAt) {
    const sinceFresh = checkLearningGap(nodeProgress.refreshCompletedAt);
    if (!sinceFresh.hasGap) {
      return { needsRefresh: false };
    }
  }

  return {
    needsRefresh: true,
    gapDays,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REFRESH SESSION GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate a refresh session for a node
 */
export async function generateRefreshSession(
  userId: string,
  node: Node,
  nodeProgress: NodeProgress,
  gapDays: number
): Promise<DailyPlan> {
  const timezone = await getUserTimezone(userId);
  const today = getTodayInTimezone(timezone);

  // Mark that we're doing a refresh
  await markNeedsRefresh(userId, node.id);

  // Generate review assets
  const assets = generateRefreshAssets(node, gapDays);
  const spark = generateRefreshSpark(node);

  return {
    id: `refresh_${node.id}_${Date.now()}`,
    nodeId: node.id,
    sessionNumber: nodeProgress.currentSession, // Same session number
    planDate: today,
    route: 'recall', // Refresh always uses recall route

    overview: generateRefreshOverview(node, gapDays),
    keyPoints: [
      'Quick review of key concepts',
      'Test your retention',
      'Identify any areas to revisit',
    ],

    assets,
    spark,

    maintenanceLayer: {
      quickRecall: generateQuickRecallQuestions(node),
      checkpoint: 'Ready to continue where you left off?',
    },

    isFinalSession: false,
    generationSource: 'refresh',
    generatedAt: new Date(),
    isRefreshSession: true,
  };
}

/**
 * Generate refresh overview text
 */
function generateRefreshOverview(node: Node, gapDays: number): string {
  if (gapDays < 14) {
    return `Welcome back! It's been ${gapDays} days since you worked on "${node.title}". Let's do a quick review to refresh your memory before continuing.`;
  } else if (gapDays < 30) {
    return `It's been a while (${gapDays} days) since your last session on "${node.title}". Let's take some time to recall what you learned before moving forward.`;
  } else {
    return `You've been away from "${node.title}" for ${gapDays} days. This review session will help you reconnect with the material. Take your time!`;
  }
}

/**
 * Generate refresh assets
 */
function generateRefreshAssets(node: Node, gapDays: number): GeneratedAsset[] {
  const assets: GeneratedAsset[] = [];

  // Always include spaced review
  assets.push({
    id: 'refresh_spaced_review',
    type: 'spaced_review',
    title: 'Memory Check',
    content: `Without looking at any notes, write down everything you remember about ${node.title}. Include:\n\n1. Key concepts or terms\n2. Important steps or procedures\n3. Common mistakes to avoid\n\nThen compare with your previous notes or the lesson content.`,
    estimatedMinutes: gapDays > 14 ? 10 : 5,
    isSpark: false,
  });

  // Add active recall prompt
  assets.push({
    id: 'refresh_active_recall',
    type: 'active_recall_prompt',
    title: 'Key Points Review',
    content: `Answer these questions about ${node.title}:\n\n1. What is the main goal or purpose?\n2. What are the 3 most important things to remember?\n3. How does this connect to what you learned before?`,
    estimatedMinutes: 5,
    isSpark: false,
  });

  // For longer gaps, add a quiz
  if (gapDays > 14) {
    assets.push({
      id: 'refresh_quiz',
      type: 'quiz',
      title: 'Quick Knowledge Check',
      content: `Test your understanding of ${node.title}:\n\n1. [Create a quick self-test question based on the node objective]\n2. [Create another question about a key concept]\n3. [Create a question about application]\n\nAnswer honestly, then review any areas where you struggled.`,
      estimatedMinutes: 10,
      isSpark: false,
    });
  }

  return assets;
}

/**
 * Generate refresh spark
 */
function generateRefreshSpark(node: Node): GeneratedAsset {
  return {
    id: 'refresh_spark',
    type: 'spark',
    title: 'One Thing You Remember',
    content: `In one sentence, what's the most useful or important thing you remember about ${node.title}?`,
    estimatedMinutes: 2,
    isSpark: true,
  };
}

/**
 * Generate quick recall questions
 */
function generateQuickRecallQuestions(node: Node): string[] {
  return [
    `What is ${node.title} about?`,
    `Why is this skill important?`,
    `What's one thing you can do with this knowledge?`,
  ];
}

// ─────────────────────────────────────────────────────────────────────────────────
// REFRESH COMPLETION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Mark refresh session as complete
 */
export async function markRefreshComplete(
  userId: string,
  nodeId: string
): Promise<NodeProgress> {
  return completeRefresh(userId, nodeId);
}

/**
 * Get refresh status message
 */
export function getRefreshMessage(gapDays: number): string {
  if (gapDays < 10) {
    return 'Quick refresh to get you back on track';
  } else if (gapDays < 21) {
    return 'Memory refresh session before continuing';
  } else if (gapDays < 45) {
    return 'Extended review to rebuild your knowledge';
  } else {
    return 'Full refresh recommended after your break';
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const RefreshService = {
  checkNeeds: checkNeedsRefresh,
  generate: generateRefreshSession,
  markComplete: markRefreshComplete,
  getMessage: getRefreshMessage,
  GAP_THRESHOLD_DAYS,
};
