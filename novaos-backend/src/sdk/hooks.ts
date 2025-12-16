// ═══════════════════════════════════════════════════════════════════════════════
// REACT HOOKS — React Integration for NovaOS Client SDK
// ═══════════════════════════════════════════════════════════════════════════════
//
// NOTE: These hooks require React 18+ and are provided for React applications.
// They use the React hooks API but don't import React directly to avoid
// requiring React as a dependency for non-React users.
//
// Usage:
//   import { NovaProvider, useNovaClient, useChat } from '@novaos/sdk/react';
//
// ═══════════════════════════════════════════════════════════════════════════════

import type { NovaClient } from './client.js';
import type {
  ChatRequest,
  ChatResponse,
  Goal,
  GoalWithPath,
  CreateGoalRequest,
  Spark,
  Memory,
  Profile,
  Preferences,
  SearchRequest,
  SearchResponse,
} from './types.js';
import { AckRequiredError, StoppedError, NovaError } from './errors.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

// Minimal React types to avoid importing React
type SetStateAction<T> = T | ((prev: T) => T);
type Dispatch<T> = (action: T) => void;

interface ReactRef<T> {
  current: T;
}

// Hook return types
export interface UseQueryResult<T> {
  data: T | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isError: boolean;
  refetch: () => Promise<void>;
}

export interface UseMutationResult<TData, TVariables> {
  data: TData | undefined;
  error: Error | undefined;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  mutate: (variables: TVariables) => Promise<TData>;
  reset: () => void;
}

export interface UseChatResult {
  messages: ChatMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | undefined;
  conversationId: string | undefined;
  send: (message: string) => Promise<ChatResponse>;
  sendStream: (message: string, onChunk?: (text: string) => void) => Promise<ChatResponse>;
  acknowledge: (ackToken: string) => Promise<ChatResponse>;
  clear: () => void;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  metadata?: Partial<ChatResponse>;
}

export interface UseGoalsResult {
  goals: Goal[];
  isLoading: boolean;
  error: Error | undefined;
  create: (goal: CreateGoalRequest) => Promise<Goal>;
  getPath: (goalId: string) => Promise<GoalWithPath>;
  transition: (goalId: string, event: string, reason?: string) => Promise<Goal>;
  refetch: () => Promise<void>;
}

export interface UseSparkResult {
  activeSpark: Spark | null;
  isLoading: boolean;
  error: Error | undefined;
  generate: () => Promise<Spark>;
  accept: (sparkId: string) => Promise<Spark>;
  complete: (sparkId: string) => Promise<Spark>;
  skip: (sparkId: string, reason?: string) => Promise<Spark>;
  refetch: () => Promise<void>;
}

export interface UseMemoriesResult {
  memories: Memory[];
  isLoading: boolean;
  error: Error | undefined;
  create: (memory: { category: string; key: string; value: string }) => Promise<Memory>;
  update: (id: string, value: string) => Promise<Memory>;
  remove: (id: string) => Promise<void>;
  extract: (message: string) => Promise<Memory[]>;
  refetch: () => Promise<void>;
}

export interface UseProfileResult {
  profile: Profile | undefined;
  preferences: Preferences | undefined;
  isLoading: boolean;
  error: Error | undefined;
  updateProfile: (updates: Partial<Profile>) => Promise<Profile>;
  updatePreferences: (updates: Partial<Preferences>) => Promise<Preferences>;
  refetch: () => Promise<void>;
}

export interface UseSearchResult {
  results: SearchResponse | undefined;
  isLoading: boolean;
  error: Error | undefined;
  search: (query: string, options?: Partial<SearchRequest>) => Promise<SearchResponse>;
  suggestions: string[];
  getSuggestions: (query: string) => Promise<string[]>;
  clear: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HOOK IMPLEMENTATIONS (Framework-agnostic patterns)
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Creates a query hook factory
 * Can be used with any React-like framework that provides useState and useEffect
 */
export function createQueryHook<T>(
  fetcher: (client: NovaClient) => Promise<T>
) {
  return function useQuery(
    client: NovaClient,
    useState: <S>(init: S) => [S, Dispatch<SetStateAction<S>>],
    useEffect: (effect: () => void | (() => void), deps?: unknown[]) => void
  ): UseQueryResult<T> {
    const [data, setData] = useState<T | undefined>(undefined);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(true);

    const fetch = async () => {
      setIsLoading(true);
      setError(undefined);
      try {
        const result = await fetcher(client);
        setData(result);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
      } finally {
        setIsLoading(false);
      }
    };

    useEffect(() => {
      fetch();
    }, []);

    return {
      data,
      error,
      isLoading,
      isError: !!error,
      refetch: fetch,
    };
  };
}

/**
 * Creates a mutation hook factory
 */
export function createMutationHook<TData, TVariables>(
  mutator: (client: NovaClient, variables: TVariables) => Promise<TData>
) {
  return function useMutation(
    client: NovaClient,
    useState: <S>(init: S) => [S, Dispatch<SetStateAction<S>>]
  ): UseMutationResult<TData, TVariables> {
    const [data, setData] = useState<TData | undefined>(undefined);
    const [error, setError] = useState<Error | undefined>(undefined);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const mutate = async (variables: TVariables): Promise<TData> => {
      setIsLoading(true);
      setError(undefined);
      setIsSuccess(false);
      try {
        const result = await mutator(client, variables);
        setData(result);
        setIsSuccess(true);
        return result;
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        setError(err);
        throw err;
      } finally {
        setIsLoading(false);
      }
    };

    const reset = () => {
      setData(undefined);
      setError(undefined);
      setIsLoading(false);
      setIsSuccess(false);
    };

    return {
      data,
      error,
      isLoading,
      isError: !!error,
      isSuccess,
      mutate,
      reset,
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CHAT HOOK IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create chat hook state manager
 */
export function createChatManager(client: NovaClient) {
  let messages: ChatMessage[] = [];
  let conversationId: string | undefined;
  let isLoading = false;
  let isStreaming = false;
  let error: Error | undefined;
  let listeners: Set<() => void> = new Set();

  const notify = () => {
    listeners.forEach(l => l());
  };

  const generateId = () => `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const addMessage = (role: 'user' | 'assistant', content: string, metadata?: Partial<ChatResponse>) => {
    messages = [...messages, {
      id: generateId(),
      role,
      content,
      timestamp: Date.now(),
      metadata,
    }];
    notify();
  };

  const updateLastMessage = (content: string) => {
    if (messages.length > 0 && messages[messages.length - 1]!.role === 'assistant') {
      messages = [...messages.slice(0, -1), {
        ...messages[messages.length - 1]!,
        content,
      }];
      notify();
    }
  };

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getState: () => ({ messages, conversationId, isLoading, isStreaming, error }),

    send: async (message: string): Promise<ChatResponse> => {
      isLoading = true;
      error = undefined;
      notify();

      addMessage('user', message);

      try {
        const response = await client.chat({
          message,
          conversationId,
        });

        conversationId = response.conversationId;
        addMessage('assistant', response.message, response);

        return response;
      } catch (e) {
        if (e instanceof AckRequiredError) {
          addMessage('assistant', e.message, { ackRequired: { token: e.ackToken, requiredText: e.requiredText, expiresAt: e.expiresAt } } as Partial<ChatResponse>);
          error = e;
          throw e;
        }
        if (e instanceof StoppedError) {
          addMessage('assistant', `Action stopped: ${e.reason}`);
          error = e;
          throw e;
        }
        error = e instanceof Error ? e : new Error(String(e));
        throw error;
      } finally {
        isLoading = false;
        notify();
      }
    },

    sendStream: async (message: string, onChunk?: (text: string) => void): Promise<ChatResponse> => {
      isLoading = true;
      isStreaming = true;
      error = undefined;
      notify();

      addMessage('user', message);
      addMessage('assistant', '');

      try {
        const stream = await client.chatStream({ message, conversationId });
        let fullText = '';

        for await (const chunk of stream) {
          fullText += chunk;
          updateLastMessage(fullText);
          onChunk?.(chunk);
        }

        const response = await stream.response();
        conversationId = response.conversationId;

        // Update final message with metadata
        messages = [...messages.slice(0, -1), {
          ...messages[messages.length - 1]!,
          content: response.message,
          metadata: response,
        }];
        notify();

        return response;
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
        throw error;
      } finally {
        isLoading = false;
        isStreaming = false;
        notify();
      }
    },

    acknowledge: async (ackToken: string): Promise<ChatResponse> => {
      isLoading = true;
      error = undefined;
      notify();

      try {
        const response = await client.chat({
          message: 'I acknowledge',
          conversationId,
          ackToken,
        });

        addMessage('assistant', response.message, response);
        return response;
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
        throw error;
      } finally {
        isLoading = false;
        notify();
      }
    },

    clear: () => {
      messages = [];
      conversationId = undefined;
      isLoading = false;
      isStreaming = false;
      error = undefined;
      notify();
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// GOALS HOOK IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────

export function createGoalsManager(client: NovaClient) {
  let goals: Goal[] = [];
  let isLoading = false;
  let error: Error | undefined;
  let listeners: Set<() => void> = new Set();

  const notify = () => listeners.forEach(l => l());

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getState: () => ({ goals, isLoading, error }),

    fetch: async () => {
      isLoading = true;
      error = undefined;
      notify();

      try {
        const result = await client.listGoals();
        goals = result.goals;
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
      } finally {
        isLoading = false;
        notify();
      }
    },

    create: async (request: CreateGoalRequest): Promise<Goal> => {
      const result = await client.createGoal(request);
      goals = [...goals, result.goal];
      notify();
      return result.goal;
    },

    getPath: async (goalId: string): Promise<GoalWithPath> => {
      return client.getGoal(goalId);
    },

    transition: async (goalId: string, event: string, reason?: string): Promise<Goal> => {
      const result = await client.transitionGoal(goalId, event as any, reason);
      goals = goals.map(g => g.id === goalId ? result.goal : g);
      notify();
      return result.goal;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SPARK HOOK IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────

export function createSparkManager(client: NovaClient) {
  let activeSpark: Spark | null = null;
  let isLoading = false;
  let error: Error | undefined;
  let listeners: Set<() => void> = new Set();

  const notify = () => listeners.forEach(l => l());

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getState: () => ({ activeSpark, isLoading, error }),

    fetch: async () => {
      isLoading = true;
      error = undefined;
      notify();

      try {
        const result = await client.getActiveSpark();
        activeSpark = result.spark;
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
      } finally {
        isLoading = false;
        notify();
      }
    },

    generate: async (): Promise<Spark> => {
      const result = await client.generateSpark();
      activeSpark = result.spark;
      notify();
      return result.spark;
    },

    accept: async (sparkId: string): Promise<Spark> => {
      const result = await client.transitionSpark(sparkId, 'ACCEPT');
      activeSpark = result.spark;
      notify();
      return result.spark;
    },

    complete: async (sparkId: string): Promise<Spark> => {
      const result = await client.transitionSpark(sparkId, 'COMPLETE');
      activeSpark = null;
      notify();
      return result.spark;
    },

    skip: async (sparkId: string, reason?: string): Promise<Spark> => {
      const result = await client.transitionSpark(sparkId, 'SKIP', reason);
      activeSpark = null;
      notify();
      return result.spark;
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REACT CONTEXT PATTERN
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Context value type for NovaProvider
 */
export interface NovaContextValue {
  client: NovaClient;
  chat: ReturnType<typeof createChatManager>;
  goals: ReturnType<typeof createGoalsManager>;
  spark: ReturnType<typeof createSparkManager>;
}

/**
 * Create context value for NovaProvider
 */
export function createNovaContextValue(client: NovaClient): NovaContextValue {
  return {
    client,
    chat: createChatManager(client),
    goals: createGoalsManager(client),
    spark: createSparkManager(client),
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// VANILLA JS STATE MANAGEMENT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Simple state store for vanilla JS usage
 */
export class NovaStore {
  private client: NovaClient;
  private chat: ReturnType<typeof createChatManager>;
  private goals: ReturnType<typeof createGoalsManager>;
  private spark: ReturnType<typeof createSparkManager>;

  constructor(client: NovaClient) {
    this.client = client;
    this.chat = createChatManager(client);
    this.goals = createGoalsManager(client);
    this.spark = createSparkManager(client);
  }

  getClient(): NovaClient {
    return this.client;
  }

  getChat() {
    return this.chat;
  }

  getGoals() {
    return this.goals;
  }

  getSpark() {
    return this.spark;
  }

  // Initialize all data
  async initialize(): Promise<void> {
    await Promise.all([
      this.goals.fetch(),
      this.spark.fetch(),
    ]);
  }
}
