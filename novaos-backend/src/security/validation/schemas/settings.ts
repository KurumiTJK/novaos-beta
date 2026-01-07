// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS VALIDATION — Zod Schemas for Settings Endpoints
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────────────────────────────────────────

export const ThemeSchema = z.enum(['dark', 'light', 'system']);
export const DefaultStanceSchema = z.enum(['lens', 'sword', 'shield', 'control']);

// ─────────────────────────────────────────────────────────────────────────────────
// NOTIFICATION SETTINGS
// ─────────────────────────────────────────────────────────────────────────────────

export const NotificationSettingsSchema = z.object({
  sparkReminders: z.boolean().optional(),
  dailySummary: z.boolean().optional(),
}).strict();

// ─────────────────────────────────────────────────────────────────────────────────
// UPDATE SETTINGS (PATCH /settings)
// ─────────────────────────────────────────────────────────────────────────────────

export const UpdateSettingsSchema = z.object({
  theme: ThemeSchema.optional(),
  defaultStance: DefaultStanceSchema.optional(),
  hapticFeedback: z.boolean().optional(),
  notifications: NotificationSettingsSchema.optional(),
}).strict().refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one setting must be provided' }
);

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type Theme = z.infer<typeof ThemeSchema>;
export type DefaultStance = z.infer<typeof DefaultStanceSchema>;
export type NotificationSettingsInput = z.infer<typeof NotificationSettingsSchema>;
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;
