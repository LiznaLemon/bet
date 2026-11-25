-- The app no longer has user accounts; every client request uses the anon key.
--
-- 1. Make anon read access explicit on every public data table the app reads,
--    directly or through SECURITY INVOKER RPCs. Some of these policies were
--    created outside migrations, so each is guarded and only added if missing.
-- 2. Drop the user_profiles table that backed sign-up/onboarding state.
-- 3. Keep pipeline bookkeeping tables private (service role only).

DO $$
DECLARE
  tbl text;
  policy_name text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'schedules',
    'player_boxscores_raw',
    'play_by_play_raw',
    'team_boxscores_raw',
    'team_abbreviations',
    'game_injury_snapshots',
    'game_injury_reports',
    'league_second_half_percentile_cache'
  ]
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      RAISE NOTICE 'Skipping %, table does not exist', tbl;
      CONTINUE;
    END IF;

    policy_name := 'Allow anon read ' || tbl;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = tbl AND policyname = policy_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)',
        policy_name,
        tbl
      );
    END IF;
  END LOOP;
END
$$;

-- Accounts are gone: drop profile storage and its trigger function.
DROP TABLE IF EXISTS public.user_profiles CASCADE;
DROP FUNCTION IF EXISTS public.set_user_profiles_updated_at();

-- Pipeline tables are written by the GitHub Actions updater with the service
-- role key (which bypasses RLS). With RLS on and no policies, anon cannot read
-- or write them.
ALTER TABLE IF EXISTS public.pipeline_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.pipeline_run_audit ENABLE ROW LEVEL SECURITY;
