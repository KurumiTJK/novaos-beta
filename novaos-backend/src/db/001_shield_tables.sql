-- ═══════════════════════════════════════════════════════════════════════════════
-- SHIELD SERVICE — Database Schema
-- Run this migration in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- SHIELD ACTIVATIONS — Audit Trail
-- ─────────────────────────────────────────────────────────────────────────────────
-- Records every time Shield activates (medium or high)
-- Used for compliance and pattern analysis

CREATE TABLE IF NOT EXISTS shield_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Classification from Intent Gate
    safety_signal VARCHAR(20) NOT NULL,  -- 'medium' | 'high'
    urgency VARCHAR(20) NOT NULL,        -- 'low' | 'medium' | 'high'
    
    -- Original message that triggered shield
    trigger_message TEXT NOT NULL,
    
    -- LLM-generated risk assessment (JSON)
    risk_assessment TEXT,
    
    -- Action taken: 'warning' (medium) or 'crisis' (high)
    action_taken VARCHAR(20) NOT NULL,
    
    -- When user acknowledged (for medium) or confirmed safety (for high)
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_shield_activations_user 
ON shield_activations(user_id, created_at DESC);

-- Index for audit queries by signal type
CREATE INDEX IF NOT EXISTS idx_shield_activations_signal 
ON shield_activations(safety_signal, created_at DESC);

-- ─────────────────────────────────────────────────────────────────────────────────
-- SHIELD CRISIS SESSIONS — Active Crisis Tracking
-- ─────────────────────────────────────────────────────────────────────────────────
-- For HIGH signals only
-- Blocks ALL messages until user confirms safety

CREATE TABLE IF NOT EXISTS shield_crisis_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Link to activation record
    activation_id UUID REFERENCES shield_activations(id) ON DELETE SET NULL,
    
    -- 'active' = blocking all messages, 'resolved' = user confirmed safety
    status VARCHAR(20) DEFAULT 'active',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

-- Critical index: fast lookup of active crisis for user
-- Used on EVERY message to check if user is blocked
CREATE INDEX IF NOT EXISTS idx_crisis_sessions_active 
ON shield_crisis_sessions(user_id) 
WHERE status = 'active';

-- ─────────────────────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (Optional but recommended)
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
'JSON string containing LLM-generated risk assessment: {domain, riskExplanation, consequences, alternatives, question}';

COMMENT ON COLUMN shield_crisis_sessions.status IS 
'active = user is blocked, resolved = user confirmed safety and can send messages again';
