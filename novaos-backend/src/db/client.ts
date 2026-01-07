// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE CLIENT — Supabase PostgreSQL
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let supabase: SupabaseClient | null = null;
let initialized = false;

// ─────────────────────────────────────────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface SupabaseConfig {
  url: string;
  serviceKey: string;
}

/**
 * Initialize the Supabase client.
 * Call this once on server startup.
 */
export function initSupabase(config?: Partial<SupabaseConfig>): SupabaseClient {
  if (initialized && supabase) {
    return supabase;
  }

  const url = config?.url ?? process.env.SUPABASE_URL;
  const serviceKey = config?.serviceKey ?? process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      '[SUPABASE] Missing configuration. Set SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables.'
    );
  }

  supabase = createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: {
      schema: 'public',
    },
  });

  initialized = true;
  console.log('[SUPABASE] Client initialized');

  return supabase;
}

/**
 * Get the Supabase client.
 * Throws if not initialized.
 */
export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('[SUPABASE] Client not initialized. Call initSupabase() first.');
  }
  return supabase;
}

/**
 * Check if Supabase is initialized.
 */
export function isSupabaseInitialized(): boolean {
  return initialized && supabase !== null;
}

/**
 * Test the database connection.
 */
export async function testConnection(): Promise<boolean> {
  if (!supabase) {
    return false;
  }

  try {
    const { error } = await supabase.from('users').select('id').limit(1);
    if (error) {
      console.error('[SUPABASE] Connection test failed:', error.message);
      return false;
    }
    console.log('[SUPABASE] Connection test passed');
    return true;
  } catch (err) {
    console.error('[SUPABASE] Connection test error:', err);
    return false;
  }
}
