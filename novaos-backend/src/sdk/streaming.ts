// ═══════════════════════════════════════════════════════════════════════════════
// SDK STREAMING — Server-Sent Events (SSE) Support
// ═══════════════════════════════════════════════════════════════════════════════

import { StreamError, NetworkError } from './errors.js';
import type { StreamEvent, ChatResponse } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface StreamOptions {
  /** Callback for each text chunk */
  onChunk?: (text: string) => void;
  /** Callback when streaming is complete */
  onComplete?: (response: ChatResponse) => void;
  /** Callback for errors */
  onError?: (error: Error) => void;
  /** Callback for metadata updates */
  onMetadata?: (metadata: Partial<ChatResponse>) => void;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

export interface StreamReader {
  /** Read the next event */
  read(): Promise<StreamEvent | null>;
  /** Cancel the stream */
  cancel(): void;
  /** Check if stream is done */
  isDone(): boolean;
  /** Iterate over events */
  [Symbol.asyncIterator](): AsyncIterator<StreamEvent>;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SSE PARSER
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Parse SSE data from a line
 */
export function parseSSELine(line: string): { field: string; value: string } | null {
  // Ignore comments
  if (line.startsWith(':')) {
    return null;
  }
  
  // Empty line signals end of event
  if (line === '') {
    return null;
  }
  
  // Parse field: value
  const colonIndex = line.indexOf(':');
  if (colonIndex === -1) {
    return { field: line, value: '' };
  }
  
  const field = line.slice(0, colonIndex);
  let value = line.slice(colonIndex + 1);
  
  // Remove leading space from value (per SSE spec)
  if (value.startsWith(' ')) {
    value = value.slice(1);
  }
  
  return { field, value };
}

/**
 * Parse an SSE event from accumulated data
 */
export function parseSSEEvent(data: string): StreamEvent | null {
  try {
    const parsed = JSON.parse(data);
    
    if (parsed.type === 'chunk') {
      return { type: 'chunk', data: parsed.data };
    }
    
    if (parsed.type === 'done') {
      return { type: 'done', metadata: parsed.metadata };
    }
    
    if (parsed.type === 'error') {
      return { type: 'error', error: parsed.error };
    }
    
    if (parsed.type === 'metadata') {
      return { type: 'metadata', metadata: parsed.metadata };
    }
    
    return null;
  } catch {
    // If not JSON, treat as raw chunk
    return { type: 'chunk', data };
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// STREAM READER IMPLEMENTATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a StreamReader from a Response
 */
export function createStreamReader(response: Response, signal?: AbortSignal): StreamReader {
  if (!response.body) {
    throw new StreamError('Response body is null');
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;
  
  // Handle abort
  if (signal) {
    signal.addEventListener('abort', () => {
      reader.cancel().catch(() => {});
      done = true;
    }, { once: true });
  }
  
  async function read(): Promise<StreamEvent | null> {
    if (done) {
      return null;
    }
    
    while (true) {
      // Check for complete event in buffer
      const eventEnd = buffer.indexOf('\n\n');
      if (eventEnd !== -1) {
        const eventData = buffer.slice(0, eventEnd);
        buffer = buffer.slice(eventEnd + 2);
        
        // Parse SSE lines
        const lines = eventData.split('\n');
        let data = '';
        
        for (const line of lines) {
          const parsed = parseSSELine(line);
          if (parsed?.field === 'data') {
            data += parsed.value;
          }
        }
        
        if (data) {
          const event = parseSSEEvent(data);
          if (event) {
            if (event.type === 'done' || event.type === 'error') {
              done = true;
            }
            return event;
          }
        }
      }
      
      // Read more data
      try {
        const { value, done: readerDone } = await reader.read();
        
        if (readerDone) {
          done = true;
          // Process any remaining buffer
          if (buffer.trim()) {
            const event = parseSSEEvent(buffer);
            buffer = '';
            return event;
          }
          return null;
        }
        
        buffer += decoder.decode(value, { stream: true });
      } catch (error) {
        done = true;
        if (error instanceof DOMException && error.name === 'AbortError') {
          return null;
        }
        throw new NetworkError('Stream read failed', error instanceof Error ? error : undefined);
      }
    }
  }
  
  function cancel(): void {
    done = true;
    reader.cancel().catch(() => {});
  }
  
  function isDone(): boolean {
    return done;
  }
  
  async function* iterate(): AsyncGenerator<StreamEvent> {
    while (!done) {
      const event = await read();
      if (event === null) {
        break;
      }
      yield event;
    }
  }
  
  return {
    read,
    cancel,
    isDone,
    [Symbol.asyncIterator]: iterate,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// STREAM HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Consume a stream with callbacks
 */
export async function consumeStream(
  reader: StreamReader,
  options: StreamOptions = {}
): Promise<ChatResponse> {
  let fullText = '';
  let metadata: Partial<ChatResponse> = {};
  
  try {
    for await (const event of reader) {
      switch (event.type) {
        case 'chunk':
          if (event.data) {
            fullText += event.data;
            options.onChunk?.(event.data);
          }
          break;
          
        case 'metadata':
          if (event.metadata) {
            metadata = { ...metadata, ...event.metadata };
            options.onMetadata?.(event.metadata);
          }
          break;
          
        case 'done':
          if (event.metadata) {
            metadata = { ...metadata, ...event.metadata };
          }
          break;
          
        case 'error':
          throw new StreamError(event.error ?? 'Stream error');
      }
    }
    
    const response: ChatResponse = {
      type: 'success',
      message: fullText,
      conversationId: metadata.conversationId ?? '',
      ...metadata,
    };
    
    options.onComplete?.(response);
    return response;
    
  } catch (error) {
    const err = error instanceof Error ? error : new StreamError(String(error));
    options.onError?.(err);
    throw err;
  }
}

/**
 * Collect all stream chunks into a single response
 */
export async function collectStream(reader: StreamReader): Promise<ChatResponse> {
  return consumeStream(reader);
}

/**
 * Convert stream to async generator of text chunks
 */
export async function* streamToChunks(reader: StreamReader): AsyncGenerator<string> {
  for await (const event of reader) {
    if (event.type === 'chunk' && event.data) {
      yield event.data;
    } else if (event.type === 'error') {
      throw new StreamError(event.error ?? 'Stream error');
    }
  }
}

/**
 * Convert stream to a single string
 */
export async function streamToString(reader: StreamReader): Promise<string> {
  let result = '';
  for await (const chunk of streamToChunks(reader)) {
    result += chunk;
  }
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TEXT STREAM CLASS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * A readable text stream with helper methods
 */
export class TextStream {
  private reader: StreamReader;
  private chunks: string[] = [];
  private metadata: Partial<ChatResponse> = {};
  private consumed = false;
  
  constructor(reader: StreamReader) {
    this.reader = reader;
  }
  
  /**
   * Iterate over text chunks
   */
  async *[Symbol.asyncIterator](): AsyncGenerator<string> {
    if (this.consumed) {
      // Return cached chunks
      for (const chunk of this.chunks) {
        yield chunk;
      }
      return;
    }
    
    for await (const event of this.reader) {
      if (event.type === 'chunk' && event.data) {
        this.chunks.push(event.data);
        yield event.data;
      } else if (event.type === 'metadata' && event.metadata) {
        this.metadata = { ...this.metadata, ...event.metadata };
      } else if (event.type === 'done' && event.metadata) {
        this.metadata = { ...this.metadata, ...event.metadata };
      } else if (event.type === 'error') {
        throw new StreamError(event.error ?? 'Stream error');
      }
    }
    
    this.consumed = true;
  }
  
  /**
   * Get full text (consumes stream if not already consumed)
   */
  async text(): Promise<string> {
    if (!this.consumed) {
      for await (const _ of this) {
        // Consume stream
      }
    }
    return this.chunks.join('');
  }
  
  /**
   * Get full response (consumes stream if not already consumed)
   */
  async response(): Promise<ChatResponse> {
    const text = await this.text();
    return {
      type: 'success',
      message: text,
      conversationId: this.metadata.conversationId ?? '',
      ...this.metadata,
    };
  }
  
  /**
   * Cancel the stream
   */
  cancel(): void {
    this.reader.cancel();
    this.consumed = true;
  }
  
  /**
   * Check if stream is done
   */
  isDone(): boolean {
    return this.consumed || this.reader.isDone();
  }
  
  /**
   * Get metadata (available after stream completes)
   */
  getMetadata(): Partial<ChatResponse> {
    return this.metadata;
  }
}
