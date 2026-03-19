-- Extend get_player_quarter_stats: add p_as_of_date for point-in-time quarter averages,
-- and add per-quarter stats for rebounds, assists, turnovers, steals, blocks, fouls.
-- When viewing a completed game, quarter averages reflect historical data as of that game date.

-- Drop old 4-arg overload (different return type prevents CREATE OR REPLACE from replacing it)
DROP FUNCTION IF EXISTS get_player_quarter_stats(text, integer, integer, integer);

-- Index for athlete_id_1 lookups by season
CREATE INDEX IF NOT EXISTS idx_pbp_athlete1_season_type
  ON play_by_play_raw (athlete_id_1, season, season_type);

-- Index for athlete_id_2 (assists) lookups by season
CREATE INDEX IF NOT EXISTS idx_pbp_athlete2_season_type
  ON play_by_play_raw (athlete_id_2, season, season_type)
  WHERE athlete_id_2 IS NOT NULL;

CREATE OR REPLACE FUNCTION get_player_quarter_stats(
  p_athlete_id text,
  p_season int DEFAULT 2026,
  p_season_type int DEFAULT 2,
  p_limit int DEFAULT 50,
  p_as_of_date date DEFAULT NULL
)
RETURNS TABLE (
  game_id text,
  q1_pts int, q2_pts int, q3_pts int, q4_pts int,
  second_half_pts int,
  q1_reb int, q2_reb int, q3_reb int, q4_reb int,
  q1_ast int, q2_ast int, q3_ast int, q4_ast int,
  q1_tov int, q2_tov int, q3_tov int, q4_tov int,
  q1_stl int, q2_stl int, q3_stl int, q4_stl int,
  q1_blk int, q2_blk int, q3_blk int, q4_blk int,
  q1_pf int, q2_pf int, q3_pf int, q4_pf int
)
LANGUAGE sql
STABLE
AS $$
  WITH excluded_games AS (
    SELECT unnest(ARRAY[401809839,401838140,401838141,401838142,401838143]::bigint[]) AS gid
  ),
  -- Pre-filter to only this player's plays (athlete_id_1) — uses idx_pbp_athlete1_season_type
  plays_a1 AS (
    SELECT p.game_id, p.period_number, p.type_text, p.scoring_play, p.score_value
    FROM play_by_play_raw p
    WHERE p.athlete_id_1 = p_athlete_id::int
      AND p.season = p_season
      AND p.season_type = p_season_type
      AND p.game_id NOT IN (SELECT gid FROM excluded_games)
  ),
  -- Assists use athlete_id_2 — uses idx_pbp_athlete2_season_type
  plays_a2 AS (
    SELECT p.game_id, p.period_number
    FROM play_by_play_raw p
    WHERE p.athlete_id_2 = p_athlete_id::int
      AND p.scoring_play
      AND p.season = p_season
      AND p.season_type = p_season_type
      AND p.game_id NOT IN (SELECT gid FROM excluded_games)
  ),
  quarter_pts AS (
    SELECT game_id::text, period_number,
      SUM(CASE WHEN scoring_play THEN COALESCE(score_value, 0)::int ELSE 0 END) AS pts
    FROM plays_a1
    GROUP BY game_id, period_number
  ),
  quarter_reb AS (
    SELECT game_id::text, period_number, COUNT(*)::int AS reb
    FROM plays_a1
    WHERE LOWER(type_text) LIKE '%offensive rebound%' OR LOWER(type_text) LIKE '%defensive rebound%'
    GROUP BY game_id, period_number
  ),
  quarter_ast AS (
    SELECT game_id::text, period_number, COUNT(*)::int AS ast
    FROM plays_a2
    GROUP BY game_id, period_number
  ),
  quarter_tov AS (
    SELECT game_id::text, period_number, COUNT(*)::int AS tov
    FROM plays_a1
    WHERE LOWER(type_text) LIKE '%turnover%'
    GROUP BY game_id, period_number
  ),
  quarter_stl AS (
    SELECT game_id::text, period_number, COUNT(*)::int AS stl
    FROM plays_a1
    WHERE LOWER(type_text) LIKE '%steal%'
    GROUP BY game_id, period_number
  ),
  quarter_blk AS (
    SELECT game_id::text, period_number, COUNT(*)::int AS blk
    FROM plays_a1
    WHERE LOWER(type_text) LIKE '%block%'
    GROUP BY game_id, period_number
  ),
  quarter_pf AS (
    SELECT game_id::text, period_number, COUNT(*)::int AS pf
    FROM plays_a1
    WHERE LOWER(type_text) LIKE '%foul%' AND LOWER(type_text) NOT LIKE '%turnover%'
    GROUP BY game_id, period_number
  ),
  pivoted_pts AS (
    SELECT game_id,
      COALESCE(MAX(CASE WHEN period_number = 1 THEN pts END), 0)::int AS q1_pts,
      COALESCE(MAX(CASE WHEN period_number = 2 THEN pts END), 0)::int AS q2_pts,
      COALESCE(MAX(CASE WHEN period_number = 3 THEN pts END), 0)::int AS q3_pts,
      COALESCE(MAX(CASE WHEN period_number = 4 THEN pts END), 0)::int AS q4_pts
    FROM quarter_pts GROUP BY game_id
  ),
  pivoted_reb AS (
    SELECT game_id,
      COALESCE(MAX(CASE WHEN period_number = 1 THEN reb END), 0)::int AS q1_reb,
      COALESCE(MAX(CASE WHEN period_number = 2 THEN reb END), 0)::int AS q2_reb,
      COALESCE(MAX(CASE WHEN period_number = 3 THEN reb END), 0)::int AS q3_reb,
      COALESCE(MAX(CASE WHEN period_number = 4 THEN reb END), 0)::int AS q4_reb
    FROM quarter_reb GROUP BY game_id
  ),
  pivoted_ast AS (
    SELECT game_id,
      COALESCE(MAX(CASE WHEN period_number = 1 THEN ast END), 0)::int AS q1_ast,
      COALESCE(MAX(CASE WHEN period_number = 2 THEN ast END), 0)::int AS q2_ast,
      COALESCE(MAX(CASE WHEN period_number = 3 THEN ast END), 0)::int AS q3_ast,
      COALESCE(MAX(CASE WHEN period_number = 4 THEN ast END), 0)::int AS q4_ast
    FROM quarter_ast GROUP BY game_id
  ),
  pivoted_tov AS (
    SELECT game_id,
      COALESCE(MAX(CASE WHEN period_number = 1 THEN tov END), 0)::int AS q1_tov,
      COALESCE(MAX(CASE WHEN period_number = 2 THEN tov END), 0)::int AS q2_tov,
      COALESCE(MAX(CASE WHEN period_number = 3 THEN tov END), 0)::int AS q3_tov,
      COALESCE(MAX(CASE WHEN period_number = 4 THEN tov END), 0)::int AS q4_tov
    FROM quarter_tov GROUP BY game_id
  ),
  pivoted_stl AS (
    SELECT game_id,
      COALESCE(MAX(CASE WHEN period_number = 1 THEN stl END), 0)::int AS q1_stl,
      COALESCE(MAX(CASE WHEN period_number = 2 THEN stl END), 0)::int AS q2_stl,
      COALESCE(MAX(CASE WHEN period_number = 3 THEN stl END), 0)::int AS q3_stl,
      COALESCE(MAX(CASE WHEN period_number = 4 THEN stl END), 0)::int AS q4_stl
    FROM quarter_stl GROUP BY game_id
  ),
  pivoted_blk AS (
    SELECT game_id,
      COALESCE(MAX(CASE WHEN period_number = 1 THEN blk END), 0)::int AS q1_blk,
      COALESCE(MAX(CASE WHEN period_number = 2 THEN blk END), 0)::int AS q2_blk,
      COALESCE(MAX(CASE WHEN period_number = 3 THEN blk END), 0)::int AS q3_blk,
      COALESCE(MAX(CASE WHEN period_number = 4 THEN blk END), 0)::int AS q4_blk
    FROM quarter_blk GROUP BY game_id
  ),
  pivoted_pf AS (
    SELECT game_id,
      COALESCE(MAX(CASE WHEN period_number = 1 THEN pf END), 0)::int AS q1_pf,
      COALESCE(MAX(CASE WHEN period_number = 2 THEN pf END), 0)::int AS q2_pf,
      COALESCE(MAX(CASE WHEN period_number = 3 THEN pf END), 0)::int AS q3_pf,
      COALESCE(MAX(CASE WHEN period_number = 4 THEN pf END), 0)::int AS q4_pf
    FROM quarter_pf GROUP BY game_id
  ),
  sched AS (
    SELECT game_id, game_date
    FROM schedules
    WHERE season = p_season AND season_type = p_season_type
      AND (p_as_of_date IS NULL OR game_date < p_as_of_date)
  ),
  combined AS (
    SELECT
      pt.game_id,
      pt.q1_pts, pt.q2_pts, pt.q3_pts, pt.q4_pts,
      (pt.q3_pts + pt.q4_pts)::int AS second_half_pts,
      COALESCE(rb.q1_reb, 0) AS q1_reb, COALESCE(rb.q2_reb, 0) AS q2_reb,
      COALESCE(rb.q3_reb, 0) AS q3_reb, COALESCE(rb.q4_reb, 0) AS q4_reb,
      COALESCE(ast.q1_ast, 0) AS q1_ast, COALESCE(ast.q2_ast, 0) AS q2_ast,
      COALESCE(ast.q3_ast, 0) AS q3_ast, COALESCE(ast.q4_ast, 0) AS q4_ast,
      COALESCE(tv.q1_tov, 0) AS q1_tov, COALESCE(tv.q2_tov, 0) AS q2_tov,
      COALESCE(tv.q3_tov, 0) AS q3_tov, COALESCE(tv.q4_tov, 0) AS q4_tov,
      COALESCE(st.q1_stl, 0) AS q1_stl, COALESCE(st.q2_stl, 0) AS q2_stl,
      COALESCE(st.q3_stl, 0) AS q3_stl, COALESCE(st.q4_stl, 0) AS q4_stl,
      COALESCE(bl.q1_blk, 0) AS q1_blk, COALESCE(bl.q2_blk, 0) AS q2_blk,
      COALESCE(bl.q3_blk, 0) AS q3_blk, COALESCE(bl.q4_blk, 0) AS q4_blk,
      COALESCE(pf.q1_pf, 0) AS q1_pf, COALESCE(pf.q2_pf, 0) AS q2_pf,
      COALESCE(pf.q3_pf, 0) AS q3_pf, COALESCE(pf.q4_pf, 0) AS q4_pf,
      s.game_date
    FROM pivoted_pts pt
    INNER JOIN sched s ON s.game_id::text = pt.game_id
    LEFT JOIN pivoted_reb rb ON rb.game_id = pt.game_id
    LEFT JOIN pivoted_ast ast ON ast.game_id = pt.game_id
    LEFT JOIN pivoted_tov tv ON tv.game_id = pt.game_id
    LEFT JOIN pivoted_stl st ON st.game_id = pt.game_id
    LEFT JOIN pivoted_blk bl ON bl.game_id = pt.game_id
    LEFT JOIN pivoted_pf pf ON pf.game_id = pt.game_id
    ORDER BY s.game_date DESC
    LIMIT p_limit
  )
  SELECT
    game_id, q1_pts, q2_pts, q3_pts, q4_pts, second_half_pts,
    q1_reb, q2_reb, q3_reb, q4_reb,
    q1_ast, q2_ast, q3_ast, q4_ast,
    q1_tov, q2_tov, q3_tov, q4_tov,
    q1_stl, q2_stl, q3_stl, q4_stl,
    q1_blk, q2_blk, q3_blk, q4_blk,
    q1_pf, q2_pf, q3_pf, q4_pf
  FROM combined;
$$;
