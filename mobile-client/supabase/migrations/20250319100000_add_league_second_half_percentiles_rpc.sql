-- League-wide 2nd-half points percentiles for live prop baseline (Phase 3)
-- "X in a half is ~Yth percentile for league"

CREATE OR REPLACE FUNCTION get_league_second_half_percentiles(
  p_season int DEFAULT 2026,
  p_season_type int DEFAULT 2
)
RETURNS TABLE (
  p50 numeric,
  p90 numeric,
  p99 numeric
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
      p.athlete_id_1::text AS athlete_id,
      SUM(CASE WHEN p.period_number IN (3, 4) AND p.scoring_play THEN COALESCE(p.score_value, 0) ELSE 0 END)::int AS second_half_pts
    FROM play_by_play_raw p
    WHERE p.season = p_season
      AND p.season_type = p_season_type
      AND p.game_id::text NOT IN (SELECT gid FROM excluded_games)
      AND p.athlete_id_1 IS NOT NULL
    GROUP BY p.game_id, p.athlete_id_1
  )
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY second_half_pts)::numeric AS p50,
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY second_half_pts)::numeric AS p90,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY second_half_pts)::numeric AS p99
  FROM quarter_pts;
$$;
