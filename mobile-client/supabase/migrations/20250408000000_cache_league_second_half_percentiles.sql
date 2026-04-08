-- Cache table for league-wide 2nd-half scoring percentiles.
-- Avoids a full play_by_play_raw aggregate on every app request.
CREATE TABLE IF NOT EXISTS league_second_half_percentile_cache (
  season       int  NOT NULL,
  season_type  int  NOT NULL,
  p50          numeric NOT NULL,
  p90          numeric NOT NULL,
  p99          numeric NOT NULL,
  refreshed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season, season_type)
);

-- Seed with current values
INSERT INTO league_second_half_percentile_cache (season, season_type, p50, p90, p99)
VALUES (2026, 2, 4, 12, 21)
ON CONFLICT (season, season_type) DO UPDATE
  SET p50 = EXCLUDED.p50,
      p90 = EXCLUDED.p90,
      p99 = EXCLUDED.p99,
      refreshed_at = now();

-- Maintenance function: call this after bulk play-by-play ingestion
CREATE OR REPLACE FUNCTION refresh_league_second_half_percentiles(
  p_season int DEFAULT 2026,
  p_season_type int DEFAULT 2
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_p50 numeric;
  v_p90 numeric;
  v_p99 numeric;
BEGIN
  WITH excluded_games AS (
    SELECT unnest(ARRAY['401809839','401838140','401838141','401838142','401838143']::text[]) AS gid
  ),
  quarter_pts AS (
    SELECT
      SUM(CASE WHEN period_number IN (3,4) AND scoring_play THEN COALESCE(score_value, 0) ELSE 0 END)::int AS second_half_pts
    FROM play_by_play_raw p
    WHERE p.season = p_season
      AND p.season_type = p_season_type
      AND p.game_id::text NOT IN (SELECT gid FROM excluded_games)
      AND p.athlete_id_1 IS NOT NULL
    GROUP BY p.game_id, p.athlete_id_1
  )
  SELECT
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY second_half_pts),
    PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY second_half_pts),
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY second_half_pts)
  INTO v_p50, v_p90, v_p99
  FROM quarter_pts;

  INSERT INTO league_second_half_percentile_cache (season, season_type, p50, p90, p99, refreshed_at)
  VALUES (p_season, p_season_type, v_p50, v_p90, v_p99, now())
  ON CONFLICT (season, season_type) DO UPDATE
    SET p50 = EXCLUDED.p50,
        p90 = EXCLUDED.p90,
        p99 = EXCLUDED.p99,
        refreshed_at = now();
END;
$$;

-- Rewrite the main RPC to read from cache (instant lookup)
CREATE OR REPLACE FUNCTION get_league_second_half_percentiles(
  p_season int DEFAULT 2026,
  p_season_type int DEFAULT 2
)
RETURNS TABLE (p50 numeric, p90 numeric, p99 numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.p50, c.p90, c.p99
  FROM league_second_half_percentile_cache c
  WHERE c.season = p_season
    AND c.season_type = p_season_type;
$$;
