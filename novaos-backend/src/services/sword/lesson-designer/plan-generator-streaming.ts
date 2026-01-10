// ═══════════════════════════════════════════════════════════════════════════════
// PLAN GENERATOR STREAMING — Progress Events for Define Goal Phase
// ═══════════════════════════════════════════════════════════════════════════════

import { CapstoneGenerator } from './capstone.js';
import { SubskillsGenerator } from './subskills.js';
import { RoutingGenerator } from './routing.js';
import { LessonDesigner } from '../index.js';
import { updateSessionPhase } from './session.js';
import type { OnProgressCallback } from '../llm/streaming-utils.js';

export interface PlanGenerationResult {
  session: any;
  capstone: any;
  subskills: any[];
  routing: any;
  preview: any;
}

/**
 * Run full plan generation with progress callbacks
 */
export async function runDefineGoalPhaseStream(
  userId: string,
  onProgress: OnProgressCallback
): Promise<PlanGenerationResult> {
  const session = await LessonDesigner.getActiveSession(userId);
  if (!session) throw new Error('No active designer session');
  if (!session.explorationData) throw new Error('Exploration must be completed first');

  console.log('[PLAN_STREAM] Starting generation for session:', session.id);

  // Stage 1: Capstone (0-25%)
  onProgress('capstone', 'starting', 'Defining your learning goal...');
  const capstoneData = await CapstoneGenerator.generate(session);
  onProgress('capstone', 'complete', 'Learning goal defined!', { title: capstoneData.title });

  const sessionAfterCapstone = await LessonDesigner.getActiveSession(userId);
  if (!sessionAfterCapstone) throw new Error('Session lost after capstone');

  // Stage 2: Subskills (25-50%)
  onProgress('subskills', 'starting', 'Breaking down into subskills...');
  const subskillsData = await SubskillsGenerator.generate(sessionAfterCapstone);
  onProgress('subskills', 'complete', `Identified ${subskillsData.subskills.length} subskills`, {
    count: subskillsData.subskills.length,
    titles: subskillsData.subskills.map((s: any) => s.title),
  });

  const sessionAfterSubskills = await LessonDesigner.getActiveSession(userId);
  if (!sessionAfterSubskills) throw new Error('Session lost after subskills');

  // Stage 3: Routing (50-75%)
  onProgress('routing', 'starting', 'Assigning learning routes...');
  const routingData = await RoutingGenerator.generate(sessionAfterSubskills);
  onProgress('routing', 'complete', 'Routes assigned!', routingData);

  // Stage 4: Distribution (75-95%)
  onProgress('distribution', 'starting', 'Planning session distribution...');
  await updateSessionPhase(session.id, 'routing', routingData);
  onProgress('distribution', 'complete', 'Sessions planned!');

  // Stage 5: Review (95-100%)
  onProgress('review', 'starting', 'Preparing review...');
  const finalSession = await LessonDesigner.getActiveSession(userId);
  
  // Build preview - use complexity-based estimate instead of non-existent estimatedSessions
  const subskillsWithRouting = subskillsData.subskills.map((s: any, i: number) => {
    const assignment = routingData.assignments?.[i];
    // Estimate sessions based on complexity (1-3) -> (2-4 sessions)
    const complexity = s.estimatedComplexity || 2;
    const estimatedSessions = complexity + 1;
    return {
      ...s,
      route: assignment?.route || 'recall',
      status: assignment?.status || 'learn',
      estimatedSessions,
    };
  });

  const totalSessions = subskillsWithRouting.reduce((sum: number, s: any) => sum + s.estimatedSessions, 0);

  const preview = {
    capstone: capstoneData,
    subskills: subskillsWithRouting,
    totalSessions,
    estimatedDays: totalSessions,
  };

  onProgress('review', 'complete', 'Your learning plan is ready!', preview);

  console.log('[PLAN_STREAM] Generation complete');

  return {
    session: finalSession,
    capstone: capstoneData,
    subskills: subskillsData.subskills,
    routing: routingData,
    preview,
  };
}

export const PlanGeneratorStreaming = {
  run: runDefineGoalPhaseStream,
};
