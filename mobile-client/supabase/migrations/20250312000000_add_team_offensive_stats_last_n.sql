-- RPC to get per-team offensive stats for last N games (per-game averages)
-- Used for Seasonal Breakdown "Last 10" and "Last 5" modes

CREATE OR REPLACE FUNCTION get_team_offensive_stats_last_n(
  p_season int DEFAULT 2026,
  p_season_type int DEFAULT 2,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  team_abbreviation text,
  games_played bigint,
  pts_avg numeric,
  reb_avg numeric,
  ast_avg numeric,
  stl_avg numeric,
  blk_avg numeric,
  tov_avg numeric,
  fg_pct numeric,
  three_pt_pct numeric,
  ft_pct numeric
)
LANGUAGE sql
STABLE
AS $$
  WITH excluded_games AS (
    SELECT unnest(ARRAY['401809839','401838140','401838141','401838142','401838143']::text[]) AS gid
  ),
  team_games_ranked AS (
    SELECT
      team_abbreviation,
      game_id,
      game_date,
      ROW_NUMBER() OVER (PARTITION BY team_abbreviation ORDER BY game_date DESC) AS rn
    FROM (
      SELECT DISTINCT b.team_abbreviation, b.game_id, b.game_date
      FROM player_boxscores_raw b
      WHERE b.season = p_season
        AND b.season_type = p_season_type
        AND (b.did_not_play IS NULL OR b.did_not_play = false)
        AND b.team_abbreviation IS NOT NULL
        AND b.team_abbreviation != ''
        AND b.game_id::text NOT IN (SELECT gid FROM excluded_games)
    ) t
  ),
  team_last_n_games AS (
    SELECT team_abbreviation, game_id
    FROM team_games_ranked
    WHERE rn <= p_limit
  ),
  team_game_totals AS (
    SELECT
      b.team_abbreviation,
      b.game_id,
      SUM(COALESCE(b.points, 0)) AS pts,
      SUM(COALESCE(b.rebounds, 0)) AS reb,
      SUM(COALESCE(b.assists, 0)) AS ast,
      SUM(COALESCE(b.steals, 0)) AS stl,
      SUM(COALESCE(b.blocks, 0)) AS blk,
      SUM(COALESCE(b.turnovers, 0)) AS tov,
      CASE
        WHEN SUM(COALESCE(b.field_goals_attempted, 0)) > 0
        THEN 100.0 * SUM(COALESCE(b.field_goals_made, 0)) / SUM(COALESCE(b.field_goals_attempted, 0))
        ELSE NULL
      END AS fg_pct,
      CASE
        WHEN SUM(COALESCE(b.three_point_field_goals_attempted, 0)) > 0
        THEN 100.0 * SUM(COALESCE(b.three_point_field_goals_made, 0)) / SUM(COALESCE(b.three_point_field_goals_attempted, 0))
        ELSE NULL
      END AS three_pt_pct,
      CASE
        WHEN SUM(COALESCE(b.free_throws_attempted, 0)) > 0
        THEN 100.0 * SUM(COALESCE(b.free_throws_made, 0)) / SUM(COALESCE(b.free_throws_attempted, 0))
        ELSE NULL
      END AS ft_pct
    FROM player_boxscores_raw b
    INNER JOIN team_last_n_games t
      ON b.team_abbreviation = t.team_abbreviation AND b.game_id = t.game_id
    WHERE b.season = p_season
      AND b.season_type = p_season_type
      AND (b.did_not_play IS NULL OR b.did_not_play = false)
      AND b.team_abbreviation IS NOT NULL
      AND b.team_abbreviation != ''
      AND b.game_id::text NOT IN (SELECT gid FROM excluded_games)
    GROUP BY b.team_abbreviation, b.game_id
  )
  SELECT
    team_abbreviation,
    COUNT(*)::bigint AS games_played,
    AVG(pts)::numeric AS pts_avg,
    AVG(reb)::numeric AS reb_avg,
    AVG(ast)::numeric AS ast_avg,
    AVG(stl)::numeric AS stl_avg,
    AVG(blk)::numeric AS blk_avg,
    AVG(tov)::numeric AS tov_avg,
    AVG(fg_pct)::numeric AS fg_pct,
    AVG(three_pt_pct)::numeric AS three_pt_pct,
    AVG(ft_pct)::numeric AS ft_pct
  FROM team_game_totals
  GROUP BY team_abbreviation;
$$;
