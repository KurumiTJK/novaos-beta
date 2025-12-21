// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION MODULE INDEX — Validation Exports
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

// Middleware
export {
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
  validate,
  ValidationErrorCode,
  type ValidationErrorCode as ValidationErrorCodeType,
  type ValidationError,
  type FieldError,
  type ValidationOptions,
  type RequestSchema,
  type ValidatedRequest,
  type InferSchema,
  // Common schemas
  IdParamSchema,
  UuidParamSchema,
  PaginationSchema,
  SearchSchema,
  DateRangeSchema,
  // Custom validators
  nonEmptyString,
  boundedString,
  email,
  url,
  positiveInt,
  nonNegativeInt,
  isoDateString,
  slug,
} from './middleware.js';

// Schemas
export {
  // Base schemas
  BaseEntitySchema,
  StatusSchema,
  PrioritySchema,
  type Status,
  type Priority,
  // Goal schemas
  CreateGoalSchema,
  UpdateGoalSchema,
  GoalQuerySchema,
  type CreateGoalInput,
  type UpdateGoalInput,
  type GoalQuery,
  // Quest schemas
  CreateQuestSchema,
  UpdateQuestSchema,
  type CreateQuestInput,
  type UpdateQuestInput,
  // Step schemas
  CreateStepSchema,
  UpdateStepSchema,
  type CreateStepInput,
  type UpdateStepInput,
  // Spark schemas
  SparkTypeSchema,
  CreateSparkSchema,
  GenerateSparkSchema,
  SparkResponseSchema,
  type SparkType,
  type CreateSparkInput,
  type GenerateSparkInput,
  type SparkResponseInput,
  // Reminder schemas
  ReminderFrequencySchema,
  CreateReminderSchema,
  type ReminderFrequency,
  type CreateReminderInput,
  // Chat schemas
  ChatMessageSchema,
  type ChatMessageInput,
  // Memory schemas
  MemoryTypeSchema,
  CreateMemorySchema,
  MemoryQuerySchema,
  type MemoryType,
  type CreateMemoryInput,
  type MemoryQuery,
  // Preferences schemas
  UserPreferencesSchema,
  type UserPreferencesInput,
  // Auth schemas
  LoginSchema,
  RegisterSchema,
  RefreshTokenSchema,
  type LoginInput,
  type RegisterInput,
  type RefreshTokenInput,
  // Param schemas
  GoalIdParamSchema,
  QuestIdParamSchema,
  StepIdParamSchema,
  SparkIdParamSchema,
  IdParamSchema as GenericIdParamSchema,
} from './schemas.js';
