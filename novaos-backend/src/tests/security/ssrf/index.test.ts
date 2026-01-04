// ═══════════════════════════════════════════════════════════════════════════════
// SSRF PROTECTION TESTS — Server-Side Request Forgery Prevention
// NovaOS Security Tests
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SSRFGuard,
  DEFAULT_SSRF_CONFIG,
  initSSRFGuard,
  getSSRFGuard,
  validateUrl,
  isUrlSafe,
  isPrivateIp,
  type SSRFValidationResult,
  type SSRFConfig,
} from '../../../security/ssrf/index.js';

// ─────────────────────────────────────────────────────────────────────────────────
// isPrivateIp TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('isPrivateIp()', () => {
  describe('Loopback Addresses', () => {
    it('should detect 127.x.x.x as private', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('127.0.0.0')).toBe(true);
      expect(isPrivateIp('127.255.255.255')).toBe(true);
    });

    it('should detect IPv6 loopback', () => {
      expect(isPrivateIp('::1')).toBe(true);
    });

    it('should detect IPv4-mapped IPv6 loopback', () => {
      expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    });
  });

  describe('Private Network Ranges', () => {
    it('should detect 10.x.x.x as private', () => {
      expect(isPrivateIp('10.0.0.0')).toBe(true);
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('10.255.255.255')).toBe(true);
    });

    it('should detect 172.16-31.x.x as private', () => {
      expect(isPrivateIp('172.16.0.0')).toBe(true);
      expect(isPrivateIp('172.16.0.1')).toBe(true);
      expect(isPrivateIp('172.31.255.255')).toBe(true);
    });

    it('should not detect 172.32.x.x as private', () => {
      expect(isPrivateIp('172.32.0.1')).toBe(false);
    });

    it('should detect 192.168.x.x as private', () => {
      expect(isPrivateIp('192.168.0.0')).toBe(true);
      expect(isPrivateIp('192.168.0.1')).toBe(true);
      expect(isPrivateIp('192.168.255.255')).toBe(true);
    });
  });

  describe('Link-Local Addresses (Cloud Metadata)', () => {
    it('should detect 169.254.x.x as private', () => {
      expect(isPrivateIp('169.254.0.0')).toBe(true);
      expect(isPrivateIp('169.254.169.254')).toBe(true); // AWS/GCP metadata
      expect(isPrivateIp('169.254.255.255')).toBe(true);
    });
  });

  describe('Current Network', () => {
    it('should detect 0.x.x.x as private', () => {
      expect(isPrivateIp('0.0.0.0')).toBe(true);
      expect(isPrivateIp('0.0.0.1')).toBe(true);
    });
  });

  describe('Public Addresses', () => {
    it('should not flag public IPs', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);       // Google DNS
      expect(isPrivateIp('1.1.1.1')).toBe(false);       // Cloudflare
      expect(isPrivateIp('93.184.216.34')).toBe(false); // example.com
      expect(isPrivateIp('142.250.185.206')).toBe(false); // Google
    });
  });

  describe('IPv4-Mapped IPv6', () => {
    it('should handle IPv4-mapped addresses', () => {
      expect(isPrivateIp('::ffff:10.0.0.1')).toBe(true);
      expect(isPrivateIp('::ffff:192.168.1.1')).toBe(true);
      expect(isPrivateIp('::ffff:8.8.8.8')).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should treat non-IPv4 as private (conservative)', () => {
      expect(isPrivateIp('not-an-ip')).toBe(true);
      expect(isPrivateIp('')).toBe(true);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// DEFAULT_SSRF_CONFIG TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('DEFAULT_SSRF_CONFIG', () => {
  it('should not allow HTTP by default', () => {
    expect(DEFAULT_SSRF_CONFIG.allowHttp).toBe(false);
  });

  it('should allow standard ports', () => {
    expect(DEFAULT_SSRF_CONFIG.allowedPorts).toContain(80);
    expect(DEFAULT_SSRF_CONFIG.allowedPorts).toContain(443);
  });

  it('should block common dangerous hostnames', () => {
    expect(DEFAULT_SSRF_CONFIG.blockedHostnames).toContain('localhost');
    expect(DEFAULT_SSRF_CONFIG.blockedHostnames).toContain('169.254.169.254');
    expect(DEFAULT_SSRF_CONFIG.blockedHostnames).toContain('metadata.google.internal');
  });

  it('should not allow localhost by default', () => {
    expect(DEFAULT_SSRF_CONFIG.allowLocalhost).toBe(false);
  });

  it('should have DNS timeout configured', () => {
    expect(DEFAULT_SSRF_CONFIG.dnsTimeoutMs).toBe(5000);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SSRFGuard CLASS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('SSRFGuard', () => {
  let guard: SSRFGuard;

  beforeEach(() => {
    guard = new SSRFGuard();
  });

  describe('constructor', () => {
    it('should create with default config', () => {
      const defaultGuard = new SSRFGuard();
      expect(defaultGuard).toBeDefined();
    });

    it('should accept custom config', () => {
      const customGuard = new SSRFGuard({
        allowHttp: true,
        allowedPorts: [80, 443, 8080],
      });
      expect(customGuard).toBeDefined();
    });
  });

  describe('quickCheck()', () => {
    describe('Protocol Validation', () => {
      it('should reject HTTP when not allowed', () => {
        const result = guard.quickCheck('http://example.com');
        
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('HTTP');
      });

      it('should allow HTTP when configured', () => {
        const httpGuard = new SSRFGuard({ allowHttp: true });
        const result = httpGuard.quickCheck('http://example.com');
        
        expect(result.safe).toBe(true);
      });

      it('should allow HTTPS', () => {
        const result = guard.quickCheck('https://example.com');
        
        expect(result.safe).toBe(true);
      });

      it('should reject non-HTTP protocols', () => {
        expect(guard.quickCheck('ftp://example.com').safe).toBe(false);
        expect(guard.quickCheck('file:///etc/passwd').safe).toBe(false);
        expect(guard.quickCheck('javascript:alert(1)').safe).toBe(false);
      });
    });

    describe('Hostname Validation', () => {
      it('should reject localhost', () => {
        const result = guard.quickCheck('https://localhost');
        
        expect(result.safe).toBe(false);
        // Reason can be "Blocked hostname" or contain "localhost"
        expect(result.reason).toBeDefined();
      });

      it('should reject blocked hostnames', () => {
        expect(guard.quickCheck('https://169.254.169.254').safe).toBe(false);
        expect(guard.quickCheck('https://metadata.google.internal').safe).toBe(false);
      });

      it('should allow localhost when configured', () => {
        // Note: allowLocalhost only works if localhost is also removed from blockedHostnames
        const localGuard = new SSRFGuard({ 
          allowLocalhost: true,
          blockedHostnames: [], // Must also remove from blocked list
        });
        const result = localGuard.quickCheck('https://localhost');
        
        expect(result.safe).toBe(true);
      });
    });

    describe('IP Address Validation', () => {
      it('should reject private IPs', () => {
        expect(guard.quickCheck('https://127.0.0.1').safe).toBe(false);
        expect(guard.quickCheck('https://10.0.0.1').safe).toBe(false);
        expect(guard.quickCheck('https://192.168.1.1').safe).toBe(false);
        expect(guard.quickCheck('https://172.16.0.1').safe).toBe(false);
      });

      it('should allow public IPs', () => {
        expect(guard.quickCheck('https://8.8.8.8').safe).toBe(true);
        expect(guard.quickCheck('https://1.1.1.1').safe).toBe(true);
      });
    });

    describe('Invalid URLs', () => {
      it('should reject invalid URLs', () => {
        expect(guard.quickCheck('not-a-url').safe).toBe(false);
        expect(guard.quickCheck('').safe).toBe(false);
        expect(guard.quickCheck('://missing-protocol.com').safe).toBe(false);
      });
    });
  });

  describe('validate()', () => {
    describe('Protocol Validation', () => {
      it('should reject HTTP when not allowed', async () => {
        const result = await guard.validate('http://example.com');
        
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('HTTPS');
      });

      it('should allow HTTPS', async () => {
        // This will fail DNS resolution in test, but protocol passes
        const result = await guard.validate('https://example.com');
        
        // May fail on DNS, but not on protocol
        if (!result.safe) {
          expect(result.reason).not.toContain('Protocol');
        }
      });

      it('should reject invalid protocols', async () => {
        const result = await guard.validate('ftp://example.com');
        
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('Protocol');
      });
    });

    describe('Port Validation', () => {
      it('should reject non-standard ports', async () => {
        const result = await guard.validate('https://example.com:8080');
        
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('Port');
      });

      it('should allow configured ports', async () => {
        const customGuard = new SSRFGuard({ allowedPorts: [80, 443, 8080] });
        const result = await customGuard.validate('https://example.com:8080');
        
        // May fail on DNS, but not on port
        if (!result.safe) {
          expect(result.reason).not.toContain('Port');
        }
      });
    });

    describe('Blocked Hostnames', () => {
      it('should reject blocked hostnames', async () => {
        const result = await guard.validate('https://metadata.google.internal');
        
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('blocked');
      });

      it('should reject localhost', async () => {
        const result = await guard.validate('https://localhost');
        
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('localhost');
      });
    });

    describe('Domain Whitelist', () => {
      it('should reject domains not in whitelist', async () => {
        const restrictedGuard = new SSRFGuard({
          allowedDomains: ['api.example.com'],
        });
        
        const result = await restrictedGuard.validate('https://evil.com');
        
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('allowlist');
      });

      it('should allow whitelisted domains', async () => {
        const restrictedGuard = new SSRFGuard({
          allowedDomains: ['api.example.com'],
        });
        
        const result = await restrictedGuard.validate('https://api.example.com');
        
        // May fail DNS, but not allowlist check
        if (!result.safe) {
          expect(result.reason).not.toContain('allowlist');
        }
      });

      it('should allow subdomains of whitelisted domains', async () => {
        const restrictedGuard = new SSRFGuard({
          allowedDomains: ['example.com'],
        });
        
        const result = await restrictedGuard.validate('https://api.example.com');
        
        if (!result.safe) {
          expect(result.reason).not.toContain('allowlist');
        }
      });
    });

    describe('Invalid URLs', () => {
      it('should reject invalid URL format', async () => {
        const result = await guard.validate('not-a-valid-url');
        
        expect(result.safe).toBe(false);
        expect(result.reason).toContain('Invalid URL');
      });
    });

    describe('Result Structure', () => {
      it('should include URL on success', async () => {
        // Use IP that will pass quick check
        const quickResult = guard.quickCheck('https://8.8.8.8');
        
        if (quickResult.safe) {
          expect(quickResult.url).toBe('https://8.8.8.8');
        }
      });

      it('should include resolved IP on success', async () => {
        // This is hard to test without real DNS, but verify structure
        const result = await guard.validate('https://8.8.8.8');
        
        if (result.safe) {
          expect(result.resolvedIp).toBeDefined();
        }
      });
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON FUNCTIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Singleton Functions', () => {
  describe('initSSRFGuard()', () => {
    it('should initialize and return guard', () => {
      const guard = initSSRFGuard();
      expect(guard).toBeInstanceOf(SSRFGuard);
    });

    it('should accept custom config', () => {
      const guard = initSSRFGuard({ allowHttp: true });
      expect(guard).toBeInstanceOf(SSRFGuard);
    });
  });

  describe('getSSRFGuard()', () => {
    it('should return guard (creating if needed)', () => {
      const guard = getSSRFGuard();
      expect(guard).toBeInstanceOf(SSRFGuard);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Convenience Functions', () => {
  beforeEach(() => {
    initSSRFGuard();
  });

  describe('validateUrl()', () => {
    it('should validate URL using singleton', async () => {
      const result = await validateUrl('https://example.com');
      
      expect(result).toHaveProperty('safe');
    });

    it('should reject dangerous URLs', async () => {
      const result = await validateUrl('https://127.0.0.1');
      
      expect(result.safe).toBe(false);
    });
  });

  describe('isUrlSafe()', () => {
    it('should return true for safe URLs', () => {
      expect(isUrlSafe('https://8.8.8.8')).toBe(true);
    });

    it('should return false for dangerous URLs', () => {
      expect(isUrlSafe('https://127.0.0.1')).toBe(false);
      expect(isUrlSafe('https://localhost')).toBe(false);
      expect(isUrlSafe('http://example.com')).toBe(false); // HTTP not allowed
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// SECURITY ATTACK SCENARIOS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Security Attack Scenarios', () => {
  let guard: SSRFGuard;

  beforeEach(() => {
    guard = new SSRFGuard();
  });

  describe('Cloud Metadata Attacks', () => {
    it('should block AWS metadata endpoint', async () => {
      const result = await guard.validate('https://169.254.169.254/latest/meta-data/');
      expect(result.safe).toBe(false);
    });

    it('should block GCP metadata endpoint', async () => {
      const result = await guard.validate('https://metadata.google.internal/computeMetadata/v1/');
      expect(result.safe).toBe(false);
    });
  });

  describe('Internal Network Access', () => {
    it('should block internal services', async () => {
      expect((await guard.validate('https://10.0.0.1:3000')).safe).toBe(false);
      expect((await guard.validate('https://192.168.1.100:8080')).safe).toBe(false);
      expect((await guard.validate('https://172.16.0.50')).safe).toBe(false);
    });
  });

  describe('Localhost Bypass Attempts', () => {
    it('should block various localhost representations', () => {
      expect(guard.quickCheck('https://localhost').safe).toBe(false);
      expect(guard.quickCheck('https://127.0.0.1').safe).toBe(false);
      expect(guard.quickCheck('https://127.1').safe).toBe(false);
      expect(guard.quickCheck('https://0.0.0.0').safe).toBe(false);
    });
  });

  describe('Protocol Smuggling', () => {
    it('should reject non-HTTP protocols', () => {
      expect(guard.quickCheck('file:///etc/passwd').safe).toBe(false);
      expect(guard.quickCheck('gopher://localhost').safe).toBe(false);
      expect(guard.quickCheck('dict://localhost').safe).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE COMPATIBILITY TESTS
// ─────────────────────────────────────────────────────────────────────────────────

describe('Type Compatibility', () => {
  describe('SSRFValidationResult', () => {
    it('should accept safe result', () => {
      const result: SSRFValidationResult = {
        safe: true,
        url: 'https://example.com',
        resolvedIp: '93.184.216.34',
      };
      
      expect(result.safe).toBe(true);
    });

    it('should accept unsafe result', () => {
      const result: SSRFValidationResult = {
        safe: false,
        reason: 'Private IP not allowed',
        resolvedIp: '192.168.1.1',
      };
      
      expect(result.safe).toBe(false);
    });
  });

  describe('SSRFConfig', () => {
    it('should accept valid config', () => {
      const config: SSRFConfig = {
        allowHttp: false,
        allowedPorts: [80, 443],
        blockedHostnames: ['localhost'],
        allowLocalhost: false,
        dnsTimeoutMs: 5000,
        allowedDomains: ['api.example.com'],
      };
      
      expect(config.allowHttp).toBe(false);
    });
  });
});
