-- Authenticated users should be able to read the same public app data as anon users.
-- Without these policies, logging in causes RLS to hide rows from security-invoker RPCs.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'schedules'
      AND policyname = 'Allow authenticated read schedules'
  ) THEN
    CREATE POLICY "Allow authenticated read schedules"
      ON public.schedules
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'player_boxscores_raw'
      AND policyname = 'Allow authenticated read player_boxscores_raw'
  ) THEN
    CREATE POLICY "Allow authenticated read player_boxscores_raw"
      ON public.player_boxscores_raw
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'play_by_play_raw'
      AND policyname = 'Allow authenticated read play_by_play_raw'
  ) THEN
    CREATE POLICY "Allow authenticated read play_by_play_raw"
      ON public.play_by_play_raw
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'game_injury_snapshots'
      AND policyname = 'Allow authenticated read game_injury_snapshots'
  ) THEN
    CREATE POLICY "Allow authenticated read game_injury_snapshots"
      ON public.game_injury_snapshots
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;
