-- ═══════════════════════════════════════════════════════════════════════════════
-- NOVAOS SWORDGATE - NODE-BASED LEARNING SCHEMA v2
-- 
-- This schema implements a pedagogically-grounded learning system with:
-- - 7 core routes (recall, practice, diagnose, apply, build, refine, plan)
-- - Prerequisite-based node unlocking (hard lock)
-- - Multi-session nodes with mastery verification
-- - Adaptive method node insertion (session-based)
-- - Refresh sessions for learning gaps
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE route_type AS ENUM (
    'recall',     -- Facts, vocab, definitions
    'practice',   -- Procedural reps
    'diagnose',   -- Perceptual/judgment
    'apply',      -- Transfer to new contexts
    'build',      -- Project/production
    'refine',     -- Feedback + revision
    'plan'        -- Map + adjust
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE subskill_type AS ENUM (
    'concepts',         -- → recall
    'procedures',       -- → practice
    'judgments',        -- → diagnose
    'outputs',          -- → build
    'tool_setup',       -- → practice
    'tool_management'   -- → plan
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE node_status AS ENUM (
    'locked',       -- Prerequisites not met
    'available',    -- Ready to start
    'in_progress',  -- Started, not complete
    'completed'     -- Mastery achieved
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE method_node_type AS ENUM (
    'error_review',    -- Plan: review mistakes
    'mixed_practice',  -- Apply/Diagnose: combine skills
    'spaced_review'    -- Recall: retention check
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE asset_type AS ENUM (
    -- Recall
    'active_recall_prompt',
    'quiz',
    'spaced_review',
    -- Practice
    'worked_example',
    'guided_problem',
    'independent_problem',
    -- Diagnose
    'spot_error',
    'classify',
    'compare_contrast',
    -- Apply
    'novel_scenario',
    'case_question',
    -- Build
    'project_milestone',
    'integration_checklist',
    -- Refine
    'rubric_check',
    'revision_pass',
    -- Plan
    'concept_map',
    'error_log_review',
    -- Universal
    'spark',
    'mastery_reflection'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE plan_status AS ENUM (
    'designing',
    'active',
    'completed',
    'abandoned'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE generation_source AS ENUM (
    'llm',
    'fallback',
    'prefetch',
    'refresh'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE visible_phase AS ENUM (
    'exploration',
    'define_goal',
    'research',
    'review'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE internal_phase AS ENUM (
    'exploration',
    'capstone',
    'subskills',
    'routing',
    'research',
    'node_generation',
    'sequencing',
    'method_nodes'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────────
-- LESSON PLANS
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lesson_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Goal
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Capstone (generated in Phase 2)
  capstone_statement TEXT,
  success_criteria JSONB DEFAULT '[]',
  
  -- Scope (user input)
  difficulty VARCHAR(20) NOT NULL DEFAULT 'intermediate',
  daily_minutes INTEGER NOT NULL DEFAULT 30,
  weekly_cadence INTEGER NOT NULL DEFAULT 5,
  
  -- Derived from nodes (no stored duration_weeks)
  total_nodes INTEGER NOT NULL DEFAULT 0,
  total_sessions INTEGER NOT NULL DEFAULT 0,
  estimated_weeks INTEGER NOT NULL DEFAULT 0,
  
  -- Status
  status plan_status NOT NULL DEFAULT 'designing',
  progress FLOAT NOT NULL DEFAULT 0,
  
  -- Session tracking for method nodes
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  sessions_since_method_node INTEGER NOT NULL DEFAULT 0,
  
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

-- ─────────────────────────────────────────────────────────────────────────────────
-- NODES (replaces lessons)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  
  -- Core
  title VARCHAR(255) NOT NULL,
  objective TEXT NOT NULL,
  route route_type NOT NULL,
  subskill_type subskill_type NOT NULL,
  
  -- Sequencing
  sequence_order INTEGER NOT NULL,
  module_number INTEGER NOT NULL DEFAULT 1,
  
  -- Mastery
  mastery_check TEXT NOT NULL,
  mastery_reflection_prompt TEXT NOT NULL,
  estimated_sessions INTEGER NOT NULL DEFAULT 1,
  
  -- Method node
  is_method_node BOOLEAN NOT NULL DEFAULT FALSE,
  method_node_type method_node_type,
  
  -- Assets (templates for daily generation)
  practice_asset_specs JSONB NOT NULL DEFAULT '[]',
  canonical_sources JSONB NOT NULL DEFAULT '[]',
  fallback_assets JSONB NOT NULL DEFAULT '[]',
  
  -- Timestamps
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

-- ─────────────────────────────────────────────────────────────────────────────────
-- NODE PREREQUISITES (graph edges)
-- ─────────────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────────────
-- NODE PROGRESS
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS node_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  
  -- Status (precomputed availability)
  status node_status NOT NULL DEFAULT 'locked',
  available_at TIMESTAMPTZ,
  
  -- Progress tracking
  sessions_completed INTEGER NOT NULL DEFAULT 0,
  current_session INTEGER NOT NULL DEFAULT 0,
  
  -- Mastery (hybrid verification)
  all_assets_completed BOOLEAN NOT NULL DEFAULT FALSE,
  mastery_reflection TEXT,
  mastery_achieved BOOLEAN NOT NULL DEFAULT FALSE,
  
  -- Timing (gap detection)
  started_at TIMESTAMPTZ,
  last_session_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Refresh tracking
  needs_refresh BOOLEAN NOT NULL DEFAULT FALSE,
  refresh_completed_at TIMESTAMPTZ,
  
  CONSTRAINT unique_user_node UNIQUE(user_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_node_progress_user_status ON node_progress(user_id, status);
CREATE INDEX IF NOT EXISTS idx_node_progress_user_inprogress ON node_progress(user_id) 
  WHERE status = 'in_progress';

-- ─────────────────────────────────────────────────────────────────────────────────
-- DAILY PLANS (session-based, spark required)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  
  -- Session info
  session_number INTEGER NOT NULL,
  plan_date DATE NOT NULL,
  
  -- Route (inherited from node)
  route route_type NOT NULL,
  
  -- Content
  overview TEXT NOT NULL,
  key_points JSONB NOT NULL DEFAULT '[]',
  
  -- Assets
  assets JSONB NOT NULL DEFAULT '[]',
  
  -- Spark is REQUIRED and separate
  spark JSONB NOT NULL,
  
  -- Maintenance layer (always present)
  maintenance_layer JSONB NOT NULL DEFAULT '{"quick_recall":[],"checkpoint":""}',
  
  -- Mastery check (only on final session)
  is_final_session BOOLEAN NOT NULL DEFAULT FALSE,
  mastery_reflection_prompt TEXT,
  
  -- Generation metadata
  generation_source generation_source NOT NULL DEFAULT 'llm',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  locked_at TIMESTAMPTZ,
  
  -- Refresh session marker
  is_refresh_session BOOLEAN NOT NULL DEFAULT FALSE,
  
  CONSTRAINT unique_node_session_date UNIQUE(node_id, session_number, plan_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_plans_node_session ON daily_plans(node_id, session_number);
CREATE INDEX IF NOT EXISTS idx_daily_plans_date ON daily_plans(plan_date);

-- ─────────────────────────────────────────────────────────────────────────────────
-- ASSET PROGRESS (per-asset completion)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS asset_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  daily_plan_id UUID NOT NULL REFERENCES daily_plans(id) ON DELETE CASCADE,
  asset_id VARCHAR(100) NOT NULL,
  
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at TIMESTAMPTZ,
  
  -- For quiz-type assets
  score FLOAT,
  attempts INTEGER DEFAULT 0,
  
  CONSTRAINT unique_user_plan_asset UNIQUE(user_id, daily_plan_id, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_asset_progress_user_plan ON asset_progress(user_id, daily_plan_id);

-- ─────────────────────────────────────────────────────────────────────────────────
-- METHOD NODE INSERTIONS (session-based triggers)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS method_node_insertions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES lesson_plans(id) ON DELETE CASCADE,
  
  -- When inserted
  inserted_after_session INTEGER NOT NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- What was inserted
  method_node_type method_node_type NOT NULL,
  node_id UUID REFERENCES nodes(id) ON DELETE SET NULL,
  
  -- Trigger reason
  trigger_reason VARCHAR(50) NOT NULL,
  
  completed_at TIMESTAMPTZ,
  
  CONSTRAINT valid_trigger_reason CHECK (
    trigger_reason IN ('session_count', 'before_build', 'module_boundary')
  )
);

CREATE INDEX IF NOT EXISTS idx_method_insertions_plan ON method_node_insertions(plan_id);

-- ─────────────────────────────────────────────────────────────────────────────────
-- DESIGNER SESSIONS (user sees 4 phases, system does 8)
-- ─────────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS designer_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES lesson_plans(id) ON DELETE SET NULL,
  conversation_id VARCHAR(100),
  
  -- User-visible phase (4 phases)
  visible_phase visible_phase NOT NULL DEFAULT 'exploration',
  
  -- Internal phase (8 phases)
  internal_phase internal_phase NOT NULL DEFAULT 'exploration',
  
  -- Phase data storage
  exploration_data JSONB,
  capstone_data JSONB,
  subskills_data JSONB,
  routing_data JSONB,
  research_data JSONB,
  nodes_data JSONB,
  sequencing_data JSONB,
  method_nodes_data JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_designer_sessions_user ON designer_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_designer_sessions_active ON designer_sessions(user_id) 
  WHERE completed_at IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────────
-- PREFETCH QUEUE
-- ─────────────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────────────
-- CIRCUIT BREAKER STATE
-- ─────────────────────────────────────────────────────────────────────────────────

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

-- ─────────────────────────────────────────────────────────────────────────────────
-- FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────────────────

-- Update node availability when prerequisite completes
CREATE OR REPLACE FUNCTION update_node_availability()
RETURNS TRIGGER AS $$
BEGIN
  -- When a node is completed, check dependents
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Update all nodes that had this as a prereq
    UPDATE node_progress np
    SET 
      status = 'available',
      available_at = NOW()
    WHERE np.node_id IN (
      SELECT prereq.node_id 
      FROM node_prerequisites prereq
      WHERE prereq.prereq_node_id = NEW.node_id
    )
    AND np.status = 'locked'
    AND np.user_id = NEW.user_id
    AND NOT EXISTS (
      -- Check if any other prereqs are incomplete
      SELECT 1 
      FROM node_prerequisites other_prereq
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
FOR EACH ROW
EXECUTE FUNCTION update_node_availability();

-- Check for session gaps (7+ days)
CREATE OR REPLACE FUNCTION check_session_gap(
  p_last_session_at TIMESTAMPTZ,
  p_gap_days INTEGER DEFAULT 7
) RETURNS BOOLEAN AS $$
BEGIN
  IF p_last_session_at IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN (NOW() - p_last_session_at) > (p_gap_days || ' days')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

-- Initialize node progress for all nodes when plan is activated
CREATE OR REPLACE FUNCTION initialize_node_progress(
  p_user_id UUID,
  p_plan_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_node RECORD;
  v_count INTEGER := 0;
BEGIN
  FOR v_node IN 
    SELECT n.id, n.sequence_order,
      NOT EXISTS (
        SELECT 1 FROM node_prerequisites np WHERE np.node_id = n.id
      ) AS has_no_prereqs
    FROM nodes n
    WHERE n.plan_id = p_plan_id
    ORDER BY n.sequence_order
  LOOP
    INSERT INTO node_progress (user_id, node_id, status, available_at)
    VALUES (
      p_user_id,
      v_node.id,
      CASE WHEN v_node.has_no_prereqs THEN 'available'::node_status ELSE 'locked'::node_status END,
      CASE WHEN v_node.has_no_prereqs THEN NOW() ELSE NULL END
    )
    ON CONFLICT (user_id, node_id) DO NOTHING;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Calculate plan progress from node completion
CREATE OR REPLACE FUNCTION calculate_plan_progress(
  p_user_id UUID,
  p_plan_id UUID
) RETURNS FLOAT AS $$
DECLARE
  v_total INTEGER;
  v_completed INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total
  FROM nodes
  WHERE plan_id = p_plan_id;
  
  IF v_total = 0 THEN
    RETURN 0;
  END IF;
  
  SELECT COUNT(*) INTO v_completed
  FROM node_progress np
  JOIN nodes n ON n.id = np.node_id
  WHERE n.plan_id = p_plan_id
    AND np.user_id = p_user_id
    AND np.status = 'completed';
  
  RETURN v_completed::FLOAT / v_total::FLOAT;
END;
$$ LANGUAGE plpgsql;

-- Update plan derived fields
CREATE OR REPLACE FUNCTION update_plan_derived_fields(p_plan_id UUID)
RETURNS VOID AS $$
DECLARE
  v_total_nodes INTEGER;
  v_total_sessions INTEGER;
  v_weekly_cadence INTEGER;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(estimated_sessions), 0)
  INTO v_total_nodes, v_total_sessions
  FROM nodes
  WHERE plan_id = p_plan_id;
  
  SELECT weekly_cadence INTO v_weekly_cadence
  FROM lesson_plans
  WHERE id = p_plan_id;
  
  UPDATE lesson_plans
  SET 
    total_nodes = v_total_nodes,
    total_sessions = v_total_sessions,
    estimated_weeks = CEIL(v_total_sessions::FLOAT / COALESCE(v_weekly_cadence, 5))
  WHERE id = p_plan_id;
END;
$$ LANGUAGE plpgsql;

-- ─────────────────────────────────────────────────────────────────────────────────
-- COMMENTS
-- ─────────────────────────────────────────────────────────────────────────────────

COMMENT ON TABLE lesson_plans IS 'Learning plans with capstone-based goals. Duration derived from nodes.';
COMMENT ON TABLE nodes IS 'Skill-building units with routes. Replaces linear lessons.';
COMMENT ON TABLE node_prerequisites IS 'Graph edges defining prerequisite relationships (hard lock).';
COMMENT ON TABLE node_progress IS 'Per-user progress on nodes. Status precomputed for performance.';
COMMENT ON TABLE daily_plans IS 'Route-specific daily content. Spark is always required.';
COMMENT ON TABLE asset_progress IS 'Individual asset completion tracking.';
COMMENT ON TABLE method_node_insertions IS 'Tracks adaptive method node insertions (session-based).';
COMMENT ON TABLE designer_sessions IS 'Design flow state. User sees 4 phases, system does 8.';

COMMENT ON COLUMN nodes.route IS '7 core routes: recall, practice, diagnose, apply, build, refine, plan';
COMMENT ON COLUMN nodes.subskill_type IS 'Determines route via deterministic mapping';
COMMENT ON COLUMN nodes.mastery_reflection_prompt IS 'Required on final session for mastery verification';
COMMENT ON COLUMN node_progress.available_at IS 'Precomputed via trigger when prereqs complete';
COMMENT ON COLUMN node_progress.last_session_at IS 'For 7-day gap detection and refresh sessions';
COMMENT ON COLUMN daily_plans.spark IS 'REQUIRED field - every session must have a spark';
COMMENT ON COLUMN daily_plans.is_refresh_session IS 'True if generated to handle learning gap';
