// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE CHECK HANDLER — LLM-Powered
// Hard gate at end of each subskill - must pass 70% to advance
// ═══════════════════════════════════════════════════════════════════════════════

import { getSupabase } from '../../../../db/index.js';
import { SwordGateLLM } from '../../llm/swordgate-llm.js';
import type { PlanSubskill, LessonPlan } from '../../types.js';
import { mapPlanSubskill, mapLessonPlan } from '../../types.js';
import type {
  KnowledgeCheck,
  KnowledgeCheckQuestion,
  KnowledgeCheckResult,
  UserAnswer,
  MissedQuestion,
  SessionSummary,
} from '../types.js';
import { mapKnowledgeCheck, mapSessionSummary } from '../types.js';
import {
  KNOWLEDGE_CHECK_SYSTEM_PROMPT,
  buildKnowledgeCheckUserMessage,
  buildFullContext,
  parseLLMJson,
} from '../shared/prompts.js';

const PASS_THRESHOLD = 70;

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

interface KnowledgeCheckLLMResponse {
  questions: KnowledgeCheckQuestion[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// KNOWLEDGE CHECK MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Get or create knowledge check for a subskill
 */
export async function getKnowledgeCheck(
  userId: string,
  subskillId: string
): Promise<KnowledgeCheck> {
  const supabase = getSupabase();
  
  // Get user's internal ID
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  const internalUserId = user.id;
  
  // Check for existing incomplete check
  const { data: existingRow } = await supabase
    .from('knowledge_checks')
    .select('*')
    .eq('subskill_id', subskillId)
    .eq('user_id', internalUserId)
    .is('completed_at', null)
    .order('attempt_number', { ascending: false })
    .limit(1)
    .single();
  
  if (existingRow) {
    console.log(`[KC] Found existing check, attempt ${existingRow.attempt_number}`);
    return mapKnowledgeCheck(existingRow);
  }
  
  // Get attempt count
  const { count: attemptCount } = await supabase
    .from('knowledge_checks')
    .select('*', { count: 'exact', head: true })
    .eq('subskill_id', subskillId)
    .eq('user_id', internalUserId);
  
  const attemptNumber = (attemptCount || 0) + 1;
  
  // Get subskill
  const { data: subskillRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('id', subskillId)
    .single();
  
  if (!subskillRow) {
    throw new Error(`Subskill not found: ${subskillId}`);
  }
  
  const subskill = mapPlanSubskill(subskillRow);
  
  // Get plan
  const { data: planRow } = await supabase
    .from('lesson_plans')
    .select('*')
    .eq('id', subskill.planId)
    .single();
  
  if (!planRow) {
    throw new Error(`Plan not found: ${subskill.planId}`);
  }
  
  const plan = mapLessonPlan(planRow);
  
  // Get session summaries for context
  const { data: summaryRows } = await supabase
    .from('session_summaries')
    .select('*')
    .eq('subskill_id', subskillId)
    .eq('user_id', internalUserId)
    .order('session_number', { ascending: true });
  
  const summaries = (summaryRows || []).map(mapSessionSummary);
  
  // Get weak areas from previous attempts
  const weakAreas = await getWeakAreasFromPreviousAttempts(internalUserId, subskillId);
  
  // Generate questions with LLM
  const questions = await generateKnowledgeCheckQuestions(subskill, plan, summaries, weakAreas);
  
  // Create check
  const { data: row, error } = await supabase
    .from('knowledge_checks')
    .insert({
      subskill_id: subskillId,
      user_id: internalUserId,
      attempt_number: attemptNumber,
      questions,
    })
    .select()
    .single();
  
  if (error || !row) {
    throw new Error(`Failed to create knowledge check: ${error?.message}`);
  }
  
  console.log(`[KC] Created check with ${questions.length} questions (attempt ${attemptNumber})`);
  
  return mapKnowledgeCheck(row);
}

/**
 * Submit answers and get result
 */
export async function submitKnowledgeCheck(
  userId: string,
  checkId: string,
  answers: UserAnswer[]
): Promise<KnowledgeCheckResult> {
  const supabase = getSupabase();
  
  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('external_id', userId)
    .single();
  
  if (!user) throw new Error('User not found');
  
  const { data: row, error } = await supabase
    .from('knowledge_checks')
    .select('*')
    .eq('id', checkId)
    .eq('user_id', user.id)
    .single();
  
  if (error || !row) {
    throw new Error(`Knowledge check not found: ${checkId}`);
  }
  
  const check = mapKnowledgeCheck(row);
  
  // Score
  const { score, missedQuestions, feedback } = scoreKnowledgeCheck(check.questions, answers);
  const passed = score >= PASS_THRESHOLD;
  
  console.log(`[KC] Score: ${score}%, Passed: ${passed}`);
  
  // Update check
  const { data: updatedRow } = await supabase
    .from('knowledge_checks')
    .update({
      answers,
      score,
      passed,
      missed_questions: missedQuestions,
      feedback,
      completed_at: new Date().toISOString(),
    })
    .eq('id', checkId)
    .select()
    .single();
  
  const completedCheck = mapKnowledgeCheck(updatedRow);
  
  if (passed) {
    return handlePass(user.id, completedCheck);
  } else {
    return handleFail(user.id, completedCheck, missedQuestions, feedback);
  }
}

async function handlePass(
  internalUserId: string,
  check: KnowledgeCheck
): Promise<KnowledgeCheckResult> {
  const supabase = getSupabase();
  
  console.log(`[KC] PASSED - marking subskill as mastered`);
  
  await supabase
    .from('plan_subskills')
    .update({
      status: 'mastered',
      mastered_at: new Date().toISOString(),
    })
    .eq('id', check.subskillId);
  
  const { data: subskillRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('id', check.subskillId)
    .single();
  
  if (!subskillRow) {
    throw new Error(`Subskill not found: ${check.subskillId}`);
  }
  
  const subskill = mapPlanSubskill(subskillRow);
  
  const { data: nextRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('plan_id', subskill.planId)
    .in('status', ['pending', 'assess'])
    .gt('order', subskill.order)
    .order('order', { ascending: true })
    .limit(1)
    .single();
  
  const nextSubskill = nextRow ? mapPlanSubskill(nextRow) : null;
  
  let isPlanComplete = false;
  
  if (!nextSubskill) {
    const { count: remaining } = await supabase
      .from('plan_subskills')
      .select('*', { count: 'exact', head: true })
      .eq('plan_id', subskill.planId)
      .in('status', ['pending', 'active', 'assess']);
    
    if (remaining === 0) {
      isPlanComplete = true;
      await supabase
        .from('lesson_plans')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          progress: 1.0,
        })
        .eq('id', subskill.planId);
      
      console.log(`[KC] PLAN COMPLETE!`);
    }
  } else {
    await supabase
      .from('plan_subskills')
      .update({ status: 'active' })
      .eq('id', nextSubskill.id);
    
    await supabase
      .from('lesson_plans')
      .update({ current_subskill_id: nextSubskill.id })
      .eq('id', subskill.planId);
  }
  
  await updatePlanProgress(subskill.planId);
  
  return {
    check,
    passed: true,
    score: check.score!,
    canRetake: false,
    attemptNumber: check.attemptNumber,
    nextSubskill: nextSubskill || undefined,
    isPlanComplete,
  };
}

async function handleFail(
  internalUserId: string,
  check: KnowledgeCheck,
  missedQuestions: MissedQuestion[],
  feedback: string[]
): Promise<KnowledgeCheckResult> {
  const supabase = getSupabase();
  
  console.log(`[KC] FAILED - adding remediation session`);
  
  // Get current subskill to find estimated_sessions
  const { data: subskillRow } = await supabase
    .from('plan_subskills')
    .select('*')
    .eq('id', check.subskillId)
    .single();
  
  if (subskillRow) {
    const currentEstimated = subskillRow.estimated_sessions || 3;
    
    // Add one remediation session
    await supabase
      .from('plan_subskills')
      .update({ estimated_sessions: currentEstimated + 1 } as any)
      .eq('id', check.subskillId);
    
    console.log(`[KC] Remediation session added: ${currentEstimated} → ${currentEstimated + 1}`);
    feedback.push('Complete the remediation session to review missed concepts, then retry the knowledge check.');
  }
  
  return {
    check,
    passed: false,
    score: check.score!,
    missedQuestions,
    feedback,
    canRetake: true,
    attemptNumber: check.attemptNumber,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// QUESTION GENERATION (LLM-Powered)
// ─────────────────────────────────────────────────────────────────────────────────

async function generateKnowledgeCheckQuestions(
  subskill: PlanSubskill,
  plan: LessonPlan,
  summaries: SessionSummary[],
  weakAreas: string[]
): Promise<KnowledgeCheckQuestion[]> {
  console.log(`[KC] Generating questions with LLM for: ${subskill.title}`);
  
  try {
    // Build full context
    const context = buildFullContext(
      subskill,
      plan,
      subskill.estimatedSessions || 5, // Final session
      subskill.estimatedSessions || 5,
      summaries,
      [],
      weakAreas
    );
    
    const userMessage = buildKnowledgeCheckUserMessage(subskill, plan, summaries, context);
    
    const response = await SwordGateLLM.generate(
      KNOWLEDGE_CHECK_SYSTEM_PROMPT,
      userMessage,
      { thinkingLevel: 'high' }
    );
    
    const result = parseLLMJson<KnowledgeCheckLLMResponse>(response);
    
    if (!result.questions?.length) {
      throw new Error('No questions generated');
    }
    
    // Validate and normalize questions
    const questions = result.questions.map((q, index) => ({
      id: q.id || `q${index + 1}`,
      question: q.question,
      type: q.type || 'multiple_choice',
      options: q.options || [],
      correctAnswer: q.correctAnswer,
      explanation: q.explanation || 'See the lesson content for more details.',
      relatedConcept: q.relatedConcept,
    }));
    
    console.log(`[KC] LLM generated ${questions.length} questions`);
    
    // Ensure we have between 10-15 questions
    if (questions.length < 10) {
      const fallbackQuestions = generateFallbackQuestions(subskill, summaries);
      return [...questions, ...fallbackQuestions].slice(0, 15);
    }
    
    return questions.slice(0, 15);
    
  } catch (error) {
    console.error('[KC] LLM generation failed, using fallback:', error);
    return generateFallbackQuestions(subskill, summaries);
  }
}

function generateFallbackQuestions(
  subskill: PlanSubskill,
  summaries: SessionSummary[]
): KnowledgeCheckQuestion[] {
  const questions: KnowledgeCheckQuestion[] = [];
  
  // Concept questions from summaries
  for (const summary of summaries) {
    for (const concept of summary.keyConcepts.slice(0, 2)) {
      questions.push({
        id: `c${questions.length + 1}`,
        question: `Which of the following best describes the concept of "${concept}" in the context of ${subskill.title}?`,
        type: 'multiple_choice',
        options: [
          `A fundamental aspect of ${subskill.title} that you practiced`,
          'An unrelated concept from a different topic',
          'An advanced topic not covered in these sessions',
          'A prerequisite from a different learning area',
        ],
        correctAnswer: `A fundamental aspect of ${subskill.title} that you practiced`,
        explanation: `"${concept}" is one of the key concepts you covered while learning ${subskill.title}. Understanding this concept is essential for mastery.`,
        relatedConcept: concept,
      });
    }
  }
  
  // Base questions about learning approach
  questions.push(
    {
      id: `b1`,
      question: `What is the most effective approach to mastering ${subskill.title}?`,
      type: 'multiple_choice',
      options: [
        'Consistent practice and application over time',
        'Memorizing definitions without practicing',
        'Skipping foundational concepts to save time',
        'Avoiding mistakes at all costs',
      ],
      correctAnswer: 'Consistent practice and application over time',
      explanation: 'Mastery comes from consistent, deliberate practice where you apply concepts in various situations and learn from both successes and mistakes.',
    },
    {
      id: `b2`,
      question: `When would the skills from ${subskill.title} be most applicable?`,
      type: 'multiple_choice',
      options: [
        'When solving real-world problems in this domain',
        'Only in theoretical or academic discussions',
        'Never in practical scenarios',
        'Only when supervised by an expert',
      ],
      correctAnswer: 'When solving real-world problems in this domain',
      explanation: `The skills from ${subskill.title} are directly applicable to real-world problems. The goal of learning is to apply knowledge practically.`,
    },
    {
      id: `b3`,
      question: `What should you do if you encounter a difficult concept in ${subskill.title}?`,
      type: 'multiple_choice',
      options: [
        'Break it down, practice components, and revisit fundamentals',
        'Skip it and hope it won\'t come up',
        'Memorize without understanding',
        'Give up and move to something else',
      ],
      correctAnswer: 'Break it down, practice components, and revisit fundamentals',
      explanation: 'When facing difficulty, effective learners break complex concepts into smaller parts, practice each component, and ensure they have solid fundamentals.',
    }
  );
  
  // Application-focused questions
  questions.push(
    {
      id: `a1`,
      question: `How does ${subskill.title} connect to your overall learning goals?`,
      type: 'multiple_choice',
      options: [
        'It builds foundational skills needed for the capstone goal',
        'It is completely unrelated to other skills',
        'It should be learned in isolation',
        'It has no practical value',
      ],
      correctAnswer: 'It builds foundational skills needed for the capstone goal',
      explanation: `Each subskill, including ${subskill.title}, is designed to build toward your capstone goal. Understanding these connections helps with retention and application.`,
    },
    {
      id: `a2`,
      question: `What indicates that you've truly mastered ${subskill.title}?`,
      type: 'multiple_choice',
      options: [
        'You can apply it confidently in new situations',
        'You can recite definitions from memory',
        'You completed all the activities once',
        'You passed a single test',
      ],
      correctAnswer: 'You can apply it confidently in new situations',
      explanation: 'True mastery means being able to apply skills in novel situations, not just familiar ones. This requires deep understanding beyond memorization.',
    }
  );
  
  // Ensure we have at least 10 questions
  while (questions.length < 10) {
    questions.push({
      id: `f${questions.length + 1}`,
      question: `Which statement about learning ${subskill.title} is TRUE?`,
      type: 'multiple_choice',
      options: [
        'Understanding and practice are both essential for mastery',
        'It can be mastered instantly without effort',
        'It has no connection to other skills',
        'Prerequisites are unnecessary',
      ],
      correctAnswer: 'Understanding and practice are both essential for mastery',
      explanation: 'Meaningful skill development requires both conceptual understanding and practical application through deliberate practice.',
    });
  }
  
  return questions.slice(0, 15);
}

async function getWeakAreasFromPreviousAttempts(
  internalUserId: string,
  subskillId: string
): Promise<string[]> {
  const supabase = getSupabase();
  
  const { data: checkRows } = await supabase
    .from('knowledge_checks')
    .select('missed_questions')
    .eq('subskill_id', subskillId)
    .eq('user_id', internalUserId)
    .not('missed_questions', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(2);
  
  const weakAreas: string[] = [];
  for (const check of checkRows || []) {
    if (check.missed_questions) {
      for (const mq of check.missed_questions as any[]) {
        if (mq.relatedConcept && !weakAreas.includes(mq.relatedConcept)) {
          weakAreas.push(mq.relatedConcept);
        }
      }
    }
  }
  
  return weakAreas;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SCORING
// ─────────────────────────────────────────────────────────────────────────────────

function scoreKnowledgeCheck(
  questions: KnowledgeCheckQuestion[],
  answers: UserAnswer[]
): { score: number; missedQuestions: MissedQuestion[]; feedback: string[] } {
  const answerMap = new Map(answers.map(a => [a.questionId, a]));
  
  let correct = 0;
  const missedQuestions: MissedQuestion[] = [];
  const feedback: string[] = [];
  const missedConcepts = new Set<string>();
  
  for (const question of questions) {
    const answer = answerMap.get(question.id);
    const isCorrect = checkAnswer(question, answer);
    
    if (isCorrect) {
      correct++;
    } else {
      missedQuestions.push({
        questionId: question.id,
        question: question.question,
        userAnswer: answer?.answer || '',
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
      });
      
      if (question.relatedConcept) {
        missedConcepts.add(question.relatedConcept);
      }
    }
  }
  
  const score = Math.round((correct / questions.length) * 100);
  
  // Generate personalized feedback
  if (missedConcepts.size > 0) {
    feedback.push(`Focus your review on these concepts: ${Array.from(missedConcepts).join(', ')}`);
  }
  
  if (score >= PASS_THRESHOLD) {
    feedback.push('Great job! You\'ve demonstrated mastery of this skill.');
  } else if (score >= 50) {
    feedback.push('You\'re making progress! Review the explanations for missed questions.');
    feedback.push('Pay special attention to the concepts you missed and try again when ready.');
  } else {
    feedback.push('Take time to review the lesson content before retaking the test.');
    feedback.push('Focus on understanding the concepts, not just memorizing answers.');
    feedback.push('You can retake the test with new questions when ready.');
  }
  
  return { score, missedQuestions, feedback };
}

function checkAnswer(question: KnowledgeCheckQuestion, answer?: UserAnswer): boolean {
  if (!answer) return false;
  
  const correct = question.correctAnswer;
  const given = answer.answer;
  
  // Handle array answers (for ordering questions)
  if (Array.isArray(correct)) {
    if (!Array.isArray(given)) return false;
    return correct.length === given.length &&
      correct.every((c, i) => c.toLowerCase() === given[i]?.toLowerCase());
  }
  
  // Handle string answers
  if (typeof given === 'string') {
    return correct.toLowerCase().trim() === given.toLowerCase().trim();
  }
  
  return false;
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

export const KnowledgeCheckHandler = {
  get: getKnowledgeCheck,
  submit: submitKnowledgeCheck,
  PASS_THRESHOLD,
};
