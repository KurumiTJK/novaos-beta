// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY TESTS — Phase 20 Production Hardening Validation
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from 'vitest';
import {
  sanitizeValue,
  sanitizers,
  validators,
  loadSanitizationConfig,
  type SanitizationConfig,
} from '../api/middleware/sanitization.js';
import {
  CircuitBreaker,
  CircuitOpenError,
  CircuitTimeoutError,
  circuitRegistry,
} from '../services/circuit-breaker.js';

// ─────────────────────────────────────────────────────────────────────────────────
// INPUT SANITIZATION TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Input Sanitization', () => {
  let config: SanitizationConfig;
  
  beforeEach(() => {
    config = loadSanitizationConfig();
  });
  
  describe('String Sanitization', () => {
    it('should strip HTML tags', () => {
      const input = '<script>alert("xss")</script>Hello<b>World</b>';
      const result = sanitizeValue(input, config, 0, 'test');
      
      expect(result.result).not.toContain('<script>');
      expect(result.result).not.toContain('<b>');
      expect(result.sanitized).toBe(true);
    });
    
    it('should strip script injection patterns', () => {
      const input = 'javascript:alert(1)';
      const result = sanitizeValue(input, config, 0, 'test');
      
      expect(result.result).not.toContain('javascript:');
      expect(result.sanitized).toBe(true);
    });
    
    it('should strip null bytes', () => {
      const input = 'hello\x00world';
      const result = sanitizeValue(input, config, 0, 'test');
      
      // Null byte is simply removed, no space is inserted
      expect(result.result).toBe('helloworld');
      expect(result.sanitized).toBe(true);
    });
    
    it('should truncate long strings', () => {
      const input = 'a'.repeat(20000);
      const result = sanitizeValue(input, config, 0, 'test');
      
      expect((result.result as string).length).toBeLessThanOrEqual(config.maxStringLength);
      expect(result.sanitized).toBe(true);
    });
    
    it('should normalize unicode', () => {
      const input = 'café';  // With combining character
      const result = sanitizeValue(input, config, 0, 'test');
      
      expect(result.result).toBe(input.normalize('NFC'));
    });
    
    it('should normalize whitespace', () => {
      const input = '  hello    world  ';
      const result = sanitizeValue(input, config, 0, 'test');
      
      expect(result.result).toBe('hello world');
    });
  });
  
  describe('Object Sanitization', () => {
    it('should sanitize nested objects', () => {
      const input = {
        message: '<script>bad</script>safe text',
        nested: {
          value: 'javascript:alert(1)',
        },
      };
      
      const result = sanitizeValue(input, config, 0, 'test');
      const output = result.result as any;
      
      expect(output.message).not.toContain('<script>');
      expect(output.nested.value).not.toContain('javascript:');
    });
    
    it('should limit object depth', () => {
      let deep: any = { value: 'test' };
      for (let i = 0; i < 15; i++) {
        deep = { nested: deep };
      }
      
      const result = sanitizeValue(deep, { ...config, maxObjectDepth: 10 }, 0, 'test');
      
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.some(v => v.includes('too deep'))).toBe(true);
    });
    
    it('should limit object keys', () => {
      const input: Record<string, string> = {};
      for (let i = 0; i < 150; i++) {
        input[`key${i}`] = 'value';
      }
      
      const result = sanitizeValue(input, { ...config, maxObjectKeys: 100 }, 0, 'test');
      const output = result.result as Record<string, string>;
      
      expect(Object.keys(output).length).toBeLessThanOrEqual(100);
    });
  });
  
  describe('Array Sanitization', () => {
    it('should sanitize array elements', () => {
      const input = ['<script>bad</script>', 'safe', 'javascript:alert(1)'];
      
      const result = sanitizeValue(input, config, 0, 'test');
      const output = result.result as string[];
      
      expect(output[0]).not.toContain('<script>');
      expect(output[2]).not.toContain('javascript:');
    });
    
    it('should limit array length', () => {
      const input = Array(200).fill('item');
      
      const result = sanitizeValue(input, { ...config, maxArrayLength: 100 }, 0, 'test');
      const output = result.result as string[];
      
      expect(output.length).toBeLessThanOrEqual(100);
    });
  });
  
  describe('Dangerous Pattern Detection', () => {
    it('should detect path traversal', () => {
      expect(validators.hasPathTraversal('../etc/passwd')).toBe(true);
      expect(validators.hasPathTraversal('safe/path')).toBe(false);
    });
    
    it('should detect SQL injection', () => {
      expect(validators.hasSqlInjection("'; DROP TABLE users;--")).toBe(true);
      expect(validators.hasSqlInjection('normal query')).toBe(false);
    });
    
    it('should detect NoSQL injection', () => {
      expect(validators.hasNoSqlInjection({ $where: '1==1' })).toBe(true);
      expect(validators.hasNoSqlInjection({ name: 'test' })).toBe(false);
    });
    
    it('should detect command injection', () => {
      expect(validators.hasCommandInjection('$(whoami)')).toBe(true);
      expect(validators.hasCommandInjection('normal text')).toBe(false);
    });
  });
  
  describe('Specific Sanitizers', () => {
    it('should sanitize emails', () => {
      expect(sanitizers.sanitizeEmail('  TEST@Example.COM  ')).toBe('test@example.com');
      expect(sanitizers.sanitizeEmail('test<script>@example.com')).toBe('testscript@example.com');
    });
    
    it('should sanitize URLs', () => {
      expect(sanitizers.sanitizeUrl('https://example.com/path')).toBe('https://example.com/path');
      expect(sanitizers.sanitizeUrl('javascript:alert(1)')).toBeNull();
      expect(sanitizers.sanitizeUrl('ftp://example.com')).toBeNull();
    });
    
    it('should sanitize filenames', () => {
      expect(sanitizers.sanitizeFilename('test.txt')).toBe('test.txt');
      // '../../../etc/passwd' -> '.._.._.._etc_passwd' -> '._._._etc_passwd' -> '__._._etc_passwd'
      // (replace /, collapse .., replace leading .)
      expect(sanitizers.sanitizeFilename('../../../etc/passwd')).toBe('__._._etc_passwd');
      expect(sanitizers.sanitizeFilename('.hidden')).toBe('_hidden');
    });
    
    it('should sanitize IDs', () => {
      expect(sanitizers.sanitizeId('user_123')).toBe('user_123');
      expect(sanitizers.sanitizeId('user<script>123')).toBe('userscript123');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CIRCUIT BREAKER TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Circuit Breaker', () => {
  beforeEach(() => {
    circuitRegistry.clear();
  });
  
  describe('Basic Operations', () => {
    it('should allow calls when closed', async () => {
      const circuit = new CircuitBreaker({ name: 'test-closed' });
      
      const result = await circuit.fire(async () => 'success');
      
      expect(result).toBe('success');
      expect(circuit.getState()).toBe('closed');
    });
    
    it('should track successes', async () => {
      const circuit = new CircuitBreaker({ name: 'test-success' });
      
      await circuit.fire(async () => 'ok');
      await circuit.fire(async () => 'ok');
      
      const stats = circuit.getStats();
      expect(stats.successes).toBe(2);
      expect(stats.totalCalls).toBe(2);
    });
    
    it('should track failures', async () => {
      const circuit = new CircuitBreaker({ 
        name: 'test-failure',
        failureThreshold: 10, // High threshold to prevent opening
      });
      
      try {
        await circuit.fire(async () => { throw new Error('fail'); });
      } catch {
        // Expected
      }
      
      const stats = circuit.getStats();
      expect(stats.failures).toBe(1);
      expect(stats.consecutiveFailures).toBe(1);
    });
  });
  
  describe('State Transitions', () => {
    it('should open after failure threshold', async () => {
      const circuit = new CircuitBreaker({ 
        name: 'test-open',
        failureThreshold: 3,
        volumeThreshold: 1,
        failureWindow: 60000,
      });
      
      // Trigger failures
      for (let i = 0; i < 5; i++) {
        try {
          await circuit.fire(async () => { throw new Error('fail'); });
        } catch {
          // Expected
        }
      }
      
      expect(circuit.getState()).toBe('open');
    });
    
    it('should reject calls when open', async () => {
      const circuit = new CircuitBreaker({ name: 'test-reject' });
      circuit.tripOpen();
      
      await expect(circuit.fire(async () => 'ok')).rejects.toThrow(CircuitOpenError);
    });
    
    it('should transition to half-open after reset timeout', async () => {
      const circuit = new CircuitBreaker({ 
        name: 'test-half-open',
        resetTimeout: 100, // Fast for testing
      });
      
      circuit.tripOpen();
      expect(circuit.getState()).toBe('open');
      
      // Wait for reset
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(circuit.getState()).toBe('half-open');
    });
    
    it('should close after successes in half-open', async () => {
      const circuit = new CircuitBreaker({ 
        name: 'test-close',
        successThreshold: 2,
        resetTimeout: 50,
      });
      
      circuit.tripOpen();
      
      // Wait for half-open
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(circuit.getState()).toBe('half-open');
      
      // Success calls
      await circuit.fire(async () => 'ok');
      await circuit.fire(async () => 'ok');
      
      expect(circuit.getState()).toBe('closed');
    });
    
    it('should reopen on failure in half-open', async () => {
      const circuit = new CircuitBreaker({ 
        name: 'test-reopen',
        resetTimeout: 50,
      });
      
      circuit.tripOpen();
      
      // Wait for half-open
      await new Promise(resolve => setTimeout(resolve, 60));
      expect(circuit.getState()).toBe('half-open');
      
      // Fail
      try {
        await circuit.fire(async () => { throw new Error('fail'); });
      } catch {
        // Expected
      }
      
      expect(circuit.getState()).toBe('open');
    });
  });
  
  describe('Timeout Handling', () => {
    it('should timeout slow calls', async () => {
      const circuit = new CircuitBreaker({ 
        name: 'test-timeout',
        callTimeout: 50,
        failureThreshold: 10, // High to prevent opening
      });
      
      await expect(
        circuit.fire(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return 'too slow';
        })
      ).rejects.toThrow(CircuitTimeoutError);
    });
  });
  
  describe('Error Filtering', () => {
    it('should not count filtered errors as failures', async () => {
      const circuit = new CircuitBreaker({ 
        name: 'test-filter',
        errorFilter: (error) => !error.message.includes('ignore'),
      });
      
      // This error should be filtered
      try {
        await circuit.fire(async () => { throw new Error('ignore this'); });
      } catch {
        // Expected
      }
      
      expect(circuit.getStats().failures).toBe(0);
      
      // This error should NOT be filtered
      try {
        await circuit.fire(async () => { throw new Error('count this'); });
      } catch {
        // Expected
      }
      
      expect(circuit.getStats().failures).toBe(1);
    });
  });
  
  describe('Manual Controls', () => {
    it('should allow manual trip', () => {
      const circuit = new CircuitBreaker({ name: 'test-trip' });
      
      circuit.tripOpen();
      
      expect(circuit.getState()).toBe('open');
    });
    
    it('should allow manual reset', () => {
      const circuit = new CircuitBreaker({ name: 'test-reset' });
      
      circuit.tripOpen();
      circuit.reset();
      
      expect(circuit.getState()).toBe('closed');
    });
  });
  
  describe('Registry', () => {
    it('should get or create circuits', () => {
      const circuit1 = circuitRegistry.getOrCreate('test-registry');
      const circuit2 = circuitRegistry.getOrCreate('test-registry');
      
      expect(circuit1).toBe(circuit2);
    });
    
    it('should get all stats', () => {
      circuitRegistry.getOrCreate('circuit-a');
      circuitRegistry.getOrCreate('circuit-b');
      
      const stats = circuitRegistry.getAllStats();
      
      expect(Object.keys(stats)).toContain('circuit-a');
      expect(Object.keys(stats)).toContain('circuit-b');
    });
    
    it('should reset all circuits', () => {
      const circuit1 = circuitRegistry.getOrCreate('reset-a');
      const circuit2 = circuitRegistry.getOrCreate('reset-b');
      
      circuit1.tripOpen();
      circuit2.tripOpen();
      
      circuitRegistry.resetAll();
      
      expect(circuit1.getState()).toBe('closed');
      expect(circuit2.getState()).toBe('closed');
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SECURITY HEADERS TESTS (Integration)
// ─────────────────────────────────────────────────────────────────────────────────

describe('Security Headers', () => {
  // These would typically be integration tests with a test server
  // For unit tests, we verify the middleware functions exist and are callable
  
  it('should export security middleware functions', async () => {
    const { 
      securityHeaders, 
      contentSecurityPolicy, 
      corsMiddleware,
      applySecurity,
    } = await import('../api/middleware/security.js');
    
    expect(typeof securityHeaders).toBe('function');
    expect(typeof contentSecurityPolicy).toBe('function');
    expect(typeof corsMiddleware).toBe('function');
    expect(typeof applySecurity).toBe('function');
  });
  
  it('should load security config', async () => {
    const { loadSecurityConfig } = await import('../api/middleware/security.js');
    
    const config = loadSecurityConfig();
    
    expect(config).toHaveProperty('isDevelopment');
    expect(config).toHaveProperty('isProduction');
    expect(config).toHaveProperty('hstsMaxAge');
    expect(config).toHaveProperty('allowedOrigins');
  });
});
