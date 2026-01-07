// ═══════════════════════════════════════════════════════════════════════════════
// NODE GENERATION
// Phase 4a: Generate full node schema for each subskill
// Uses research context for informed generation
// ═══════════════════════════════════════════════════════════════════════════════

import type {
  DesignerSession,
  ResearchData,
  NodesData,
  Node,
  Subskill,
  Route,
  Resource,
  PracticeAssetSpec,
  FallbackAsset,
  AssetType,
} from '../types.js';
import { ROUTE_ASSETS } from '../types.js';
import { updateSessionPhase } from './session.js';
import { getAssetTimeEstimate } from '../shared/session-assets.js';

// ─────────────────────────────────────────────────────────────────────────────────
// MAIN GENERATION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate nodes from subskills with research context
 */
export async function generateNodes(
  session: DesignerSession
): Promise<NodesData> {
  if (!session.subskillsData || !session.routingData || !session.researchData) {
    throw new Error('Subskills, routing, and research data required for node generation');
  }

  const { subskills } = session.subskillsData;
  const { assignments } = session.routingData;
  const { resources } = session.researchData;

  // Create lookup maps
  const routeMap = new Map<string, Route>();
  assignments.forEach(a => routeMap.set(a.subskillId, a.route));

  const resourceMap = new Map<string, Resource[]>();
  resources.forEach(r => resourceMap.set(r.subskillId, r.sources));

  // Generate node for each subskill
  const nodes: NodesData['nodes'] = [];

  for (let i = 0; i < subskills.length; i++) {
    const subskill = subskills[i];
    if (!subskill) continue; // Skip if undefined
    
    const route = routeMap.get(subskill.id) || 'practice';
    const sources = resourceMap.get(subskill.id) || [];

    const node = await generateNodeForSubskill(subskill, route, sources, i);
    nodes.push(node);
  }

  const nodesData: NodesData = { nodes };

  // Update session
  await updateSessionPhase(session.id, 'node_generation', nodesData);

  return nodesData;
}

/**
 * Generate a single node from a subskill
 */
async function generateNodeForSubskill(
  subskill: Subskill,
  route: Route,
  sources: Resource[],
  index: number
): Promise<Omit<Node, 'id' | 'planId' | 'createdAt'>> {
  // Generate with LLM (or fallback to template)
  const generated = await generateNodeWithLLM(subskill, route, sources);

  return {
    title: subskill.title,
    objective: generated.objective,
    route,
    subskillType: subskill.subskillType,
    sequenceOrder: index + 1, // Will be reordered in sequencing phase
    moduleNumber: 1, // Will be assigned in sequencing phase
    masteryCheck: generated.masteryCheck,
    masteryReflectionPrompt: generated.masteryReflectionPrompt,
    estimatedSessions: calculateEstimatedSessions(subskill.estimatedComplexity, route),
    isMethodNode: false,
    practiceAssetSpecs: generateAssetSpecs(route, subskill),
    canonicalSources: sources,
    fallbackAssets: generateFallbackAssets(subskill, route),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// LLM GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

interface GeneratedNodeContent {
  objective: string;
  masteryCheck: string;
  masteryReflectionPrompt: string;
}

/**
 * Generate node content with LLM
 * 
 * @stub - Implement with actual LLM call
 */
async function generateNodeWithLLM(
  subskill: Subskill,
  route: Route,
  sources: Resource[]
): Promise<GeneratedNodeContent> {
  // ═══════════════════════════════════════════════════════════════════════════
  // TODO: Implement LLM call
  // 
  // Prompt structure:
  // ```
  // For the learning subskill: "${subskill.title}"
  // Description: ${subskill.description}
  // Route: ${route}
  // 
  // Available resources:
  // ${sources.map(s => `- ${s.title}: ${s.url}`).join('\n')}
  // 
  // Generate:
  // 1. objective: A measurable learning objective (format: "The learner will be able to...")
  // 2. masteryCheck: What proves mastery (specific, observable behavior)
  // 3. masteryReflectionPrompt: Question for learner to reflect on after completing
  // ```
  // ═══════════════════════════════════════════════════════════════════════════

  // STUB: Generate template-based content
  const routeVerbs: Record<Route, string> = {
    recall: 'explain and recall',
    practice: 'correctly execute',
    diagnose: 'identify and diagnose',
    apply: 'apply to new situations',
    build: 'create and implement',
    refine: 'critique and improve',
    plan: 'organize and plan',
  };

  return {
    objective: `The learner will be able to ${routeVerbs[route]} ${subskill.title.toLowerCase()} with confidence and accuracy.`,
    masteryCheck: `Can ${routeVerbs[route]} ${subskill.title.toLowerCase()} without reference materials, handling common variations.`,
    masteryReflectionPrompt: `What was the most challenging aspect of ${subskill.title.toLowerCase()}? How would you explain this to someone just starting?`,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SESSION ESTIMATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Calculate estimated sessions based on complexity and route
 */
function calculateEstimatedSessions(
  complexity: 1 | 2 | 3,
  route: Route
): number {
  // Base: complexity directly maps to sessions
  let sessions: number = complexity;

  // Adjust based on route
  switch (route) {
    case 'build':
      // Build nodes typically need more time
      sessions = Math.ceil(sessions * 1.5);
      break;
    case 'recall':
      // Recall can often be done quicker
      sessions = Math.max(1, sessions - 1);
      break;
    case 'practice':
      // Practice benefits from more repetition
      sessions = Math.min(5, sessions + 1);
      break;
  }

  return Math.max(1, Math.min(5, sessions));
}

// ─────────────────────────────────────────────────────────────────────────────────
// ASSET SPEC GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate practice asset specifications for a node
 */
function generateAssetSpecs(
  route: Route,
  subskill: Subskill
): PracticeAssetSpec[] {
  const routeAssets = ROUTE_ASSETS[route];
  const specs: PracticeAssetSpec[] = [];

  // Generate spec for each applicable asset type
  routeAssets.forEach((assetType, index) => {
    if (assetType === 'spark') return; // Sparks generated separately

    const difficulty = index === 0 ? 'foundational' 
      : index === routeAssets.length - 2 ? 'independent' 
      : 'guided';

    specs.push({
      type: assetType,
      difficulty: difficulty as 'foundational' | 'guided' | 'independent',
      promptTemplate: generatePromptTemplate(assetType, subskill),
      estimatedMinutes: getAssetTimeEstimate(assetType),
    });
  });

  return specs;
}

/**
 * Generate LLM prompt template for an asset type
 */
function generatePromptTemplate(assetType: AssetType, subskill: Subskill): string {
  const templates: Record<string, string> = {
    active_recall_prompt: `Create an active recall question about ${subskill.title}. The learner should answer from memory.`,
    quiz: `Create a short quiz (3-5 questions) testing understanding of ${subskill.title}.`,
    spaced_review: `Create a spaced review prompt for ${subskill.title}, focusing on key concepts.`,
    worked_example: `Provide a worked example demonstrating ${subskill.title}, showing each step clearly.`,
    guided_problem: `Create a practice problem for ${subskill.title} with hints available.`,
    independent_problem: `Create a challenging practice problem for ${subskill.title} without hints.`,
    spot_error: `Create a "spot the error" exercise for ${subskill.title}.`,
    classify: `Create a classification exercise for ${subskill.title} concepts.`,
    compare_contrast: `Create a compare/contrast exercise for ${subskill.title}.`,
    novel_scenario: `Create a novel scenario applying ${subskill.title} in an unexpected context.`,
    case_question: `Create a case study question for ${subskill.title}.`,
    project_milestone: `Define a project milestone for ${subskill.title}.`,
    integration_checklist: `Create an integration checklist for ${subskill.title}.`,
    rubric_check: `Create a rubric for evaluating ${subskill.title} work.`,
    revision_pass: `Create revision guidance for improving ${subskill.title} output.`,
    concept_map: `Create a concept mapping exercise for ${subskill.title}.`,
    error_log_review: `Create an error log review prompt for ${subskill.title}.`,
  };

  return templates[assetType] || `Create an exercise for ${subskill.title}.`;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FALLBACK ASSET GENERATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate fallback assets (used when LLM fails)
 */
function generateFallbackAssets(
  subskill: Subskill,
  route: Route
): FallbackAsset[] {
  const fallbacks: FallbackAsset[] = [];

  // Always include a reading task
  fallbacks.push({
    type: 'active_recall_prompt',
    title: `Review: ${subskill.title}`,
    content: `Take 5 minutes to review ${subskill.title}. Search for "${subskill.title}" and read the top result. Then write down 3 key points from memory.`,
    estimatedMinutes: 5,
  });

  // Route-specific fallback
  switch (route) {
    case 'recall':
      fallbacks.push({
        type: 'quiz',
        title: `Self-Test: ${subskill.title}`,
        content: `Write down everything you know about ${subskill.title}. Then search to verify and fill gaps.`,
        estimatedMinutes: 10,
      });
      break;

    case 'practice':
      fallbacks.push({
        type: 'guided_problem',
        title: `Practice: ${subskill.title}`,
        content: `Find a tutorial or exercise for ${subskill.title} and work through it. Search: "${subskill.title} exercises".`,
        estimatedMinutes: 15,
      });
      break;

    case 'diagnose':
      fallbacks.push({
        type: 'spot_error',
        title: `Debug: ${subskill.title}`,
        content: `Search for "common mistakes ${subskill.title}" and review. Try to identify issues in your own work.`,
        estimatedMinutes: 10,
      });
      break;

    case 'apply':
      fallbacks.push({
        type: 'case_question',
        title: `Apply: ${subskill.title}`,
        content: `Think of a real situation where you could use ${subskill.title}. Write a brief plan for how you'd apply it.`,
        estimatedMinutes: 10,
      });
      break;

    case 'build':
      fallbacks.push({
        type: 'project_milestone',
        title: `Build: ${subskill.title}`,
        content: `Start a small project using ${subskill.title}. Define one clear outcome to achieve today.`,
        estimatedMinutes: 20,
      });
      break;

    case 'refine':
      fallbacks.push({
        type: 'revision_pass',
        title: `Improve: ${subskill.title}`,
        content: `Review your previous work on ${subskill.title}. Identify one thing to improve and make the change.`,
        estimatedMinutes: 15,
      });
      break;

    case 'plan':
      fallbacks.push({
        type: 'concept_map',
        title: `Map: ${subskill.title}`,
        content: `Draw a concept map connecting ${subskill.title} to related topics. Include at least 5 connections.`,
        estimatedMinutes: 10,
      });
      break;
  }

  return fallbacks;
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export const NodeGenerator = {
  generate: generateNodes,
  generateForSubskill: generateNodeForSubskill,
  calculateSessions: calculateEstimatedSessions,
  generateAssetSpecs,
  generateFallbacks: generateFallbackAssets,
};
