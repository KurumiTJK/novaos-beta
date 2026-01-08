-- ═══════════════════════════════════════════════════════════════════════════════
-- LESSON RUNNER MIGRATION
-- Add tables for the subskill-based lesson runner
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- SUBSKILL LESSON PLANS
-- Generated once per subskill when learning starts
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subskill_lesson_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subskill_id UUID NOT NULL REFERENCES plan_subskills(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
    
    -- Learning structure
    learning_objectives TEXT[] NOT NULL DEFAULT '{}',
    prerequisites TEXT[] NOT NULL DEFAULT '{}',
    session_outline JSONB NOT NULL DEFAULT '[]',
    
    -- For remediation plans (from assess flow)
    is_remediation_plan BOOLEAN NOT NULL DEFAULT FALSE,
    assessment_id UUID,
    gaps JSONB,
    
    -- Metadata
    generation_source VARCHAR(20) NOT NULL DEFAULT 'llm',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_generation_source CHECK (generation_source IN ('llm', 'template', 'hybrid'))
);

CREATE INDEX idx_subskill_lesson_plans_subskill ON subskill_lesson_plans(subskill_id);
CREATE INDEX idx_subskill_lesson_plans_plan ON subskill_lesson_plans(plan_id);

-- ─────────────────────────────────────────────────────────────────────────────────
-- SUBSKILL ASSESSMENTS (Diagnostic Tests)
-- Created when user starts an assess-status subskill
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS subskill_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subskill_id UUID NOT NULL REFERENCES plan_subskills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Test content
    questions JSONB NOT NULL DEFAULT '[]',
    answers JSONB,
    
    -- Results
    score INTEGER,
    area_results JSONB,
    gaps JSONB,
    strengths TEXT[],
    recommendation VARCHAR(20),
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    CONSTRAINT valid_recommendation CHECK (
        recommendation IS NULL OR 
        recommendation IN ('autopass', 'targeted', 'convert_learn')
    )
);

CREATE INDEX idx_subskill_assessments_subskill ON subskill_assessments(subskill_id);
CREATE INDEX idx_subskill_assessments_user ON subskill_assessments(user_id);
CREATE INDEX idx_subskill_assessments_incomplete ON subskill_assessments(user_id, subskill_id) 
    WHERE completed_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────────
-- DAILY LESSONS
-- Generated per session when user starts learning
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subskill_id UUID NOT NULL REFERENCES plan_subskills(id) ON DELETE CASCADE,
    lesson_plan_id UUID REFERENCES subskill_lesson_plans(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_number INTEGER NOT NULL,
    
    -- Context snapshot (for continuity)
    context JSONB NOT NULL DEFAULT '{}',
    
    -- Generated content
    session_goal TEXT,
    content JSONB,
    activities JSONB,
    key_points TEXT[],
    
    -- Resources (fetched asynchronously)
    resources JSONB,
    resources_fetched_at TIMESTAMPTZ,
    
    -- Timestamps
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    UNIQUE(subskill_id, user_id, session_number)
);

CREATE INDEX idx_daily_lessons_subskill ON daily_lessons(subskill_id);
CREATE INDEX idx_daily_lessons_user ON daily_lessons(user_id);
CREATE INDEX idx_daily_lessons_user_session ON daily_lessons(user_id, subskill_id, session_number);

-- ─────────────────────────────────────────────────────────────────────────────────
-- KNOWLEDGE CHECKS (Mastery Tests)
-- Created at final session of each subskill
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subskill_id UUID NOT NULL REFERENCES plan_subskills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    
    -- Test content
    questions JSONB NOT NULL DEFAULT '[]',
    answers JSONB,
    
    -- Results
    score INTEGER,
    passed BOOLEAN,
    missed_questions JSONB,
    feedback TEXT[],
    
    -- Timestamps
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_knowledge_checks_subskill ON knowledge_checks(subskill_id);
CREATE INDEX idx_knowledge_checks_user ON knowledge_checks(user_id);
CREATE INDEX idx_knowledge_checks_incomplete ON knowledge_checks(user_id, subskill_id)
    WHERE completed_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────────
-- SESSION SUMMARIES
-- Generated after each session completion
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS session_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subskill_id UUID NOT NULL REFERENCES plan_subskills(id) ON DELETE CASCADE,
    daily_lesson_id UUID REFERENCES daily_lessons(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_number INTEGER NOT NULL,
    
    -- Content
    summary TEXT NOT NULL,
    key_concepts TEXT[] NOT NULL DEFAULT '{}',
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(subskill_id, user_id, session_number)
);

CREATE INDEX idx_session_summaries_subskill ON session_summaries(subskill_id);
CREATE INDEX idx_session_summaries_user ON session_summaries(user_id);

-- ─────────────────────────────────────────────────────────────────────────────────
-- ADD COLUMNS TO PLAN_SUBSKILLS
-- Track lesson runner state
-- ─────────────────────────────────────────────────────────────────────────────────

-- Add lesson_plan_id column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_subskills' AND column_name = 'lesson_plan_id'
    ) THEN
        ALTER TABLE plan_subskills ADD COLUMN lesson_plan_id UUID REFERENCES subskill_lesson_plans(id) ON DELETE SET NULL;
    END IF;
END $$;

-- Add current_session column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_subskills' AND column_name = 'current_session'
    ) THEN
        ALTER TABLE plan_subskills ADD COLUMN current_session INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add sessions_completed column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_subskills' AND column_name = 'sessions_completed'
    ) THEN
        ALTER TABLE plan_subskills ADD COLUMN sessions_completed INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add last_session_date column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_subskills' AND column_name = 'last_session_date'
    ) THEN
        ALTER TABLE plan_subskills ADD COLUMN last_session_date TIMESTAMPTZ;
    END IF;
END $$;

-- Add mastered_at column if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_subskills' AND column_name = 'mastered_at'
    ) THEN
        ALTER TABLE plan_subskills ADD COLUMN mastered_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add assessment columns if not exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_subskills' AND column_name = 'assessment_score'
    ) THEN
        ALTER TABLE plan_subskills ADD COLUMN assessment_score INTEGER;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_subskills' AND column_name = 'assessment_data'
    ) THEN
        ALTER TABLE plan_subskills ADD COLUMN assessment_data JSONB;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'plan_subskills' AND column_name = 'assessed_at'
    ) THEN
        ALTER TABLE plan_subskills ADD COLUMN assessed_at TIMESTAMPTZ;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────────
-- ADD COLUMNS TO LESSON_PLANS
-- Track current subskill
-- ─────────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'lesson_plans' AND column_name = 'current_subskill_id'
    ) THEN
        ALTER TABLE lesson_plans ADD COLUMN current_subskill_id UUID;
    END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────────
-- GRANT PERMISSIONS (for Supabase)
-- ─────────────────────────────────────────────────────────────────────────────────

-- Enable RLS
ALTER TABLE subskill_lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subskill_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
CREATE POLICY "Users can view their own data" ON subskill_lesson_plans
    FOR SELECT USING (
        plan_id IN (SELECT id FROM lesson_plans WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can view their own assessments" ON subskill_assessments
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own assessments" ON subskill_assessments
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view their own lessons" ON daily_lessons
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own lessons" ON daily_lessons
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view their own checks" ON knowledge_checks
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own checks" ON knowledge_checks
    FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view their own summaries" ON session_summaries
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own summaries" ON session_summaries
    FOR ALL USING (user_id = auth.uid());
