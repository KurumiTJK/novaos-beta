// ═══════════════════════════════════════════════════════════════════════════════
// STREAMING UTILS — SSE Writer and Callback Types
// ═══════════════════════════════════════════════════════════════════════════════

import type { Response } from 'express';

export type OnTokenCallback = (text: string) => void;
export type OnProgressCallback = (stage: string, status: 'starting' | 'generating' | 'complete' | 'error', message: string, data?: any) => void;
export type OnThinkingCallback = (active: boolean) => void;

export const PLAN_GENERATION_STAGES = {
  capstone: { order: 1, weight: 25, label: 'Creating Learning Goal' },
  subskills: { order: 2, weight: 25, label: 'Breaking Down Skills' },
  routing: { order: 3, weight: 25, label: 'Assigning Learning Routes' },
  distribution: { order: 4, weight: 20, label: 'Planning Sessions' },
  review: { order: 5, weight: 5, label: 'Preparing Review' },
} as const;

export type PlanStage = keyof typeof PLAN_GENERATION_STAGES;

export function getStageProgress(stage: PlanStage, stageProgress: number = 0): number {
  const stages = Object.entries(PLAN_GENERATION_STAGES);
  let baseProgress = 0;
  for (const [name, config] of stages) {
    if (name === stage) return baseProgress + (config.weight * stageProgress / 100);
    baseProgress += config.weight;
  }
  return baseProgress;
}

export function getStageLabel(stage: string): string {
  return PLAN_GENERATION_STAGES[stage as PlanStage]?.label || stage;
}

export class SSEWriter {
  private res: Response;
  private closed = false;

  constructor(res: Response) {
    this.res = res;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
  }

  sendToken(text: string): void {
    if (this.closed) return;
    this.res.write(`data: ${JSON.stringify({ type: 'token', text })}\n\n`);
  }

  sendProgress(stage: string, status: 'starting' | 'generating' | 'complete' | 'error', message: string, data?: any): void {
    if (this.closed) return;
    const progress = getStageProgress(stage as PlanStage, status === 'complete' ? 100 : status === 'generating' ? 50 : 0);
    this.res.write(`data: ${JSON.stringify({ type: 'progress', stage, status, message, data, progress })}\n\n`);
  }

  sendThinking(active: boolean): void {
    if (this.closed) return;
    this.res.write(`data: ${JSON.stringify({ type: 'thinking', active })}\n\n`);
  }

  sendDone(result: any): void {
    if (this.closed) return;
    this.res.write(`data: ${JSON.stringify({ type: 'done', ...result })}\n\n`);
  }

  sendError(code: string, message: string): void {
    if (this.closed) return;
    this.res.write(`data: ${JSON.stringify({ type: 'error', code, message })}\n\n`);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.res.end();
  }
}

export function createTokenCallback(writer: SSEWriter): OnTokenCallback {
  return (text: string) => writer.sendToken(text);
}

export function createProgressCallback(writer: SSEWriter): OnProgressCallback {
  return (stage, status, message, data) => writer.sendProgress(stage, status, message, data);
}

export function createThinkingCallback(writer: SSEWriter): OnThinkingCallback {
  return (active: boolean) => writer.sendThinking(active);
}
