// ═══════════════════════════════════════════════════════════════════════════════
// NOVAOS BACKEND — Server Entry Point
// ═══════════════════════════════════════════════════════════════════════════════

import express from 'express';
import cors from 'cors';
import { createRouter, errorHandler } from './api/routes.js';

// ─────────────────────────────────────────────────────────────────────────────────
// ENVIRONMENT CONFIG
// ─────────────────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const NODE_ENV = process.env.NODE_ENV ?? 'development';

// Provider configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PREFERRED_PROVIDER = (process.env.PREFERRED_PROVIDER as 'openai' | 'gemini' | 'mock') ?? 'openai';
const USE_MOCK = process.env.USE_MOCK_PROVIDER === 'true';

// Auth configuration
const REQUIRE_AUTH = process.env.REQUIRE_AUTH === 'true';

// ─────────────────────────────────────────────────────────────────────────────────
// SERVER SETUP
// ─────────────────────────────────────────────────────────────────────────────────

const app = express();

// CORS
app.use(cors({
  origin: NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') ?? []
    : '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// Body parsing
app.use(express.json({ limit: '1mb' }));

// Request logging
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─────────────────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────────────────

// Health check at root for load balancers
app.get('/', (_req, res) => {
  res.json({ status: 'ok', service: 'novaos-backend' });
});

// API routes
const router = createRouter({
  openaiApiKey: OPENAI_API_KEY,
  geminiApiKey: GEMINI_API_KEY,
  preferredProvider: PREFERRED_PROVIDER,
  useMockProvider: USE_MOCK,
  requireAuth: REQUIRE_AUTH,
});

app.use('/api/v1', router);

// Error handler (must be last)
app.use(errorHandler);

// ─────────────────────────────────────────────────────────────────────────────────
// START SERVER
// ─────────────────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  const providerStatus = USE_MOCK 
    ? 'mock' 
    : [OPENAI_API_KEY ? 'openai' : '', GEMINI_API_KEY ? 'gemini' : ''].filter(Boolean).join(', ') || 'none (mock fallback)';
  
  console.log(`
╔═══════════════════════════════════════════════════════════════════╗
║                     NOVAOS BACKEND v3.0.0                        ║
╠═══════════════════════════════════════════════════════════════════╣
║  Environment:  ${NODE_ENV.padEnd(49)}║
║  Port:         ${String(PORT).padEnd(49)}║
║  Providers:    ${providerStatus.padEnd(49)}║
║  Preferred:    ${PREFERRED_PROVIDER.padEnd(49)}║
║  Auth:         ${(REQUIRE_AUTH ? 'required' : 'optional').padEnd(49)}║
╚═══════════════════════════════════════════════════════════════════╝

Endpoints:
  GET  /                       Root health check
  GET  /api/v1/health          Detailed health status
  GET  /api/v1/version         Version and feature info
  GET  /api/v1/providers       Available providers
  
  POST /api/v1/auth/register   Get token (dev mode)
  GET  /api/v1/auth/verify     Verify token
  GET  /api/v1/auth/status     User status
  
  POST /api/v1/chat            Main chat endpoint
  POST /api/v1/parse-command   Explicit action parsing
  
  POST /api/v1/admin/block-user    Block a user
  POST /api/v1/admin/unblock-user  Unblock a user

Ready to enforce the Nova Constitution.
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[SERVER] SIGTERM received, shutting down...');
  server.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SERVER] SIGINT received, shutting down...');
  server.close(() => {
    console.log('[SERVER] Server closed');
    process.exit(0);
  });
});

export { app, server };
