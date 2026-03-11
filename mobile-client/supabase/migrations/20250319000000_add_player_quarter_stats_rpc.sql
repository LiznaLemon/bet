-- Player quarter stats (points per quarter) from play-by-play for live prop insights
-- Used for Phase 2: max/avg 2nd-half, "never done X" / "done it Y times"

CREATE OR REPLACE FUNCTION get_player_quarter_stats(
  p_athlete_id text,
  p_season int DEFAULT 2026,
  p_season_type int DEFAULT 2,
  p_limit int DEFAULT 50
)
RETURNS TABLE (
  game_id text,
  q1_pts int,
  q2_pts int,
  q3_pts int,
  q4_pts int,
  second_half_pts int
)
LANGUAGE sql
STABLE
AS $$
  WITH excluded_games AS (
    SELECT unnest(ARRAY['401809839','401838140','401838141','401838142','401838143']::text[]) AS gid
  ),
  quarter_pts AS (
    SELECT
      p.game_id::text,
      p.period_number,
      SUM(CASE WHEN p.scoring_play THEN COALESCE(p.score_value, 0)::int ELSE 0 END) AS pts
    FROM play_by_play_raw p
    WHERE p.athlete_id_1::text = p_athlete_id
      AND p.season = p_season
      AND p.season_type = p_season_type
      AND p.game_id::text NOT IN (SELECT gid FROM excluded_games)
    GROUP BY p.game_id, p.period_number
  ),
  pivoted AS (
    SELECT
      game_id,
      COALESCE(MAX(CASE WHEN period_number = 1 THEN pts END), 0)::int AS q1_pts,
      COALESCE(MAX(CASE WHEN period_number = 2 THEN pts END), 0)::int AS q2_pts,
      COALESCE(MAX(CASE WHEN period_number = 3 THEN pts END), 0)::int AS q3_pts,
      COALESCE(MAX(CASE WHEN period_number = 4 THEN pts END), 0)::int AS q4_pts
    FROM quarter_pts
    GROUP BY game_id
  ),
  with_second_half AS (
    SELECT
      p.game_id,
      p.q1_pts,
      p.q2_pts,
      p.q3_pts,
      p.q4_pts,
      (p.q3_pts + p.q4_pts)::int AS second_half_pts
    FROM pivoted p
    INNER JOIN (
      SELECT game_id, game_date
      FROM schedules
      WHERE season = p_season AND season_type = p_season_type
    ) s ON s.game_id::text = p.game_id
    ORDER BY s.game_date DESC
    LIMIT p_limit
  )
  SELECT game_id, q1_pts, q2_pts, q3_pts, q4_pts, second_half_pts
  FROM with_second_half;
$$;
