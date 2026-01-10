// ═══════════════════════════════════════════════════════════════════════════════
// SWORDGATE LLM — Gemini 3 Pro Integration WITH STREAMING
// ═══════════════════════════════════════════════════════════════════════════════

import { GoogleGenAI } from '@google/genai';
import type { OnTokenCallback, OnThinkingCallback } from './streaming-utils.js';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatOptions {
  thinkingLevel?: 'low' | 'high';
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  text: string;
  model: string;
  thinkingLevel: string;
}

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('[SWORDGATE_LLM] GEMINI_API_KEY not set');
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

export function isAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function resetClient(): void {
  client = null;
}

function getModel(): string {
  return process.env.SWORDGATE_LLM_MODEL || 'gemini-3-pro-preview';
}

function getDefaultThinkingLevel(): 'low' | 'high' {
  const level = process.env.SWORDGATE_LLM_THINKING_LEVEL;
  return (level === 'low' || level === 'high') ? level : 'high';
}

function buildContents(messages: Message[]): any[] {
  const systemMessage = messages.find(m => m.role === 'system')?.content;
  const conversationMessages = messages.filter(m => m.role !== 'system');
  if (conversationMessages.length === 0) throw new Error('[SWORDGATE_LLM] No user/assistant messages');

  const contents = conversationMessages.map((msg, index) => {
    let text = msg.content;
    if (index === 0 && systemMessage && msg.role === 'user') text = `${systemMessage}\n\n${text}`;
    return { role: msg.role === 'assistant' ? 'model' : 'user', parts: [{ text }] };
  });

  if (contents[0]?.role === 'model' && systemMessage) {
    contents.unshift({ role: 'user', parts: [{ text: systemMessage }] });
  }
  return contents;
}

export async function chat(messages: Message[], options: ChatOptions = {}): Promise<ChatResponse> {
  const ai = getClient();
  const model = getModel();
  const thinkingLevel = options.thinkingLevel || getDefaultThinkingLevel();
  const contents = buildContents(messages);

  console.log(`[SWORDGATE_LLM] Calling ${model} with thinkingLevel=${thinkingLevel}`);

  const response = await ai.models.generateContent({
    model, contents,
    config: {
      thinkingConfig: { thinkingLevel: thinkingLevel as any },
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
    },
  });

  const text = response.text;
  if (!text) throw new Error('[SWORDGATE_LLM] Empty response');
  console.log(`[SWORDGATE_LLM] Response received (${text.length} chars)`);
  return { text, model, thinkingLevel };
}

export async function chatStream(
  messages: Message[],
  onToken: OnTokenCallback,
  options: ChatOptions = {},
  onThinking?: OnThinkingCallback
): Promise<string> {
  const ai = getClient();
  const model = getModel();
  const thinkingLevel = options.thinkingLevel || getDefaultThinkingLevel();
  const contents = buildContents(messages);

  console.log(`[SWORDGATE_LLM] Streaming ${model} with thinkingLevel=${thinkingLevel}`);

  if (thinkingLevel === 'high' && onThinking) onThinking(true);

  const response = await ai.models.generateContentStream({
    model, contents,
    config: {
      thinkingConfig: { thinkingLevel: thinkingLevel as any },
      temperature: options.temperature,
      maxOutputTokens: options.maxTokens,
    },
  });

  let fullText = '';
  let thinkingEnded = false;

  for await (const chunk of response) {
    const text = chunk.text;
    if (text) {
      if (!thinkingEnded && thinkingLevel === 'high' && onThinking) {
        onThinking(false);
        thinkingEnded = true;
      }
      fullText += text;
      onToken(text);
    }
  }

  if (!thinkingEnded && thinkingLevel === 'high' && onThinking) onThinking(false);
  console.log(`[SWORDGATE_LLM] Stream complete (${fullText.length} chars)`);
  return fullText;
}

export async function generate(systemPrompt: string, userMessage: string, options: ChatOptions = {}): Promise<string> {
  const response = await chat([{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }], options);
  return response.text;
}

export async function converse(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  newMessage: string,
  options: ChatOptions = {}
): Promise<string> {
  const messages: Message[] = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: newMessage }];
  const response = await chat(messages, options);
  return response.text;
}

export async function generateStream(
  systemPrompt: string,
  userMessage: string,
  onToken: OnTokenCallback,
  options: ChatOptions = {},
  onThinking?: OnThinkingCallback
): Promise<string> {
  return chatStream([{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }], onToken, options, onThinking);
}

export async function converseStream(
  systemPrompt: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
  newMessage: string,
  onToken: OnTokenCallback,
  options: ChatOptions = {},
  onThinking?: OnThinkingCallback
): Promise<string> {
  const messages: Message[] = [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: newMessage }];
  return chatStream(messages, onToken, options, onThinking);
}

export const SwordGateLLM = {
  chat, generate, converse,
  chatStream, generateStream, converseStream,
  isAvailable, resetClient,
};

export default SwordGateLLM;
