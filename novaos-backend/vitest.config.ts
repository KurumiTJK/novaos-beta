import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    
    // ─────────────────────────────────────────────────────────────────────────────
    // COVERAGE CONFIGURATION
    // ─────────────────────────────────────────────────────────────────────────────
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      
      // Include all source code for coverage
      include: [
        'src/db/**/*.ts',
        'src/services/**/*.ts',
        'src/gates/**/*.ts',
        'src/pipeline/**/*.ts',
        'src/api/**/*.ts',
        'src/security/**/*.ts',
        'src/core/**/*.ts',
      ],
      
      // Exclude non-testable files
      exclude: [
        'src/tests/**',
        'src/**/*.d.ts',
        'src/**/index.ts',        // Re-export files
        'src/**/types.ts',        // Type definitions
        'src/server.ts',          // Entry point
        'src/config/**',          // Configuration
        'src/observability/**',   // Logging/monitoring
      ],
      
      // Coverage thresholds (enforce minimum coverage)
      thresholds: {
        // Start with lower thresholds, increase as you add tests
        statements: 40,
        branches: 30,
        functions: 40,
        lines: 40,
      },
    },
    
    // ─────────────────────────────────────────────────────────────────────────────
    // TIMEOUTS
    // ─────────────────────────────────────────────────────────────────────────────
    testTimeout: 10000,
    hookTimeout: 10000,
    
    // ─────────────────────────────────────────────────────────────────────────────
    // REPORTER
    // ─────────────────────────────────────────────────────────────────────────────
    reporters: ['verbose'],
    
    // ─────────────────────────────────────────────────────────────────────────────
    // ISOLATION
    // ─────────────────────────────────────────────────────────────────────────────
    isolate: true,
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true, // Run tests sequentially for DB tests
      },
    },
  },
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PATH ALIASES
  // ─────────────────────────────────────────────────────────────────────────────
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@db': path.resolve(__dirname, './src/db'),
      '@services': path.resolve(__dirname, './src/services'),
      '@gates': path.resolve(__dirname, './src/gates'),
      '@pipeline': path.resolve(__dirname, './src/pipeline'),
      '@api': path.resolve(__dirname, './src/api'),
      '@security': path.resolve(__dirname, './src/security'),
      '@core': path.resolve(__dirname, './src/core'),
    },
  },
});
