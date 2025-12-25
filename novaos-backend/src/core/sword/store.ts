// ═══════════════════════════════════════════════════════════════════════════════
// SWORD STORE — Persistence for Goals, Quests, Steps, Sparks
// ═══════════════════════════════════════════════════════════════════════════════

import { getStore, type KeyValueStore } from '../../storage/index.js';
import type {
  Goal, GoalStatus,
  Quest, QuestStatus,
  Step,
  Spark, SparkStatus,
  Path, PathBlocker,
  CreateGoalRequest,
  CreateQuestRequest,
  CreateStepRequest,
  GoalEvent, GoalEventType,
  QuestEvent, QuestEventType,
  StepEvent, StepEventType,
  SparkEvent, SparkEventType,
} from './types.js';
import {
  toGoalEvent,
  toQuestEvent,
  toStepEvent,
  toSparkEvent,
} from './types.js';
import {
  transitionGoal, transitionQuest, transitionStep, transitionSpark,
  type TransitionResult, type SideEffect,
} from './state-machine.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const GOAL_TTL = 365 * 24 * 60 * 60;       // 1 year
const QUEST_TTL = 180 * 24 * 60 * 60;      // 6 months
const STEP_TTL = 180 * 24 * 60 * 60;       // 6 months
const SPARK_TTL = 7 * 24 * 60 * 60;        // 7 days
const SPARK_EXPIRY_HOURS = 24;             // Sparks expire after 24 hours

// ─────────────────────────────────────────────────────────────────────────────────
// KEY GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

function goalKey(id: string): string {
  return `sword:goal:${id}`;
}

function userGoalsKey(userId: string): string {
  return `sword:user:${userId}:goals`;
}

function questKey(id: string): string {
  return `sword:quest:${id}`;
}

function goalQuestsKey(goalId: string): string {
  return `sword:goal:${goalId}:quests`;
}

function stepKey(id: string): string {
  return `sword:step:${id}`;
}

function questStepsKey(questId: string): string {
  return `sword:quest:${questId}:steps`;
}

function sparkKey(id: string): string {
  return `sword:spark:${id}`;
}

function userSparksKey(userId: string): string {
  return `sword:user:${userId}:sparks`;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SWORD STORE CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class SwordStore {
  private store: KeyValueStore;
  
  constructor(store?: KeyValueStore) {
    this.store = store ?? getStore();
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // GOAL OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  async createGoal(userId: string, request: CreateGoalRequest): Promise<Goal> {
    const id = generateId();
    const now = new Date().toISOString();
    
    const goal: Goal = {
      id,
      userId,
      title: request.title,
      description: request.description,
      desiredOutcome: request.desiredOutcome,
      interestLevel: request.interestLevel ?? 'career_capital',
      tags: request.tags ?? [],
      status: 'active',
      progress: 0,
      targetDate: request.targetDate,
      createdAt: now,
      updatedAt: now,
      questIds: [],
      motivations: request.motivations ?? [],
      constraints: request.constraints ?? [],
      successCriteria: request.successCriteria ?? [],
    };
    
    // Save goal
    await this.store.set(goalKey(id), JSON.stringify(goal), GOAL_TTL);
    
    // Add to user's goals list
    const userGoals = await this.getUserGoalIds(userId);
    userGoals.push(id);
    await this.store.set(userGoalsKey(userId), JSON.stringify(userGoals), GOAL_TTL);
    
    return goal;
  }
  
  async getGoal(id: string): Promise<Goal | null> {
    const data = await this.store.get(goalKey(id));
    return data ? JSON.parse(data) : null;
  }
  
  async updateGoal(id: string, updates: Partial<Goal>): Promise<Goal | null> {
    const goal = await this.getGoal(id);
    if (!goal) return null;
    
    // Filter out null values from updates (convert to undefined)
    const cleanUpdates: Partial<Goal> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (value !== null) {
        (cleanUpdates as Record<string, unknown>)[key] = value;
      }
    }
    
    const updated: Goal = {
      ...goal,
      ...cleanUpdates,
      id: goal.id,
      userId: goal.userId,
      updatedAt: new Date().toISOString(),
    };
    
    await this.store.set(goalKey(id), JSON.stringify(updated), GOAL_TTL);
    return updated;
  }
  
  async deleteGoal(id: string): Promise<boolean> {
    const goal = await this.getGoal(id);
    if (!goal) return false;
    
    // Remove from user's goals list
    const userGoals = await this.getUserGoalIds(goal.userId);
    const index = userGoals.indexOf(id);
    if (index > -1) {
      userGoals.splice(index, 1);
      await this.store.set(userGoalsKey(goal.userId), JSON.stringify(userGoals), GOAL_TTL);
    }
    
    // Delete the goal
    await this.store.delete(goalKey(id));
    return true;
  }
  
  /**
   * Transition goal state using either string event type or full event object.
   */
  async transitionGoalState(
    id: string, 
    eventOrType: GoalEvent | GoalEventType | string,
    payload?: Record<string, unknown>
  ): Promise<TransitionResult<Goal> | null> {
    const goal = await this.getGoal(id);
    if (!goal) return null;
    
    // Convert string to event object if needed
    const event = typeof eventOrType === 'string' 
      ? toGoalEvent(eventOrType.toUpperCase() as GoalEventType, payload)
      : eventOrType;
    
    const result = transitionGoal(goal, event, payload);
    
    if (result.success) {
      await this.store.set(goalKey(id), JSON.stringify(result.entity), GOAL_TTL);
      await this.processSideEffects(result.sideEffects ?? []);
    }
    
    return result;
  }
  
  async getUserGoals(userId: string, status?: GoalStatus | string): Promise<Goal[]> {
    const ids = await this.getUserGoalIds(userId);
    const goals: Goal[] = [];
    
    for (const id of ids) {
      const goal = await this.getGoal(id);
      if (goal) {
        // Filter by status if provided
        if (!status || goal.status === status) {
          goals.push(goal);
        }
      }
    }
    
    return goals;
  }
  
  /** Alias for getUserGoals (for backward compatibility) */
  async getGoals(userId: string, status?: GoalStatus | string): Promise<Goal[]> {
    return this.getUserGoals(userId, status);
  }
  
  private async getUserGoalIds(userId: string): Promise<string[]> {
    const data = await this.store.get(userGoalsKey(userId));
    return data ? JSON.parse(data) : [];
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // QUEST OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  async createQuest(userId: string, request: CreateQuestRequest): Promise<Quest | null> {
    const goal = await this.getGoal(request.goalId);
    if (!goal || goal.userId !== userId) return null;
    
    const id = generateId();
    const now = new Date().toISOString();
    
    // Determine order
    const existingQuests = await this.getQuestsForGoal(request.goalId);
    const order = request.order ?? existingQuests.length;
    
    const quest: Quest = {
      id,
      userId,
      goalId: request.goalId,
      title: request.title,
      description: request.description,
      outcome: request.outcome,
      status: 'not_started',
      priority: request.priority ?? 'medium',
      progress: 0,
      order,
      estimatedMinutes: request.estimatedMinutes,
      targetDate: request.targetDate,
      createdAt: now,
      updatedAt: now,
      stepIds: [],
      riskLevel: 'none',
    };
    
    // Save quest
    await this.store.set(questKey(id), JSON.stringify(quest), QUEST_TTL);
    
    // Add to goal's quests list
    const goalQuests = await this.getGoalQuestIds(request.goalId);
    goalQuests.push(id);
    await this.store.set(goalQuestsKey(request.goalId), JSON.stringify(goalQuests), QUEST_TTL);
    
    // Update goal
    await this.updateGoal(request.goalId, { questIds: goalQuests });
    
    return quest;
  }
  
  async getQuest(id: string): Promise<Quest | null> {
    const data = await this.store.get(questKey(id));
    return data ? JSON.parse(data) : null;
  }
  
  async updateQuest(id: string, updates: Partial<Quest>): Promise<Quest | null> {
    const quest = await this.getQuest(id);
    if (!quest) return null;
    
    const updated: Quest = {
      ...quest,
      ...updates,
      id: quest.id,
      userId: quest.userId,
      goalId: quest.goalId,
      updatedAt: new Date().toISOString(),
    };
    
    await this.store.set(questKey(id), JSON.stringify(updated), QUEST_TTL);
    return updated;
  }
  
  async deleteQuest(id: string): Promise<boolean> {
    const quest = await this.getQuest(id);
    if (!quest) return false;
    
    // Remove from goal's quests list
    const goalQuests = await this.getGoalQuestIds(quest.goalId);
    const index = goalQuests.indexOf(id);
    if (index > -1) {
      goalQuests.splice(index, 1);
      await this.store.set(goalQuestsKey(quest.goalId), JSON.stringify(goalQuests), QUEST_TTL);
      await this.updateGoal(quest.goalId, { questIds: goalQuests });
    }
    
    // Delete the quest
    await this.store.delete(questKey(id));
    return true;
  }
  
  /**
   * Transition quest state using either string event type or full event object.
   */
  async transitionQuestState(
    id: string, 
    eventOrType: QuestEvent | QuestEventType | string,
    payload?: Record<string, unknown>
  ): Promise<TransitionResult<Quest> | null> {
    const quest = await this.getQuest(id);
    if (!quest) return null;
    
    // Convert string to event object if needed
    const event = typeof eventOrType === 'string' 
      ? toQuestEvent(eventOrType.toUpperCase() as QuestEventType, payload)
      : eventOrType;
    
    const result = transitionQuest(quest, event, payload);
    
    if (result.success) {
      await this.store.set(questKey(id), JSON.stringify(result.entity), QUEST_TTL);
      await this.processSideEffects(result.sideEffects ?? []);
    }
    
    return result;
  }
  
  async getQuestsForGoal(goalId: string): Promise<Quest[]> {
    const ids = await this.getGoalQuestIds(goalId);
    const quests: Quest[] = [];
    
    for (const id of ids) {
      const quest = await this.getQuest(id);
      if (quest) quests.push(quest);
    }
    
    return quests.sort((a, b) => a.order - b.order);
  }
  
  async getUserQuests(userId: string): Promise<Quest[]> {
    const goals = await this.getUserGoals(userId);
    const allQuests: Quest[] = [];
    
    for (const goal of goals) {
      const quests = await this.getQuestsForGoal(goal.id);
      allQuests.push(...quests);
    }
    
    return allQuests;
  }
  
  private async getGoalQuestIds(goalId: string): Promise<string[]> {
    const data = await this.store.get(goalQuestsKey(goalId));
    return data ? JSON.parse(data) : [];
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // STEP OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  async createStep(request: CreateStepRequest): Promise<Step | null> {
    const quest = await this.getQuest(request.questId);
    if (!quest) return null;
    
    const id = generateId();
    const now = new Date().toISOString();
    
    // Determine order
    const existingSteps = await this.getStepsForQuest(request.questId);
    const order = request.order ?? existingSteps.length;
    
    const step: Step = {
      id,
      questId: request.questId,
      title: request.title,
      description: request.description,
      type: request.type ?? 'action',
      actionType: request.actionType,
      status: 'pending',
      order,
      estimatedMinutes: request.estimatedMinutes,
      createdAt: now,
      dayNumber: request.dayNumber,
      scheduledDate: request.scheduledDate,
      sparkPrompt: request.sparkPrompt,
      verificationRequired: request.verificationRequired ?? false,
    };
    
    // Save step
    await this.store.set(stepKey(id), JSON.stringify(step), STEP_TTL);
    
    // Add to quest's steps list
    const questSteps = await this.getQuestStepIds(request.questId);
    questSteps.push(id);
    await this.store.set(questStepsKey(request.questId), JSON.stringify(questSteps), STEP_TTL);
    
    // Update quest
    await this.updateQuest(request.questId, { stepIds: questSteps });
    
    return step;
  }
  
  async getStep(id: string): Promise<Step | null> {
    const data = await this.store.get(stepKey(id));
    return data ? JSON.parse(data) : null;
  }
  
  async updateStep(id: string, updates: Partial<Step>): Promise<Step | null> {
    const step = await this.getStep(id);
    if (!step) return null;
    
    const updated: Step = {
      ...step,
      ...updates,
      id: step.id,
      questId: step.questId,
    };
    
    await this.store.set(stepKey(id), JSON.stringify(updated), STEP_TTL);
    return updated;
  }
  
  async deleteStep(id: string): Promise<boolean> {
    const step = await this.getStep(id);
    if (!step) return false;
    
    // Remove from quest's steps list
    const questSteps = await this.getQuestStepIds(step.questId);
    const index = questSteps.indexOf(id);
    if (index > -1) {
      questSteps.splice(index, 1);
      await this.store.set(questStepsKey(step.questId), JSON.stringify(questSteps), STEP_TTL);
      await this.updateQuest(step.questId, { stepIds: questSteps });
    }
    
    // Delete the step
    await this.store.delete(stepKey(id));
    return true;
  }
  
  /**
   * Transition step state using either string event type or full event object.
   */
  async transitionStepState(
    id: string, 
    eventOrType: StepEvent | StepEventType | string,
    payload?: Record<string, unknown>
  ): Promise<TransitionResult<Step> | null> {
    const step = await this.getStep(id);
    if (!step) return null;
    
    // Convert string to event object if needed
    const event = typeof eventOrType === 'string' 
      ? toStepEvent(eventOrType.toUpperCase() as StepEventType, payload)
      : eventOrType;
    
    const result = transitionStep(step, event, payload);
    
    if (result.success) {
      await this.store.set(stepKey(id), JSON.stringify(result.entity), STEP_TTL);
      await this.processSideEffects(result.sideEffects ?? []);
    }
    
    return result;
  }
  
  async getStepsForQuest(questId: string): Promise<Step[]> {
    const ids = await this.getQuestStepIds(questId);
    const steps: Step[] = [];
    
    for (const id of ids) {
      const step = await this.getStep(id);
      if (step) steps.push(step);
    }
    
    return steps.sort((a, b) => a.order - b.order);
  }
  
  async getNextStep(questId: string): Promise<Step | null> {
    const steps = await this.getStepsForQuest(questId);
    return steps.find(s => s.status === 'pending' || s.status === 'active') ?? null;
  }
  
  async getSparksForStep(stepId: string): Promise<Spark[]> {
    const sparks = await this.getAllSparks();
    return sparks.filter(s => s.stepId === stepId);
  }
  
  private async getQuestStepIds(questId: string): Promise<string[]> {
    const data = await this.store.get(questStepsKey(questId));
    return data ? JSON.parse(data) : [];
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // SPARK OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  async createSpark(userId: string, spark: Omit<Spark, 'id' | 'status' | 'createdAt' | 'expiresAt'> & { userId?: string }): Promise<Spark> {
    const id = generateId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SPARK_EXPIRY_HOURS * 60 * 60 * 1000);
    
    const fullSpark: Spark = {
      ...spark,
      id,
      userId: spark.userId ?? userId,  // Use passed userId or fall back to parameter
      status: 'suggested',
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };
    
    // Save spark
    await this.store.set(sparkKey(id), JSON.stringify(fullSpark), SPARK_TTL);
    
    // Add to user's sparks list
    const userSparks = await this.getUserSparkIds(userId);
    userSparks.push(id);
    await this.store.set(userSparksKey(userId), JSON.stringify(userSparks), SPARK_TTL);
    
    return fullSpark;
  }
  
  async getSpark(id: string): Promise<Spark | null> {
    const data = await this.store.get(sparkKey(id));
    return data ? JSON.parse(data) : null;
  }
  
  async updateSpark(id: string, updates: Partial<Spark>): Promise<Spark | null> {
    const spark = await this.getSpark(id);
    if (!spark) return null;
    
    const updated: Spark = {
      ...spark,
      ...updates,
      id: spark.id,
      userId: spark.userId,
    };
    
    await this.store.set(sparkKey(id), JSON.stringify(updated), SPARK_TTL);
    return updated;
  }
  
  async deleteSpark(id: string): Promise<boolean> {
    const spark = await this.getSpark(id);
    if (!spark) return false;
    
    // Remove from user's sparks list
    const userSparks = await this.getUserSparkIds(spark.userId);
    const index = userSparks.indexOf(id);
    if (index > -1) {
      userSparks.splice(index, 1);
      await this.store.set(userSparksKey(spark.userId), JSON.stringify(userSparks), SPARK_TTL);
    }
    
    // Delete the spark
    await this.store.delete(sparkKey(id));
    return true;
  }
  
  /**
   * Transition spark state using either string event type or full event object.
   */
  async transitionSparkState(
    id: string, 
    eventOrType: SparkEvent | SparkEventType | string,
    payload?: Record<string, unknown>
  ): Promise<TransitionResult<Spark> | null> {
    const spark = await this.getSpark(id);
    if (!spark) return null;
    
    // Convert string to event object if needed
    const event = typeof eventOrType === 'string' 
      ? toSparkEvent(eventOrType.toUpperCase() as SparkEventType, payload)
      : eventOrType;
    
    const result = transitionSpark(spark, event, payload);
    
    if (result.success) {
      await this.store.set(sparkKey(id), JSON.stringify(result.entity), SPARK_TTL);
      await this.processSideEffects(result.sideEffects ?? []);
    }
    
    return result;
  }
  
  async getUserSparks(userId: string, limit = 100): Promise<Spark[]> {
    const ids = await this.getUserSparkIds(userId);
    const sparks: Spark[] = [];
    
    for (const id of ids.slice(-limit)) {
      const spark = await this.getSpark(id);
      if (spark) sparks.push(spark);
    }
    
    return sparks.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }
  
  async getSparksByStatus(userId: string, status: SparkStatus): Promise<Spark[]> {
    const sparks = await this.getUserSparks(userId);
    return sparks.filter(s => s.status === status);
  }
  
  async getActiveSpark(userId: string): Promise<Spark | null> {
    const sparks = await this.getUserSparks(userId);
    return sparks.find(s => 
      s.status === 'suggested' || s.status === 'accepted'
    ) ?? null;
  }
  
  private async getUserSparkIds(userId: string): Promise<string[]> {
    const data = await this.store.get(userSparksKey(userId));
    return data ? JSON.parse(data) : [];
  }
  
  private async getAllSparks(): Promise<Spark[]> {
    // This is inefficient but works for now
    // In production, would use a proper index
    const sparks: Spark[] = [];
    // Note: KeyValueStore doesn't have a keys() method in the interface
    // This is a placeholder - real implementation would need store enhancement
    return sparks;
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // PATH OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  async getPath(goalId: string, userId?: string): Promise<Path | null> {
    const goal = await this.getGoal(goalId);
    if (!goal) return null;
    
    // Verify ownership if userId provided
    if (userId && goal.userId !== userId) return null;
    
    const quests = await this.getQuestsForGoal(goalId);
    const completedQuests = quests.filter(q => q.status === 'completed').length;
    const overallProgress = goal.progress;
    
    // Find current quest and step
    const activeQuest = quests.find(q => q.status === 'active');
    let currentStep: Step | null = null;
    let activeSpark: Spark | null = null;
    
    if (activeQuest) {
      const steps = await this.getStepsForQuest(activeQuest.id);
      currentStep = steps.find(s => s.status === 'active' || s.status === 'pending') ?? null;
      
      if (currentStep?.lastSparkId) {
        activeSpark = await this.getSpark(currentStep.lastSparkId);
      }
    }
    
    // Calculate blockers
    const blockers: PathBlocker[] = [];
    for (const quest of quests) {
      if (quest.status === 'blocked') {
        blockers.push({
          type: 'quest_dependency',
          description: quest.riskNotes ?? 'Quest is blocked',
          questId: quest.id,
        });
      }
    }
    
    // Calculate timeline
    let estimatedCompletionDate: string | undefined;
    let daysRemaining: number | undefined;
    
    if (goal.targetDate) {
      estimatedCompletionDate = goal.targetDate;
      const target = new Date(goal.targetDate);
      const now = new Date();
      daysRemaining = Math.ceil((target.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    }
    
    return {
      goalId,
      currentQuestId: activeQuest?.id,
      currentStepId: currentStep?.id,
      completedQuests,
      totalQuests: quests.length,
      overallProgress,
      nextStep: currentStep ?? undefined,
      activeSpark: activeSpark ?? undefined,
      blockers,
      estimatedCompletionDate,
      daysRemaining,
      onTrack: blockers.length === 0 && (daysRemaining === undefined || overallProgress >= (100 - daysRemaining)),
    };
  }
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // SIDE EFFECTS
  // ═══════════════════════════════════════════════════════════════════════════════
  
  private async processSideEffects(effects: SideEffect[]): Promise<void> {
    for (const effect of effects) {
      switch (effect.type) {
        case 'update_progress':
          if (effect.target === 'goal') {
            await this.recalculateGoalProgress(effect.targetId);
          } else if (effect.target === 'quest') {
            await this.recalculateQuestProgress(effect.targetId);
          }
          break;
          
        case 'cascade_complete':
          if (effect.target === 'step') {
            await this.transitionStepState(effect.targetId, { type: 'COMPLETE' });
          }
          break;
          
        // Other effects can be added as needed
      }
    }
  }
  
  private async recalculateGoalProgress(goalId: string): Promise<void> {
    const quests = await this.getQuestsForGoal(goalId);
    if (quests.length === 0) return;
    
    const totalProgress = quests.reduce((sum, q) => sum + q.progress, 0);
    const avgProgress = Math.round(totalProgress / quests.length);
    
    await this.updateGoal(goalId, { progress: avgProgress });
    
    // Check for auto-complete
    if (avgProgress === 100) {
      const goal = await this.getGoal(goalId);
      if (goal && goal.status === 'active') {
        await this.transitionGoalState(goalId, { type: 'COMPLETE' });
      }
    }
  }
  
  private async recalculateQuestProgress(questId: string): Promise<void> {
    const steps = await this.getStepsForQuest(questId);
    if (steps.length === 0) return;
    
    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const progress = Math.round((completedSteps / steps.length) * 100);
    
    await this.updateQuest(questId, { progress });
    
    // Check for auto-complete
    if (progress === 100) {
      const quest = await this.getQuest(questId);
      if (quest && quest.status === 'active') {
        await this.transitionQuestState(questId, { type: 'COMPLETE' });
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let swordStore: SwordStore | null = null;

export function getSwordStore(): SwordStore {
  if (!swordStore) {
    swordStore = new SwordStore();
  }
  return swordStore;
}

export function resetSwordStore(): void {
  swordStore = null;
}
