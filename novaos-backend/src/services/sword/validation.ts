// ═══════════════════════════════════════════════════════════════════════════════
// SWORD VALIDATION SCHEMAS
// Request/response validation using Zod
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────────

export const RouteSchema = z.enum([
  'recall',
  'practice',
  'diagnose',
  'apply',
  'build',
  'refine',
  'plan',
]);

export const DifficultySchema = z.enum([
  'beginner',
  'intermediate',
  'advanced',
]);

export const NodeStatusSchema = z.enum([
  'locked',
  'available',
  'in_progress',
  'completed',
]);

export const MethodNodeTypeSchema = z.enum([
  'error_review',
  'mixed_practice',
  'spaced_review',
]);

// ─────────────────────────────────────────────────────────────────────────────────
// DESIGNER REQUESTS
// ─────────────────────────────────────────────────────────────────────────────────

export const StartDesignerSchema = z.object({
  conversationId: z.string().optional(),
});

export const ExplorationMessageSchema = z.object({
  message: z.string().min(1).max(5000),
});

export const GoalDefinitionSchema = z.object({
  difficulty: DifficultySchema,
  dailyMinutes: z.number().int().min(10).max(180),
  weeklyCadence: z.number().int().min(1).max(7),
});

// ─────────────────────────────────────────────────────────────────────────────────
// NODE REQUESTS
// ─────────────────────────────────────────────────────────────────────────────────

export const NodeIdParamSchema = z.object({
  nodeId: z.string().uuid(),
});

export const StartNodeSchema = z.object({
  force: z.boolean().optional().default(false),
});

export const SwitchNodeSchema = z.object({
  nodeId: z.string().uuid(),
  confirmed: z.boolean().optional().default(false),
});

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION REQUESTS
// ─────────────────────────────────────────────────────────────────────────────────

export const SessionIdParamSchema = z.object({
  sessionId: z.string().uuid(),
});

export const CompleteAssetSchema = z.object({
  assetId: z.string().min(1).max(100),
  score: z.number().min(0).max(100).optional(),
});

export const CompleteSparkSchema = z.object({
  sparkId: z.string().min(1).max(100).optional(),
});

export const SubmitMasterySchema = z.object({
  reflection: z.string().min(10).max(2000),
});

// ─────────────────────────────────────────────────────────────────────────────────
// PLAN REQUESTS
// ─────────────────────────────────────────────────────────────────────────────────

export const PlanIdParamSchema = z.object({
  planId: z.string().uuid(),
});

export const ActivatePlanSchema = z.object({
  planId: z.string().uuid(),
});

export const AbandonPlanSchema = z.object({
  planId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

export const ResourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  url: z.string().url(),
  type: z.enum(['article', 'video', 'documentation', 'tool', 'exercise']),
  status: z.enum(['verified', 'pending', 'failed']),
  verifiedAt: z.string().datetime().optional(),
  fallbackUrl: z.string().url().optional(),
});

export const GeneratedAssetSchema = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  content: z.string(),
  estimatedMinutes: z.number(),
  isSpark: z.boolean(),
  resourceId: z.string().optional(),
  completed: z.boolean().optional(),
  completedAt: z.string().datetime().optional(),
});

export const MaintenanceLayerSchema = z.object({
  quickRecall: z.array(z.string()),
  checkpoint: z.string(),
});

export const DailyPlanResponseSchema = z.object({
  id: z.string().uuid(),
  nodeId: z.string().uuid(),
  sessionNumber: z.number().int().positive(),
  planDate: z.string(),
  route: RouteSchema,
  overview: z.string(),
  keyPoints: z.array(z.string()),
  assets: z.array(GeneratedAssetSchema),
  spark: GeneratedAssetSchema,
  maintenanceLayer: MaintenanceLayerSchema,
  isFinalSession: z.boolean(),
  masteryReflectionPrompt: z.string().optional(),
  isRefreshSession: z.boolean(),
});

export const NodeResponseSchema = z.object({
  id: z.string().uuid(),
  planId: z.string().uuid(),
  title: z.string(),
  objective: z.string(),
  route: RouteSchema,
  sequenceOrder: z.number(),
  moduleNumber: z.number(),
  masteryCheck: z.string(),
  estimatedSessions: z.number(),
  isMethodNode: z.boolean(),
  methodNodeType: MethodNodeTypeSchema.optional(),
  canonicalSources: z.array(ResourceSchema),
});

export const NodeProgressResponseSchema = z.object({
  id: z.string().uuid(),
  nodeId: z.string().uuid(),
  status: NodeStatusSchema,
  sessionsCompleted: z.number(),
  currentSession: z.number(),
  allAssetsCompleted: z.boolean(),
  masteryAchieved: z.boolean(),
  needsRefresh: z.boolean(),
  startedAt: z.string().datetime().optional(),
  lastSessionAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export const LessonPlanResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().optional(),
  capstoneStatement: z.string().optional(),
  successCriteria: z.array(z.string()),
  difficulty: DifficultySchema,
  dailyMinutes: z.number(),
  weeklyCadence: z.number(),
  totalNodes: z.number(),
  totalSessions: z.number(),
  estimatedWeeks: z.number(),
  status: z.enum(['designing', 'active', 'completed', 'abandoned']),
  progress: z.number(),
  sessionsCompleted: z.number(),
  createdAt: z.string().datetime(),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

export const TodayResponseSchema = z.object({
  plan: LessonPlanResponseSchema,
  currentNode: NodeResponseSchema,
  nodeProgress: NodeProgressResponseSchema,
  sessionNumber: z.number(),
  totalSessions: z.number(),
  dailyPlan: DailyPlanResponseSchema,
  isRefreshSession: z.boolean(),
  refreshReason: z.string().optional(),
  hasOtherInProgress: z.object({
    nodeId: z.string().uuid(),
    nodeTitle: z.string(),
    sessionNumber: z.number(),
  }).optional(),
  completedNodes: z.number(),
  totalNodes: z.number(),
  nextAvailableNodes: z.array(z.object({
    id: z.string().uuid(),
    title: z.string(),
    route: RouteSchema,
  })),
  methodNodeDue: z.boolean(),
  nextMethodNodeType: MethodNodeTypeSchema.optional(),
});

export const DesignerStateResponseSchema = z.object({
  hasActiveSession: z.boolean(),
  session: z.object({
    id: z.string().uuid(),
    visiblePhase: z.enum(['exploration', 'define_goal', 'research', 'review']),
    internalPhase: z.string(),
    planId: z.string().uuid().optional(),
  }).optional(),
  visiblePhase: z.object({
    title: z.string(),
    description: z.string(),
    stepNumber: z.number(),
    totalSteps: z.number(),
  }).optional(),
});

// ─────────────────────────────────────────────────────────────────────────────────
// FULL STATE RESPONSE
// ─────────────────────────────────────────────────────────────────────────────────

export const SwordStateResponseSchema = z.object({
  hasActivePlan: z.boolean(),
  hasDesignerSession: z.boolean(),
  today: TodayResponseSchema.optional(),
  designerState: DesignerStateResponseSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export type StartDesignerInput = z.infer<typeof StartDesignerSchema>;
export type ExplorationMessageInput = z.infer<typeof ExplorationMessageSchema>;
export type GoalDefinitionInput = z.infer<typeof GoalDefinitionSchema>;
export type StartNodeInput = z.infer<typeof StartNodeSchema>;
export type SwitchNodeInput = z.infer<typeof SwitchNodeSchema>;
export type CompleteAssetInput = z.infer<typeof CompleteAssetSchema>;
export type CompleteSparkInput = z.infer<typeof CompleteSparkSchema>;
export type SubmitMasteryInput = z.infer<typeof SubmitMasterySchema>;
export type ActivatePlanInput = z.infer<typeof ActivatePlanSchema>;
export type AbandonPlanInput = z.infer<typeof AbandonPlanSchema>;

export type TodayResponse = z.infer<typeof TodayResponseSchema>;
export type SwordStateResponse = z.infer<typeof SwordStateResponseSchema>;
export type DesignerStateResponse = z.infer<typeof DesignerStateResponseSchema>;
export type LessonPlanResponse = z.infer<typeof LessonPlanResponseSchema>;
export type NodeResponse = z.infer<typeof NodeResponseSchema>;
export type DailyPlanResponse = z.infer<typeof DailyPlanResponseSchema>;
