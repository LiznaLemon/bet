-- Indexes on player_boxscores_raw for common query patterns
-- Speeds up team-scoped queries, game box scores, and full/team players RPCs

-- Team-scoped queries (team-active-players, team-offensive-stats)
CREATE INDEX IF NOT EXISTS idx_boxscores_team_season
  ON player_boxscores_raw (season, season_type, team_abbreviation)
  WHERE (did_not_play IS NULL OR did_not_play = false);

-- Game box scores
CREATE INDEX IF NOT EXISTS idx_boxscores_game
  ON player_boxscores_raw (game_id, season, season_type);

-- Full players / team players (boxscores CTE)
CREATE INDEX IF NOT EXISTS idx_boxscores_season_type
  ON player_boxscores_raw (season, season_type)
  WHERE (did_not_play IS NULL OR did_not_play = false);
