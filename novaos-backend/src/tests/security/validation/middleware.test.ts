// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION MIDDLEWARE TESTS — Zod-Based Input Validation
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import express, { type Application } from 'express';
import request from 'supertest';
import { z } from 'zod';
import {
  validateBody,
  validateQuery,
  validateParams,
  validateHeaders,
  validate,
  ValidationErrorCode,
  type ValidationError,
  type FieldError,
  type ValidationOptions,
  type RequestSchemas,
} from '../../../security/validation/middleware.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TEST SETUP
// ─────────────────────────────────────────────────────────────────────────────────

let app: Application;

beforeEach(() => {
  app = express();
  app.use(express.json());
});

// ─────────────────────────────────────────────────────────────────────────────────
// TEST SCHEMAS
// ─────────────────────────────────────────────────────────────────────────────────

const TestBodySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  age: z.number().int().positive().optional(),
});

const TestQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  search: z.string().optional(),
});

const TestParamsSchema = z.object({
  id: z.string().uuid('Invalid UUID'),
});

const TestHeadersSchema = z.object({
  'x-api-version': z.string().optional(),
  'content-type': z.string(),
});

// ─────────────────────────────────────────────────────────────────────────────────
// ValidationErrorCode TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('ValidationErrorCode', () => {
  it('should have VALIDATION_ERROR code', () => {
    expect(ValidationErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
  });

  it('should have INVALID_BODY code', () => {
    expect(ValidationErrorCode.INVALID_BODY).toBe('INVALID_BODY');
  });

  it('should have INVALID_QUERY code', () => {
    expect(ValidationErrorCode.INVALID_QUERY).toBe('INVALID_QUERY');
  });

  it('should have INVALID_PARAMS code', () => {
    expect(ValidationErrorCode.INVALID_PARAMS).toBe('INVALID_PARAMS');
  });

  it('should have INVALID_HEADERS code', () => {
    expect(ValidationErrorCode.INVALID_HEADERS).toBe('INVALID_HEADERS');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// validateBody TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('validateBody()', () => {
  it('should pass valid body', async () => {
    app.post('/test', validateBody(TestBodySchema), (req, res) => {
      res.json({ body: req.body });
    });
    
    const response = await request(app)
      .post('/test')
      .send({ name: 'Test', email: 'test@example.com' });
    
    expect(response.status).toBe(200);
    expect(response.body.body.name).toBe('Test');
  });

  it('should reject invalid body', async () => {
    app.post('/test', validateBody(TestBodySchema), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .post('/test')
      .send({ name: '', email: 'invalid-email' });
    
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ValidationErrorCode.INVALID_BODY);
  });

  it('should include field errors', async () => {
    app.post('/test', validateBody(TestBodySchema), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .post('/test')
      .send({ name: '', email: 'invalid' });
    
    expect(response.body.errors).toBeDefined();
    expect(Array.isArray(response.body.errors)).toBe(true);
    expect(response.body.errors.length).toBeGreaterThan(0);
    expect(response.body.errors[0]).toHaveProperty('field');
    expect(response.body.errors[0]).toHaveProperty('message');
  });

  it('should replace body with validated data', async () => {
    const SchemaWithDefaults = z.object({
      name: z.string(),
      count: z.number().default(0),
    });
    
    let receivedBody: any;
    app.post('/test', validateBody(SchemaWithDefaults), (req, res) => {
      receivedBody = req.body;
      res.json({ ok: true });
    });
    
    await request(app)
      .post('/test')
      .send({ name: 'Test' });
    
    expect(receivedBody.count).toBe(0);
  });

  it('should use custom error message', async () => {
    app.post('/test', validateBody(TestBodySchema, { 
      errorMessage: 'Custom error' 
    }), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .post('/test')
      .send({ name: '' });
    
    expect(response.body.error).toBe('Custom error');
  });

  it('should return all errors by default', async () => {
    app.post('/test', validateBody(TestBodySchema), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .post('/test')
      .send({ name: '', email: 'invalid' });
    
    expect(response.body.errors.length).toBeGreaterThan(1);
  });

  it('should return first error only when configured', async () => {
    app.post('/test', validateBody(TestBodySchema, { 
      allErrors: false 
    }), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .post('/test')
      .send({ name: '', email: 'invalid' });
    
    expect(response.body.errors.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// validateQuery TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('validateQuery()', () => {
  it('should pass valid query', async () => {
    app.get('/test', validateQuery(TestQuerySchema), (req, res) => {
      res.json({ query: req.query });
    });
    
    const response = await request(app)
      .get('/test')
      .query({ limit: '50', offset: '10' });
    
    expect(response.status).toBe(200);
    expect(response.body.query.limit).toBe(50);
    expect(response.body.query.offset).toBe(10);
  });

  it('should apply default values', async () => {
    app.get('/test', validateQuery(TestQuerySchema), (req, res) => {
      res.json({ query: req.query });
    });
    
    const response = await request(app).get('/test');
    
    expect(response.status).toBe(200);
    expect(response.body.query.limit).toBe(20);
    expect(response.body.query.offset).toBe(0);
  });

  it('should reject invalid query', async () => {
    app.get('/test', validateQuery(TestQuerySchema), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .query({ limit: '200' });
    
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ValidationErrorCode.INVALID_QUERY);
  });

  it('should coerce query string values', async () => {
    app.get('/test', validateQuery(TestQuerySchema), (req, res) => {
      res.json({ query: req.query });
    });
    
    const response = await request(app)
      .get('/test')
      .query({ limit: '30' });
    
    expect(response.body.query.limit).toBe(30);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// validateParams TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('validateParams()', () => {
  it('should pass valid params', async () => {
    app.get('/test/:id', validateParams(TestParamsSchema), (req, res) => {
      res.json({ params: req.params });
    });
    
    const validUuid = '123e4567-e89b-12d3-a456-426614174000';
    const response = await request(app).get(`/test/${validUuid}`);
    
    expect(response.status).toBe(200);
    expect(response.body.params.id).toBe(validUuid);
  });

  it('should reject invalid params', async () => {
    app.get('/test/:id', validateParams(TestParamsSchema), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app).get('/test/not-a-uuid');
    
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ValidationErrorCode.INVALID_PARAMS);
  });

  it('should include error details', async () => {
    app.get('/test/:id', validateParams(TestParamsSchema), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app).get('/test/invalid');
    
    expect(response.body.errors[0].message).toContain('UUID');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// validateHeaders TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('validateHeaders()', () => {
  it('should pass valid headers', async () => {
    app.get('/test', validateHeaders(TestHeadersSchema), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .get('/test')
      .set('Content-Type', 'application/json')
      .set('X-API-Version', '1.0');
    
    expect(response.status).toBe(200);
  });

  it('should reject missing required headers', async () => {
    const RequiredHeaderSchema = z.object({
      'x-api-key': z.string().min(1, 'API key required'),
    });
    
    app.get('/test', validateHeaders(RequiredHeaderSchema), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app).get('/test');
    
    expect(response.status).toBe(400);
    expect(response.body.code).toBe(ValidationErrorCode.INVALID_HEADERS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// validate (COMBINED) TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('validate()', () => {
  it('should validate multiple parts at once', async () => {
    const bodySchema = z.object({ name: z.string() });
    const querySchema = z.object({ limit: z.coerce.number().default(10) });
    const paramsSchema = z.object({ id: z.string() });
    
    app.post('/test/:id', validate({
      body: bodySchema,
      query: querySchema,
      params: paramsSchema,
    }), (req, res) => {
      res.json({ 
        body: req.body,
        query: req.query,
        params: req.params,
      });
    });
    
    const response = await request(app)
      .post('/test/123')
      .query({ limit: '20' })
      .send({ name: 'Test' });
    
    expect(response.status).toBe(200);
    expect(response.body.body.name).toBe('Test');
    expect(response.body.query.limit).toBe(20);
    expect(response.body.params.id).toBe('123');
  });

  it('should collect errors from all parts', async () => {
    const bodySchema = z.object({ name: z.string().min(1) });
    const querySchema = z.object({ limit: z.coerce.number().positive() });
    
    app.post('/test', validate({
      body: bodySchema,
      query: querySchema,
    }), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .post('/test')
      .query({ limit: '-1' })
      .send({ name: '' });
    
    expect(response.status).toBe(400);
    expect(response.body.errors.length).toBeGreaterThanOrEqual(2);
    
    const fieldPrefixes = response.body.errors.map((e: any) => e.field.split('.')[0]);
    expect(fieldPrefixes).toContain('body');
    expect(fieldPrefixes).toContain('query');
  });

  it('should work with partial schemas', async () => {
    const bodySchema = z.object({ name: z.string() });
    
    app.post('/test', validate({ body: bodySchema }), (req, res) => {
      res.json({ body: req.body });
    });
    
    const response = await request(app)
      .post('/test')
      .send({ name: 'Test' });
    
    expect(response.status).toBe(200);
  });

  it('should use custom error message', async () => {
    const bodySchema = z.object({ name: z.string().min(1) });
    
    app.post('/test', validate(
      { body: bodySchema },
      { errorMessage: 'Validation failed for request' }
    ), (req, res) => {
      res.json({ ok: true });
    });
    
    const response = await request(app)
      .post('/test')
      .send({ name: '' });
    
    expect(response.body.error).toBe('Validation failed for request');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  describe('ValidationError', () => {
    it('should accept valid error structure', () => {
      const error: ValidationError = {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        field: 'email',
        errors: [{ field: 'email', message: 'Invalid email' }],
      };
      
      expect(error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('FieldError', () => {
    it('should accept valid field error', () => {
      const error: FieldError = {
        field: 'name',
        message: 'Name is required',
        code: 'too_small',
      };
      
      expect(error.field).toBe('name');
    });
  });

  describe('ValidationOptions', () => {
    it('should accept valid options', () => {
      const options: ValidationOptions = {
        stripUnknown: true,
        allErrors: true,
        errorMessage: 'Custom message',
      };
      
      expect(options.stripUnknown).toBe(true);
    });
  });

  describe('RequestSchemas', () => {
    it('should accept valid schemas', () => {
      const schemas: RequestSchemas = {
        body: z.object({ name: z.string() }),
        query: z.object({ limit: z.number() }),
        params: z.object({ id: z.string() }),
        headers: z.object({ 'x-api-key': z.string() }),
      };
      
      expect(schemas.body).toBeDefined();
    });
  });
});
