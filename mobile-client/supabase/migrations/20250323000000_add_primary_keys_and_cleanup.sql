-- Add primary keys to all data tables
ALTER TABLE public.player_boxscores_raw ADD PRIMARY KEY (game_id, athlete_id);
ALTER TABLE public.schedules ADD PRIMARY KEY (game_id);
ALTER TABLE public.team_boxscores_raw ADD PRIMARY KEY (game_id, team_id);

ALTER TABLE public.play_by_play_raw ALTER COLUMN id SET NOT NULL;
ALTER TABLE public.play_by_play_raw ADD PRIMARY KEY (id);

-- Drop unused indexes flagged by Supabase performance advisor
DROP INDEX IF EXISTS public.idx_player_boxscores_raw_team_id;
DROP INDEX IF EXISTS public.idx_team_boxscores_raw_team_id;

-- Enable RLS on team_boxscores_raw (was missing)
ALTER TABLE public.team_boxscores_raw ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON public.team_boxscores_raw FOR SELECT USING (true);
