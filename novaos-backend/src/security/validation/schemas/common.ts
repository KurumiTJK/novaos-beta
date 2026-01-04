// ═══════════════════════════════════════════════════════════════════════════════
// COMMON SCHEMAS — Reusable Zod Validation Schemas
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────────
// CUSTOM VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Non-empty string that trims whitespace.
 */
export const nonEmptyString = (message = 'This field is required') =>
  z.string().trim().min(1, message);

/**
 * String with min/max length constraints.
 */
export const boundedString = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

/**
 * Email validator.
 */
export const email = z.string().email('Invalid email address').toLowerCase();

/**
 * URL validator.
 */
export const url = z.string().url('Invalid URL');

/**
 * Positive integer.
 */
export const positiveInt = z.coerce.number().int().positive();

/**
 * Non-negative integer.
 */
export const nonNegativeInt = z.coerce.number().int().min(0);

/**
 * ISO date string.
 */
export const isoDateString = z.string().datetime({ message: 'Invalid ISO date format' });

/**
 * Slug (URL-safe string).
 */
export const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format');

// ─────────────────────────────────────────────────────────────────────────────────
// ID SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

export const IdParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

// ─────────────────────────────────────────────────────────────────────────────────
// PAGINATION
// ─────────────────────────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type PaginationInput = z.infer<typeof PaginationSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// SEARCH
// ─────────────────────────────────────────────────────────────────────────────────

export const SearchSchema = z.object({
  q: z.string().trim().min(1).max(500).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type SearchInput = z.infer<typeof SearchSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// DATE RANGE
// ─────────────────────────────────────────────────────────────────────────────────

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
}).refine(
  data => {
    if (data.startDate && data.endDate) {
      return new Date(data.startDate) <= new Date(data.endDate);
    }
    return true;
  },
  { message: 'Start date must be before end date' }
);

export type DateRangeInput = z.infer<typeof DateRangeSchema>;

// ─────────────────────────────────────────────────────────────────────────────────
// BASE ENTITY
// ─────────────────────────────────────────────────────────────────────────────────

export const StatusSchema = z.enum(['active', 'completed', 'abandoned', 'blocked']);
export type Status = z.infer<typeof StatusSchema>;

export const PrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);
export type Priority = z.infer<typeof PrioritySchema>;
