-- ═══════════════════════════════════════════════════════════════════════════════
-- NOVAOS COMPLETE DATABASE SCHEMA v4
-- 
-- FRESH INSTALL: Run this ONCE in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste All → Run
-- 
-- Includes:
-- - Base tables (users, settings)
-- - SwordGate tables (lesson_plans, plan_subskills, nodes, etc.)
-- - Shield tables (shield_activations, shield_crisis_sessions)
-- - Lesson Runner tables (daily_lessons, knowledge_checks, etc.)
-- - Sparks table
-- ═══════════════════════════════════════════════════════════════════════════════


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 1: BASE TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Users table (syncs with JWT via external_id)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id);

-- Settings table (user preferences)
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

CREATE INDEX IF NOT EXISTS idx_settings_user_id ON settings(user_id);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS settings_updated_at ON settings;
CREATE TRIGGER settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 2: SWORDGATE ENUMS
-- ═══════════════════════════════════════════════════════════════════════════════

DO $$ BEGIN
  CREATE TYPE route_type AS ENUM (
    'recall', 'practice', 'diagnose', 'apply', 'build', 'refine', 'plan'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subskill_type AS ENUM (
    'concepts', 'procedures', 'judgments', 'outputs', 'tool_setup', 'tool_management'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE node_status AS ENUM (
    'locked', 'available', 'in_progress', 'completed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE method_node_type AS ENUM (
    'error_review', 'mixed_practice', 'spaced_review'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_type AS ENUM (
    'active_recall_prompt', 'quiz', 'spaced_review',
    'worked_example', 'guided_problem', 'independent_problem',
    'spot_error', 'classify', 'compare_contrast',
    'novel_scenario', 'case_question',
    'project_milestone', 'integration_checklist',
    'rubric_check', 'revision_pass',
    'concept_map', 'error_log_review',
    'spark', 'mastery_reflection'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE plan_status AS ENUM (
    'designing', 'active', 'completed', 'abandoned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE generation_source AS ENUM (
    'llm', 'fallback', 'prefetch', 'refresh'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE visible_phase AS ENUM ('exploration', 'define_goal', 'review');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE internal_phase AS ENUM (
    'exploration', 'capstone', 'subskills', 'routing', 'review'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subskill_status AS ENUM (
    'pending', 'active', 'assess', 'mastered', 'skipped'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 3: LESSON PLANS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lesson_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Goal
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Capstone
  capstone_statement TEXT,
  success_criteria JSONB DEFAULT '[]',
  
  -- Scope
  difficulty VARCHAR(20) NOT NULL DEFAULT 'intermediate',
  daily_minutes INTEGER NOT NULL DEFAULT 30,
  weekly_cadence INTEGER NOT NULL DEFAULT 5,
  
  -- Node-based tracking (legacy)
  total_nodes INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  sessions_since_method_node INTEGER NOT NULL DEFAULT 0,
  
  -- Subskill-based tracking (new)
  total_subskills INTEGER DEFAULT 0,
  current_subskill_index INTEGER DEFAULT 0,
  current_subskill_id UUID,
  estimated_sessions INTEGER DEFAULT 0,
  estimated_weeks INTEGER NOT NULL DEFAULT 0,
  estimated_time_display TEXT,
  
  -- Status
  status plan_status NOT NULL DEFAULT 'designing',
  progress FLOAT NOT NULL DEFAULT 0,
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  abandoned_at TIMESTAMPTZ,
  
  CONSTRAINT valid_difficulty CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  CONSTRAINT valid_daily_minutes CHECK (daily_minutes BETWEEN 10 AND 180),
  CONSTRAINT valid_weekly_cadence CHECK (weekly_cadence BETWEEN 1 AND 7)
);

CREATE INDEX IF NOT EXISTS idx_lesson_plans_user_status ON lesson_plans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_lesson_plans_user_active ON lesson_plans(user_id) WHERE status = 'active';


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 4: PLAN SUBSKILLS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS plan_subskills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  
  -- Core info
  title VARCHAR(255) NOT NULL,
  description TEXT,
  subskill_type VARCHAR(50),
  route VARCHAR(50),
  complexity INTEGER DEFAULT 2 CHECK (complexity BETWEEN 1 AND 3),
  "order" INTEGER NOT NULL,
  
  -- Status
  status VARCHAR(50) NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'active', 'assess', 'mastered', 'skipped')),
  
  -- Session allocation
  estimated_sessions INTEGER DEFAULT 1,
  
  -- Progress
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  current_session INTEGER DEFAULT 0,
  last_session_date TIMESTAMPTZ,
  mastered_at TIMESTAMPTZ,
  
  -- Lesson plan reference
  lesson_plan_id UUID,
  
  -- Assessment (for 'assess' status)
  assessment_score INTEGER,
  assessment_data JSONB,
  assessed_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_subskills_plan ON plan_subskills(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_subskills_status ON plan_subskills(status);
CREATE INDEX IF NOT EXISTS idx_plan_subskills_plan_order ON plan_subskills(plan_id, "order");


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 5: NODES (Legacy)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  
  title VARCHAR(255) NOT NULL,
  objective TEXT NOT NULL,
  route route_type NOT NULL,
  subskill_type subskill_type NOT NULL,
  
  sequence_order INTEGER NOT NULL,
  module_number INTEGER NOT NULL DEFAULT 1,
  
  mastery_check TEXT NOT NULL,
  mastery_reflection_prompt TEXT NOT NULL,
  estimated_sessions INTEGER NOT NULL DEFAULT 1,
  
  is_method_node BOOLEAN NOT NULL DEFAULT FALSE,
  method_node_type method_node_type,
  
  practice_asset_specs JSONB NOT NULL DEFAULT '[]',
  canonical_sources JSONB NOT NULL DEFAULT '[]',
  fallback_assets JSONB NOT NULL DEFAULT '[]',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_method_node CHECK (
    (is_method_node = FALSE AND method_node_type IS NULL) OR
    (is_method_node = TRUE AND method_node_type IS NOT NULL)
  ),
  CONSTRAINT valid_estimated_sessions CHECK (estimated_sessions BETWEEN 1 AND 30)
);

CREATE INDEX IF NOT EXISTS idx_nodes_plan_order ON nodes(plan_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_nodes_plan_module ON nodes(plan_id, module_number);
CREATE INDEX IF NOT EXISTS idx_nodes_route ON nodes(route);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 6: NODE PREREQUISITES (Legacy)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS node_prerequisites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  prereq_node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_prerequisite UNIQUE(node_id, prereq_node_id),
  CONSTRAINT no_self_prereq CHECK (node_id != prereq_node_id)
);

CREATE INDEX IF NOT EXISTS idx_prereqs_node ON node_prerequisites(node_id);
CREATE INDEX IF NOT EXISTS idx_prereqs_prereq ON node_prerequisites(prereq_node_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 7: NODE PROGRESS (Legacy)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS node_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  
  status node_status NOT NULL DEFAULT 'locked',
  available_at TIMESTAMPTZ,
  
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  current_session INTEGER NOT NULL DEFAULT 0,
  
  all_assets_completed BOOLEAN NOT NULL DEFAULT FALSE,
  mastery_reflection TEXT,
  mastery_achieved BOOLEAN NOT NULL DEFAULT FALSE,
  
  started_at TIMESTAMPTZ,
  last_session_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  needs_refresh BOOLEAN NOT NULL DEFAULT FALSE,
  refresh_completed_at TIMESTAMPTZ,
  
  CONSTRAINT unique_user_node UNIQUE(user_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_node_progress_user_status ON node_progress(user_id, status);
CREATE INDEX IF NOT EXISTS idx_node_progress_user_inprogress ON node_progress(user_id) 
  WHERE status = 'in_progress';


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 8: DAILY PLANS (Legacy)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  
  session_number INTEGER NOT NULL,
  plan_date DATE NOT NULL,
  route route_type NOT NULL,
  
  overview TEXT NOT NULL,
  key_points JSONB NOT NULL DEFAULT '[]',
  assets JSONB NOT NULL DEFAULT '[]',
  spark JSONB NOT NULL,
  
  maintenance_layer JSONB NOT NULL DEFAULT '{"quick_recall":[],"checkpoint":""}',
  
  is_final_session BOOLEAN NOT NULL DEFAULT FALSE,
  mastery_reflection_prompt TEXT,
  
  generation_source generation_source NOT NULL DEFAULT 'llm',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  
  is_refresh_session BOOLEAN NOT NULL DEFAULT FALSE,
  
  CONSTRAINT unique_node_session_date UNIQUE(node_id, session_number, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_plans_node_session ON daily_plans(node_id, session_number);
CREATE INDEX IF NOT EXISTS idx_daily_plans_date ON daily_plans(plan_date);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 9: ASSET PROGRESS (Legacy)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS asset_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_plan_id UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
  asset_id VARCHAR(100) NOT NULL,
  
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  
  score FLOAT,
  attempts INTEGER DEFAULT 0,
  
  CONSTRAINT unique_user_plan_asset UNIQUE(user_id, daily_plan_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_progress_user_plan ON asset_progress(user_id, daily_plan_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 10: METHOD NODE INSERTIONS (Legacy)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS method_node_insertions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  
  inserted_after_session INTEGER NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  method_node_type method_node_type NOT NULL,
  node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
  
  trigger_reason VARCHAR(50) NOT NULL,
  
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_trigger_reason CHECK (
    trigger_reason IN ('session_count', 'before_build', 'module_boundary')
  )
);

CREATE INDEX IF NOT EXISTS idx_method_insertions_plan ON method_node_insertions(plan_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 11: DESIGNER SESSIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS designer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES lesson_plans(id) ON DELETE SET NULL,
  conversation_id VARCHAR(100),
  
  visible_phase VARCHAR(50) NOT NULL DEFAULT 'exploration',
  internal_phase VARCHAR(50) NOT NULL DEFAULT 'exploration',
  
  exploration_data JSONB,
  capstone_data JSONB,
  subskills_data JSONB,
  routing_data JSONB,
  
  -- Deprecated columns (kept for compatibility)
  research_data JSONB,
  nodes_data JSONB,
  sequencing_data JSONB,
  method_nodes_data JSONB,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_designer_sessions_user ON designer_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_designer_sessions_active ON designer_sessions(user_id) 
  WHERE completed_at IS NULL;

DROP TRIGGER IF EXISTS designer_sessions_updated_at ON designer_sessions;
CREATE TRIGGER designer_sessions_updated_at
    BEFORE UPDATE ON designer_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 12: PREFETCH QUEUE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS prefetch_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  plan_date DATE NOT NULL,
  
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_prefetch_status CHECK (
    status IN ('pending', 'processing', 'completed', 'failed')
  )
);

CREATE INDEX IF NOT EXISTS idx_prefetch_queue_status ON prefetch_queue(status) WHERE status = 'pending';


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 13: CIRCUIT BREAKER STATE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS circuit_breaker_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name VARCHAR(100) NOT NULL UNIQUE,
  
  state VARCHAR(20) NOT NULL DEFAULT 'closed',
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  
  opened_at TIMESTAMPTZ,
  half_open_at TIMESTAMPTZ,
  
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT valid_cb_state CHECK (state IN ('closed', 'open', 'half_open'))
);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 14: SHIELD TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Drop if re-running
DROP TABLE IF EXISTS shield_crisis_sessions CASCADE;
DROP TABLE IF EXISTS shield_activations CASCADE;

-- Shield Activations (audit trail)
CREATE TABLE shield_activations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,  -- TEXT for external_id format
    
    safety_signal TEXT NOT NULL CHECK (safety_signal IN ('medium', 'high')),
    urgency TEXT NOT NULL CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
    
    trigger_message TEXT NOT NULL,
    risk_assessment JSONB,
    
    action_taken TEXT NOT NULL CHECK (action_taken IN ('warn', 'crisis')),
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shield_activations_user ON shield_activations(user_id, created_at DESC);
CREATE INDEX idx_shield_activations_signal ON shield_activations(safety_signal, created_at DESC);

-- Shield Crisis Sessions (active crisis blocking)
CREATE TABLE shield_crisis_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,  -- TEXT for external_id format
    
    activation_id UUID REFERENCES shield_activations(id) ON DELETE SET NULL,
    
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_crisis_sessions_active ON shield_crisis_sessions(user_id) WHERE status = 'active';


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 15: LESSON RUNNER TABLES
-- ═══════════════════════════════════════════════════════════════════════════════

-- Subskill Lesson Plans
CREATE TABLE IF NOT EXISTS subskill_lesson_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subskill_id UUID NOT NULL REFERENCES plan_subskills(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
    
    learning_objectives TEXT[] NOT NULL DEFAULT '{}',
    prerequisites TEXT[] NOT NULL DEFAULT '{}',
    session_outline JSONB NOT NULL DEFAULT '[]',
    
    is_remediation_plan BOOLEAN NOT NULL DEFAULT FALSE,
    assessment_id UUID,
    gaps JSONB,
    
    generation_source VARCHAR(20) NOT NULL DEFAULT 'llm',
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT valid_gen_source CHECK (generation_source IN ('llm', 'template', 'hybrid'))
);

CREATE INDEX IF NOT EXISTS idx_subskill_lesson_plans_subskill ON subskill_lesson_plans(subskill_id);
CREATE INDEX IF NOT EXISTS idx_subskill_lesson_plans_plan ON subskill_lesson_plans(plan_id);

-- Add foreign key to plan_subskills
ALTER TABLE plan_subskills 
  ADD CONSTRAINT fk_plan_subskills_lesson_plan 
  FOREIGN KEY (lesson_plan_id) REFERENCES subskill_lesson_plans(id) ON DELETE SET NULL;

-- Subskill Assessments (diagnostic tests)
CREATE TABLE IF NOT EXISTS subskill_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subskill_id UUID NOT NULL REFERENCES plan_subskills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    questions JSONB NOT NULL DEFAULT '[]',
    answers JSONB,
    
    score INTEGER,
    area_results JSONB,
    gaps JSONB,
    strengths TEXT[],
    recommendation VARCHAR(20),
    
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    CONSTRAINT valid_recommendation CHECK (
        recommendation IS NULL OR 
        recommendation IN ('autopass', 'targeted', 'convert_learn')
    )
);

CREATE INDEX IF NOT EXISTS idx_subskill_assessments_subskill ON subskill_assessments(subskill_id);
CREATE INDEX IF NOT EXISTS idx_subskill_assessments_user ON subskill_assessments(user_id);

-- Daily Lessons (per session content)
CREATE TABLE IF NOT EXISTS daily_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subskill_id UUID NOT NULL REFERENCES plan_subskills(id) ON DELETE CASCADE,
    lesson_plan_id UUID REFERENCES subskill_lesson_plans(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_number INTEGER NOT NULL,
    
    context JSONB NOT NULL DEFAULT '{}',
    
    session_goal TEXT,
    content JSONB,
    activities JSONB,
    key_points TEXT[],
    
    resources JSONB,
    resources_fetched_at TIMESTAMPTZ,
    
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    
    UNIQUE(subskill_id, user_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_daily_lessons_subskill ON daily_lessons(subskill_id);
CREATE INDEX IF NOT EXISTS idx_daily_lessons_user ON daily_lessons(user_id);

-- Knowledge Checks (mastery tests)
CREATE TABLE IF NOT EXISTS knowledge_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subskill_id UUID NOT NULL REFERENCES plan_subskills(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL DEFAULT 1,
    
    questions JSONB NOT NULL DEFAULT '[]',
    answers JSONB,
    
    score INTEGER,
    passed BOOLEAN,
    missed_questions JSONB,
    feedback TEXT[],
    
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_knowledge_checks_subskill ON knowledge_checks(subskill_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_checks_user ON knowledge_checks(user_id);

-- Session Summaries
CREATE TABLE IF NOT EXISTS session_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subskill_id UUID NOT NULL REFERENCES plan_subskills(id) ON DELETE CASCADE,
    daily_lesson_id UUID REFERENCES daily_lessons(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_number INTEGER NOT NULL,
    
    summary TEXT NOT NULL,
    key_concepts TEXT[] NOT NULL DEFAULT '{}',
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(subskill_id, user_id, session_number)
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_subskill ON session_summaries(subskill_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_user ON session_summaries(user_id);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 16: SPARKS TABLE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sparks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    plan_id UUID REFERENCES lesson_plans(id) ON DELETE SET NULL,
    subskill_id UUID REFERENCES plan_subskills(id) ON DELETE SET NULL,
    daily_lesson_id UUID REFERENCES daily_lessons(id) ON DELETE SET NULL,
    session_number INTEGER,
    
    task TEXT NOT NULL,
    context TEXT,
    estimated_minutes INTEGER DEFAULT 5,
    
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    skip_reason TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sparks_user_active ON sparks(user_id) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_sparks_user_created ON sparks(user_id, created_at DESC);


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 17: HELPER FUNCTIONS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Update node availability when prerequisite completes
CREATE OR REPLACE FUNCTION update_node_availability()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE node_progress np
    SET status = 'available', available_at = NOW()
    WHERE np.node_id IN (
      SELECT prereq.node_id FROM node_prerequisites prereq
      WHERE prereq.prereq_node_id = NEW.node_id
    )
    AND np.status = 'locked'
    AND np.user_id = NEW.user_id
    AND NOT EXISTS (
      SELECT 1 FROM node_prerequisites other_prereq
      JOIN node_progress other_prog ON other_prog.node_id = other_prereq.prereq_node_id
        AND other_prog.user_id = np.user_id
      WHERE other_prereq.node_id = np.node_id
        AND other_prereq.prereq_node_id != NEW.node_id
        AND other_prog.status != 'completed'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_availability ON node_progress;
CREATE TRIGGER trigger_update_availability
AFTER UPDATE ON node_progress
FOR EACH ROW EXECUTE FUNCTION update_node_availability();

-- Check for session gaps (7+ days)
CREATE OR REPLACE FUNCTION check_session_gap(
  p_last_session_at TIMESTAMPTZ,
  p_gap_days INTEGER DEFAULT 7
) RETURNS BOOLEAN AS $$
BEGIN
  IF p_last_session_at IS NULL THEN RETURN FALSE; END IF;
  RETURN (NOW() - p_last_session_at) > (p_gap_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Calculate plan progress from subskills
CREATE OR REPLACE FUNCTION calculate_subskill_progress(p_plan_id UUID) RETURNS FLOAT AS $$
DECLARE
  v_total INTEGER;
  v_mastered INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total FROM plan_subskills
  WHERE plan_id = p_plan_id AND status != 'skipped';
  IF v_total = 0 THEN RETURN 0; END IF;
  SELECT COUNT(*) INTO v_mastered FROM plan_subskills
  WHERE plan_id = p_plan_id AND status = 'mastered';
  RETURN v_mastered::FLOAT / v_total::FLOAT;
END;
$$ LANGUAGE plpgsql;


-- ═══════════════════════════════════════════════════════════════════════════════
-- PART 18: ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE shield_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE shield_crisis_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subskill_lesson_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subskill_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE sparks ENABLE ROW LEVEL SECURITY;

-- Service role full access (backend)
CREATE POLICY "Service role full access" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON shield_activations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON shield_crisis_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON subskill_lesson_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON subskill_assessments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON daily_lessons FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON knowledge_checks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON session_summaries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON sparks FOR ALL USING (true) WITH CHECK (true);


-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════════

-- Run this to verify all tables were created:
/*
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
*/

-- Expected tables (23 total):
-- asset_progress, circuit_breaker_state, daily_lessons, daily_plans,
-- designer_sessions, knowledge_checks, lesson_plans, method_node_insertions,
-- node_prerequisites, node_progress, nodes, plan_subskills, prefetch_queue,
-- session_summaries, settings, shield_activations, shield_crisis_sessions,
-- sparks, subskill_assessments, subskill_lesson_plans, users
