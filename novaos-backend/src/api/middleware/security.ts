// ═══════════════════════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE — Production Security Headers & Hardening
// Phase 20: Production Hardening
// ═══════════════════════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from 'express';

// ─────────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface SecurityConfig {
  // Environment
  isDevelopment: boolean;
  isProduction: boolean;
  
  // CORS
  allowedOrigins: string[];
  
  // CSP
  cspReportUri?: string;
  cspReportOnly?: boolean;
  
  // HSTS
  hstsMaxAge: number;  // seconds
  hstsIncludeSubDomains: boolean;
  hstsPreload: boolean;
  
  // Rate limiting
  trustProxy: boolean;
  
  // Custom
  customHeaders?: Record<string, string>;
}

export function loadSecurityConfig(): SecurityConfig {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';
  
  return {
    isDevelopment: nodeEnv === 'development',
    isProduction,
    
    // CORS origins
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',').map(s => s.trim()) ?? 
      (isProduction ? [] : ['http://localhost:3000', 'http://localhost:5173']),
    
    // CSP
    cspReportUri: process.env.CSP_REPORT_URI,
    cspReportOnly: process.env.CSP_REPORT_ONLY === 'true',
    
    // HSTS (2 years = 63072000 seconds)
    hstsMaxAge: parseInt(process.env.HSTS_MAX_AGE ?? '63072000', 10),
    hstsIncludeSubDomains: process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false',
    hstsPreload: process.env.HSTS_PRELOAD === 'true',
    
    // Proxy
    trustProxy: process.env.TRUST_PROXY === 'true' || isProduction,
    
    // Custom headers
    customHeaders: process.env.CUSTOM_SECURITY_HEADERS 
      ? JSON.parse(process.env.CUSTOM_SECURITY_HEADERS) 
      : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// SECURITY HEADERS MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Apply comprehensive security headers.
 * Implements Helmet-equivalent functionality.
 */
export function securityHeaders(config?: Partial<SecurityConfig>) {
  const cfg = { ...loadSecurityConfig(), ...config };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    // ═══════════════════════════════════════════════════════════════════════════
    // X-Content-Type-Options
    // Prevents MIME-sniffing attacks
    // ═══════════════════════════════════════════════════════════════════════════
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // X-Frame-Options
    // Prevents clickjacking attacks
    // ═══════════════════════════════════════════════════════════════════════════
    res.setHeader('X-Frame-Options', 'DENY');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // X-XSS-Protection
    // Legacy XSS protection (mostly for older browsers)
    // ═══════════════════════════════════════════════════════════════════════════
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // X-Download-Options
    // Prevents IE from executing downloads in site's context
    // ═══════════════════════════════════════════════════════════════════════════
    res.setHeader('X-Download-Options', 'noopen');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // X-Permitted-Cross-Domain-Policies
    // Restricts Adobe Flash and PDF cross-domain requests
    // ═══════════════════════════════════════════════════════════════════════════
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Referrer-Policy
    // Controls referrer information sent with requests
    // ═══════════════════════════════════════════════════════════════════════════
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // X-DNS-Prefetch-Control
    // Disables DNS prefetching to prevent info leakage
    // ═══════════════════════════════════════════════════════════════════════════
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Strict-Transport-Security (HSTS)
    // Forces HTTPS connections (production only)
    // ═══════════════════════════════════════════════════════════════════════════
    if (cfg.isProduction) {
      let hstsValue = `max-age=${cfg.hstsMaxAge}`;
      if (cfg.hstsIncludeSubDomains) {
        hstsValue += '; includeSubDomains';
      }
      if (cfg.hstsPreload) {
        hstsValue += '; preload';
      }
      res.setHeader('Strict-Transport-Security', hstsValue);
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Cache-Control for API responses
    // Prevents caching of sensitive data
    // ═══════════════════════════════════════════════════════════════════════════
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.setHeader('Surrogate-Control', 'no-store');
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Permissions-Policy (formerly Feature-Policy)
    // Restricts browser features
    // ═══════════════════════════════════════════════════════════════════════════
    res.setHeader('Permissions-Policy', [
      'accelerometer=()',
      'camera=()',
      'geolocation=()',
      'gyroscope=()',
      'magnetometer=()',
      'microphone=()',
      'payment=()',
      'usb=()',
      'interest-cohort=()',  // Blocks FLoC
    ].join(', '));
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Remove X-Powered-By
    // Hides server technology
    // ═══════════════════════════════════════════════════════════════════════════
    res.removeHeader('X-Powered-By');
    
    // ═══════════════════════════════════════════════════════════════════════════
    // Custom headers
    // ═══════════════════════════════════════════════════════════════════════════
    if (cfg.customHeaders) {
      for (const [key, value] of Object.entries(cfg.customHeaders)) {
        res.setHeader(key, value);
      }
    }
    
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONTENT SECURITY POLICY (CSP)
// ─────────────────────────────────────────────────────────────────────────────────

export interface CSPDirectives {
  defaultSrc?: string[];
  scriptSrc?: string[];
  styleSrc?: string[];
  imgSrc?: string[];
  fontSrc?: string[];
  connectSrc?: string[];
  frameSrc?: string[];
  objectSrc?: string[];
  mediaSrc?: string[];
  workerSrc?: string[];
  childSrc?: string[];
  formAction?: string[];
  frameAncestors?: string[];
  baseUri?: string[];
  upgradeInsecureRequests?: boolean;
  blockAllMixedContent?: boolean;
  reportUri?: string;
  reportTo?: string;
}

/**
 * Generate Content-Security-Policy header value
 */
function buildCSPHeader(directives: CSPDirectives): string {
  const parts: string[] = [];
  
  const directiveMap: Record<string, keyof CSPDirectives> = {
    'default-src': 'defaultSrc',
    'script-src': 'scriptSrc',
    'style-src': 'styleSrc',
    'img-src': 'imgSrc',
    'font-src': 'fontSrc',
    'connect-src': 'connectSrc',
    'frame-src': 'frameSrc',
    'object-src': 'objectSrc',
    'media-src': 'mediaSrc',
    'worker-src': 'workerSrc',
    'child-src': 'childSrc',
    'form-action': 'formAction',
    'frame-ancestors': 'frameAncestors',
    'base-uri': 'baseUri',
    'report-uri': 'reportUri',
    'report-to': 'reportTo',
  };
  
  for (const [header, key] of Object.entries(directiveMap)) {
    const value = directives[key];
    if (Array.isArray(value) && value.length > 0) {
      parts.push(`${header} ${value.join(' ')}`);
    } else if (typeof value === 'string' && value) {
      parts.push(`${header} ${value}`);
    }
  }
  
  if (directives.upgradeInsecureRequests) {
    parts.push('upgrade-insecure-requests');
  }
  
  if (directives.blockAllMixedContent) {
    parts.push('block-all-mixed-content');
  }
  
  return parts.join('; ');
}

/**
 * Content Security Policy middleware
 */
export function contentSecurityPolicy(directives?: Partial<CSPDirectives>, reportOnly = false) {
  const cfg = loadSecurityConfig();
  
  // Default CSP for API-only backend
  const defaultDirectives: CSPDirectives = {
    defaultSrc: ["'none'"],
    frameAncestors: ["'none'"],
    formAction: ["'self'"],
    baseUri: ["'self'"],
    upgradeInsecureRequests: cfg.isProduction,
    reportUri: cfg.cspReportUri,
  };
  
  const mergedDirectives = { ...defaultDirectives, ...directives };
  const cspValue = buildCSPHeader(mergedDirectives);
  
  const headerName = (reportOnly || cfg.cspReportOnly) 
    ? 'Content-Security-Policy-Report-Only'
    : 'Content-Security-Policy';
  
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader(headerName, cspValue);
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// CORS CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface CORSConfig {
  origins: string[] | '*';
  methods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  credentials: boolean;
  maxAge: number;
  preflightContinue: boolean;
}

/**
 * Enhanced CORS middleware with security checks
 */
export function corsMiddleware(config?: Partial<CORSConfig>) {
  const securityCfg = loadSecurityConfig();
  
  const defaults: CORSConfig = {
    origins: securityCfg.isProduction ? securityCfg.allowedOrigins : '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true,
    maxAge: 86400, // 24 hours
    preflightContinue: false,
  };
  
  const cfg = { ...defaults, ...config };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    
    // Check if origin is allowed
    let allowOrigin: string | null = null;
    
    if (cfg.origins === '*') {
      allowOrigin = '*';
    } else if (origin && cfg.origins.includes(origin)) {
      allowOrigin = origin;
    }
    
    if (allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowOrigin);
      
      if (cfg.credentials && allowOrigin !== '*') {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
    }
    
    res.setHeader('Access-Control-Allow-Methods', cfg.methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', cfg.allowedHeaders.join(', '));
    res.setHeader('Access-Control-Expose-Headers', cfg.exposedHeaders.join(', '));
    res.setHeader('Access-Control-Max-Age', cfg.maxAge.toString());
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
      if (cfg.preflightContinue) {
        next();
      } else {
        res.status(204).end();
      }
      return;
    }
    
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// HTTPS REDIRECT
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Redirect HTTP to HTTPS in production
 */
export function httpsRedirect() {
  const cfg = loadSecurityConfig();
  
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!cfg.isProduction) {
      return next();
    }
    
    // Check various headers for HTTPS
    const isHttps = 
      req.secure ||
      req.headers['x-forwarded-proto'] === 'https' ||
      req.headers['x-forwarded-ssl'] === 'on';
    
    if (!isHttps) {
      const host = req.headers.host ?? req.hostname;
      const redirectUrl = `https://${host}${req.url}`;
      return res.redirect(301, redirectUrl);
    }
    
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// REQUEST SIZE LIMITS
// ─────────────────────────────────────────────────────────────────────────────────

export interface RequestLimits {
  maxBodySize: string;  // e.g., '1mb', '100kb'
  maxUrlLength: number;
  maxHeaderSize: number;
  maxParameterCount: number;
}

/**
 * Enforce request size limits
 */
export function requestLimits(limits?: Partial<RequestLimits>) {
  const defaults: RequestLimits = {
    maxBodySize: '1mb',
    maxUrlLength: 2048,
    maxHeaderSize: 8192,
    maxParameterCount: 100,
  };
  
  const cfg = { ...defaults, ...limits };
  
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check URL length
    if (req.url.length > cfg.maxUrlLength) {
      res.status(414).json({
        error: 'URI Too Long',
        code: 'URI_TOO_LONG',
        maxLength: cfg.maxUrlLength,
      });
      return;
    }
    
    // Check header size (approximate)
    const headerSize = Object.entries(req.headers)
      .reduce((sum, [k, v]) => sum + k.length + (Array.isArray(v) ? v.join('').length : (v?.length ?? 0)), 0);
    
    if (headerSize > cfg.maxHeaderSize) {
      res.status(431).json({
        error: 'Request Header Fields Too Large',
        code: 'HEADERS_TOO_LARGE',
        maxSize: cfg.maxHeaderSize,
      });
      return;
    }
    
    // Check query parameter count
    const paramCount = Object.keys(req.query).length;
    if (paramCount > cfg.maxParameterCount) {
      res.status(400).json({
        error: 'Too Many Parameters',
        code: 'TOO_MANY_PARAMS',
        maxCount: cfg.maxParameterCount,
      });
      return;
    }
    
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// IP FILTERING
// ─────────────────────────────────────────────────────────────────────────────────

export interface IPFilterConfig {
  allowlist?: string[];
  blocklist?: string[];
  trustProxy: boolean;
}

/**
 * Get client IP address considering proxies
 */
export function getClientIP(req: Request, trustProxy = true): string {
  if (trustProxy) {
    // Check X-Forwarded-For header
    const xff = req.headers['x-forwarded-for'];
    if (xff) {
      const ips = Array.isArray(xff) ? xff[0] : xff.split(',')[0];
      if (ips) {
        return ips.trim();
      }
    }
    
    // Check X-Real-IP header
    const xri = req.headers['x-real-ip'];
    if (xri) {
      const ip = Array.isArray(xri) ? xri[0] : xri;
      if (ip) {
        return ip;
      }
    }
  }
  
  return req.socket?.remoteAddress ?? req.ip ?? 'unknown';
}

/**
 * IP allowlist/blocklist middleware
 */
export function ipFilter(config: IPFilterConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = getClientIP(req, config.trustProxy);
    
    // Check blocklist first
    if (config.blocklist?.includes(clientIP)) {
      res.status(403).json({
        error: 'Forbidden',
        code: 'IP_BLOCKED',
      });
      return;
    }
    
    // If allowlist exists, check it
    if (config.allowlist && config.allowlist.length > 0) {
      if (!config.allowlist.includes(clientIP)) {
        res.status(403).json({
          error: 'Forbidden',
          code: 'IP_NOT_ALLOWED',
        });
        return;
      }
    }
    
    next();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED SECURITY MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────────

export interface SecurityOptions {
  headers?: boolean;
  csp?: boolean | Partial<CSPDirectives>;
  cors?: boolean | Partial<CORSConfig>;
  httpsRedirect?: boolean;
  requestLimits?: boolean | Partial<RequestLimits>;
  ipFilter?: IPFilterConfig;
}

/**
 * Apply all security middleware with a single call
 */
export function applySecurity(options: SecurityOptions = {}) {
  const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];
  
  // HTTPS redirect (should be first)
  if (options.httpsRedirect !== false) {
    middlewares.push(httpsRedirect());
  }
  
  // Security headers
  if (options.headers !== false) {
    middlewares.push(securityHeaders());
  }
  
  // CSP
  if (options.csp !== false) {
    const cspDirectives = typeof options.csp === 'object' ? options.csp : undefined;
    middlewares.push(contentSecurityPolicy(cspDirectives));
  }
  
  // CORS
  if (options.cors !== false) {
    const corsConfig = typeof options.cors === 'object' ? options.cors : undefined;
    middlewares.push(corsMiddleware(corsConfig));
  }
  
  // Request limits
  if (options.requestLimits !== false) {
    const limits = typeof options.requestLimits === 'object' ? options.requestLimits : undefined;
    middlewares.push(requestLimits(limits));
  }
  
  // IP filtering
  if (options.ipFilter) {
    middlewares.push(ipFilter(options.ipFilter));
  }
  
  // Return combined middleware
  return (req: Request, res: Response, next: NextFunction): void => {
    let index = 0;
    
    const runNext = (err?: unknown): void => {
      if (err) {
        return next(err as Error);
      }
      
      if (index >= middlewares.length) {
        return next();
      }
      
      const middleware = middlewares[index++];
      if (!middleware) {
        return next();
      }
      try {
        middleware(req, res, runNext as NextFunction);
      } catch (error) {
        next(error);
      }
    };
    
    runNext();
  };
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ─────────────────────────────────────────────────────────────────────────────────

export {
  securityHeaders as helmet,  // Alias for familiarity
};
