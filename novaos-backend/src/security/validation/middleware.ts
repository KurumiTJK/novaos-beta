// ═══════════════════════════════════════════════════════════════════════════════
// INPUT VALIDATION MIDDLEWARE — Zod-based Request Validation
// NovaOS Security Module — Phase 2
// ═══════════════════════════════════════════════════════════════════════════════

import type { Response, NextFunction } from 'express';
import { z, type ZodSchema, type ZodError, type ZodIssue } from 'zod';
import type { SecureRequest } from '../auth/types.js';
import { getLogger } from '../../logging/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// LOGGER
// ─────────────────────────────────────────────────────────────────────────────────

const logger = getLogger({ component: 'validation' });

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION ERROR TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validation error code.
 */
export const ValidationErrorCode = {
  INVALID_BODY: 'INVALID_BODY',
  INVALID_QUERY: 'INVALID_QUERY',
  INVALID_PARAMS: 'INVALID_PARAMS',
  INVALID_HEADERS: 'INVALID_HEADERS',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
} as const;

export type ValidationErrorCode = typeof ValidationErrorCode[keyof typeof ValidationErrorCode];

/**
 * Formatted validation error.
 */
export interface ValidationError {
  readonly code: ValidationErrorCode;
  readonly message: string;
  readonly errors: readonly FieldError[];
}

/**
 * Individual field error.
 */
export interface FieldError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
  readonly expected?: string;
  readonly received?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR FORMATTING
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Format Zod error into API-friendly format.
 */
function formatZodError(error: ZodError, source: string): ValidationError {
  const fieldErrors: FieldError[] = error.issues.map((issue: ZodIssue) => ({
    field: issue.path.join('.') || source,
    message: issue.message,
    code: issue.code,
    expected: 'expected' in issue ? String(issue.expected) : undefined,
    received: 'received' in issue ? String(issue.received) : undefined,
  }));

  // Determine error code based on source
  let code: ValidationErrorCode;
  switch (source) {
    case 'body':
      code = 'INVALID_BODY';
      break;
    case 'query':
      code = 'INVALID_QUERY';
      break;
    case 'params':
      code = 'INVALID_PARAMS';
      break;
    case 'headers':
      code = 'INVALID_HEADERS';
      break;
    default:
      code = 'VALIDATION_FAILED';
  }

  return {
    code,
    message: `Validation failed for ${source}`,
    errors: fieldErrors,
  };
}

/**
 * Send validation error response.
 */
function sendValidationError(res: Response, error: ValidationError): void {
  res.status(400).json({
    error: error.message,
    code: error.code,
    details: error.errors,
  });
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATION OPTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Options for validation middleware.
 */
export interface ValidationOptions {
  /**
   * Whether to strip unknown properties from the validated data.
   * Default: true
   */
  readonly stripUnknown?: boolean;

  /**
   * Whether to coerce types (e.g., string "123" to number 123).
   * Default: true for query/params, false for body
   */
  readonly coerce?: boolean;

  /**
   * Custom error message.
   */
  readonly errorMessage?: string;

  /**
   * Whether to abort early on first error.
   * Default: false (collect all errors)
   */
  readonly abortEarly?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// BODY VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate request body against a Zod schema.
 * 
 * @example
 * const CreateGoalSchema = z.object({
 *   title: z.string().min(1).max(200),
 *   description: z.string().optional(),
 * });
 * 
 * router.post('/goals', validateBody(CreateGoalSchema), createGoalHandler);
 */
export function validateBody<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
) {
  const { stripUnknown = true, abortEarly = false } = options;

  return (req: SecureRequest, res: Response, next: NextFunction): void => {
    try {
      // Parse and validate
      const parseOptions = { 
        strict: !stripUnknown,
        // abortEarly is not a Zod option, we handle all errors
      };
      
      let effectiveSchema = schema;
      if (stripUnknown && schema instanceof z.ZodObject) {
        effectiveSchema = schema.strip() as unknown as T;
      }

      const result = effectiveSchema.safeParse(req.body);

      if (!result.success) {
        const error = formatZodError(result.error, 'body');
        
        logger.debug('Body validation failed', {
          path: req.path,
          errors: error.errors,
        });

        sendValidationError(res, error);
        return;
      }

      // Replace body with validated/transformed data
      req.body = result.data;
      next();
    } catch (err) {
      logger.error('Body validation error', err instanceof Error ? err : undefined);
      res.status(500).json({ error: 'Internal validation error', code: 'VALIDATION_ERROR' });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// QUERY VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate query parameters against a Zod schema.
 * 
 * @example
 * const ListGoalsSchema = z.object({
 *   page: z.coerce.number().int().min(1).default(1),
 *   limit: z.coerce.number().int().min(1).max(100).default(20),
 *   status: z.enum(['active', 'completed', 'archived']).optional(),
 * });
 * 
 * router.get('/goals', validateQuery(ListGoalsSchema), listGoalsHandler);
 */
export function validateQuery<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
) {
  const { stripUnknown = true } = options;

  return (req: SecureRequest, res: Response, next: NextFunction): void => {
    try {
      let effectiveSchema = schema;
      if (stripUnknown && schema instanceof z.ZodObject) {
        effectiveSchema = schema.strip() as unknown as T;
      }

      const result = effectiveSchema.safeParse(req.query);

      if (!result.success) {
        const error = formatZodError(result.error, 'query');
        
        logger.debug('Query validation failed', {
          path: req.path,
          errors: error.errors,
        });

        sendValidationError(res, error);
        return;
      }

      // Replace query with validated/transformed data
      req.query = result.data;
      next();
    } catch (err) {
      logger.error('Query validation error', err instanceof Error ? err : undefined);
      res.status(500).json({ error: 'Internal validation error', code: 'VALIDATION_ERROR' });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// PARAMS VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate URL parameters against a Zod schema.
 * 
 * @example
 * const GoalParamsSchema = z.object({
 *   id: z.string().uuid(),
 * });
 * 
 * router.get('/goals/:id', validateParams(GoalParamsSchema), getGoalHandler);
 */
export function validateParams<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
) {
  return (req: SecureRequest, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.params);

      if (!result.success) {
        const error = formatZodError(result.error, 'params');
        
        logger.debug('Params validation failed', {
          path: req.path,
          errors: error.errors,
        });

        sendValidationError(res, error);
        return;
      }

      // Replace params with validated data
      req.params = result.data;
      next();
    } catch (err) {
      logger.error('Params validation error', err instanceof Error ? err : undefined);
      res.status(500).json({ error: 'Internal validation error', code: 'VALIDATION_ERROR' });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HEADERS VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate headers against a Zod schema.
 * 
 * @example
 * const RequiredHeadersSchema = z.object({
 *   'x-api-version': z.string().regex(/^\d+\.\d+$/),
 * });
 * 
 * router.use(validateHeaders(RequiredHeadersSchema));
 */
export function validateHeaders<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
) {
  return (req: SecureRequest, res: Response, next: NextFunction): void => {
    try {
      // Headers are case-insensitive, normalize to lowercase
      const normalizedHeaders: Record<string, string | string[] | undefined> = {};
      for (const [key, value] of Object.entries(req.headers)) {
        normalizedHeaders[key.toLowerCase()] = value;
      }

      const result = schema.safeParse(normalizedHeaders);

      if (!result.success) {
        const error = formatZodError(result.error, 'headers');
        
        logger.debug('Headers validation failed', {
          path: req.path,
          errors: error.errors,
        });

        sendValidationError(res, error);
        return;
      }

      next();
    } catch (err) {
      logger.error('Headers validation error', err instanceof Error ? err : undefined);
      res.status(500).json({ error: 'Internal validation error', code: 'VALIDATION_ERROR' });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Schema definition for combined validation.
 */
export interface RequestSchema {
  readonly body?: ZodSchema;
  readonly query?: ZodSchema;
  readonly params?: ZodSchema;
  readonly headers?: ZodSchema;
}

/**
 * Validate multiple parts of the request at once.
 * 
 * @example
 * router.put('/goals/:id', validate({
 *   params: z.object({ id: z.string().uuid() }),
 *   body: z.object({ title: z.string().min(1) }),
 *   query: z.object({ returnUpdated: z.coerce.boolean().default(false) }),
 * }), updateGoalHandler);
 */
export function validate(schemas: RequestSchema, options: ValidationOptions = {}) {
  const middlewares: Array<(req: SecureRequest, res: Response, next: NextFunction) => void> = [];

  if (schemas.params) {
    middlewares.push(validateParams(schemas.params, options));
  }
  if (schemas.query) {
    middlewares.push(validateQuery(schemas.query, options));
  }
  if (schemas.headers) {
    middlewares.push(validateHeaders(schemas.headers, options));
  }
  if (schemas.body) {
    middlewares.push(validateBody(schemas.body, options));
  }

  return (req: SecureRequest, res: Response, next: NextFunction): void => {
    // Run middlewares sequentially
    let index = 0;
    
    const runNext: NextFunction = (err?: unknown): void => {
      if (err || res.headersSent) {
        if (err) next(err);
        return;
      }

      if (index >= middlewares.length) {
        next();
        return;
      }

      const middleware = middlewares[index++];
      if (middleware) {
        middleware(req, res, runNext);
      } else {
        next();
      }
    };

    runNext();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMMON SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Common ID parameter schema.
 */
export const IdParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

/**
 * UUID parameter schema.
 */
export const UuidParamSchema = z.object({
  id: z.string().uuid('Invalid UUID format'),
});

/**
 * Common pagination query schema.
 */
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Common search query schema.
 */
export const SearchSchema = z.object({
  q: z.string().min(1).max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * Common date range query schema.
 */
export const DateRangeSchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
}).refine(
  (data) => {
    if (data.from && data.to) {
      return data.from <= data.to;
    }
    return true;
  },
  { message: "'from' must be before 'to'" }
);

// ─────────────────────────────────────────────────────────────────────────────────
// CUSTOM VALIDATORS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Create a string that's trimmed and non-empty.
 */
export const nonEmptyString = (message?: string) => 
  z.string().trim().min(1, message ?? 'Cannot be empty');

/**
 * Create a bounded string.
 */
export const boundedString = (min: number, max: number) =>
  z.string().trim().min(min).max(max);

/**
 * Create an email validator.
 */
export const email = () => z.string().trim().email().toLowerCase();

/**
 * Create a URL validator.
 */
export const url = () => z.string().trim().url();

/**
 * Create a positive integer validator.
 */
export const positiveInt = () => z.coerce.number().int().positive();

/**
 * Create a non-negative integer validator.
 */
export const nonNegativeInt = () => z.coerce.number().int().nonnegative();

/**
 * Create an ISO date string validator.
 */
export const isoDateString = () => z.string().datetime();

/**
 * Create a slug validator (lowercase alphanumeric with hyphens).
 */
export const slug = () => 
  z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug format');

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE INFERENCE HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Infer the type from a Zod schema.
 */
export type InferSchema<T extends ZodSchema> = z.infer<T>;

/**
 * Type-safe request handler with validated data.
 */
export type ValidatedRequest<
  TBody = unknown,
  TQuery = unknown,
  TParams = Record<string, string>
> = Omit<SecureRequest, 'body' | 'query' | 'params'> & {
  body: TBody;
  query: TQuery;
  params: TParams;
};
