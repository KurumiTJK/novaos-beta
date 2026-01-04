// ═══════════════════════════════════════════════════════════════════════════════
// SSRF PROTECTION — Server-Side Request Forgery Prevention
// NovaOS Security Module
// ═══════════════════════════════════════════════════════════════════════════════
//
// Prevents attacks where malicious users trick the server into making requests to:
// - Internal IPs (127.0.0.1, 10.x.x.x, 192.168.x.x, 172.16-31.x.x)
// - Cloud metadata endpoints (169.254.169.254)
// - Local services (localhost, internal hostnames)
//
// Usage:
//   import { ssrfGuard, isUrlSafe } from '../security/ssrf/index.js';
//   
//   // Check URL before fetching
//   const result = await ssrfGuard.validate(url);
//   if (!result.safe) {
//     throw new Error(result.reason);
//   }
//
// ═══════════════════════════════════════════════════════════════════════════════

import { URL } from 'url';
import dns from 'dns/promises';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface SSRFValidationResult {
  safe: boolean;
  url?: string;
  reason?: string;
  resolvedIp?: string;
}

export interface SSRFConfig {
  /** Allow HTTP (not just HTTPS) */
  allowHttp: boolean;
  
  /** Allowed ports (default: 80, 443) */
  allowedPorts: number[];
  
  /** Blocked hostnames */
  blockedHostnames: string[];
  
  /** Allow localhost (DANGEROUS - only for testing) */
  allowLocalhost: boolean;
  
  /** DNS resolution timeout in ms */
  dnsTimeoutMs: number;
  
  /** Allowed domains whitelist (if set, only these domains allowed) */
  allowedDomains?: string[];
}

export const DEFAULT_SSRF_CONFIG: SSRFConfig = {
  allowHttp: false,
  allowedPorts: [80, 443],
  blockedHostnames: [
    'localhost',
    'metadata.google.internal',
    'metadata.goog',
    '169.254.169.254',
  ],
  allowLocalhost: false,
  dnsTimeoutMs: 5000,
};

// ─────────────────────────────────────────────────────────────────────────────────
// PRIVATE IP RANGES
// ─────────────────────────────────────────────────────────────────────────────────

const PRIVATE_IP_RANGES = [
  // Loopback
  { start: '127.0.0.0', end: '127.255.255.255' },
  
  // Private networks
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
  
  // Link-local (includes AWS/GCP/Azure metadata)
  { start: '169.254.0.0', end: '169.254.255.255' },
  
  // Current network
  { start: '0.0.0.0', end: '0.255.255.255' },
];

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  // Added non-null assertions to fix TS2532
  return (parts[0]! << 24) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

function isPrivateIp(ip: string): boolean {
  // Handle IPv6 localhost
  if (ip === '::1' || ip === '::ffff:127.0.0.1') {
    return true;
  }
  
  // Handle IPv4-mapped IPv6
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  
  // Validate IPv4 format
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipv4Regex.test(ip)) {
    // For non-IPv4, assume private (conservative)
    return true;
  }
  
  const ipNum = ipToNumber(ip);
  
  for (const range of PRIVATE_IP_RANGES) {
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);
    
    if (ipNum >= startNum && ipNum <= endNum) {
      return true;
    }
  }
  
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────────
// SSRF GUARD CLASS
// ─────────────────────────────────────────────────────────────────────────────────

export class SSRFGuard {
  private readonly config: SSRFConfig;
  
  constructor(config?: Partial<SSRFConfig>) {
    this.config = { ...DEFAULT_SSRF_CONFIG, ...config };
  }
  
  /**
   * Validate a URL for SSRF safety.
   */
  async validate(urlString: string): Promise<SSRFValidationResult> {
    try {
      // Parse URL
      const url = new URL(urlString);
      
      // Check protocol
      if (!this.config.allowHttp && url.protocol === 'http:') {
        return { safe: false, reason: 'HTTP not allowed, use HTTPS' };
      }
      
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { safe: false, reason: `Protocol '${url.protocol}' not allowed` };
      }
      
      // Check port
      const port = url.port
        ? parseInt(url.port, 10)
        : url.protocol === 'https:' ? 443 : 80;
      
      if (!this.config.allowedPorts.includes(port)) {
        return { safe: false, reason: `Port ${port} not allowed` };
      }
      
      // Check hostname
      const hostname = url.hostname.toLowerCase();
      
      // Check blocked hostnames
      for (const blocked of this.config.blockedHostnames) {
        if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
          return { safe: false, reason: `Hostname '${hostname}' is blocked` };
        }
      }
      
      // Check localhost
      if (!this.config.allowLocalhost) {
        if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
          return { safe: false, reason: 'Localhost not allowed' };
        }
      }
      
      // Check allowed domains whitelist
      if (this.config.allowedDomains && this.config.allowedDomains.length > 0) {
        const isAllowed = this.config.allowedDomains.some(
          domain => hostname === domain || hostname.endsWith(`.${domain}`)
        );
        
        if (!isAllowed) {
          return { safe: false, reason: `Domain '${hostname}' not in allowlist` };
        }
      }
      
      // Resolve DNS and check IP
      const resolvedIp = await this.resolveHostname(hostname);
      
      if (!resolvedIp) {
        return { safe: false, reason: `Could not resolve hostname '${hostname}'` };
      }
      
      if (isPrivateIp(resolvedIp)) {
        return { 
          safe: false, 
          reason: `Resolved IP '${resolvedIp}' is a private/internal address`,
          resolvedIp,
        };
      }
      
      return { safe: true, url: urlString, resolvedIp };
    } catch (error) {
      if (error instanceof TypeError) {
        return { safe: false, reason: 'Invalid URL format' };
      }
      return { safe: false, reason: `Validation error: ${error}` };
    }
  }
  
  /**
   * Resolve hostname to IP with timeout.
   */
  private async resolveHostname(hostname: string): Promise<string | null> {
    // If it's already an IP, validate directly
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (ipv4Regex.test(hostname)) {
      return hostname;
    }
    
    try {
      const addresses = await Promise.race([
        dns.resolve4(hostname),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('DNS timeout')), this.config.dnsTimeoutMs)
        ),
      ]);
      
      return addresses[0] ?? null;
    } catch {
      return null;
    }
  }
  
  /**
   * Quick synchronous check (no DNS resolution).
   * Use validate() for full protection.
   */
  quickCheck(urlString: string): SSRFValidationResult {
    try {
      const url = new URL(urlString);
      
      if (!this.config.allowHttp && url.protocol === 'http:') {
        return { safe: false, reason: 'HTTP not allowed' };
      }
      
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { safe: false, reason: 'Invalid protocol' };
      }
      
      const hostname = url.hostname.toLowerCase();
      
      // Check if hostname is an IP
      const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipv4Regex.test(hostname)) {
        if (isPrivateIp(hostname)) {
          return { safe: false, reason: 'Private IP not allowed' };
        }
      }
      
      // Check blocked hostnames
      for (const blocked of this.config.blockedHostnames) {
        if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
          return { safe: false, reason: 'Blocked hostname' };
        }
      }
      
      if (!this.config.allowLocalhost && hostname === 'localhost') {
        return { safe: false, reason: 'Localhost not allowed' };
      }
      
      return { safe: true, url: urlString };
    } catch {
      return { safe: false, reason: 'Invalid URL' };
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let ssrfGuard: SSRFGuard | null = null;

export function initSSRFGuard(config?: Partial<SSRFConfig>): SSRFGuard {
  ssrfGuard = new SSRFGuard(config);
  return ssrfGuard;
}

export function getSSRFGuard(): SSRFGuard {
  if (!ssrfGuard) {
    ssrfGuard = new SSRFGuard();
  }
  return ssrfGuard;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Validate a URL for SSRF safety.
 */
export async function validateUrl(url: string): Promise<SSRFValidationResult> {
  return getSSRFGuard().validate(url);
}

/**
 * Quick check without DNS resolution.
 */
export function isUrlSafe(url: string): boolean {
  return getSSRFGuard().quickCheck(url).safe;
}

/**
 * Check if an IP address is private/internal.
 */
export { isPrivateIp };
