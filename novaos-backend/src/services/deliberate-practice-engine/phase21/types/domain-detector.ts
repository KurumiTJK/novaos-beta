// ═══════════════════════════════════════════════════════════════════════════════
// PHASE 21: DOMAIN DETECTOR — Topic Classification
// NovaOS — Deliberate Practice Engine
// ═══════════════════════════════════════════════════════════════════════════════
//
// Classifies learning topics into LearningDomain types.
// Uses keyword matching with LLM fallback for ambiguous cases.
//
// ═══════════════════════════════════════════════════════════════════════════════

import OpenAI from 'openai';
import type { AsyncAppResult } from '../../../../types/result.js';
import { ok, err, appError } from '../../../../types/result.js';

import type { LearningDomain } from './enhanced-types.js';
import { DOMAIN_PROFILES } from './enhanced-types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// KEYWORD PATTERNS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Keyword patterns for domain detection.
 * Order matters — more specific patterns first.
 */
const DOMAIN_PATTERNS: Array<{
  domain: LearningDomain;
  patterns: RegExp[];
  keywords: string[];
}> = [
  // TECHNICAL
  {
    domain: 'technical',
    patterns: [
      /\b(program|code|coding|software|develop|engineer)\b/i,
      /\b(python|javascript|typescript|rust|go|java|c\+\+|ruby|swift|kotlin)\b/i,
      /\b(web|frontend|backend|fullstack|api|database|sql|nosql)\b/i,
      /\b(devops|kubernetes|docker|aws|azure|gcp|cloud)\b/i,
      /\b(machine learning|ml|ai|artificial intelligence|deep learning)\b/i,
      /\b(data science|data analysis|statistics|analytics)\b/i,
      /\b(cybersecurity|security|hacking|penetration|networking)\b/i,
      /\b(git|github|version control|ci\/cd)\b/i,
      /\b(react|vue|angular|node|express|django|flask|rails)\b/i,
      /\b(algorithm|data structure|leetcode|system design)\b/i,
    ],
    keywords: [
      'programming', 'coding', 'developer', 'software', 'engineering',
      'python', 'javascript', 'typescript', 'rust', 'golang', 'java',
      'web development', 'frontend', 'backend', 'database', 'api',
      'devops', 'kubernetes', 'docker', 'aws', 'cloud',
      'machine learning', 'data science', 'ai', 'cybersecurity',
    ],
  },

  // LANGUAGE
  {
    domain: 'language',
    patterns: [
      /\b(spanish|french|german|italian|portuguese|chinese|mandarin|cantonese)\b/i,
      /\b(japanese|korean|arabic|russian|hindi|hebrew|greek|latin)\b/i,
      /\b(language learning|foreign language|second language|l2)\b/i,
      /\b(vocabulary|grammar|pronunciation|fluency|conversation)\b/i,
      /\b(sign language|asl|bsl)\b/i,
      /\b(duolingo|rosetta|immersion|polyglot)\b/i,
    ],
    keywords: [
      'spanish', 'french', 'german', 'italian', 'portuguese',
      'chinese', 'mandarin', 'japanese', 'korean', 'arabic',
      'language', 'vocabulary', 'grammar', 'pronunciation', 'fluency',
      'sign language', 'conversation', 'bilingual',
    ],
  },

  // CREATIVE
  {
    domain: 'creative',
    patterns: [
      /\b(guitar|piano|violin|drums|bass|ukulele|saxophone)\b/i,
      /\b(music|musician|instrument|song|melody|chord|scale)\b/i,
      /\b(draw|drawing|sketch|illustration|paint|painting|art)\b/i,
      /\b(design|graphic design|ui|ux|figma|photoshop|illustrator)\b/i,
      /\b(write|writing|creative writing|fiction|poetry|screenplay)\b/i,
      /\b(photography|photo|camera|lightroom|composition)\b/i,
      /\b(video|film|filmmaking|editing|premiere|davinci)\b/i,
      /\b(sing|singing|vocal|voice)\b/i,
      /\b(dance|dancing|choreography|ballet|hip hop|salsa)\b/i,
    ],
    keywords: [
      'guitar', 'piano', 'music', 'instrument', 'drawing', 'painting',
      'design', 'graphic design', 'writing', 'creative writing',
      'photography', 'video', 'filmmaking', 'singing', 'dance',
    ],
  },

  // PHYSICAL
  {
    domain: 'physical',
    patterns: [
      /\b(yoga|meditation|mindfulness|breathing)\b/i,
      /\b(fitness|workout|exercise|strength|cardio|gym)\b/i,
      /\b(running|marathon|cycling|swimming|triathlon)\b/i,
      /\b(martial arts|karate|judo|taekwondo|jiu[- ]?jitsu|boxing|mma)\b/i,
      /\b(basketball|soccer|football|tennis|golf|baseball)\b/i,
      /\b(climbing|hiking|surfing|skiing|snowboarding)\b/i,
      /\b(calisthenics|bodyweight|stretching|flexibility)\b/i,
      /\b(posture|mobility|movement|athletics)\b/i,
    ],
    keywords: [
      'yoga', 'fitness', 'workout', 'running', 'martial arts',
      'basketball', 'soccer', 'tennis', 'golf', 'climbing',
      'swimming', 'cycling', 'strength training', 'flexibility',
    ],
  },

  // KNOWLEDGE
  {
    domain: 'knowledge',
    patterns: [
      /\b(history|historical|civilization|ancient|medieval|modern)\b/i,
      /\b(philosophy|ethics|logic|metaphysics|epistemology)\b/i,
      /\b(science|physics|chemistry|biology|astronomy)\b/i,
      /\b(mathematics|math|calculus|algebra|geometry|statistics)\b/i,
      /\b(psychology|sociology|anthropology|economics)\b/i,
      /\b(literature|reading|books|novels|classics)\b/i,
      /\b(politics|government|law|constitution|civics)\b/i,
      /\b(geography|culture|religion|theology)\b/i,
    ],
    keywords: [
      'history', 'philosophy', 'science', 'physics', 'chemistry',
      'biology', 'mathematics', 'psychology', 'economics',
      'literature', 'politics', 'geography',
    ],
  },

  // PROFESSIONAL
  {
    domain: 'professional',
    patterns: [
      /\b(leadership|management|team|executive|ceo|director)\b/i,
      /\b(negotiation|sales|persuasion|influence)\b/i,
      /\b(public speaking|presentation|communication|speaking)\b/i,
      /\b(interview|career|job|resume|linkedin)\b/i,
      /\b(productivity|time management|gtd|efficiency)\b/i,
      /\b(business|startup|entrepreneurship|founder)\b/i,
      /\b(finance|investing|trading|stock|crypto)\b/i,
      /\b(marketing|branding|growth|seo|content)\b/i,
      /\b(project management|agile|scrum|pm)\b/i,
    ],
    keywords: [
      'leadership', 'management', 'negotiation', 'sales',
      'public speaking', 'presentation', 'interview', 'career',
      'productivity', 'business', 'startup', 'finance', 'investing',
      'marketing', 'project management',
    ],
  },

  // CRAFT
  {
    domain: 'craft',
    patterns: [
      /\b(cooking|baking|culinary|chef|recipe|kitchen)\b/i,
      /\b(woodworking|carpentry|furniture|wood)\b/i,
      /\b(gardening|plants|garden|landscaping|horticulture)\b/i,
      /\b(sewing|knitting|crochet|embroidery|textile)\b/i,
      /\b(pottery|ceramics|clay|sculpting)\b/i,
      /\b(brewing|fermentation|wine|beer|coffee|barista)\b/i,
      /\b(diy|home improvement|renovation|repair)\b/i,
      /\b(leatherwork|metalwork|jewelry|crafting)\b/i,
    ],
    keywords: [
      'cooking', 'baking', 'woodworking', 'gardening', 'sewing',
      'knitting', 'pottery', 'brewing', 'coffee', 'diy',
      'home improvement', 'crafting',
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// DOMAIN DETECTOR
// ─────────────────────────────────────────────────────────────────────────────────

export interface DomainDetectorConfig {
  /** OpenAI API key for LLM fallback */
  openaiApiKey?: string;
  /** Model to use (default: gpt-4o-mini) */
  model?: string;
  /** Use LLM for ambiguous cases */
  useLLMFallback?: boolean;
}

export interface DomainDetectionResult {
  /** Detected domain */
  readonly domain: LearningDomain;
  /** Confidence (0-1) */
  readonly confidence: number;
  /** Method used */
  readonly method: 'keyword' | 'llm' | 'default';
  /** Matched keywords/patterns (if keyword method) */
  readonly matchedKeywords?: readonly string[];
}

/**
 * Detects the learning domain for a topic.
 */
export class DomainDetector {
  private readonly config: Required<DomainDetectorConfig>;
  private openai: OpenAI | null = null;

  constructor(config: DomainDetectorConfig = {}) {
    this.config = {
      openaiApiKey: config.openaiApiKey ?? process.env.OPENAI_API_KEY ?? '',
      model: config.model ?? 'gpt-4o-mini',
      useLLMFallback: config.useLLMFallback ?? true,
    };

    if (this.config.openaiApiKey && this.config.useLLMFallback) {
      this.openai = new OpenAI({ apiKey: this.config.openaiApiKey });
    }
  }

  /**
   * Detect the domain for a topic.
   */
  async detect(topic: string): AsyncAppResult<DomainDetectionResult> {
    const normalizedTopic = topic.toLowerCase().trim();

    // Try keyword matching first
    const keywordResult = this.detectByKeywords(normalizedTopic);
    if (keywordResult.confidence >= 0.7) {
      console.log(`[DOMAIN_DETECTOR] Keyword match: ${keywordResult.domain} (${keywordResult.confidence})`);
      return ok(keywordResult);
    }

    // Try LLM for ambiguous cases
    if (this.openai && this.config.useLLMFallback) {
      const llmResult = await this.detectByLLM(topic);
      if (llmResult.ok) {
        console.log(`[DOMAIN_DETECTOR] LLM match: ${llmResult.value.domain} (${llmResult.value.confidence})`);
        return llmResult;
      }
    }

    // Return keyword result even if low confidence, or default
    if (keywordResult.confidence > 0) {
      return ok(keywordResult);
    }

    // Default to 'mixed' if nothing matches
    console.log(`[DOMAIN_DETECTOR] No match, defaulting to 'mixed'`);
    return ok({
      domain: 'mixed',
      confidence: 0.3,
      method: 'default',
    });
  }

  /**
   * Detect domain using keyword patterns.
   */
  private detectByKeywords(topic: string): DomainDetectionResult {
    const scores: Map<LearningDomain, { score: number; matches: string[] }> = new Map();

    for (const { domain, patterns, keywords } of DOMAIN_PATTERNS) {
      let score = 0;
      const matches: string[] = [];

      // Check patterns
      for (const pattern of patterns) {
        if (pattern.test(topic)) {
          score += 2;
          const match = topic.match(pattern);
          if (match) matches.push(match[0]);
        }
      }

      // Check keywords
      for (const keyword of keywords) {
        if (topic.includes(keyword.toLowerCase())) {
          score += 1;
          matches.push(keyword);
        }
      }

      if (score > 0) {
        scores.set(domain, { score, matches });
      }
    }

    // Find highest scoring domain
    let bestDomain: LearningDomain = 'mixed';
    let bestScore = 0;
    let bestMatches: string[] = [];

    for (const [domain, { score, matches }] of scores) {
      if (score > bestScore) {
        bestDomain = domain;
        bestScore = score;
        bestMatches = matches;
      }
    }

    // Calculate confidence based on score
    const confidence = Math.min(1, bestScore / 6); // Max out at score of 6

    return {
      domain: bestDomain,
      confidence,
      method: 'keyword',
      matchedKeywords: bestMatches,
    };
  }

  /**
   * Detect domain using LLM.
   */
  private async detectByLLM(topic: string): AsyncAppResult<DomainDetectionResult> {
    if (!this.openai) {
      return err(appError('CONFIG_ERROR', 'OpenAI not configured'));
    }

    const domains = Object.keys(DOMAIN_PROFILES).join(', ');

    try {
      const response = await this.openai.chat.completions.create({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: `You classify learning topics into domains. Return ONLY a JSON object.

Domains:
- technical: Programming, software, DevOps, data science, cybersecurity
- creative: Music, art, design, writing, photography, video
- language: Spanish, Japanese, any foreign language
- physical: Yoga, fitness, sports, martial arts, dance
- knowledge: History, philosophy, science, math, literature
- professional: Leadership, negotiation, public speaking, business
- craft: Cooking, woodworking, gardening, sewing, DIY
- mixed: Combination or unclear

Return: { "domain": "technical|creative|language|physical|knowledge|professional|craft|mixed", "confidence": 0.0-1.0 }`,
          },
          {
            role: 'user',
            content: `Classify this topic: "${topic}"`,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
      });

      const content = response.choices[0]?.message?.content?.trim() ?? '';
      
      // Parse JSON response
      const parsed = JSON.parse(content);
      const domain = parsed.domain as LearningDomain;
      const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.8;

      if (!DOMAIN_PROFILES[domain]) {
        return err(appError('VALIDATION_ERROR', `Invalid domain: ${domain}`));
      }

      return ok({
        domain,
        confidence,
        method: 'llm',
      });
    } catch (error) {
      console.warn('[DOMAIN_DETECTOR] LLM detection failed:', error);
      return err(appError('LLM_ERROR', 'Failed to classify domain', { cause: error instanceof Error ? error : undefined }));
    }
  }
}

/**
 * Create a domain detector instance.
 */
export function createDomainDetector(config?: DomainDetectorConfig): DomainDetector {
  return new DomainDetector(config);
}

/**
 * Quick domain detection (keyword-only, no LLM).
 */
export function detectDomainSync(topic: string): LearningDomain {
  const detector = new DomainDetector({ useLLMFallback: false });
  const normalizedTopic = topic.toLowerCase().trim();
  
  // Simple keyword matching
  for (const { domain, patterns } of DOMAIN_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(normalizedTopic)) {
        return domain;
      }
    }
  }
  
  return 'mixed';
}
