// ═══════════════════════════════════════════════════════════════════════════════
// AUTH SCHEMAS TESTS — Authentication Request Validation
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from 'vitest';
import {
  RegisterSchema,
  LoginSchema,
  RefreshTokenSchema,
  CreateApiKeySchema,
  type RegisterInput,
  type LoginInput,
  type RefreshTokenInput,
  type CreateApiKeyInput,
} from '../../../../security/validation/schemas/auth.js';

// ─────────────────────────────────────────────────────────────────────────────────
// RegisterSchema TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RegisterSchema', () => {
  it('should accept valid registration', () => {
    const result = RegisterSchema.parse({
      email: 'user@example.com',
      tier: 'pro',
    });
    
    expect(result.email).toBe('user@example.com');
    expect(result.tier).toBe('pro');
  });

  it('should lowercase email', () => {
    const result = RegisterSchema.parse({
      email: 'USER@EXAMPLE.COM',
    });
    
    expect(result.email).toBe('user@example.com');
  });

  it('should default tier to free', () => {
    const result = RegisterSchema.parse({
      email: 'user@example.com',
    });
    
    expect(result.tier).toBe('free');
  });

  it('should accept all valid tiers', () => {
    expect(RegisterSchema.parse({ email: 'a@b.com', tier: 'free' }).tier).toBe('free');
    expect(RegisterSchema.parse({ email: 'a@b.com', tier: 'pro' }).tier).toBe('pro');
    expect(RegisterSchema.parse({ email: 'a@b.com', tier: 'enterprise' }).tier).toBe('enterprise');
  });

  it('should reject invalid email', () => {
    expect(() => RegisterSchema.parse({ email: 'not-an-email' })).toThrow();
  });

  it('should reject email too long', () => {
    const longEmail = 'a'.repeat(250) + '@b.com';
    expect(() => RegisterSchema.parse({ email: longEmail })).toThrow();
  });

  it('should reject invalid tier', () => {
    expect(() => RegisterSchema.parse({ email: 'a@b.com', tier: 'invalid' })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// LoginSchema TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('LoginSchema', () => {
  it('should accept valid login', () => {
    const result = LoginSchema.parse({
      email: 'user@example.com',
      password: 'securepassword123',
    });
    
    expect(result.email).toBe('user@example.com');
    expect(result.password).toBe('securepassword123');
  });

  it('should lowercase email', () => {
    const result = LoginSchema.parse({
      email: 'USER@EXAMPLE.COM',
      password: 'password123',
    });
    
    expect(result.email).toBe('user@example.com');
  });

  it('should reject invalid email', () => {
    expect(() => LoginSchema.parse({
      email: 'not-an-email',
      password: 'password123',
    })).toThrow();
  });

  it('should reject password too short', () => {
    expect(() => LoginSchema.parse({
      email: 'user@example.com',
      password: 'short',
    })).toThrow();
  });

  it('should reject password too long', () => {
    const longPassword = 'a'.repeat(129);
    expect(() => LoginSchema.parse({
      email: 'user@example.com',
      password: longPassword,
    })).toThrow();
  });

  it('should accept 8 character password (minimum)', () => {
    const result = LoginSchema.parse({
      email: 'user@example.com',
      password: '12345678',
    });
    
    expect(result.password).toBe('12345678');
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// RefreshTokenSchema TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('RefreshTokenSchema', () => {
  it('should accept valid refresh token', () => {
    const result = RefreshTokenSchema.parse({
      refreshToken: 'refresh_abc123xyz',
    });
    
    expect(result.refreshToken).toBe('refresh_abc123xyz');
  });

  it('should reject empty refresh token', () => {
    expect(() => RefreshTokenSchema.parse({
      refreshToken: '',
    })).toThrow();
  });

  it('should reject missing refresh token', () => {
    expect(() => RefreshTokenSchema.parse({})).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CreateApiKeySchema TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('CreateApiKeySchema', () => {
  it('should accept valid API key creation', () => {
    const result = CreateApiKeySchema.parse({
      name: 'My API Key',
      expiresIn: '90d',
    });
    
    expect(result.name).toBe('My API Key');
    expect(result.expiresIn).toBe('90d');
  });

  it('should trim name', () => {
    const result = CreateApiKeySchema.parse({
      name: '  My Key  ',
    });
    
    expect(result.name).toBe('My Key');
  });

  it('should default expiresIn to 90d', () => {
    const result = CreateApiKeySchema.parse({
      name: 'My Key',
    });
    
    expect(result.expiresIn).toBe('90d');
  });

  it('should accept all valid expiry options', () => {
    expect(CreateApiKeySchema.parse({ name: 'k', expiresIn: '30d' }).expiresIn).toBe('30d');
    expect(CreateApiKeySchema.parse({ name: 'k', expiresIn: '90d' }).expiresIn).toBe('90d');
    expect(CreateApiKeySchema.parse({ name: 'k', expiresIn: '180d' }).expiresIn).toBe('180d');
    expect(CreateApiKeySchema.parse({ name: 'k', expiresIn: '365d' }).expiresIn).toBe('365d');
  });

  it('should reject empty name', () => {
    expect(() => CreateApiKeySchema.parse({
      name: '',
    })).toThrow();
  });

  it('should reject whitespace-only name', () => {
    expect(() => CreateApiKeySchema.parse({
      name: '   ',
    })).toThrow();
  });

  it('should reject name too long', () => {
    const longName = 'a'.repeat(101);
    expect(() => CreateApiKeySchema.parse({
      name: longName,
    })).toThrow();
  });

  it('should reject invalid expiresIn', () => {
    expect(() => CreateApiKeySchema.parse({
      name: 'My Key',
      expiresIn: '60d',
    })).toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  describe('RegisterInput', () => {
    it('should match schema output', () => {
      const input: RegisterInput = {
        email: 'user@example.com',
        tier: 'pro',
      };
      
      expect(input.email).toBe('user@example.com');
    });
  });

  describe('LoginInput', () => {
    it('should match schema output', () => {
      const input: LoginInput = {
        email: 'user@example.com',
        password: 'password123',
      };
      
      expect(input.email).toBe('user@example.com');
    });
  });

  describe('RefreshTokenInput', () => {
    it('should match schema output', () => {
      const input: RefreshTokenInput = {
        refreshToken: 'token123',
      };
      
      expect(input.refreshToken).toBe('token123');
    });
  });

  describe('CreateApiKeyInput', () => {
    it('should match schema output', () => {
      const input: CreateApiKeyInput = {
        name: 'My Key',
        expiresIn: '90d',
      };
      
      expect(input.name).toBe('My Key');
    });
  });
});
