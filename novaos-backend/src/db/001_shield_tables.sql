-- ═══════════════════════════════════════════════════════════════════════════════
-- SHIELD SERVICE — Database Schema
-- Run this migration in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- NOTE: user_id is TEXT (not UUID) to match NovaOS's string-based user IDs
-- e.g., "user_dGVzdF9zaGllbGRA"
--
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- DROP EXISTING TABLES (if re-running migration)
-- ─────────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS shield_crisis_sessions CASCADE;
DROP TABLE IF EXISTS shield_activations CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────────
-- SHIELD ACTIVATIONS — Audit Trail
-- ─────────────────────────────────────────────────────────────────────────────────
-- Records every time Shield activates (medium or high)
-- Used for compliance and pattern analysis

CREATE TABLE shield_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User ID (TEXT to match NovaOS user ID format)
    user_id TEXT NOT NULL,
    
    -- Classification from Intent Gate
    safety_signal TEXT NOT NULL CHECK (safety_signal IN ('medium', 'high')),
    urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    
    -- Original message that triggered shield
    trigger_message TEXT NOT NULL,
    
    -- LLM-generated risk assessment (stored as JSONB for querying)
    risk_assessment JSONB,
    
    -- Action taken: 'warn' (medium) or 'crisis' (high)
    action_taken TEXT NOT NULL CHECK (action_taken IN ('warn', 'crisis')),
    
    -- When user acknowledged (for medium) or confirmed safety (for high)
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user history lookups
CREATE INDEX idx_shield_activations_user 
ON shield_activations(user_id, created_at DESC);

-- Index for audit queries by signal type
CREATE INDEX idx_shield_activations_signal 
ON shield_activations(safety_signal, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────────
-- SHIELD CRISIS SESSIONS — Active Crisis Tracking
-- ─────────────────────────────────────────────────────────────────────────────────
-- For HIGH signals only
-- Blocks ALL messages until user confirms safety

CREATE TABLE shield_crisis_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- User ID (TEXT to match NovaOS user ID format)
    user_id TEXT NOT NULL,
    
    -- Link to activation record
    activation_id UUID REFERENCES shield_activations(id) ON DELETE SET NULL,
    
    -- 'active' = blocking all messages, 'resolved' = user confirmed safety
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Critical index: fast lookup of active crisis for user
-- Used on EVERY message to check if user is blocked
CREATE INDEX idx_crisis_sessions_active 
ON shield_crisis_sessions(user_id) 
WHERE status = 'active';

-- ─────────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────────────────────────

-- Enable RLS
ALTER TABLE shield_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shield_crisis_sessions ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (backend access)
CREATE POLICY "Service role full access on shield_activations" 
ON shield_activations FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Service role full access on shield_crisis_sessions" 
ON shield_crisis_sessions FOR ALL 
USING (true) 
WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────────
-- COMMENTS
-- ─────────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE shield_activations IS 
'Audit trail for Shield activations. Records every warning (medium) and crisis (high) trigger.';

COMMENT ON TABLE shield_crisis_sessions IS 
'Active crisis sessions. When status=active, user is blocked from sending any messages until they confirm safety.';

COMMENT ON COLUMN shield_activations.risk_assessment IS 
'JSONB containing LLM-generated risk assessment: {domain, riskExplanation, consequences, alternatives, reflectiveQuestion}';

COMMENT ON COLUMN shield_crisis_sessions.status IS 
'active = user is blocked, resolved = user confirmed safety and can send messages again';
