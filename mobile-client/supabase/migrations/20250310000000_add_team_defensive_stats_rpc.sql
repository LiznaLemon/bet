-- RPC to get per-team defensive stats: what each team allows (opponent totals when facing them)
-- Used for matchup screen mismatch detection

CREATE OR REPLACE FUNCTION get_team_defensive_stats(p_season int DEFAULT 2026, p_season_type int DEFAULT 2)
RETURNS TABLE (
  team_abbreviation text,
  games_played bigint,
  pts_allowed_avg numeric,
  reb_allowed_avg numeric,
  ast_allowed_avg numeric,
  fg_pct_allowed numeric,
  three_pt_pct_allowed numeric,
  ft_pct_allowed numeric,
  pts_allowed_rank int,
  reb_allowed_rank int,
  ast_allowed_rank int
)
LANGUAGE sql
STABLE
AS $$
  WITH excluded_games AS (
    SELECT unnest(ARRAY['401809839','401838140','401838141','401838142','401838143']::text[]) AS gid
  ),
  opponent_totals AS (
    SELECT
      b.opponent_team_abbreviation AS team_abbreviation,
      b.game_id,
      SUM(COALESCE(b.points, 0)) AS pts,
      SUM(COALESCE(b.rebounds, 0)) AS reb,
      SUM(COALESCE(b.assists, 0)) AS ast,
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
    WHERE b.season = p_season
      AND b.season_type = p_season_type
      AND (b.did_not_play IS NULL OR b.did_not_play = false)
      AND b.opponent_team_abbreviation IS NOT NULL
      AND b.opponent_team_abbreviation != ''
      AND b.game_id::text NOT IN (SELECT gid FROM excluded_games)
    GROUP BY b.opponent_team_abbreviation, b.game_id
  ),
  team_avgs AS (
    SELECT
      team_abbreviation,
      COUNT(*)::bigint AS games_played,
      AVG(pts)::numeric AS pts_allowed_avg,
      AVG(reb)::numeric AS reb_allowed_avg,
      AVG(ast)::numeric AS ast_allowed_avg,
      AVG(fg_pct)::numeric AS fg_pct_allowed,
      AVG(three_pt_pct)::numeric AS three_pt_pct_allowed,
      AVG(ft_pct)::numeric AS ft_pct_allowed
    FROM opponent_totals
    GROUP BY team_abbreviation
  ),
  ranked AS (
    SELECT
      *,
      ROW_NUMBER() OVER (ORDER BY pts_allowed_avg ASC NULLS LAST)::int AS pts_allowed_rank,
      ROW_NUMBER() OVER (ORDER BY reb_allowed_avg DESC NULLS LAST)::int AS reb_allowed_rank,
      ROW_NUMBER() OVER (ORDER BY ast_allowed_avg DESC NULLS LAST)::int AS ast_allowed_rank
    FROM team_avgs
  )
  SELECT
    team_abbreviation,
    games_played,
    pts_allowed_avg,
    reb_allowed_avg,
    ast_allowed_avg,
    fg_pct_allowed,
    three_pt_pct_allowed,
    ft_pct_allowed,
    pts_allowed_rank,
    reb_allowed_rank,
    ast_allowed_rank
  FROM ranked;
$$;
