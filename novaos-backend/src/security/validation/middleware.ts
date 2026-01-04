// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION MIDDLEWARE — Zod-Based Input Validation
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════

import type { Response, NextFunction, Request } from 'express';
import { z, ZodError, type ZodSchema } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────────
// ERROR CODES
// ─────────────────────────────────────────────────────────────────────────────────

export const ValidationErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_BODY: 'INVALID_BODY',
  INVALID_QUERY: 'INVALID_QUERY',
  INVALID_PARAMS: 'INVALID_PARAMS',
  INVALID_HEADERS: 'INVALID_HEADERS',
} as const;

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  errors?: FieldError[];
}

export interface FieldError {
  field: string;
  message: string;
  code?: string;
}

export interface ValidationOptions {
  /** Strip unknown keys (default: true) */
  stripUnknown?: boolean;
  
  /** Return all errors vs first error only (default: true) */
  allErrors?: boolean;
  
  /** Custom error message */
  errorMessage?: string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// HELPER: Format Zod Errors
// ─────────────────────────────────────────────────────────────────────────────────

function formatZodError(error: ZodError): FieldError[] {
  return error.errors.map(err => ({
    field: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATE BODY
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
 * router.post('/goals', validateBody(CreateGoalSchema), handler);
 */
export function validateBody<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
) {
  const { stripUnknown = true, allErrors = true, errorMessage } = options;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const parseOptions = stripUnknown ? { strict: false } : { strict: true };
      const result = schema.safeParse(req.body);
      
      if (!result.success) {
        const errors = formatZodError(result.error);
        
        res.status(400).json({
          error: errorMessage ?? 'Invalid request body',
          code: ValidationErrorCode.INVALID_BODY,
          errors: allErrors ? errors : errors.slice(0, 1),
        });
        return;
      }
      
      // Replace body with validated data
      req.body = result.data;
      next();
    } catch (error) {
      console.error('[VALIDATION] Body validation error:', error);
      res.status(400).json({
        error: 'Validation failed',
        code: ValidationErrorCode.VALIDATION_ERROR,
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATE QUERY
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate query parameters against a Zod schema.
 * 
 * @example
 * const PaginationSchema = z.object({
 *   limit: z.coerce.number().min(1).max(100).default(20),
 *   offset: z.coerce.number().min(0).default(0),
 * });
 * 
 * router.get('/goals', validateQuery(PaginationSchema), handler);
 */
export function validateQuery<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
) {
  const { allErrors = true, errorMessage } = options;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.query);
      
      if (!result.success) {
        const errors = formatZodError(result.error);
        
        res.status(400).json({
          error: errorMessage ?? 'Invalid query parameters',
          code: ValidationErrorCode.INVALID_QUERY,
          errors: allErrors ? errors : errors.slice(0, 1),
        });
        return;
      }
      
      // Replace query with validated data
      req.query = result.data;
      next();
    } catch (error) {
      console.error('[VALIDATION] Query validation error:', error);
      res.status(400).json({
        error: 'Validation failed',
        code: ValidationErrorCode.VALIDATION_ERROR,
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATE PARAMS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate URL parameters against a Zod schema.
 * 
 * @example
 * const IdParamSchema = z.object({
 *   id: z.string().uuid(),
 * });
 * 
 * router.get('/goals/:id', validateParams(IdParamSchema), handler);
 */
export function validateParams<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
) {
  const { allErrors = true, errorMessage } = options;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.params);
      
      if (!result.success) {
        const errors = formatZodError(result.error);
        
        res.status(400).json({
          error: errorMessage ?? 'Invalid URL parameters',
          code: ValidationErrorCode.INVALID_PARAMS,
          errors: allErrors ? errors : errors.slice(0, 1),
        });
        return;
      }
      
      // Replace params with validated data
      req.params = result.data;
      next();
    } catch (error) {
      console.error('[VALIDATION] Params validation error:', error);
      res.status(400).json({
        error: 'Validation failed',
        code: ValidationErrorCode.VALIDATION_ERROR,
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// VALIDATE HEADERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate request headers against a Zod schema.
 */
export function validateHeaders<T extends ZodSchema>(
  schema: T,
  options: ValidationOptions = {}
) {
  const { allErrors = true, errorMessage } = options;
  
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse(req.headers);
      
      if (!result.success) {
        const errors = formatZodError(result.error);
        
        res.status(400).json({
          error: errorMessage ?? 'Invalid headers',
          code: ValidationErrorCode.INVALID_HEADERS,
          errors: allErrors ? errors : errors.slice(0, 1),
        });
        return;
      }
      
      next();
    } catch (error) {
      console.error('[VALIDATION] Headers validation error:', error);
      res.status(400).json({
        error: 'Validation failed',
        code: ValidationErrorCode.VALIDATION_ERROR,
      });
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED VALIDATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface RequestSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
  headers?: ZodSchema;
}

/**
 * Validate multiple parts of the request at once.
 * 
 * @example
 * router.post('/goals/:id',
 *   validate({
 *     params: IdParamSchema,
 *     body: UpdateGoalSchema,
 *   }),
 *   handler
 * );
 */
export function validate(schemas: RequestSchemas, options: ValidationOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const errors: FieldError[] = [];
    
    // Validate body
    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        errors.push(...formatZodError(result.error).map(e => ({
          ...e,
          field: `body.${e.field}`,
        })));
      } else {
        req.body = result.data;
      }
    }
    
    // Validate query
    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        errors.push(...formatZodError(result.error).map(e => ({
          ...e,
          field: `query.${e.field}`,
        })));
      } else {
        req.query = result.data;
      }
    }
    
    // Validate params
    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        errors.push(...formatZodError(result.error).map(e => ({
          ...e,
          field: `params.${e.field}`,
        })));
      } else {
        req.params = result.data;
      }
    }
    
    // Validate headers
    if (schemas.headers) {
      const result = schemas.headers.safeParse(req.headers);
      if (!result.success) {
        errors.push(...formatZodError(result.error).map(e => ({
          ...e,
          field: `headers.${e.field}`,
        })));
      }
    }
    
    // Return errors if any
    if (errors.length > 0) {
      res.status(400).json({
        error: options.errorMessage ?? 'Validation failed',
        code: ValidationErrorCode.VALIDATION_ERROR,
        errors: options.allErrors !== false ? errors : errors.slice(0, 1),
      });
      return;
    }
    
    next();
  };
}
