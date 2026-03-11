-- Combined team offensive stats RPC: returns season, last_10, last_5 in one round-trip
-- Reduces 3 round-trips to 1 for game screen Seasonal Breakdown

CREATE OR REPLACE FUNCTION get_team_offensive_stats_all_modes(
  p_season int DEFAULT 2026,
  p_season_type int DEFAULT 2
)
RETURNS TABLE (
  mode text,
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
  -- Full season
  season_totals AS (
    SELECT
      b.team_abbreviation,
      b.game_id,
      SUM(COALESCE(b.points, 0)) AS pts,
      SUM(COALESCE(b.rebounds, 0)) AS reb,
      SUM(COALESCE(b.assists, 0)) AS ast,
      SUM(COALESCE(b.steals, 0)) AS stl,
      SUM(COALESCE(b.blocks, 0)) AS blk,
      SUM(COALESCE(b.turnovers, 0)) AS tov,
      CASE WHEN SUM(COALESCE(b.field_goals_attempted, 0)) > 0
        THEN 100.0 * SUM(COALESCE(b.field_goals_made, 0)) / SUM(COALESCE(b.field_goals_attempted, 0))
        ELSE NULL END AS fg_pct,
      CASE WHEN SUM(COALESCE(b.three_point_field_goals_attempted, 0)) > 0
        THEN 100.0 * SUM(COALESCE(b.three_point_field_goals_made, 0)) / SUM(COALESCE(b.three_point_field_goals_attempted, 0))
        ELSE NULL END AS three_pt_pct,
      CASE WHEN SUM(COALESCE(b.free_throws_attempted, 0)) > 0
        THEN 100.0 * SUM(COALESCE(b.free_throws_made, 0)) / SUM(COALESCE(b.free_throws_attempted, 0))
        ELSE NULL END AS ft_pct
    FROM player_boxscores_raw b
    WHERE b.season = p_season
      AND b.season_type = p_season_type
      AND (b.did_not_play IS NULL OR b.did_not_play = false)
      AND b.team_abbreviation IS NOT NULL
      AND b.team_abbreviation != ''
      AND b.game_id::text NOT IN (SELECT gid FROM excluded_games)
    GROUP BY b.team_abbreviation, b.game_id
  ),
  season_agg AS (
    SELECT
      'season'::text AS mode,
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
    FROM season_totals
    GROUP BY team_abbreviation
  ),
  -- Last 10
  team_games_ranked AS (
    SELECT
      team_abbreviation,
      game_id,
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
  last_n_games AS (
    SELECT team_abbreviation, game_id, rn
    FROM team_games_ranked
    WHERE rn <= 10
  ),
  last10_totals AS (
    SELECT
      b.team_abbreviation,
      b.game_id,
      SUM(COALESCE(b.points, 0)) AS pts,
      SUM(COALESCE(b.rebounds, 0)) AS reb,
      SUM(COALESCE(b.assists, 0)) AS ast,
      SUM(COALESCE(b.steals, 0)) AS stl,
      SUM(COALESCE(b.blocks, 0)) AS blk,
      SUM(COALESCE(b.turnovers, 0)) AS tov,
      CASE WHEN SUM(COALESCE(b.field_goals_attempted, 0)) > 0
        THEN 100.0 * SUM(COALESCE(b.field_goals_made, 0)) / SUM(COALESCE(b.field_goals_attempted, 0))
        ELSE NULL END AS fg_pct,
      CASE WHEN SUM(COALESCE(b.three_point_field_goals_attempted, 0)) > 0
        THEN 100.0 * SUM(COALESCE(b.three_point_field_goals_made, 0)) / SUM(COALESCE(b.three_point_field_goals_attempted, 0))
        ELSE NULL END AS three_pt_pct,
      CASE WHEN SUM(COALESCE(b.free_throws_attempted, 0)) > 0
        THEN 100.0 * SUM(COALESCE(b.free_throws_made, 0)) / SUM(COALESCE(b.free_throws_attempted, 0))
        ELSE NULL END AS ft_pct
    FROM player_boxscores_raw b
    INNER JOIN last_n_games t ON b.team_abbreviation = t.team_abbreviation AND b.game_id = t.game_id
    WHERE b.season = p_season
      AND b.season_type = p_season_type
      AND (b.did_not_play IS NULL OR b.did_not_play = false)
      AND b.team_abbreviation IS NOT NULL
      AND b.team_abbreviation != ''
      AND b.game_id::text NOT IN (SELECT gid FROM excluded_games)
    GROUP BY b.team_abbreviation, b.game_id
  ),
  last10_agg AS (
    SELECT
      'last_10'::text AS mode,
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
    FROM last10_totals
    GROUP BY team_abbreviation
  ),
  -- Last 5
  last5_games AS (
    SELECT team_abbreviation, game_id
    FROM team_games_ranked
    WHERE rn <= 5
  ),
  last5_totals AS (
    SELECT
      b.team_abbreviation,
      b.game_id,
      SUM(COALESCE(b.points, 0)) AS pts,
      SUM(COALESCE(b.rebounds, 0)) AS reb,
      SUM(COALESCE(b.assists, 0)) AS ast,
      SUM(COALESCE(b.steals, 0)) AS stl,
      SUM(COALESCE(b.blocks, 0)) AS blk,
      SUM(COALESCE(b.turnovers, 0)) AS tov,
      CASE WHEN SUM(COALESCE(b.field_goals_attempted, 0)) > 0
        THEN 100.0 * SUM(COALESCE(b.field_goals_made, 0)) / SUM(COALESCE(b.field_goals_attempted, 0))
        ELSE NULL END AS fg_pct,
      CASE WHEN SUM(COALESCE(b.three_point_field_goals_attempted, 0)) > 0
        THEN 100.0 * SUM(COALESCE(b.three_point_field_goals_made, 0)) / SUM(COALESCE(b.three_point_field_goals_attempted, 0))
        ELSE NULL END AS three_pt_pct,
      CASE WHEN SUM(COALESCE(b.free_throws_attempted, 0)) > 0
        THEN 100.0 * SUM(COALESCE(b.free_throws_made, 0)) / SUM(COALESCE(b.free_throws_attempted, 0))
        ELSE NULL END AS ft_pct
    FROM player_boxscores_raw b
    INNER JOIN last5_games t ON b.team_abbreviation = t.team_abbreviation AND b.game_id = t.game_id
    WHERE b.season = p_season
      AND b.season_type = p_season_type
      AND (b.did_not_play IS NULL OR b.did_not_play = false)
      AND b.team_abbreviation IS NOT NULL
      AND b.team_abbreviation != ''
      AND b.game_id::text NOT IN (SELECT gid FROM excluded_games)
    GROUP BY b.team_abbreviation, b.game_id
  ),
  last5_agg AS (
    SELECT
      'last_5'::text AS mode,
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
    FROM last5_totals
    GROUP BY team_abbreviation
  )
  SELECT * FROM season_agg
  UNION ALL
  SELECT * FROM last10_agg
  UNION ALL
  SELECT * FROM last5_agg;
$$;
