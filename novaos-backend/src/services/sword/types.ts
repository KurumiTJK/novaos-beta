// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE TYPES v2 - NODE-BASED LEARNING SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────────

export type Route = 'recall' | 'practice' | 'diagnose' | 'apply' | 'build' | 'refine' | 'plan';

export type RouteStatus = 'learn' | 'skip' | 'assess';

export type SubskillType =
  | 'concepts'         // → recall
  | 'procedures'       // → practice
  | 'judgments'        // → diagnose
  | 'outputs'          // → build
  | 'tool_setup'       // → practice
  | 'tool_management'; // → plan

export type NodeStatus = 'locked' | 'available' | 'in_progress' | 'completed';

export type MethodNodeType = 'error_review' | 'mixed_practice' | 'spaced_review';

export type AssetType =
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

export type GenerationSource = 'llm' | 'fallback' | 'prefetch' | 'refresh';

export type PlanStatus = 'designing' | 'active' | 'completed' | 'abandoned';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

// Visible phases (user sees 4)
export type VisiblePhase = 'exploration' | 'define_goal' | 'research' | 'review';

// Internal phases (system does 8)
export type InternalPhase =
  | 'exploration'
  | 'capstone'
  | 'subskills'
  | 'routing'
  | 'research'
  | 'node_generation'
  | 'sequencing'
  | 'method_nodes';

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTING TABLE (deterministic, no ambiguity)
// ─────────────────────────────────────────────────────────────────────────────────

export const SUBSKILL_TO_ROUTE: Record<SubskillType, Route> = {
  concepts: 'recall',
  procedures: 'practice',
  judgments: 'diagnose',
  outputs: 'build',
  tool_setup: 'practice',
  tool_management: 'plan',
};

// Route to asset types mapping
export const ROUTE_ASSETS: Record<Route, AssetType[]> = {
  recall: ['active_recall_prompt', 'quiz', 'spaced_review', 'spark'],
  practice: ['worked_example', 'guided_problem', 'independent_problem', 'spark'],
  diagnose: ['spot_error', 'classify', 'compare_contrast', 'spark'],
  apply: ['novel_scenario', 'case_question', 'spark'],
  build: ['project_milestone', 'integration_checklist', 'spark'],
  refine: ['rubric_check', 'revision_pass', 'spark'],
  plan: ['concept_map', 'error_log_review', 'spark'],
};

// ─────────────────────────────────────────────────────────────────────────────────
// PHASE MAPPING
// ─────────────────────────────────────────────────────────────────────────────────

export const PHASE_MAPPING: Record<InternalPhase, VisiblePhase> = {
  exploration: 'exploration',
  capstone: 'define_goal',
  subskills: 'define_goal',
  routing: 'define_goal',
  research: 'research',
  node_generation: 'review',
  sequencing: 'review',
  method_nodes: 'review',
};

export const VISIBLE_PHASE_ORDER: VisiblePhase[] = [
  'exploration',
  'define_goal',
  'research',
  'review',
];

export const INTERNAL_PHASE_ORDER: InternalPhase[] = [
  'exploration',
  'capstone',
  'subskills',
  'routing',
  'research',
  'node_generation',
  'sequencing',
  'method_nodes',
];

// ─────────────────────────────────────────────────────────────────────────────────
// LESSON PLAN
// ─────────────────────────────────────────────────────────────────────────────────

export interface LessonPlan {
  id: string;
  userId: string;

  // Goal
  title: string;
  description?: string;

  // Capstone
  capstoneStatement?: string;
  successCriteria: string[];

  // Scope
  difficulty: Difficulty;
  dailyMinutes: number;
  weeklyCadence: number;

  // Derived from nodes
  totalNodes: number;
  totalSessions: number;
  estimatedWeeks: number;

  // Status
  status: PlanStatus;
  progress: number;

  // Session tracking for method nodes
  sessionsCompleted: number;
  sessionsSinceMethodNode: number;

  // Timestamps
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  abandonedAt?: Date;
}

export interface LessonPlanRow {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  capstone_statement: string | null;
  success_criteria: string[];
  difficulty: string;
  daily_minutes: number;
  weekly_cadence: number;
  total_nodes: number;
  total_sessions: number;
  estimated_weeks: number;
  status: string;
  progress: number;
  sessions_completed: number;
  sessions_since_method_node: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  abandoned_at: string | null;
}

export function mapLessonPlan(row: LessonPlanRow): LessonPlan {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    description: row.description || undefined,
    capstoneStatement: row.capstone_statement || undefined,
    successCriteria: row.success_criteria || [],
    difficulty: row.difficulty as Difficulty,
    dailyMinutes: row.daily_minutes,
    weeklyCadence: row.weekly_cadence,
    totalNodes: row.total_nodes,
    totalSessions: row.total_sessions,
    estimatedWeeks: row.estimated_weeks,
    status: row.status as PlanStatus,
    progress: row.progress,
    sessionsCompleted: row.sessions_completed,
    sessionsSinceMethodNode: row.sessions_since_method_node,
    createdAt: new Date(row.created_at),
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    abandonedAt: row.abandoned_at ? new Date(row.abandoned_at) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// NODE
// ─────────────────────────────────────────────────────────────────────────────────

export interface PracticeAssetSpec {
  type: AssetType;
  difficulty: 'foundational' | 'guided' | 'independent';
  promptTemplate: string;
  estimatedMinutes: number;
}

export interface Resource {
  id: string;
  title: string;
  url: string;
  type: 'article' | 'video' | 'documentation' | 'tool' | 'exercise';
  status: 'verified' | 'pending' | 'failed';
  verifiedAt?: string;
  fallbackUrl?: string;
}

export interface FallbackAsset {
  type: AssetType;
  title: string;
  content: string;
  estimatedMinutes: number;
}

export interface Node {
  id: string;
  planId: string;

  // Core
  title: string;
  objective: string;
  route: Route;
  subskillType: SubskillType;

  // Sequencing
  sequenceOrder: number;
  moduleNumber: number;

  // Mastery
  masteryCheck: string;
  masteryReflectionPrompt: string;
  estimatedSessions: number;

  // Method node
  isMethodNode: boolean;
  methodNodeType?: MethodNodeType;

  // Assets
  practiceAssetSpecs: PracticeAssetSpec[];
  canonicalSources: Resource[];
  fallbackAssets: FallbackAsset[];

  // Timestamps
  createdAt: Date;
}

export interface NodeRow {
  id: string;
  plan_id: string;
  title: string;
  objective: string;
  route: string;
  subskill_type: string;
  sequence_order: number;
  module_number: number;
  mastery_check: string;
  mastery_reflection_prompt: string;
  estimated_sessions: number;
  is_method_node: boolean;
  method_node_type: string | null;
  practice_asset_specs: PracticeAssetSpec[];
  canonical_sources: Resource[];
  fallback_assets: FallbackAsset[];
  created_at: string;
}

export function mapNode(row: NodeRow): Node {
  return {
    id: row.id,
    planId: row.plan_id,
    title: row.title,
    objective: row.objective,
    route: row.route as Route,
    subskillType: row.subskill_type as SubskillType,
    sequenceOrder: row.sequence_order,
    moduleNumber: row.module_number,
    masteryCheck: row.mastery_check,
    masteryReflectionPrompt: row.mastery_reflection_prompt,
    estimatedSessions: row.estimated_sessions,
    isMethodNode: row.is_method_node,
    methodNodeType: row.method_node_type as MethodNodeType | undefined,
    practiceAssetSpecs: row.practice_asset_specs || [],
    canonicalSources: row.canonical_sources || [],
    fallbackAssets: row.fallback_assets || [],
    createdAt: new Date(row.created_at),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// NODE PROGRESS
// ─────────────────────────────────────────────────────────────────────────────────

export interface NodeProgress {
  id: string;
  userId: string;
  nodeId: string;

  // Status
  status: NodeStatus;
  availableAt?: Date;

  // Progress
  sessionsCompleted: number;
  currentSession: number;

  // Mastery
  allAssetsCompleted: boolean;
  masteryReflection?: string;
  masteryAchieved: boolean;

  // Timing
  startedAt?: Date;
  lastSessionAt?: Date;
  completedAt?: Date;

  // Refresh
  needsRefresh: boolean;
  refreshCompletedAt?: Date;
}

export interface NodeProgressRow {
  id: string;
  user_id: string;
  node_id: string;
  status: string;
  available_at: string | null;
  sessions_completed: number;
  current_session: number;
  all_assets_completed: boolean;
  mastery_reflection: string | null;
  mastery_achieved: boolean;
  started_at: string | null;
  last_session_at: string | null;
  completed_at: string | null;
  needs_refresh: boolean;
  refresh_completed_at: string | null;
}

export function mapNodeProgress(row: NodeProgressRow): NodeProgress {
  return {
    id: row.id,
    userId: row.user_id,
    nodeId: row.node_id,
    status: row.status as NodeStatus,
    availableAt: row.available_at ? new Date(row.available_at) : undefined,
    sessionsCompleted: row.sessions_completed,
    currentSession: row.current_session,
    allAssetsCompleted: row.all_assets_completed,
    masteryReflection: row.mastery_reflection || undefined,
    masteryAchieved: row.mastery_achieved,
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    lastSessionAt: row.last_session_at ? new Date(row.last_session_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    needsRefresh: row.needs_refresh,
    refreshCompletedAt: row.refresh_completed_at ? new Date(row.refresh_completed_at) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// DAILY PLAN
// ─────────────────────────────────────────────────────────────────────────────────

export interface GeneratedAsset {
  id: string;
  type: AssetType;
  title: string;
  content: string;
  estimatedMinutes: number;
  isSpark: boolean;
  resourceId?: string;

  // Progress (populated from asset_progress)
  completed?: boolean;
  completedAt?: Date;
}

export interface MaintenanceLayer {
  quickRecall: string[];
  checkpoint: string;
}

export interface DailyPlan {
  id: string;
  nodeId: string;

  // Session
  sessionNumber: number;
  planDate: string;
  route: Route;

  // Content
  overview: string;
  keyPoints: string[];

  // Assets
  assets: GeneratedAsset[];

  // Spark is REQUIRED
  spark: GeneratedAsset;

  // Maintenance layer
  maintenanceLayer: MaintenanceLayer;

  // Mastery
  isFinalSession: boolean;
  masteryReflectionPrompt?: string;

  // Metadata
  generationSource: GenerationSource;
  generatedAt: Date;
  lockedAt?: Date;

  // Refresh
  isRefreshSession: boolean;
}

export interface DailyPlanRow {
  id: string;
  node_id: string;
  session_number: number;
  plan_date: string;
  route: string;
  overview: string;
  key_points: string[];
  assets: GeneratedAsset[];
  spark: GeneratedAsset;
  maintenance_layer: MaintenanceLayer;
  is_final_session: boolean;
  mastery_reflection_prompt: string | null;
  generation_source: string;
  generated_at: string;
  locked_at: string | null;
  is_refresh_session: boolean;
}

export function mapDailyPlan(row: DailyPlanRow): DailyPlan {
  return {
    id: row.id,
    nodeId: row.node_id,
    sessionNumber: row.session_number,
    planDate: row.plan_date,
    route: row.route as Route,
    overview: row.overview,
    keyPoints: row.key_points || [],
    assets: row.assets || [],
    spark: row.spark,
    maintenanceLayer: row.maintenance_layer || { quickRecall: [], checkpoint: '' },
    isFinalSession: row.is_final_session,
    masteryReflectionPrompt: row.mastery_reflection_prompt || undefined,
    generationSource: row.generation_source as GenerationSource,
    generatedAt: new Date(row.generated_at),
    lockedAt: row.locked_at ? new Date(row.locked_at) : undefined,
    isRefreshSession: row.is_refresh_session,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// DESIGNER SESSION
// ─────────────────────────────────────────────────────────────────────────────────

export interface ExplorationData {
  learningGoal: string;
  context: string;
  constraints: string[];
  priorKnowledge: string;
  readyForCapstone: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPLORATION STATE (Two-part exploration: Orient + Clarify)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Message in exploration conversation (Part 1: Orient)
 */
export interface ExplorationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/**
 * Extracted data from conversation (Part 2: Clarify)
 */
export interface ExplorationExtracted {
  learningGoal: string | null;
  priorKnowledge: string | null;
  context: string | null;
  constraints: string[];
}

/**
 * Track where each field's data came from
 */
export type FieldSource = 'extracted' | 'user_filled' | 'user_edited' | null;

/**
 * Full exploration state (stored in designer_sessions.exploration_data)
 */
export interface ExplorationState {
  // Current part of exploration
  part: 'orient' | 'clarify';
  
  // Part 1: Conversation history (unlimited messages)
  messages: ExplorationMessage[];
  
  // Part 2: Extracted/edited data
  extracted: ExplorationExtracted;
  
  // Track field sources for UI display
  fieldSources: {
    learningGoal: FieldSource;
    priorKnowledge: FieldSource;
    context: FieldSource;
  };
  
  // Required fields that are still empty
  missing: ('learningGoal' | 'priorKnowledge')[];
}

/**
 * Current SwordGate mode (persistent until complete)
 */
export type SwordGateMode = 
  | 'explore_orient'    // Part 1: Free conversation
  | 'explore_clarify'   // Part 2: Sort & fill page
  | 'define_goal'       // Capstone generation
  | 'research'          // Research phase
  | 'review'            // Review & finalize
  | 'learning'          // Active plan, daily learning
  | null;               // No active SwordGate mode

// ─────────────────────────────────────────────────────────────────────────────────

export interface CapstoneData {
  title: string;
  capstoneStatement: string;
  successCriteria: string[];
  estimatedTime?: string;
  impliedNodeTypes: {
    recall: number;
    practice: number;
    build: number;
  };
}

export interface Subskill {
  id: string;
  title: string;
  description: string;
  subskillType: SubskillType;
  estimatedComplexity: 1 | 2 | 3;
  order: number;
}

export interface SubskillsData {
  subskills: Subskill[];
}

export interface RoutingData {
  assignments: Array<{
    subskillId: string;
    route: Route;
    status: RouteStatus;
    reason?: string;
  }>;
}

export interface ResearchData {
  resources: Array<{
    subskillId: string;
    sources: Resource[];
  }>;
  researchComplete: boolean;
}

export interface NodesData {
  nodes: Array<Omit<Node, 'id' | 'planId' | 'createdAt'>>;
}

export interface SequencingData {
  orderedNodeIds: string[];
  prerequisites: Array<{
    nodeId: string;
    prereqIds: string[];
  }>;
  modules: Array<{
    number: number;
    nodeIds: string[];
  }>;
}

export interface MethodNodesData {
  insertions: Array<{
    afterNodeId: string;
    methodNodeType: MethodNodeType;
    reason: string;
  }>;
}

export interface DesignerSession {
  id: string;
  userId: string;
  planId?: string;
  conversationId?: string;

  // Dual phase tracking
  visiblePhase: VisiblePhase;
  internalPhase: InternalPhase;

  // Phase data
  explorationData?: ExplorationData;
  capstoneData?: CapstoneData;
  subskillsData?: SubskillsData;
  routingData?: RoutingData;
  researchData?: ResearchData;
  nodesData?: NodesData;
  sequencingData?: SequencingData;
  methodNodesData?: MethodNodesData;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface DesignerSessionRow {
  id: string;
  user_id: string;
  plan_id: string | null;
  conversation_id: string | null;
  visible_phase: string;
  internal_phase: string;
  exploration_data: ExplorationData | null;
  capstone_data: CapstoneData | null;
  subskills_data: SubskillsData | null;
  routing_data: RoutingData | null;
  research_data: ResearchData | null;
  nodes_data: NodesData | null;
  sequencing_data: SequencingData | null;
  method_nodes_data: MethodNodesData | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export function mapDesignerSession(row: DesignerSessionRow): DesignerSession {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id || undefined,
    conversationId: row.conversation_id || undefined,
    visiblePhase: row.visible_phase as VisiblePhase,
    internalPhase: row.internal_phase as InternalPhase,
    explorationData: row.exploration_data || undefined,
    capstoneData: row.capstone_data || undefined,
    subskillsData: row.subskills_data || undefined,
    routingData: row.routing_data || undefined,
    researchData: row.research_data || undefined,
    nodesData: row.nodes_data || undefined,
    sequencingData: row.sequencing_data || undefined,
    methodNodesData: row.method_nodes_data || undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// API RESPONSES
// ─────────────────────────────────────────────────────────────────────────────────

export interface TodayResponse {
  // Current state
  plan: LessonPlan;
  currentNode: Node;
  nodeProgress: NodeProgress;

  // Session info
  sessionNumber: number;
  totalSessions: number;

  // Daily plan
  dailyPlan: DailyPlan;

  // Refresh indicator
  isRefreshSession: boolean;
  refreshReason?: string;

  // In-progress warning
  hasOtherInProgress?: {
    nodeId: string;
    nodeTitle: string;
    sessionNumber: number;
  };

  // Graph context
  completedNodes: number;
  totalNodes: number;
  nextAvailableNodes: Array<{
    id: string;
    title: string;
    route: Route;
  }>;

  // Method node indicator
  methodNodeDue: boolean;
  nextMethodNodeType?: MethodNodeType;
}

export interface SwitchCheck {
  canSwitch: boolean;
  hasInProgress: boolean;
  inProgressNode?: {
    id: string;
    title: string;
    sessionNumber: number;
    totalSessions: number;
  };
  warning?: string;
}

export interface PrerequisiteCheck {
  met: boolean;
  missing: string[];
}

export interface MasteryCheck {
  canCompleteMastery: boolean;
  assetsCompleted: boolean;
  reflectionRequired: boolean;
  reflectionProvided: boolean;
}

export interface RefreshCheck {
  needsRefresh: boolean;
  gapDays?: number;
}

export interface MethodNodeCheck {
  shouldInsert: boolean;
  type?: MethodNodeType;
  reason?: 'session_count' | 'before_build' | 'module_boundary';
}

// ─────────────────────────────────────────────────────────────────────────────────
// PREFETCH
// ─────────────────────────────────────────────────────────────────────────────────

export interface PrefetchItem {
  id: string;
  userId: string;
  nodeId: string;
  sessionNumber: number;
  planDate: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  attempts: number;
  lastError?: string;
  createdAt: Date;
  processedAt?: Date;
}

export interface PrefetchItemRow {
  id: string;
  user_id: string;
  node_id: string;
  session_number: number;
  plan_date: string;
  status: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
}

export function mapPrefetchItem(row: PrefetchItemRow): PrefetchItem {
  return {
    id: row.id,
    userId: row.user_id,
    nodeId: row.node_id,
    sessionNumber: row.session_number,
    planDate: row.plan_date,
    status: row.status as PrefetchItem['status'],
    attempts: row.attempts,
    lastError: row.last_error || undefined,
    createdAt: new Date(row.created_at),
    processedAt: row.processed_at ? new Date(row.processed_at) : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER
// ─────────────────────────────────────────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half_open';

export interface CircuitBreakerState {
  id: string;
  serviceName: string;
  state: CircuitState;
  failureCount: number;
  lastFailureAt?: Date;
  lastSuccessAt?: Date;
  openedAt?: Date;
  halfOpenAt?: Date;
  updatedAt: Date;
}

export interface CircuitBreakerStateRow {
  id: string;
  service_name: string;
  state: string;
  failure_count: number;
  last_failure_at: string | null;
  last_success_at: string | null;
  opened_at: string | null;
  half_open_at: string | null;
  updated_at: string;
}

export function mapCircuitBreakerState(row: CircuitBreakerStateRow): CircuitBreakerState {
  return {
    id: row.id,
    serviceName: row.service_name,
    state: row.state as CircuitState,
    failureCount: row.failure_count,
    lastFailureAt: row.last_failure_at ? new Date(row.last_failure_at) : undefined,
    lastSuccessAt: row.last_success_at ? new Date(row.last_success_at) : undefined,
    openedAt: row.opened_at ? new Date(row.opened_at) : undefined,
    halfOpenAt: row.half_open_at ? new Date(row.half_open_at) : undefined,
    updatedAt: new Date(row.updated_at),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface SessionAssets {
  assets: AssetType[];
  spark: AssetType;
}

export interface PlanDerivedStats {
  totalSessions: number;
  estimatedWeeks: number;
  byRoute: Record<Route, number>;
}
