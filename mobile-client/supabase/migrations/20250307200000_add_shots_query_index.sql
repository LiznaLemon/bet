-- Index for useShots query: filters by athlete_id_1, season, shooting_play
-- Speeds up shot chart lookups on player detail

CREATE INDEX IF NOT EXISTS idx_play_by_play_athlete_season_shooting
  ON play_by_play_raw (athlete_id_1, season, shooting_play)
  WHERE shooting_play = true;
