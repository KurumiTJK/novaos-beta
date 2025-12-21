// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION SCHEMAS — Common Schemas for NovaOS Entities
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────────
// BASE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Base entity with ID and timestamps.
 */
export const BaseEntitySchema = z.object({
  id: z.string().min(1),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

/**
 * Status values for goals/quests/steps.
 */
export const StatusSchema = z.enum([
  'active',
  'completed',
  'paused',
  'abandoned',
  'archived',
]);

export type Status = z.infer<typeof StatusSchema>;

/**
 * Priority values.
 */
export const PrioritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);

export type Priority = z.infer<typeof PrioritySchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// GOAL SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create goal request body.
 */
export const CreateGoalSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().trim().max(2000).optional(),
  targetDate: z.coerce.date().optional(),
  priority: PrioritySchema.default('medium'),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;

/**
 * Update goal request body.
 */
export const UpdateGoalSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  targetDate: z.coerce.date().nullable().optional(),
  priority: PrioritySchema.optional(),
  status: StatusSchema.optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;

/**
 * Goal query parameters.
 */
export const GoalQuerySchema = z.object({
  status: StatusSchema.optional(),
  priority: PrioritySchema.optional(),
  tag: z.string().optional(),
  search: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(['createdAt', 'updatedAt', 'targetDate', 'title', 'priority']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type GoalQuery = z.infer<typeof GoalQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// QUEST SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create quest request body.
 */
export const CreateQuestSchema = z.object({
  goalId: z.string().min(1, 'Goal ID is required'),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().trim().max(1000).optional(),
  order: z.number().int().nonnegative().optional(),
  estimatedMinutes: z.number().int().positive().max(10080).optional(), // Max 1 week
  dueDate: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateQuestInput = z.infer<typeof CreateQuestSchema>;

/**
 * Update quest request body.
 */
export const UpdateQuestSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  order: z.number().int().nonnegative().optional(),
  status: StatusSchema.optional(),
  estimatedMinutes: z.number().int().positive().max(10080).optional(),
  dueDate: z.coerce.date().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

export type UpdateQuestInput = z.infer<typeof UpdateQuestSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// STEP SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create step request body.
 */
export const CreateStepSchema = z.object({
  questId: z.string().min(1, 'Quest ID is required'),
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().trim().max(500).optional(),
  order: z.number().int().nonnegative().optional(),
  estimatedMinutes: z.number().int().positive().max(480).optional(), // Max 8 hours
  metadata: z.record(z.unknown()).optional(),
});

export type CreateStepInput = z.infer<typeof CreateStepSchema>;

/**
 * Update step request body.
 */
export const UpdateStepSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(500).optional(),
  order: z.number().int().nonnegative().optional(),
  status: StatusSchema.optional(),
  estimatedMinutes: z.number().int().positive().max(480).optional(),
  completedAt: z.coerce.date().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
);

export type UpdateStepInput = z.infer<typeof UpdateStepSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Spark types.
 */
export const SparkTypeSchema = z.enum([
  'action',      // Specific action to take
  'reflection',  // Reflection prompt
  'reminder',    // Reminder of commitment
  'motivation',  // Motivational message
  'progress',    // Progress update
]);

export type SparkType = z.infer<typeof SparkTypeSchema>;

/**
 * Create spark request body.
 */
export const CreateSparkSchema = z.object({
  stepId: z.string().min(1, 'Step ID is required'),
  type: SparkTypeSchema.default('action'),
  content: z.string().trim().min(1, 'Content is required').max(500, 'Content too long'),
  scheduledFor: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateSparkInput = z.infer<typeof CreateSparkSchema>;

/**
 * Generate spark request body.
 */
export const GenerateSparkSchema = z.object({
  stepId: z.string().min(1, 'Step ID is required'),
  type: SparkTypeSchema.optional(),
  context: z.string().max(1000).optional(),
});

export type GenerateSparkInput = z.infer<typeof GenerateSparkSchema>;

/**
 * Spark response (action taken).
 */
export const SparkResponseSchema = z.object({
  sparkId: z.string().min(1),
  action: z.enum(['completed', 'snoozed', 'dismissed', 'escalated']),
  snoozeMinutes: z.number().int().positive().max(1440).optional(), // Max 24 hours
  note: z.string().max(500).optional(),
});

export type SparkResponseInput = z.infer<typeof SparkResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// REMINDER SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Reminder frequency.
 */
export const ReminderFrequencySchema = z.enum([
  'once',
  'daily',
  'weekly',
  'custom',
]);

export type ReminderFrequency = z.infer<typeof ReminderFrequencySchema>;

/**
 * Create reminder request body.
 */
export const CreateReminderSchema = z.object({
  stepId: z.string().min(1).optional(),
  goalId: z.string().min(1).optional(),
  message: z.string().trim().min(1).max(500),
  scheduledFor: z.coerce.date(),
  frequency: ReminderFrequencySchema.default('once'),
  cronExpression: z.string().max(100).optional(),
  endDate: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(
  (data) => data.stepId || data.goalId,
  { message: 'Either stepId or goalId is required' }
);

export type CreateReminderInput = z.infer<typeof CreateReminderSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// CHAT/MESSAGE SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Chat message request body.
 */
export const ChatMessageSchema = z.object({
  message: z.string().trim().min(1, 'Message is required').max(10000, 'Message too long'),
  conversationId: z.string().optional(),
  context: z.object({
    goalId: z.string().optional(),
    questId: z.string().optional(),
    stepId: z.string().optional(),
  }).optional(),
  options: z.object({
    stream: z.boolean().default(false),
    includeMemory: z.boolean().default(true),
    maxTokens: z.number().int().positive().max(4096).optional(),
  }).optional(),
});

export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// MEMORY SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Memory type.
 */
export const MemoryTypeSchema = z.enum([
  'fact',       // Factual information
  'preference', // User preference
  'context',    // Contextual information
  'insight',    // Derived insight
]);

export type MemoryType = z.infer<typeof MemoryTypeSchema>;

/**
 * Create memory request body.
 */
export const CreateMemorySchema = z.object({
  type: MemoryTypeSchema.default('fact'),
  content: z.string().trim().min(1).max(1000),
  source: z.string().max(100).optional(),
  confidence: z.number().min(0).max(1).default(1),
  expiresAt: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CreateMemoryInput = z.infer<typeof CreateMemorySchema>;

/**
 * Memory query parameters.
 */
export const MemoryQuerySchema = z.object({
  type: MemoryTypeSchema.optional(),
  search: z.string().max(100).optional(),
  minConfidence: z.coerce.number().min(0).max(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type MemoryQuery = z.infer<typeof MemoryQuerySchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// PREFERENCES SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * User preferences schema.
 */
export const UserPreferencesSchema = z.object({
  timezone: z.string().max(50).optional(),
  language: z.string().length(2).optional(), // ISO 639-1
  
  notifications: z.object({
    enabled: z.boolean().default(true),
    email: z.boolean().default(true),
    push: z.boolean().default(true),
    quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:mm
    quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  }).optional(),
  
  spark: z.object({
    frequency: z.enum(['low', 'medium', 'high']).default('medium'),
    preferredTimes: z.array(z.string().regex(/^\d{2}:\d{2}$/)).max(5).optional(),
    style: z.enum(['encouraging', 'direct', 'gentle']).default('encouraging'),
  }).optional(),
  
  display: z.object({
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    compactMode: z.boolean().default(false),
  }).optional(),
});

export type UserPreferencesInput = z.infer<typeof UserPreferencesSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Login request body.
 */
export const LoginSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string().min(8).max(128),
  rememberMe: z.boolean().default(false),
});

export type LoginInput = z.infer<typeof LoginSchema>;

/**
 * Register request body.
 */
export const RegisterSchema = z.object({
  email: z.string().trim().email().toLowerCase(),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  name: z.string().trim().min(1).max(100).optional(),
  acceptTerms: z.literal(true, { 
    errorMap: () => ({ message: 'You must accept the terms of service' })
  }),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

/**
 * Refresh token request body.
 */
export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// COMMON PARAM SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Goal ID param.
 */
export const GoalIdParamSchema = z.object({
  goalId: z.string().min(1, 'Goal ID is required'),
});

/**
 * Quest ID param.
 */
export const QuestIdParamSchema = z.object({
  questId: z.string().min(1, 'Quest ID is required'),
});

/**
 * Step ID param.
 */
export const StepIdParamSchema = z.object({
  stepId: z.string().min(1, 'Step ID is required'),
});

/**
 * Spark ID param.
 */
export const SparkIdParamSchema = z.object({
  sparkId: z.string().min(1, 'Spark ID is required'),
});

/**
 * Generic ID param.
 */
export const IdParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});
