// ═══════════════════════════════════════════════════════════════════════════════
// CURRICULUM STRUCTURER — LLM-Based Curriculum Generation
// NovaOS Spark Engine — Phase 7: LLM Security & Curriculum
// ═══════════════════════════════════════════════════════════════════════════════
//
// Orchestrates curriculum generation:
//   1. Build prompt from verified resources (sanitized)
//   2. Call secure LLM client
//   3. Parse and validate JSON response
//   4. Resolve resource indices to actual resources
//   5. Return structured curriculum
//
// INVARIANT: LLM only organizes verified resources, never fabricates them.
//            All resource references are validated against the input list.
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Result } from '../../../types/result.js';
import { ok, err } from '../../../types/result.js';
import { getLogger } from '../../../observability/logging/index.js';
import { incCounter, observeHistogram } from '../../../observability/metrics/index.js';

import type { VerifiedResource, TopicId } from '../resource-discovery/types.js';
import type {
  CurriculumGenerationRequest,
  CurriculumGenerationResult,
  StructuredCurriculum,
  ResolvedCurriculum,
  ResolvedCurriculumDay,
  ResolvedResourceAssignment,
  CurriculumDay,
  ResourceAssignment,
  DifficultyLevel,
  DifficultyProgression,
  RawCurriculumOutput,
  CurriculumMetadata,
} from './types.js';
import { CURRICULUM_CONSTRAINTS } from './types.js';

import {
  getSecureLLMClient,
  createLLMRequest,
  type SecureLLMResponse,
  type ResourceInput,
} from './llm/index.js';

import {
  parseRawCurriculumOutput,
  validateCurriculum,
  validateResourceIndices,
  validateDaySequence,
  validateMinutesSum,
} from './schemas.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'curriculum-structurer' });

// ─────────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// ─────────────────────────────────────────────────────────────────────────────────

const CURRICULUM_SYSTEM_PROMPT = `You are a curriculum designer that organizes verified learning resources into structured daily learning plans.

CRITICAL RULES:
1. You may ONLY reference resources by their index number (1-based) from the provided list.
2. You must NEVER invent, fabricate, or suggest resources that are not in the provided list.
3. You must NEVER include URLs, links, or resource titles in your output - only index numbers.
4. Each resource can be used on multiple days if appropriate for the learning progression.
5. The sum of resource minutes and exercise minutes for each day should equal totalMinutes.

OUTPUT FORMAT:
You must respond with valid JSON only. No markdown, no explanations, no additional text.

JSON SCHEMA:
{
  "title": "string (max 200 chars)",
  "description": "string (max 1000 chars)",
  "targetAudience": "string",
  "prerequisites": ["string"],
  "difficulty": "beginner|intermediate|advanced",
  "progression": "flat|gradual|steep",
  "days": [
    {
      "day": 1,
      "theme": "string (max 100 chars)",
      "objectives": [
        {"description": "string (max 200 chars)", "outcome": "string (optional)"}
      ],
      "resources": [
        {"index": 1, "minutes": 30, "optional": false, "focus": "string (optional)", "notes": "string (optional)"}
      ],
      "exercises": [
        {"type": "practice|quiz|project|reflection|discussion", "description": "string", "minutes": 15, "optional": false}
      ],
      "totalMinutes": 45,
      "difficulty": "beginner|intermediate|advanced",
      "notes": "string (optional)"
    }
  ]
}

EXERCISE TYPES:
- practice: Hands-on coding or application exercises
- quiz: Knowledge check questions
- project: Mini-project combining concepts
- reflection: Journaling or thinking exercises
- discussion: Discussion prompts for peer learning

Remember: Reference resources ONLY by index number. Never fabricate content.`;

// ─────────────────────────────────────────────────────────────────────────────────
// PROMPT BUILDER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Build user prompt from generation request.
 */
function buildUserPrompt(request: CurriculumGenerationRequest): string {
  const { goal, resources, days, minutesPerDay, targetDifficulty, topics, preferences } = request;
  
  // Build resource list with indices
  const resourceList = resources.map((resource, idx) => {
    const index = idx + 1; // 1-based
    const provider = resource.provider ?? 'unknown';
    const difficulty = resource.difficulty ?? 'intermediate';
    const duration = resource.estimatedMinutes ?? 30;
    const topicsStr = resource.topicIds?.join(', ') ?? '';
    
    return `[${index}] ${resource.title ?? 'Untitled'} (${provider}, ${difficulty}, ~${duration}min)${topicsStr ? ` - Topics: ${topicsStr}` : ''}`;
  }).join('\n');
  
  // Build preferences section
  const prefsLines: string[] = [];
  if (preferences?.includeExercises !== false) {
    prefsLines.push('- Include practice exercises for each day');
  }
  if (preferences?.progression) {
    prefsLines.push(`- Difficulty progression: ${preferences.progression}`);
  }
  if (preferences?.focusAreas?.length) {
    prefsLines.push(`- Focus areas: ${preferences.focusAreas.join(', ')}`);
  }
  
  const prefsSection = prefsLines.length > 0
    ? `\nPREFERENCES:\n${prefsLines.join('\n')}`
    : '';
  
  return `Create a ${days}-day learning curriculum for the following goal:

GOAL: ${goal}

TARGET: ${targetDifficulty} level, ~${minutesPerDay} minutes per day
TOPICS: ${topics.join(', ') || 'General'}

VERIFIED RESOURCES (reference by index number only):
${resourceList}

Total resources available: ${resources.length}
${prefsSection}

Generate a JSON curriculum that organizes these resources into a structured ${days}-day learning plan. Remember:
- Only use index numbers 1-${resources.length} to reference resources
- Each day's resource minutes + exercise minutes should equal totalMinutes
- Progress from fundamentals to more advanced concepts
- Respond with valid JSON only, no other text`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOURCE CONVERSION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Convert verified resources to sanitizer input format.
 */
function toResourceInputs(resources: readonly VerifiedResource[]): ResourceInput[] {
  return resources.map(resource => ({
    title: resource.title ?? 'Untitled',
    description: resource.description ?? '',
    provider: resource.provider ?? 'unknown',
    estimatedMinutes: resource.estimatedMinutes ?? 30,
    difficulty: resource.difficulty ?? 'intermediate',
    topics: resource.topicIds ?? [],
  }));
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESPONSE PARSING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Extract JSON from LLM response.
 * Handles responses that may have markdown code blocks or extra text.
 */
function extractJson(text: string): Result<unknown, string> {
  // Try to find JSON in the response
  let jsonStr = text.trim();
  
  // Remove markdown code blocks if present
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1]!.trim();
  }
  
  // Try to find JSON object
  const jsonStart = jsonStr.indexOf('{');
  const jsonEnd = jsonStr.lastIndexOf('}');
  
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
    return err('No valid JSON object found in response');
  }
  
  jsonStr = jsonStr.slice(jsonStart, jsonEnd + 1);
  
  try {
    const parsed = JSON.parse(jsonStr);
    return ok(parsed);
  } catch (e) {
    return err(`JSON parse error: ${e instanceof Error ? e.message : 'Unknown'}`);
  }
}

/**
 * Parse and validate LLM response.
 */
function parseResponse(
  text: string,
  resourceCount: number
): Result<RawCurriculumOutput, string> {
  // Extract JSON
  const jsonResult = extractJson(text);
  if (!jsonResult.ok) {
    return err(jsonResult.error);
  }
  
  // Parse with lenient schema first
  const rawResult = parseRawCurriculumOutput(jsonResult.value);
  if (!rawResult.success) {
    const issues = rawResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    return err(`Schema validation failed: ${issues.join('; ')}`);
  }
  
  const raw = rawResult.data;
  
  // Validate resource indices
  const indexValidation = validateResourceIndices(raw.days, resourceCount);
  if (!indexValidation.valid) {
    const invalid = indexValidation.invalidIndices
      .slice(0, 5)
      .map(i => `day ${i.day} index ${i.index}`)
      .join(', ');
    return err(`Invalid resource indices (must be 1-${resourceCount}): ${invalid}`);
  }
  
  // Validate day sequence
  const sequenceValidation = validateDaySequence(raw.days);
  if (!sequenceValidation.valid) {
    if (sequenceValidation.gaps.length > 0) {
      return err(`Missing days: ${sequenceValidation.gaps.join(', ')}`);
    }
    if (sequenceValidation.duplicates.length > 0) {
      return err(`Duplicate days: ${sequenceValidation.duplicates.join(', ')}`);
    }
  }
  
  return ok(raw);
}

// ─────────────────────────────────────────────────────────────────────────────────
// CURRICULUM BUILDING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate unique curriculum ID.
 */
function generateCurriculumId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `curr-${timestamp}-${random}`;
}

/**
 * Build structured curriculum from validated output.
 */
function buildCurriculum(
  raw: RawCurriculumOutput,
  resources: readonly VerifiedResource[],
  request: CurriculumGenerationRequest,
  requestId: string,
  model: string
): StructuredCurriculum {
  // Build days
  const days: CurriculumDay[] = raw.days.map(rawDay => {
    const resourceAssignments: ResourceAssignment[] = rawDay.resources.map(r => ({
      index: r.index,
      minutes: r.minutes,
      optional: r.optional ?? false,
      focus: r.focus,
      notes: r.notes,
    }));
    
    const exercises = (rawDay.exercises ?? []).map(e => ({
      type: normalizeExerciseType(e.type),
      description: e.description,
      minutes: e.minutes,
      optional: e.optional ?? false,
      relatedResources: e.relatedResources,
    }));
    
    const objectives = (rawDay.objectives ?? []).map(o => ({
      description: o.description,
      topic: o.topic as TopicId | undefined,
      outcome: o.outcome,
    }));
    
    return {
      day: rawDay.day,
      theme: rawDay.theme,
      objectives,
      resources: resourceAssignments,
      exercises,
      totalMinutes: rawDay.totalMinutes,
      difficulty: normalizeDifficulty(rawDay.difficulty),
      notes: rawDay.notes,
      prerequisiteDays: rawDay.prerequisiteDays,
    };
  });
  
  // Calculate totals
  const totalMinutes = days.reduce((sum, d) => sum + d.totalMinutes, 0);
  const usedIndices = new Set<number>();
  for (const day of days) {
    for (const r of day.resources) {
      usedIndices.add(r.index);
    }
  }
  
  // Build metadata
  const metadata: CurriculumMetadata = {
    title: raw.title ?? `${request.days}-Day ${request.goal.slice(0, 50)} Curriculum`,
    description: raw.description ?? '',
    targetAudience: raw.targetAudience ?? 'General learners',
    prerequisites: raw.prerequisites ?? [],
    topics: request.topics,
    difficulty: normalizeDifficulty(raw.difficulty),
    progression: normalizeProgression(raw.progression),
    estimatedHours: Math.round(totalMinutes / 60 * 10) / 10,
  };
  
  return {
    id: generateCurriculumId(),
    metadata,
    days,
    totalDays: days.length,
    totalMinutes,
    resourceCount: usedIndices.size,
    generation: {
      generatedAt: new Date(),
      model,
      requestId,
      userId: request.userId,
    },
  };
}

/**
 * Normalize difficulty string.
 */
function normalizeDifficulty(value?: string): DifficultyLevel {
  if (!value) return 'intermediate';
  const lower = value.toLowerCase();
  if (lower.includes('begin') || lower.includes('easy')) return 'beginner';
  if (lower.includes('advanc') || lower.includes('hard')) return 'advanced';
  return 'intermediate';
}

/**
 * Normalize progression string.
 */
function normalizeProgression(value?: string): DifficultyProgression {
  if (!value) return 'gradual';
  const lower = value.toLowerCase();
  if (lower.includes('flat') || lower.includes('constant')) return 'flat';
  if (lower.includes('steep') || lower.includes('rapid')) return 'steep';
  return 'gradual';
}

/**
 * Normalize exercise type.
 */
function normalizeExerciseType(value: string): 'practice' | 'quiz' | 'project' | 'reflection' | 'discussion' {
  const lower = value.toLowerCase();
  if (lower.includes('quiz') || lower.includes('test')) return 'quiz';
  if (lower.includes('project') || lower.includes('build')) return 'project';
  if (lower.includes('reflect') || lower.includes('journal')) return 'reflection';
  if (lower.includes('discuss')) return 'discussion';
  return 'practice';
}

// ─────────────────────────────────────────────────────────────────────────────────
// RESOURCE RESOLUTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Resolve curriculum with actual resource data.
 */
function resolveCurriculum(
  curriculum: StructuredCurriculum,
  resources: readonly VerifiedResource[]
): ResolvedCurriculum {
  const usedResources = new Map<number, VerifiedResource>();
  
  const resolvedDays: ResolvedCurriculumDay[] = curriculum.days.map(day => {
    const resolvedResources: ResolvedResourceAssignment[] = day.resources.map(assignment => {
      const resource = resources[assignment.index - 1]!; // Convert to 0-based
      usedResources.set(assignment.index, resource);
      
      return {
        ...assignment,
        resource,
        resourceId: resource.id,
        title: resource.title ?? 'Untitled',
        url: resource.canonicalUrl,
      };
    });
    
    return {
      ...day,
      resources: resolvedResources,
    };
  });
  
  return {
    ...curriculum,
    days: resolvedDays,
    allResources: Array.from(usedResources.values()),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN STRUCTURER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Curriculum structurer configuration.
 */
export interface CurriculumStructurerConfig {
  /** Maximum retries on validation failure */
  readonly maxRetries: number;
  
  /** Temperature for LLM */
  readonly temperature: number;
}

const DEFAULT_CONFIG: CurriculumStructurerConfig = {
  maxRetries: 2,
  temperature: 0.7,
};

/**
 * Generate a structured curriculum from verified resources.
 */
export async function generateCurriculum(
  request: CurriculumGenerationRequest,
  config?: Partial<CurriculumStructurerConfig>
): Promise<CurriculumGenerationResult> {
  const { maxRetries, temperature } = { ...DEFAULT_CONFIG, ...config };
  const startTime = Date.now();
  let validationAttempts = 0;
  let tokensUsed = 0;
  
  logger.info('Starting curriculum generation', {
    goal: request.goal.slice(0, 50),
    days: request.days,
    resourceCount: request.resources.length,
  });
  
  // Validate request
  if (request.resources.length === 0) {
    return {
      success: false,
      error: 'No resources provided',
      errorCode: 'NO_RESOURCES',
      metrics: { durationMs: Date.now() - startTime, tokensUsed: 0, validationAttempts: 0 },
    };
  }
  
  if (request.days < CURRICULUM_CONSTRAINTS.MIN_DAYS || request.days > CURRICULUM_CONSTRAINTS.MAX_DAYS) {
    return {
      success: false,
      error: `Days must be between ${CURRICULUM_CONSTRAINTS.MIN_DAYS} and ${CURRICULUM_CONSTRAINTS.MAX_DAYS}`,
      errorCode: 'INVALID_DAYS',
      metrics: { durationMs: Date.now() - startTime, tokensUsed: 0, validationAttempts: 0 },
    };
  }
  
  // Get LLM client
  let client;
  try {
    client = getSecureLLMClient();
  } catch (e) {
    return {
      success: false,
      error: 'LLM client not initialized',
      errorCode: 'CLIENT_NOT_INITIALIZED',
      metrics: { durationMs: Date.now() - startTime, tokensUsed: 0, validationAttempts: 0 },
    };
  }
  
  // Build prompts
  const systemPrompt = CURRICULUM_SYSTEM_PROMPT;
  const userPrompt = buildUserPrompt(request);
  const resourceInputs = toResourceInputs(request.resources);
  
  // Retry loop
  let lastError: string | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    validationAttempts++;
    
    try {
      // Build secure request
      const llmRequest = createLLMRequest()
        .setPurpose('curriculum_structuring')
        .setSystemPrompt(systemPrompt)
        .setUserPrompt(userPrompt)
        .setResources(resourceInputs)
        .setTemperature(temperature)
        .setUserId(request.userId ?? '')
        .build();
      
      // Execute
      const response = await client.execute<string>(llmRequest);
      tokensUsed += response.metrics.totalTokens;
      
      if (!response.ok) {
        lastError = response.error?.message ?? 'LLM request failed';
        logger.warn('LLM request failed', {
          attempt,
          error: lastError,
          errorCode: response.error?.code,
        });
        
        // Don't retry certain errors
        if (response.error?.code === 'SANITIZATION_BLOCKED' ||
            response.error?.code === 'TOKEN_LIMIT_EXCEEDED') {
          break;
        }
        
        continue;
      }
      
      // Parse response
      const parseResult = parseResponse(response.rawContent ?? '', request.resources.length);
      
      if (!parseResult.ok) {
        lastError = parseResult.error;
        logger.warn('Response parsing failed', {
          attempt,
          error: lastError,
        });
        continue;
      }
      
      // Build curriculum
      const curriculum = buildCurriculum(
        parseResult.value,
        request.resources,
        request,
        response.audit.requestId,
        response.metrics.model
      );
      
      // Resolve resources
      const resolved = resolveCurriculum(curriculum, request.resources);
      
      // Success!
      const durationMs = Date.now() - startTime;
      
      logger.info('Curriculum generation completed', {
        curriculumId: curriculum.id,
        days: curriculum.totalDays,
        totalMinutes: curriculum.totalMinutes,
        resourcesUsed: curriculum.resourceCount,
        durationMs,
        tokensUsed,
        attempts: validationAttempts,
      });
      
      incCounter('curriculum_generation_total', { result: 'success' });
      observeHistogram('curriculum_generation_duration_ms', durationMs);
      
      return {
        success: true,
        curriculum: resolved,
        metrics: { durationMs, tokensUsed, validationAttempts },
      };
      
    } catch (e) {
      lastError = e instanceof Error ? e.message : 'Unknown error';
      logger.error('Curriculum generation error', {
        attempt,
        error: lastError,
      });
    }
  }
  
  // All attempts failed
  const durationMs = Date.now() - startTime;
  
  logger.error('Curriculum generation failed after retries', {
    error: lastError,
    attempts: validationAttempts,
  });
  
  incCounter('curriculum_generation_total', { result: 'error' });
  
  return {
    success: false,
    error: lastError ?? 'Generation failed',
    errorCode: 'GENERATION_FAILED',
    metrics: { durationMs, tokensUsed, validationAttempts },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  CURRICULUM_SYSTEM_PROMPT,
  buildUserPrompt,
  extractJson,
  parseResponse,
  buildCurriculum,
  resolveCurriculum,
};
