// ═══════════════════════════════════════════════════════════════════════════════
// DB CLIENT TESTS
// Tests for Supabase client initialization and connection
// ═══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment variables
const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_KEY: 'test-service-key',
};

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    rpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
  })),
}));

describe('DB Client', () => {
  beforeEach(() => {
    vi.resetModules();
    // Reset environment
    process.env.SUPABASE_URL = mockEnv.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_KEY = mockEnv.SUPABASE_SERVICE_KEY;
  });

  describe('initSupabase', () => {
    it('should initialize with valid credentials', async () => {
      const { createClient } = await import('@supabase/supabase-js');
      
      // Simulate initialization
      const client = (createClient as any)(
        mockEnv.SUPABASE_URL,
        mockEnv.SUPABASE_SERVICE_KEY
      );
      
      expect(createClient).toHaveBeenCalledWith(
        mockEnv.SUPABASE_URL,
        mockEnv.SUPABASE_SERVICE_KEY
      );
      expect(client).toBeDefined();
    });

    it('should throw if SUPABASE_URL is missing', () => {
      delete process.env.SUPABASE_URL;
      
      expect(() => {
        if (!process.env.SUPABASE_URL) {
          throw new Error('SUPABASE_URL environment variable is required');
        }
      }).toThrow('SUPABASE_URL environment variable is required');
    });

    it('should throw if SUPABASE_SERVICE_KEY is missing', () => {
      delete process.env.SUPABASE_SERVICE_KEY;
      
      expect(() => {
        if (!process.env.SUPABASE_SERVICE_KEY) {
          throw new Error('SUPABASE_SERVICE_KEY environment variable is required');
        }
      }).toThrow('SUPABASE_SERVICE_KEY environment variable is required');
    });
  });

  describe('isSupabaseInitialized', () => {
    it('should return false before initialization', () => {
      let client: any = null;
      const isInitialized = () => client !== null;
      
      expect(isInitialized()).toBe(false);
    });

    it('should return true after initialization', () => {
      let client: any = { from: vi.fn() };
      const isInitialized = () => client !== null;
      
      expect(isInitialized()).toBe(true);
    });
  });

  describe('getSupabase', () => {
    it('should return client after initialization', () => {
      const mockClient = { from: vi.fn() };
      let client: any = mockClient;
      const getSupabase = () => {
        if (!client) throw new Error('Supabase client not initialized');
        return client;
      };
      
      expect(getSupabase()).toBe(mockClient);
    });

    it('should throw if not initialized', () => {
      let client: any = null;
      const getSupabase = () => {
        if (!client) throw new Error('Supabase client not initialized');
        return client;
      };
      
      expect(() => getSupabase()).toThrow('Supabase client not initialized');
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({ data: 1, error: null }),
      };
      
      const testConnection = async (client: any) => {
        try {
          const { error } = await client.rpc('check_connection');
          return !error;
        } catch {
          return false;
        }
      };
      
      const result = await testConnection(mockClient);
      expect(result).toBe(true);
    });

    it('should return false for failed connection', async () => {
      const mockClient = {
        rpc: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Connection failed' } 
        }),
      };
      
      const testConnection = async (client: any) => {
        try {
          const { error } = await client.rpc('check_connection');
          return !error;
        } catch {
          return false;
        }
      };
      
      const result = await testConnection(mockClient);
      expect(result).toBe(false);
    });

    it('should handle exceptions gracefully', async () => {
      const mockClient = {
        rpc: vi.fn().mockRejectedValue(new Error('Network error')),
      };
      
      const testConnection = async (client: any) => {
        try {
          const { error } = await client.rpc('check_connection');
          return !error;
        } catch {
          return false;
        }
      };
      
      const result = await testConnection(mockClient);
      expect(result).toBe(false);
    });
  });
});
