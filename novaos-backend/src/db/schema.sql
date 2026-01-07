-- ═══════════════════════════════════════════════════════════════════════════════
-- NOVAOS DATABASE SCHEMA
-- Run this in Supabase SQL Editor: Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- USERS TABLE
-- Syncs with JWT users via external_id (your user_xxx IDs)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by external_id
CREATE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id);

-- ─────────────────────────────────────────────────────────────────────────────────
-- SETTINGS TABLE
-- User preferences (theme, default stance, notifications, etc.)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    theme VARCHAR(20) DEFAULT 'dark' CHECK (theme IN ('dark', 'light', 'system')),
    default_stance VARCHAR(20) DEFAULT 'lens' CHECK (default_stance IN ('lens', 'sword', 'shield', 'control')),
    haptic_feedback BOOLEAN DEFAULT TRUE,
    notifications JSONB DEFAULT '{"sparkReminders": true, "dailySummary": false}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by user_id
CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- ─────────────────────────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- Automatically updates the updated_at column on row changes
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to users table
DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to settings table
DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- Disabled for now since we use service key (bypasses RLS)
-- Enable later if you want frontend direct access
-- ─────────────────────────────────────────────────────────────────────────────────

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow service role full access (your backend)
CREATE POLICY "Service role has full access to users"
    ON users FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role has full access to settings"
    ON settings FOR ALL
    USING (true)
    WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- VERIFY SETUP
-- ─────────────────────────────────────────────────────────────────────────────────

-- Run this to verify tables were created:
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
