// ═══════════════════════════════════════════════════════════════════════════════
// ASSESS FLOW HANDLER
// Generates diagnostic test, scores results, and routes accordingly
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../../../../db/index.js';
import type { PlanSubskill, LessonPlan } from '../../types.js';
import { mapPlanSubskill } from '../../types.js';
import type {
  StartSubskillResult,
  SubskillAssessment,
  AssessmentResult,
  AssessmentRecommendation,
  DiagnosticQuestion,
  UserAnswer,
  AreaResult,
  Gap,
} from '../types.js';
import { mapSubskillAssessment } from '../types.js';
import { generateLessonPlan } from '../lesson-plan/generator.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ASSESS FLOW
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Handle assess flow - generate diagnostic test
 */
export async function handleAssessFlow(
  userId: string,
  subskill: PlanSubskill,
  plan: LessonPlan
): Promise<StartSubskillResult> {
  const supabase = getSupabase();
  
  console.log(`[ASSESS] Starting assessment for: ${subskill.title}`);
  
  // Check for existing incomplete assessment
  const { data: existingRow } = await supabase
    .from('subskill_assessments')
    .select('*')
    .eq('subskill_id', subskill.id)
    .eq('user_id', userId)
    .is('completed_at', null)
    .single();
  
  if (existingRow) {
    console.log(`[ASSESS] Found existing assessment`);
    return {
      routeType: 'assess',
      subskill,
      assessment: mapSubskillAssessment(existingRow),
    };
  }
  
  // Generate diagnostic test
  const questions = await generateDiagnosticTest(subskill, plan);
  
  // Create assessment record
  const { data: assessmentRow, error } = await supabase
    .from('subskill_assessments')
    .insert({
      subskill_id: subskill.id,
      user_id: userId,
      questions,
    })
    .select()
    .single();
  
  if (error || !assessmentRow) {
    throw new Error(`Failed to create assessment: ${error?.message}`);
  }
  
  const assessment = mapSubskillAssessment(assessmentRow);
  
  return {
    routeType: 'assess',
    subskill,
    assessment,
  };
}

/**
 * Submit assessment answers and get result
 */
export async function submitAssessment(
  userId: string,
  assessmentId: string,
  answers: UserAnswer[]
): Promise<AssessmentResult> {
  const supabase = getSupabase();
  
  // Get assessment
  const { data: row, error } = await supabase
    .from('subskill_assessments')
    .select('*')
    .eq('id', assessmentId)
    .eq('user_id', userId)
    .single();
  
  if (error || !row) {
    throw new Error(`Assessment not found: ${assessmentId}`);
  }
  
  const assessment = mapSubskillAssessment(row);
  
  // Score the assessment
  const { score, areaResults, gaps, strengths } = scoreAssessment(
    assessment.questions,
    answers
  );
  
  // Determine recommendation
  const recommendation = getRecommendation(score);
  
  console.log(`[ASSESS] Score: ${score}%, Recommendation: ${recommendation}`);
  
  // Update assessment with results
  const { data: updatedRow } = await supabase
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
  
  const completedAssessment = mapSubskillAssessment(updatedRow);
  
  // Get subskill and plan
  const { data: subskillRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('id', assessment.subskillId)
    .single();
  
  const subskill = mapPlanSubskill(subskillRow);
  
  const { data: planRow } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('id', subskill.planId)
    .single();
  
  // Handle based on recommendation
  return handleAssessmentResult(
    userId,
    completedAssessment,
    subskill,
    planRow,
    recommendation,
    gaps
  );
}

/**
 * Handle assessment result based on score
 */
async function handleAssessmentResult(
  userId: string,
  assessment: SubskillAssessment,
  subskill: PlanSubskill,
  plan: any,
  recommendation: AssessmentRecommendation,
  gaps: Gap[]
): Promise<AssessmentResult> {
  const supabase = getSupabase();
  
  switch (recommendation) {
    case 'autopass': {
      // 90-100%: Mark as mastered, advance to next
      console.log(`[ASSESS] Autopass - marking as mastered`);
      
      await supabase
        .from('plan_subskills')
        .update({
          status: 'mastered',
          mastered_at: new Date().toISOString(),
          assessment_score: assessment.score,
          assessment_data: { assessmentId: assessment.id },
          assessed_at: new Date().toISOString(),
        })
        .eq('id', subskill.id);
      
      // Get next subskill
      const nextSubskill = await getNextSubskill(plan.id, subskill.order);
      
      if (nextSubskill) {
        await supabase
          .from('plan_subskills')
          .update({ status: 'active' })
          .eq('id', nextSubskill.id);
        
        await supabase
          .from('lesson_plans')
          .update({ current_subskill_id: nextSubskill.id })
          .eq('id', plan.id);
      }
      
      await updatePlanProgress(plan.id);
      
      return {
        assessment,
        recommendation,
        nextAction: 'autopass',
        nextSubskill: nextSubskill || undefined,
      };
    }
    
    case 'targeted': {
      // 40-89%: Generate targeted remediation plan
      console.log(`[ASSESS] Targeted remediation - generating plan for gaps`);
      
      // Update subskill status
      await supabase
        .from('plan_subskills')
        .update({
          status: 'active',
          assessment_score: assessment.score,
          assessment_data: { assessmentId: assessment.id, gaps },
          assessed_at: new Date().toISOString(),
        })
        .eq('id', subskill.id);
      
      // Generate targeted lesson plan
      const lessonPlan = await generateLessonPlan(
        userId,
        subskill,
        plan,
        true, // isRemediation
        assessment.id,
        gaps
      );
      
      return {
        assessment,
        recommendation,
        nextAction: 'start_remediation',
        lessonPlan,
      };
    }
    
    case 'convert_learn': {
      // 0-39%: Convert to full learn flow
      console.log(`[ASSESS] Converting to learn flow`);
      
      // Update subskill to active (full learn)
      await supabase
        .from('plan_subskills')
        .update({
          status: 'active',
          assessment_score: assessment.score,
          assessment_data: { assessmentId: assessment.id, convertedFromAssess: true },
          assessed_at: new Date().toISOString(),
        })
        .eq('id', subskill.id);
      
      // Generate normal lesson plan (not remediation)
      const lessonPlan = await generateLessonPlan(
        userId,
        subskill,
        plan,
        false // not remediation
      );
      
      return {
        assessment,
        recommendation,
        nextAction: 'start_learning',
        lessonPlan,
      };
    }
    
    default:
      throw new Error(`Unknown recommendation: ${recommendation}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// DIAGNOSTIC TEST GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate diagnostic test questions for a subskill
 */
async function generateDiagnosticTest(
  subskill: PlanSubskill,
  plan: LessonPlan
): Promise<DiagnosticQuestion[]> {
  // TODO: Implement LLM generation
  // For now, generate template questions based on route
  
  console.log(`[ASSESS] Generating diagnostic for: ${subskill.title}`);
  
  const questions = generateTemplateDiagnostic(subskill);
  
  return questions;
}

/**
 * Generate template diagnostic when LLM unavailable
 */
function generateTemplateDiagnostic(subskill: PlanSubskill): DiagnosticQuestion[] {
  const baseQuestions: DiagnosticQuestion[] = [
    {
      id: 'q1',
      area: 'Core Concepts',
      question: `What is the main purpose of ${subskill.title}?`,
      type: 'multiple_choice',
      options: [
        'To provide foundational understanding',
        'To enable practical application',
        'To support advanced techniques',
        'None of the above',
      ],
      correctAnswer: 'To provide foundational understanding',
      explanation: 'Understanding the core purpose helps frame all other learning.',
      difficulty: 1,
    },
    {
      id: 'q2',
      area: 'Core Concepts',
      question: `Which of the following is NOT typically associated with ${subskill.title}?`,
      type: 'multiple_choice',
      options: [
        'Fundamental principles',
        'Practical techniques',
        'Unrelated domain knowledge',
        'Supporting skills',
      ],
      correctAnswer: 'Unrelated domain knowledge',
      explanation: 'Identifying what is not related helps clarify boundaries.',
      difficulty: 1,
    },
    {
      id: 'q3',
      area: 'Application',
      question: `In what scenario would ${subskill.title} be most useful?`,
      type: 'multiple_choice',
      options: [
        'When starting a new project',
        'When debugging issues',
        'When optimizing performance',
        'All of the above',
      ],
      correctAnswer: 'All of the above',
      explanation: 'This skill applies across multiple scenarios.',
      difficulty: 2,
    },
    {
      id: 'q4',
      area: 'Application',
      question: `What is a common mistake when applying ${subskill.title}?`,
      type: 'multiple_choice',
      options: [
        'Moving too quickly',
        'Skipping fundamentals',
        'Over-engineering solutions',
        'All of the above',
      ],
      correctAnswer: 'All of the above',
      explanation: 'These are common pitfalls to avoid.',
      difficulty: 2,
    },
    {
      id: 'q5',
      area: 'Integration',
      question: `How does ${subskill.title} relate to the overall learning goal?`,
      type: 'multiple_choice',
      options: [
        'It is a prerequisite skill',
        'It is a supporting skill',
        'It is a core skill',
        'It depends on the context',
      ],
      correctAnswer: 'It depends on the context',
      explanation: 'The relationship varies based on your specific goals.',
      difficulty: 3,
    },
  ];
  
  // Add route-specific questions
  const routeQuestions = getRouteSpecificQuestions(subskill);
  
  return [...baseQuestions, ...routeQuestions];
}

/**
 * Get route-specific diagnostic questions
 */
function getRouteSpecificQuestions(subskill: PlanSubskill): DiagnosticQuestion[] {
  switch (subskill.route) {
    case 'recall':
      return [
        {
          id: 'r1',
          area: 'Knowledge Recall',
          question: 'Can you define the key terminology without looking it up?',
          type: 'true_false',
          correctAnswer: 'true',
          explanation: 'Recall requires being able to retrieve information from memory.',
          difficulty: 2,
        },
      ];
    
    case 'practice':
      return [
        {
          id: 'r1',
          area: 'Procedural Knowledge',
          question: 'Have you successfully completed this type of task before?',
          type: 'true_false',
          correctAnswer: 'true',
          explanation: 'Practice builds on previous experience.',
          difficulty: 2,
        },
      ];
    
    case 'diagnose':
      return [
        {
          id: 'r1',
          area: 'Pattern Recognition',
          question: 'Can you identify common errors in this domain?',
          type: 'true_false',
          correctAnswer: 'true',
          explanation: 'Diagnosis requires recognizing patterns.',
          difficulty: 2,
        },
      ];
    
    case 'build':
      return [
        {
          id: 'r1',
          area: 'Creation Skills',
          question: 'Have you built something similar before?',
          type: 'true_false',
          correctAnswer: 'true',
          explanation: 'Building requires synthesis of multiple skills.',
          difficulty: 3,
        },
      ];
    
    default:
      return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Score assessment answers
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
  // Map answers by question ID
  const answerMap = new Map(answers.map(a => [a.questionId, a]));
  
  // Group by area
  const areaScores = new Map<string, { correct: number; total: number }>();
  
  let totalCorrect = 0;
  
  for (const question of questions) {
    const area = question.area;
    
    if (!areaScores.has(area)) {
      areaScores.set(area, { correct: 0, total: 0 });
    }
    
    const areaScore = areaScores.get(area)!;
    areaScore.total++;
    
    const userAnswer = answerMap.get(question.id);
    const isCorrect = checkAnswer(question, userAnswer);
    
    if (isCorrect) {
      areaScore.correct++;
      totalCorrect++;
    }
  }
  
  // Calculate overall score
  const score = Math.round((totalCorrect / questions.length) * 100);
  
  // Build area results
  const areaResults: AreaResult[] = [];
  const gaps: Gap[] = [];
  const strengths: string[] = [];
  
  for (const [area, scores] of areaScores) {
    const areaScore = Math.round((scores.correct / scores.total) * 100);
    
    let status: AreaResult['status'];
    if (areaScore >= 70) {
      status = 'strong';
      strengths.push(area);
    } else if (areaScore >= 40) {
      status = 'weak';
    } else {
      status = 'gap';
    }
    
    areaResults.push({
      area,
      questionsTotal: scores.total,
      questionsCorrect: scores.correct,
      score: areaScore,
      status,
    });
    
    if (status === 'gap' || status === 'weak') {
      gaps.push({
        area,
        score: areaScore,
        priority: status === 'gap' ? 'high' : 'medium',
        suggestedFocus: `Review and practice ${area.toLowerCase()}`,
      });
    }
  }
  
  // Sort gaps by priority
  gaps.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
  
  return { score, areaResults, gaps, strengths };
}

/**
 * Check if answer is correct
 */
function checkAnswer(question: DiagnosticQuestion, answer?: UserAnswer): boolean {
  if (!answer) return false;
  
  const correct = question.correctAnswer;
  const given = answer.answer;
  
  if (Array.isArray(correct)) {
    if (!Array.isArray(given)) return false;
    return correct.length === given.length &&
      correct.every((c, i) => c.toLowerCase() === given[i]?.toLowerCase());
  }
  
  if (typeof given === 'string') {
    return correct.toLowerCase() === given.toLowerCase();
  }
  
  return false;
}

/**
 * Get recommendation based on score
 */
function getRecommendation(score: number): AssessmentRecommendation {
  if (score >= 90) return 'autopass';
  if (score >= 40) return 'targeted';
  return 'convert_learn';
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

async function getNextSubskill(
  planId: string,
  currentOrder: number
): Promise<PlanSubskill | null> {
  const supabase = getSupabase();
  
  const { data: row } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('plan_id', planId)
    .in('status', ['pending', 'assess'])
    .gt('order', currentOrder)
    .order('order', { ascending: true })
    .limit(1)
    .single();
  
  return row ? mapPlanSubskill(row) : null;
}

async function updatePlanProgress(planId: string): Promise<void> {
  const supabase = getSupabase();
  
  const { count: total } = await supabase
    .from('plan_subskills')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', planId);
  
  const { count: completed } = await supabase
    .from('plan_subskills')
    .select('*', { count: 'exact', head: true })
    .eq('plan_id', planId)
    .in('status', ['mastered', 'skipped']);
  
  const progress = total && total > 0 ? (completed || 0) / total : 0;
  
  await supabase
    .from('lesson_plans')
    .update({ progress })
    .eq('id', planId);
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const AssessmentHandler = {
  handle: handleAssessFlow,
  submit: submitAssessment,
  generateTest: generateDiagnosticTest,
  score: scoreAssessment,
};
