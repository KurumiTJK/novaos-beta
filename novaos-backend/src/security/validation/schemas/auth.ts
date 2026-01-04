// ═══════════════════════════════════════════════════════════════════════════════
// AUTH SCHEMAS — Authentication Request Validation
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────────
// REGISTER
// ─────────────────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase()
    .max(255, 'Email too long'),
  
  tier: z.enum(['free', 'pro', 'enterprise']).default('free'),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// LOGIN
// ─────────────────────────────────────────────────────────────────────────────────

export const LoginSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase(),
  
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long'),
});

export type LoginInput = z.infer<typeof LoginSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// REFRESH TOKEN
// ─────────────────────────────────────────────────────────────────────────────────

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// API KEY
// ─────────────────────────────────────────────────────────────────────────────────

export const CreateApiKeySchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name too long'),
  
  expiresIn: z.enum(['30d', '90d', '180d', '365d']).default('90d'),
});

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>;
