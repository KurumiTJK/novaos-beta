// ═══════════════════════════════════════════════════════════════════════════════
// USE STREAMING — SSE Streaming Hook for SwordGate
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useCallback, useRef } from 'react';

export type StreamEventType = 'token' | 'progress' | 'thinking' | 'done' | 'error';

export interface ProgressEvent {
  stage: string;
  status: 'starting' | 'generating' | 'complete' | 'error';
  message: string;
  data?: any;
  progress?: number;
}

export interface StreamState<T = any> {
  isStreaming: boolean;
  isThinking: boolean;
  text: string;
  progress: number;
  stage: string;
  statusMessage: string;
  stageData: Record<string, any>;
  result: T | null;
  error: string | null;
}

export interface StreamCallbacks<T = any> {
  onToken?: (text: string, accumulated: string) => void;
  onProgress?: (event: ProgressEvent) => void;
  onThinking?: (active: boolean) => void;
  onDone?: (result: T) => void;
  onError?: (error: { code: string; message: string }) => void;
}

const initialState: StreamState = {
  isStreaming: false,
  isThinking: false,
  text: '',
  progress: 0,
  stage: '',
  statusMessage: '',
  stageData: {},
  result: null,
  error: null,
};

export function useStreaming<T = any>(options: { callbacks?: StreamCallbacks<T> } = {}) {
  const [state, setState] = useState<StreamState<T>>(initialState as StreamState<T>);
  const callbacksRef = useRef<StreamCallbacks<T>>(options.callbacks || {});
  const abortControllerRef = useRef<AbortController | null>(null);

  const setCallbacks = useCallback((callbacks: StreamCallbacks<T>) => {
    callbacksRef.current = callbacks;
  }, []);

  const reset = useCallback(() => {
    setState(initialState as StreamState<T>);
  }, []);

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({ ...prev, isStreaming: false, isThinking: false }));
  }, []);

  const startStream = useCallback(async (url: string, body?: any): Promise<T | null> => {
    abort();
    abortControllerRef.current = new AbortController();
    setState({ ...initialState, isStreaming: true } as StreamState<T>);

    let result: T | null = null;
    let accumulatedText = '';

    try {
      const authData = localStorage.getItem('nova-auth');
      const token = authData ? JSON.parse(authData)?.state?.tokens?.accessToken : null;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('No response body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

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

            if (data.type === 'token' && data.text) {
              accumulatedText += data.text;
              setState(prev => ({ ...prev, text: accumulatedText }));
              callbacksRef.current.onToken?.(data.text, accumulatedText);
            } else if (data.type === 'progress') {
              setState(prev => ({
                ...prev,
                stage: data.stage,
                progress: data.progress ?? prev.progress,
                statusMessage: data.message,
                stageData: data.data ? { ...prev.stageData, [data.stage]: data.data } : prev.stageData,
              }));
              callbacksRef.current.onProgress?.(data);
            } else if (data.type === 'thinking') {
              setState(prev => ({ ...prev, isThinking: data.active }));
              callbacksRef.current.onThinking?.(data.active);
            } else if (data.type === 'error') {
              setState(prev => ({ ...prev, isStreaming: false, error: data.message }));
              callbacksRef.current.onError?.(data);
            } else if (data.type === 'done') {
              result = data as T;
              setState(prev => ({ ...prev, isStreaming: false, isThinking: false, result: data, progress: 100 }));
              callbacksRef.current.onDone?.(data);
            }
          } catch {}
        }
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        const msg = error instanceof Error ? error.message : 'Stream failed';
        setState(prev => ({ ...prev, isStreaming: false, isThinking: false, error: msg }));
        callbacksRef.current.onError?.({ code: 'STREAM_ERROR', message: msg });
      }
    } finally {
      abortControllerRef.current = null;
    }

    return result;
  }, [abort]);

  return { state, startStream, abort, reset, setCallbacks };
}

export function useTokenStreaming<T = any>() { return useStreaming<T>(); }
export function useProgressStreaming<T = any>() { return useStreaming<T>(); }
