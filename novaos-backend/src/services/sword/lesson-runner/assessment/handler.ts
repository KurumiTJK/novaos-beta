// ═══════════════════════════════════════════════════════════════════════════════
// ASSESSMENT HANDLER — LLM-Powered Diagnostic Tests
// For subskills with routeStatus='assess' - determines if user can skip or needs to learn
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../../../../db/index.js';
import { SwordGateLLM } from '../llm/swordgate-llm.js';
import type { PlanSubskill, LessonPlan } from '../../types.js';
import { mapPlanSubskill, mapLessonPlan } from '../../types.js';
import type {
  SubskillAssessment,
  DiagnosticQuestion,
  UserAnswer,
  AreaResult,
  Gap,
  AssessmentRecommendation,
  AssessmentResult,
} from '../types.js';
import { mapSubskillAssessment } from '../types.js';
import {
  DIAGNOSTIC_SYSTEM_PROMPT,
  buildDiagnosticUserMessage,
  parseLLMJson,
} from '../shared/prompts.js';
import { generateLessonPlan } from '../lesson-plan/generator.js';

// ─────────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────────

const AUTOPASS_THRESHOLD = 85;    // >= 85% → skip this subskill
const TARGETED_THRESHOLD = 50;    // >= 50% → targeted remediation on gaps
// < 50% → full learning (convert to learn)

const AREA_STRONG_THRESHOLD = 80;  // >= 80% in area → strong
const AREA_WEAK_THRESHOLD = 50;    // >= 50% in area → weak
// < 50% → gap

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface DiagnosticLLMResponse {
  questions: DiagnosticQuestion[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASSESSMENT MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get or create diagnostic assessment for a subskill
 * Called when user starts a subskill with routeStatus='assess'
 */
export async function getOrCreateAssessment(
  userId: string,
  subskillId: string
): Promise<SubskillAssessment> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  const internalUserId = user.id;
  
  // Check for existing incomplete assessment
  const { data: existingRow } = await supabase
    .from('subskill_assessments')
    .select('*')
    .eq('subskill_id', subskillId)
    .eq('user_id', internalUserId)
    .is('completed_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .single();
  
  if (existingRow) {
    console.log(`[ASSESS] Found existing incomplete assessment`);
    return mapSubskillAssessment(existingRow);
  }
  
  // Check for completed assessment (already done)
  const { data: completedRow } = await supabase
    .from('subskill_assessments')
    .select('*')
    .eq('subskill_id', subskillId)
    .eq('user_id', internalUserId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();
  
  if (completedRow) {
    console.log(`[ASSESS] Found completed assessment, score: ${completedRow.score}%`);
    return mapSubskillAssessment(completedRow);
  }
  
  // Generate new assessment
  console.log(`[ASSESS] Generating new diagnostic assessment`);
  return generateAssessment(userId, internalUserId, subskillId);
}

/**
 * Generate a new diagnostic assessment using LLM
 */
async function generateAssessment(
  externalUserId: string,
  internalUserId: string,
  subskillId: string
): Promise<SubskillAssessment> {
  const supabase = getSupabase();
  
  // Load subskill and plan
  const { data: subskillRow } = await supabase
    .from('plan_subskills')
    .select('*, lesson_plans(*)')
    .eq('id', subskillId)
    .single();
  
  if (!subskillRow) throw new Error('Subskill not found');
  
  const subskill = mapPlanSubskill(subskillRow);
  const plan = mapLessonPlan(subskillRow.lesson_plans);
  
  // Generate questions via LLM
  const response = await SwordGateLLM.generate(
    DIAGNOSTIC_SYSTEM_PROMPT,
    buildDiagnosticUserMessage(subskill, plan),
    { thinkingLevel: 'high' }
  );
  
  let questions: DiagnosticQuestion[];
  try {
    const parsed = parseLLMJson<DiagnosticLLMResponse>(response);
    questions = parsed.questions || [];
    
    // Ensure all questions have required fields
    questions = questions.map((q, i) => ({
      id: q.id || `q${i + 1}`,
      area: q.area || 'General',
      question: q.question,
      type: q.type || 'multiple_choice',
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || '',
      difficulty: q.difficulty || 2,
    }));
    
    console.log(`[ASSESS] Generated ${questions.length} diagnostic questions`);
  } catch (e) {
    console.error('[ASSESS] Failed to parse LLM response, using fallback');
    questions = generateFallbackQuestions(subskill);
  }
  
  // Insert into database
  const { data: row, error } = await supabase
    .from('subskill_assessments')
    .insert({
      subskill_id: subskillId,
      user_id: internalUserId,
      questions,
      started_at: new Date().toISOString(),
    })
    .select()
    .single();
  
  if (error) throw new Error(`Failed to create assessment: ${error.message}`);
  
  return mapSubskillAssessment(row);
}

/**
 * Fallback questions when LLM fails
 */
function generateFallbackQuestions(subskill: PlanSubskill): DiagnosticQuestion[] {
  return [
    {
      id: 'q1',
      area: 'General Understanding',
      question: `What is the primary purpose of "${subskill.title}"?`,
      type: 'multiple_choice',
      options: [
        'Understanding the core concepts',
        'Implementing practical solutions',
        'Analyzing complex scenarios',
        'All of the above',
      ],
      correctAnswer: 'All of the above',
      explanation: 'This topic covers multiple aspects of learning.',
      difficulty: 1,
    },
    {
      id: 'q2',
      area: 'General Understanding',
      question: `How would you rate your familiarity with "${subskill.title}"?`,
      type: 'multiple_choice',
      options: [
        'Complete beginner - never encountered this',
        'Some exposure - heard of it but not practiced',
        'Intermediate - have worked with it before',
        'Advanced - confident in this area',
      ],
      correctAnswer: 'Intermediate - have worked with it before',
      explanation: 'Self-assessment helps calibrate the learning path.',
      difficulty: 1,
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────────
// SUBMIT AND SCORE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Submit answers and get scored results
 */
export async function submitAssessment(
  userId: string,
  assessmentId: string,
  answers: UserAnswer[]
): Promise<AssessmentResult> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  const internalUserId = user.id;
  
  // Load assessment
  const { data: assessmentRow } = await supabase
    .from('subskill_assessments')
    .select('*')
    .eq('id', assessmentId)
    .eq('user_id', internalUserId)
    .single();
  
  if (!assessmentRow) throw new Error('Assessment not found');
  if (assessmentRow.completed_at) {
    // Already completed - return existing results
    return buildAssessmentResult(mapSubskillAssessment(assessmentRow));
  }
  
  const assessment = mapSubskillAssessment(assessmentRow);
  
  // Score the assessment
  const { score, areaResults, gaps, strengths } = scoreAssessment(
    assessment.questions,
    answers
  );
  
  // Determine recommendation
  const recommendation = determineRecommendation(score);
  
  console.log(`[ASSESS] Score: ${score}%, Recommendation: ${recommendation}`);
  console.log(`[ASSESS] Areas - Strong: ${strengths.length}, Gaps: ${gaps.length}`);
  
  // Update assessment in database
  const { data: updatedRow, error } = await supabase
    .from('subskill_assessments')
    .update({
      answers,
      score,
      area_results: areaResults,
      gaps,
      strengths,
      recommendation,
      completed_at: new Date().toISOString(),
    })
    .eq('id', assessmentId)
    .select()
    .single();
  
  if (error) throw new Error(`Failed to update assessment: ${error.message}`);
  
  const completedAssessment = mapSubskillAssessment(updatedRow);
  
  // Update subskill with assessment data
  await supabase
    .from('plan_subskills')
    .update({
      assessment_score: score,
      assessment_data: { areaResults, gaps, strengths, recommendation },
      assessed_at: new Date().toISOString(),
    })
    .eq('id', assessment.subskillId);
  
  return buildAssessmentResult(completedAssessment);
}

/**
 * Score the assessment
 */
function scoreAssessment(
  questions: DiagnosticQuestion[],
  answers: UserAnswer[]
): {
  score: number;
  areaResults: AreaResult[];
  gaps: Gap[];
  strengths: string[];
} {
  // Create answer map
  const answerMap = new Map(answers.map(a => [a.questionId, a.answer]));
  
  // Score each question and group by area
  const areaScores = new Map<string, { correct: number; total: number; questions: DiagnosticQuestion[] }>();
  
  for (const question of questions) {
    const area = question.area || 'General';
    if (!areaScores.has(area)) {
      areaScores.set(area, { correct: 0, total: 0, questions: [] });
    }
    
    const areaData = areaScores.get(area)!;
    areaData.total++;
    areaData.questions.push(question);
    
    const userAnswer = answerMap.get(question.id);
    if (userAnswer && normalizeAnswer(userAnswer) === normalizeAnswer(question.correctAnswer)) {
      areaData.correct++;
    }
  }
  
  // Calculate overall score
  const totalCorrect = Array.from(areaScores.values()).reduce((sum, a) => sum + a.correct, 0);
  const totalQuestions = questions.length;
  const score = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;
  
  // Calculate per-area results
  const areaResults: AreaResult[] = [];
  const gaps: Gap[] = [];
  const strengths: string[] = [];
  
  for (const [area, data] of areaScores) {
    const areaScore = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    
    let status: 'strong' | 'weak' | 'gap';
    if (areaScore >= AREA_STRONG_THRESHOLD) {
      status = 'strong';
      strengths.push(area);
    } else if (areaScore >= AREA_WEAK_THRESHOLD) {
      status = 'weak';
      gaps.push({
        area,
        score: areaScore,
        status: 'weak',
        missedConcepts: getMissedConcepts(data.questions, answerMap),
      });
    } else {
      status = 'gap';
      gaps.push({
        area,
        score: areaScore,
        status: 'gap',
        missedConcepts: getMissedConcepts(data.questions, answerMap),
      });
    }
    
    areaResults.push({
      area,
      questionsTotal: data.total,
      questionsCorrect: data.correct,
      score: areaScore,
      status,
    });
  }
  
  return { score, areaResults, gaps, strengths };
}

/**
 * Get missed concepts for an area
 */
function getMissedConcepts(
  questions: DiagnosticQuestion[],
  answerMap: Map<string, string>
): string[] {
  const missed: string[] = [];
  
  for (const q of questions) {
    const userAnswer = answerMap.get(q.id);
    if (!userAnswer || normalizeAnswer(userAnswer) !== normalizeAnswer(q.correctAnswer)) {
      // Extract concept from question (simplified)
      missed.push(q.question.slice(0, 100));
    }
  }
  
  return missed;
}

/**
 * Normalize answer for comparison
 */
function normalizeAnswer(answer: string): string {
  return answer.toLowerCase().trim();
}

/**
 * Determine recommendation based on score
 */
function determineRecommendation(score: number): AssessmentRecommendation {
  if (score >= AUTOPASS_THRESHOLD) {
    return 'autopass';
  } else if (score >= TARGETED_THRESHOLD) {
    return 'targeted';
  } else {
    return 'convert_learn';
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESULT HANDLING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Build assessment result with next action
 */
async function buildAssessmentResult(
  assessment: SubskillAssessment
): Promise<AssessmentResult> {
  const recommendation = assessment.recommendation || 'convert_learn';
  
  let nextAction: 'autopass' | 'start_remediation' | 'start_learning';
  
  switch (recommendation) {
    case 'autopass':
      nextAction = 'autopass';
      break;
    case 'targeted':
      nextAction = 'start_remediation';
      break;
    case 'convert_learn':
    default:
      nextAction = 'start_learning';
      break;
  }
  
  return {
    assessment,
    recommendation,
    nextAction,
  };
}

/**
 * Execute the next action based on assessment result
 * Called after user confirms they want to proceed
 */
export async function executeAssessmentAction(
  userId: string,
  assessmentId: string
): Promise<{
  action: 'skipped' | 'remediation_started' | 'learning_started';
  subskill: PlanSubskill;
  lessonPlan?: any;
  nextSubskill?: PlanSubskill;
}> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  const internalUserId = user.id;
  
  // Load assessment
  const { data: assessmentRow } = await supabase
    .from('subskill_assessments')
    .select('*')
    .eq('id', assessmentId)
    .eq('user_id', internalUserId)
    .single();
  
  if (!assessmentRow) throw new Error('Assessment not found');
  if (!assessmentRow.completed_at) throw new Error('Assessment not completed');
  
  const assessment = mapSubskillAssessment(assessmentRow);
  const recommendation = assessment.recommendation || 'convert_learn';
  
  // Load subskill
  const { data: subskillRow } = await supabase
    .from('plan_subskills')
    .select('*, lesson_plans(*)')
    .eq('id', assessment.subskillId)
    .single();
  
  if (!subskillRow) throw new Error('Subskill not found');
  
  const subskill = mapPlanSubskill(subskillRow);
  const plan = mapLessonPlan(subskillRow.lesson_plans);
  
  switch (recommendation) {
    case 'autopass': {
      // Mark subskill as complete and move to next
      await supabase
        .from('plan_subskills')
        .update({
          status: 'completed',
          route_status: 'skip',
          mastered_at: new Date().toISOString(),
        })
        .eq('id', subskill.id);
      
      // Find next subskill
      const nextSubskill = await getNextSubskill(plan.id, subskill.order);
      
      console.log(`[ASSESS] Autopass - skipping to next subskill`);
      
      return {
        action: 'skipped',
        subskill,
        nextSubskill,
      };
    }
    
    case 'targeted': {
      // Generate remediation lesson plan focused on gaps
      const gaps = assessment.gaps || [];
      
      console.log(`[ASSESS] Starting targeted remediation for ${gaps.length} gaps`);
      
      // Update subskill status
      await supabase
        .from('plan_subskills')
        .update({
          status: 'active',
          route_status: 'learn', // Convert to learn but with remediation
        })
        .eq('id', subskill.id);
      
      // Generate remediation plan
      const lessonPlan = await generateLessonPlan(
        userId,
        subskill,
        plan,
        true,           // isRemediation
        assessmentId,   // assessmentId
        gaps            // gaps to focus on
      );
      
      return {
        action: 'remediation_started',
        subskill,
        lessonPlan,
      };
    }
    
    case 'convert_learn':
    default: {
      // Generate full lesson plan
      console.log(`[ASSESS] Converting to full learning path`);
      
      // Update subskill status
      await supabase
        .from('plan_subskills')
        .update({
          status: 'active',
          route_status: 'learn',
        })
        .eq('id', subskill.id);
      
      // Generate full lesson plan
      const lessonPlan = await generateLessonPlan(
        userId,
        subskill,
        plan,
        false  // Not remediation - full plan
      );
      
      return {
        action: 'learning_started',
        subskill,
        lessonPlan,
      };
    }
  }
}

/**
 * Get next subskill in sequence
 */
async function getNextSubskill(
  planId: string,
  currentOrder: number
): Promise<PlanSubskill | undefined> {
  const supabase = getSupabase();
  
  const { data: nextRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('plan_id', planId)
    .gt('order', currentOrder)
    .order('order', { ascending: true })
    .limit(1)
    .single();
  
  if (!nextRow) return undefined;
  
  return mapPlanSubskill(nextRow);
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get assessment for display (strips correct answers)
 */
export function getAssessmentForUser(assessment: SubskillAssessment): {
  id: string;
  subskillId: string;
  questions: Array<{
    id: string;
    area: string;
    question: string;
    type: string;
    options: string[];
    difficulty: number;
  }>;
  isCompleted: boolean;
  score?: number;
  recommendation?: string;
} {
  return {
    id: assessment.id,
    subskillId: assessment.subskillId,
    questions: assessment.questions.map(q => ({
      id: q.id,
      area: q.area,
      question: q.question,
      type: q.type,
      options: q.options,
      difficulty: q.difficulty,
      // Note: correctAnswer and explanation are NOT included
    })),
    isCompleted: !!assessment.completedAt,
    score: assessment.score,
    recommendation: assessment.recommendation,
  };
}

/**
 * Get detailed results after completion
 */
export function getAssessmentResults(assessment: SubskillAssessment): {
  score: number;
  areaResults: AreaResult[];
  gaps: Gap[];
  strengths: string[];
  recommendation: AssessmentRecommendation;
  questionResults: Array<{
    id: string;
    question: string;
    userAnswer: string | undefined;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }>;
} {
  if (!assessment.completedAt) {
    throw new Error('Assessment not completed');
  }
  
  const answerMap = new Map(
    (assessment.answers || []).map(a => [a.questionId, a.answer])
  );
  
  const questionResults = assessment.questions.map(q => ({
    id: q.id,
    question: q.question,
    userAnswer: answerMap.get(q.id),
    correctAnswer: q.correctAnswer,
    isCorrect: normalizeAnswer(answerMap.get(q.id) || '') === normalizeAnswer(q.correctAnswer),
    explanation: q.explanation,
  }));
  
  return {
    score: assessment.score || 0,
    areaResults: assessment.areaResults || [],
    gaps: assessment.gaps || [],
    strengths: assessment.strengths || [],
    recommendation: assessment.recommendation || 'convert_learn',
    questionResults,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const AssessmentHandler = {
  getOrCreate: getOrCreateAssessment,
  submit: submitAssessment,
  executeAction: executeAssessmentAction,
  getForUser: getAssessmentForUser,
  getResults: getAssessmentResults,
};
