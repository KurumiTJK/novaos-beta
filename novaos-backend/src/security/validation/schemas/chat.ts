// ═══════════════════════════════════════════════════════════════════════════════
// CHAT SCHEMAS — Chat Request Validation
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────────
// CHAT MESSAGE
// ─────────────────────────────────────────────────────────────────────────────────

export const ChatMessageSchema = z.object({
  message: z.string()
    .trim()
    .min(1, 'Message cannot be empty')
    .max(100000, 'Message too long (max 100,000 characters)'),
  
  conversationId: z.string().optional(),
  
  ackToken: z.string().optional(),
  
  context: z.object({
    timezone: z.string().optional(),
    locale: z.string().optional(),
  }).optional(),
});

export type ChatMessageInput = z.infer<typeof ChatMessageSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// PARSE COMMAND
// ─────────────────────────────────────────────────────────────────────────────────

export const ParseCommandSchema = z.object({
  command: z.string()
    .trim()
    .min(1, 'Command cannot be empty')
    .max(10000, 'Command too long'),
  
  source: z.enum(['ui_button', 'command_parser', 'api_field']),
  
  conversationId: z.string().optional(),
});

export type ParseCommandInput = z.infer<typeof ParseCommandSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// CONVERSATION
// ─────────────────────────────────────────────────────────────────────────────────

export const ConversationIdParamSchema = z.object({
  id: z.string().min(1, 'Conversation ID is required'),
});

export const UpdateConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(10).optional(),
});

export type UpdateConversationInput = z.infer<typeof UpdateConversationSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// CONVERSATION QUERY
// ─────────────────────────────────────────────────────────────────────────────────

export const ConversationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ConversationQueryInput = z.infer<typeof ConversationQuerySchema>;
