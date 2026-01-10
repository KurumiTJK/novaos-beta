// ═══════════════════════════════════════════════════════════════════════════════
// SWORD STREAMING API — SSE Streaming Functions
// ═══════════════════════════════════════════════════════════════════════════════

const API_BASE = '/api/v1/sword';
const TOKEN_KEY = 'novaux_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export interface ProgressEvent {
  stage: string;
  status: 'starting' | 'generating' | 'complete' | 'error';
  message: string;
  data?: any;
  progress?: number;
}

export interface StreamCallbacks {
  onToken?: (text: string) => void;
  onProgress?: (event: ProgressEvent) => void;
  onThinking?: (active: boolean) => void;
  onDone?: (result: any) => void;
  onError?: (error: string) => void;
}

export interface ExplorationStreamResult {
  sessionId: string;
  state: any;
}

export interface PlanGenerationStreamResult {
  session: any;
  preview: any;
}

export interface SessionStreamResult {
  dailyLesson: any;
  previousSummaries: any[];
}

export const PLAN_STAGE_LABELS: Record<string, string> = {
  capstone: 'Creating Learning Goal',
  subskills: 'Breaking Down Skills',
  routing: 'Assigning Learning Routes',
  distribution: 'Planning Sessions',
  review: 'Preparing Review',
};

export function getStageLabel(stage: string): string {
  return PLAN_STAGE_LABELS[stage] || stage;
}

export function createStreamController(): AbortController {
  return new AbortController();
}

async function streamRequest<T>(
  url: string,
  body: any,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<T | null> {
  const token = getToken();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let result: T | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim() || !line.startsWith('data:')) continue;

      try {
        const data = JSON.parse(line.slice(5).trim());

        switch (data.type) {
          case 'token':
            callbacks.onToken?.(data.text);
            break;
          case 'progress':
            callbacks.onProgress?.(data);
            break;
          case 'thinking':
            callbacks.onThinking?.(data.active);
            break;
          case 'error':
            callbacks.onError?.(data.message);
            break;
          case 'done':
            result = data as T;
            callbacks.onDone?.(data);
            break;
        }
      } catch {}
    }
  }

  return result;
}

export async function startExplorationStream(
  topic: string | undefined,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<ExplorationStreamResult | null> {
  return streamRequest<ExplorationStreamResult>(
    `${API_BASE}/explore/start/stream`,
    { topic },
    callbacks,
    signal
  );
}

export async function exploreChatStream(
  sessionId: string,
  message: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<ExplorationStreamResult | null> {
  return streamRequest<ExplorationStreamResult>(
    `${API_BASE}/explore/chat/stream`,
    { sessionId, message },
    callbacks,
    signal
  );
}

export async function generatePlanStream(
  sessionId: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<PlanGenerationStreamResult | null> {
  return streamRequest<PlanGenerationStreamResult>(
    `${API_BASE}/designer/generate/stream`,
    { sessionId },
    callbacks,
    signal
  );
}

export async function startSessionStream(
  subskillId: string,
  callbacks: StreamCallbacks,
  signal?: AbortSignal
): Promise<SessionStreamResult | null> {
  return streamRequest<SessionStreamResult>(
    `${API_BASE}/runner/session/stream`,
    { subskillId },
    callbacks,
    signal
  );
}
