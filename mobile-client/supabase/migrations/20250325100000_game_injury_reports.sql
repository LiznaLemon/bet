CREATE TABLE IF NOT EXISTS public.game_injury_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id text NOT NULL,
  season integer NOT NULL,
  team_abbreviation text NOT NULL,
  player_name text NOT NULL,
  status text,
  position text,
  injury_type text,
  injury_detail text,
  headshot_url text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, team_abbreviation, player_name)
);

CREATE INDEX IF NOT EXISTS idx_game_injury_reports_game_id ON public.game_injury_reports (game_id);

ALTER TABLE public.game_injury_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read game_injury_reports"
  ON public.game_injury_reports FOR SELECT USING (true);

CREATE POLICY "Allow public upsert game_injury_reports"
  ON public.game_injury_reports FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update game_injury_reports"
  ON public.game_injury_reports FOR UPDATE USING (true) WITH CHECK (true);
