// ═══════════════════════════════════════════════════════════════════════════════
// TOPIC REGISTRY — Topic Storage and Management
// NovaOS Spark Engine — Phase 6: Resource Discovery
// ═══════════════════════════════════════════════════════════════════════════════
//
// The registry stores topic definitions and provides:
//   - CRUD operations for topics
//   - Hierarchical navigation
//   - Prerequisite graph traversal
//   - Persistence to KeyValueStore
//
// Topics are stored in Redis/memory with the following keys:
//   - topic:{id} - Topic definition JSON
//   - topic:index - Set of all topic IDs
//   - topic:category:{category} - Set of topic IDs by category
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { Result } from '../../../../types/result.js';
import { ok, err } from '../../../../types/result.js';
import type { TopicId } from '../types.js';
import { createTopicId } from '../types.js';
import type {
  TopicDefinition,
  TopicCategory,
  TopicDifficulty,
  CreateTopicInput,
  UpdateTopicInput,
  TopicTreeNode,
  FlattenedTopic,
  TopicLearningPath,
  TokenMatchPattern,
} from './types.js';
import { validateTopicId, getParentTopicId, getTopicDepth } from './validator.js';
import { SafeTopicMatcher, initMatcher } from './matcher.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Topic registry error codes.
 */
export type TopicRegistryErrorCode =
  | 'TOPIC_NOT_FOUND'
  | 'TOPIC_EXISTS'
  | 'INVALID_TOPIC_ID'
  | 'PARENT_NOT_FOUND'
  | 'CIRCULAR_REFERENCE'
  | 'STORAGE_ERROR';

/**
 * Topic registry error.
 */
export interface TopicRegistryError {
  readonly code: TopicRegistryErrorCode;
  readonly message: string;
  readonly topicId?: TopicId;
}

/**
 * Topic registry result type.
 */
export type TopicRegistryResult<T> = Result<T, TopicRegistryError>;

// ─────────────────────────────────────────────────────────────────────────────────
// BUILT-IN TOPICS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Built-in programming language topics.
 */
const BUILTIN_TOPICS: readonly CreateTopicInput[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // Languages (Root)
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: createTopicId('language'),
    name: 'Programming Languages',
    description: 'Programming language topics',
    category: 'language',
    difficulty: 'beginner',
    patterns: {
      include: [
        { token: 'programming', mode: 'exact', weight: 1 },
        { token: 'language', mode: 'exact', weight: 1 },
        { token: 'coding', mode: 'exact', weight: 0.5 },
      ],
    },
    keywords: ['programming', 'language', 'coding'],
  },
  
  // Rust
  {
    id: createTopicId('language:rust'),
    name: 'Rust',
    description: 'The Rust programming language',
    category: 'language',
    parentId: createTopicId('language'),
    difficulty: 'intermediate',
    patterns: {
      include: [
        { token: 'rust', mode: 'exact', weight: 2, required: true },
        { token: 'rustlang', mode: 'exact', weight: 2 },
        { token: 'cargo', mode: 'exact', weight: 1 },
        { token: 'crate', mode: 'exact', weight: 0.5 },
      ],
      exclude: [
        { token: 'corrosion', mode: 'exact', weight: 1 },
        { token: 'oxidation', mode: 'exact', weight: 1 },
      ],
    },
    aliases: ['rustlang', 'rust-lang'],
    keywords: ['rust', 'cargo', 'crate', 'rustc'],
  },
  {
    id: createTopicId('language:rust:ownership'),
    name: 'Rust Ownership',
    description: 'Ownership and borrowing in Rust',
    category: 'language',
    parentId: createTopicId('language:rust'),
    difficulty: 'intermediate',
    patterns: {
      include: [
        { token: 'ownership', mode: 'exact', weight: 2, required: true },
        { token: 'borrow', mode: 'prefix', weight: 1.5 },
        { token: 'lifetime', mode: 'exact', weight: 1.5 },
        { token: 'move', mode: 'exact', weight: 0.5 },
      ],
    },
    prerequisites: [createTopicId('language:rust')],
    keywords: ['ownership', 'borrowing', 'borrow checker', 'lifetime', 'move semantics'],
  },
  {
    id: createTopicId('language:rust:async'),
    name: 'Rust Async',
    description: 'Asynchronous programming in Rust',
    category: 'language',
    parentId: createTopicId('language:rust'),
    difficulty: 'advanced',
    patterns: {
      include: [
        { token: 'async', mode: 'exact', weight: 1.5 },
        { token: 'await', mode: 'exact', weight: 1.5 },
        { token: 'tokio', mode: 'exact', weight: 2 },
        { token: 'future', mode: 'exact', weight: 1 },
      ],
    },
    prerequisites: [createTopicId('language:rust:ownership')],
    keywords: ['async', 'await', 'tokio', 'futures', 'runtime'],
  },
  
  // TypeScript
  {
    id: createTopicId('language:typescript'),
    name: 'TypeScript',
    description: 'The TypeScript programming language',
    category: 'language',
    parentId: createTopicId('language'),
    difficulty: 'beginner',
    patterns: {
      include: [
        { token: 'typescript', mode: 'exact', weight: 2, required: true },
        { token: 'ts', mode: 'exact', weight: 1 },
        { token: 'tsc', mode: 'exact', weight: 1 },
      ],
    },
    aliases: ['ts'],
    keywords: ['typescript', 'ts', 'type', 'interface'],
  },
  {
    id: createTopicId('language:typescript:generics'),
    name: 'TypeScript Generics',
    description: 'Generic types in TypeScript',
    category: 'language',
    parentId: createTopicId('language:typescript'),
    difficulty: 'intermediate',
    patterns: {
      include: [
        { token: 'generic', mode: 'prefix', weight: 2, required: true },
        { token: 'type', mode: 'exact', weight: 0.5 },
        { token: 'parameter', mode: 'exact', weight: 0.5 },
      ],
    },
    prerequisites: [createTopicId('language:typescript')],
    keywords: ['generics', 'type parameter', 'constraint'],
  },
  
  // Python
  {
    id: createTopicId('language:python'),
    name: 'Python',
    description: 'The Python programming language',
    category: 'language',
    parentId: createTopicId('language'),
    difficulty: 'beginner',
    patterns: {
      include: [
        { token: 'python', mode: 'exact', weight: 2, required: true },
        { token: 'py', mode: 'exact', weight: 1 },
        { token: 'pip', mode: 'exact', weight: 0.5 },
      ],
    },
    aliases: ['py', 'python3'],
    keywords: ['python', 'pip', 'pypi'],
  },
  
  // JavaScript
  {
    id: createTopicId('language:javascript'),
    name: 'JavaScript',
    description: 'The JavaScript programming language',
    category: 'language',
    parentId: createTopicId('language'),
    difficulty: 'beginner',
    patterns: {
      include: [
        { token: 'javascript', mode: 'exact', weight: 2, required: true },
        { token: 'js', mode: 'exact', weight: 1.5 },
        { token: 'ecmascript', mode: 'exact', weight: 1 },
        { token: 'es6', mode: 'exact', weight: 1 },
      ],
    },
    aliases: ['js', 'ecmascript', 'es6', 'es2015'],
    keywords: ['javascript', 'js', 'node', 'browser'],
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Concepts
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: createTopicId('concept'),
    name: 'Programming Concepts',
    description: 'General programming concepts',
    category: 'concept',
    difficulty: 'beginner',
    patterns: {
      include: [
        { token: 'concept', mode: 'exact', weight: 1 },
        { token: 'theory', mode: 'exact', weight: 1 },
        { token: 'fundamental', mode: 'exact', weight: 0.5 },
      ],
    },
    keywords: ['concept', 'theory', 'fundamentals'],
  },
  {
    id: createTopicId('concept:algorithms'),
    name: 'Algorithms',
    description: 'Algorithm design and analysis',
    category: 'concept',
    parentId: createTopicId('concept'),
    difficulty: 'intermediate',
    patterns: {
      include: [
        { token: 'algorithm', mode: 'prefix', weight: 2, required: true },
        { token: 'complexity', mode: 'exact', weight: 1 },
        { token: 'big', mode: 'exact', weight: 0.5 },
      ],
    },
    keywords: ['algorithm', 'complexity', 'big o', 'sorting', 'searching'],
  },
  {
    id: createTopicId('concept:datastructures'),
    name: 'Data Structures',
    description: 'Common data structures',
    category: 'concept',
    parentId: createTopicId('concept'),
    difficulty: 'intermediate',
    patterns: {
      include: [
        { token: 'data', mode: 'exact', weight: 1 },
        { token: 'structure', mode: 'exact', weight: 1.5 },
        { token: 'array', mode: 'exact', weight: 0.5 },
        { token: 'tree', mode: 'exact', weight: 0.5 },
        { token: 'graph', mode: 'exact', weight: 0.5 },
      ],
    },
    keywords: ['data structure', 'array', 'list', 'tree', 'graph', 'hash'],
  },
];

// ─────────────────────────────────────────────────────────────────────────────────
// TOPIC REGISTRY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Topic registry for storing and managing topics.
 */
export class TopicRegistry {
  private readonly topics: Map<TopicId, TopicDefinition>;
  private readonly childrenIndex: Map<TopicId, Set<TopicId>>;
  private readonly categoryIndex: Map<TopicCategory, Set<TopicId>>;
  private matcher: SafeTopicMatcher | null = null;
  
  constructor() {
    this.topics = new Map();
    this.childrenIndex = new Map();
    this.categoryIndex = new Map();
  }
  
  /**
   * Initialize with built-in topics.
   */
  async initialize(): Promise<void> {
    // Load built-in topics
    for (const input of BUILTIN_TOPICS) {
      await this.create(input);
    }
    
    // Build matcher
    this.rebuildMatcher();
  }
  
  /**
   * Rebuild the topic matcher.
   */
  private rebuildMatcher(): void {
    const topics = Array.from(this.topics.values());
    this.matcher = initMatcher(topics);
  }
  
  /**
   * Get the topic matcher.
   */
  getMatcher(): SafeTopicMatcher {
    if (!this.matcher) {
      this.rebuildMatcher();
    }
    return this.matcher!;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // CRUD Operations
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Create a new topic.
   */
  async create(input: CreateTopicInput): Promise<TopicRegistryResult<TopicDefinition>> {
    // Validate topic ID
    const idResult = validateTopicId(input.id);
    if (!idResult.ok) {
      return err({
        code: 'INVALID_TOPIC_ID',
        message: idResult.error.message,
        topicId: input.id,
      });
    }
    
    // Check if already exists
    if (this.topics.has(input.id)) {
      return err({
        code: 'TOPIC_EXISTS',
        message: `Topic "${input.id}" already exists`,
        topicId: input.id,
      });
    }
    
    // Validate parent exists
    const parentId = input.parentId ?? null;
    if (parentId && !this.topics.has(parentId)) {
      return err({
        code: 'PARENT_NOT_FOUND',
        message: `Parent topic "${parentId}" not found`,
        topicId: parentId,
      });
    }
    
    // Create the topic
    const now = new Date();
    const topic: TopicDefinition = {
      id: input.id,
      name: input.name,
      description: input.description,
      category: input.category,
      parentId,
      difficulty: input.difficulty,
      status: 'active',
      patterns: input.patterns,
      aliases: input.aliases ?? [],
      relatedTopics: input.relatedTopics ?? [],
      prerequisites: input.prerequisites ?? [],
      childIds: [],
      keywords: input.keywords ?? [],
      metadata: {
        createdAt: now,
        updatedAt: now,
        version: 1,
        tags: input.tags,
      },
    };
    
    // Store topic
    this.topics.set(input.id, topic);
    
    // Update parent's children
    if (parentId) {
      this.addChild(parentId, input.id);
    }
    
    // Update category index
    this.addToCategory(input.category, input.id);
    
    // Rebuild matcher
    this.rebuildMatcher();
    
    return ok(topic);
  }
  
  /**
   * Get a topic by ID.
   */
  get(topicId: TopicId): TopicDefinition | undefined {
    return this.topics.get(topicId);
  }
  
  /**
   * Update an existing topic.
   */
  async update(
    topicId: TopicId,
    input: UpdateTopicInput
  ): Promise<TopicRegistryResult<TopicDefinition>> {
    const existing = this.topics.get(topicId);
    if (!existing) {
      return err({
        code: 'TOPIC_NOT_FOUND',
        message: `Topic "${topicId}" not found`,
        topicId,
      });
    }
    
    // Create updated topic
    const updated: TopicDefinition = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      difficulty: input.difficulty ?? existing.difficulty,
      status: input.status ?? existing.status,
      patterns: input.patterns ?? existing.patterns,
      aliases: input.aliases ?? existing.aliases,
      relatedTopics: input.relatedTopics ?? existing.relatedTopics,
      prerequisites: input.prerequisites ?? existing.prerequisites,
      keywords: input.keywords ?? existing.keywords,
      metadata: {
        ...existing.metadata,
        updatedAt: new Date(),
        version: existing.metadata.version + 1,
        tags: input.tags ?? existing.metadata.tags,
      },
    };
    
    // Store updated topic
    this.topics.set(topicId, updated);
    
    // Rebuild matcher
    this.rebuildMatcher();
    
    return ok(updated);
  }
  
  /**
   * Delete a topic.
   */
  async delete(topicId: TopicId): Promise<TopicRegistryResult<void>> {
    const topic = this.topics.get(topicId);
    if (!topic) {
      return err({
        code: 'TOPIC_NOT_FOUND',
        message: `Topic "${topicId}" not found`,
        topicId,
      });
    }
    
    // Remove from parent's children
    if (topic.parentId) {
      this.removeChild(topic.parentId, topicId);
    }
    
    // Remove from category index
    this.removeFromCategory(topic.category, topicId);
    
    // Delete the topic
    this.topics.delete(topicId);
    
    // Rebuild matcher
    this.rebuildMatcher();
    
    return ok(undefined);
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Index Management
  // ─────────────────────────────────────────────────────────────────────────────
  
  private addChild(parentId: TopicId, childId: TopicId): void {
    let children = this.childrenIndex.get(parentId);
    if (!children) {
      children = new Set();
      this.childrenIndex.set(parentId, children);
    }
    children.add(childId);
    
    // Update parent's childIds
    const parent = this.topics.get(parentId);
    if (parent) {
      const updatedParent: TopicDefinition = {
        ...parent,
        childIds: [...parent.childIds, childId],
      };
      this.topics.set(parentId, updatedParent);
    }
  }
  
  private removeChild(parentId: TopicId, childId: TopicId): void {
    const children = this.childrenIndex.get(parentId);
    if (children) {
      children.delete(childId);
    }
    
    // Update parent's childIds
    const parent = this.topics.get(parentId);
    if (parent) {
      const updatedParent: TopicDefinition = {
        ...parent,
        childIds: parent.childIds.filter(id => id !== childId),
      };
      this.topics.set(parentId, updatedParent);
    }
  }
  
  private addToCategory(category: TopicCategory, topicId: TopicId): void {
    let topics = this.categoryIndex.get(category);
    if (!topics) {
      topics = new Set();
      this.categoryIndex.set(category, topics);
    }
    topics.add(topicId);
  }
  
  private removeFromCategory(category: TopicCategory, topicId: TopicId): void {
    const topics = this.categoryIndex.get(category);
    if (topics) {
      topics.delete(topicId);
    }
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // Query Methods
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Get all topics.
   */
  getAll(): TopicDefinition[] {
    return Array.from(this.topics.values());
  }
  
  /**
   * Get topics by category.
   */
  getByCategory(category: TopicCategory): TopicDefinition[] {
    const topicIds = this.categoryIndex.get(category);
    if (!topicIds) return [];
    
    return Array.from(topicIds)
      .map(id => this.topics.get(id))
      .filter((t): t is TopicDefinition => t !== undefined);
  }
  
  /**
   * Get root topics (no parent).
   */
  getRootTopics(): TopicDefinition[] {
    return Array.from(this.topics.values())
      .filter(t => t.parentId === null);
  }
  
  /**
   * Get children of a topic.
   */
  getChildren(topicId: TopicId): TopicDefinition[] {
    const topic = this.topics.get(topicId);
    if (!topic) return [];
    
    return topic.childIds
      .map(id => this.topics.get(id))
      .filter((t): t is TopicDefinition => t !== undefined);
  }
  
  /**
   * Get topic tree starting from a root.
   */
  getTree(rootId?: TopicId): TopicTreeNode[] {
    const buildNode = (topic: TopicDefinition, depth: number, path: TopicId[]): TopicTreeNode => {
      const children = this.getChildren(topic.id);
      const newPath = [...path, topic.id];
      
      return {
        topic,
        depth,
        path: newPath,
        children: children.map(child => buildNode(child, depth + 1, newPath)),
      };
    };
    
    if (rootId) {
      const root = this.topics.get(rootId);
      if (!root) return [];
      return [buildNode(root, 0, [])];
    }
    
    return this.getRootTopics().map(root => buildNode(root, 0, []));
  }
  
  /**
   * Get flattened topic list.
   */
  getFlattenedTopics(rootId?: TopicId): FlattenedTopic[] {
    const result: FlattenedTopic[] = [];
    
    const flatten = (node: TopicTreeNode, isLastChild: boolean): void => {
      result.push({
        topic: node.topic,
        depth: node.depth,
        pathString: node.path.join(' > '),
        hasChildren: node.children.length > 0,
        isLastChild,
      });
      
      node.children.forEach((child, index) => {
        flatten(child, index === node.children.length - 1);
      });
    };
    
    const trees = this.getTree(rootId);
    trees.forEach((tree, index) => {
      flatten(tree, index === trees.length - 1);
    });
    
    return result;
  }
  
  /**
   * Get prerequisites for a topic (transitive).
   */
  getPrerequisites(topicId: TopicId): TopicDefinition[] {
    const visited = new Set<TopicId>();
    const result: TopicDefinition[] = [];
    
    const visit = (id: TopicId): void => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const topic = this.topics.get(id);
      if (!topic) return;
      
      for (const prereqId of topic.prerequisites) {
        visit(prereqId);
        const prereq = this.topics.get(prereqId);
        if (prereq && !result.includes(prereq)) {
          result.push(prereq);
        }
      }
    };
    
    visit(topicId);
    return result;
  }
  
  /**
   * Get a learning path for a topic.
   */
  getLearningPath(topicId: TopicId): TopicLearningPath | null {
    const topic = this.topics.get(topicId);
    if (!topic) return null;
    
    const prerequisites = this.getPrerequisites(topicId);
    const allTopics = [...prerequisites, topic];
    
    // Sort by depth (simpler topics first)
    allTopics.sort((a, b) => {
      const depthA = getTopicDepth(a.id);
      const depthB = getTopicDepth(b.id);
      return depthA - depthB;
    });
    
    return {
      topics: allTopics.map(t => t.id),
      estimatedMinutes: 0, // Would need resource data
      difficultyProgression: allTopics.map(t => t.difficulty),
    };
  }
  
  /**
   * Check if topic exists.
   */
  has(topicId: TopicId): boolean {
    return this.topics.has(topicId);
  }
  
  /**
   * Get topic count.
   */
  get count(): number {
    return this.topics.size;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let registryInstance: TopicRegistry | null = null;

/**
 * Get the topic registry singleton.
 */
export function getTopicRegistry(): TopicRegistry {
  if (!registryInstance) {
    registryInstance = new TopicRegistry();
  }
  return registryInstance;
}

/**
 * Initialize the topic registry.
 */
export async function initTopicRegistry(): Promise<TopicRegistry> {
  const registry = getTopicRegistry();
  await registry.initialize();
  return registry;
}

/**
 * Reset the topic registry (for testing).
 */
export function resetTopicRegistry(): void {
  registryInstance = null;
}
