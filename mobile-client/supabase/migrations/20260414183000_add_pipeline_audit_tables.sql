CREATE TABLE IF NOT EXISTS public.pipeline_state (
  pipeline_name text PRIMARY KEY,
  active_mode text NOT NULL CHECK (active_mode IN ('playoff', 'regular', 'offseason')),
  active_season integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pipeline_run_audit (
  id bigserial PRIMARY KEY,
  run_id uuid NOT NULL UNIQUE,
  pipeline_name text NOT NULL,
  mode text NOT NULL CHECK (mode IN ('playoff', 'regular', 'offseason')),
  from_date date,
  to_date date,
  reconcile_start date,
  reconcile_end date,
  processed_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  expected_event_count integer NOT NULL DEFAULT 0,
  missing_after_repair_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  repair_attempted boolean NOT NULL DEFAULT false,
  repair_inserted integer NOT NULL DEFAULT 0,
  repair_skipped_existing integer NOT NULL DEFAULT 0,
  failed_game_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  scoreboard_failures jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('ok', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_run_audit_pipeline_created_at
  ON public.pipeline_run_audit (pipeline_name, created_at DESC);
