-- Combined team matchup context RPC: recent results + active player IDs for both teams
-- Reduces 4 round-trips to 1 for game screen

CREATE OR REPLACE FUNCTION get_team_matchup_context(
  p_away_abbrev text,
  p_home_abbrev text,
  p_season int DEFAULT 2026,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  away_recent_results jsonb,
  home_recent_results jsonb,
  active_away_ids text[],
  active_home_ids text[]
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_away text;
  v_home text;
  v_away_results jsonb;
  v_home_results jsonb;
  v_active_away text[];
  v_active_home text[];
BEGIN
  v_away := UPPER(TRIM(COALESCE(p_away_abbrev, '')));
  v_home := UPPER(TRIM(COALESCE(p_home_abbrev, '')));
  IF v_away = '' OR v_home = '' THEN
    RETURN QUERY SELECT
      '{"wins":0,"losses":0,"results":[]}'::jsonb,
      '{"wins":0,"losses":0,"results":[]}'::jsonb,
      ARRAY[]::text[],
      ARRAY[]::text[];
    RETURN;
  END IF;

  -- Away team recent results (last N completed games)
  WITH away_games AS (
    SELECT game_id, game_date, home_abbreviation, away_abbreviation, home_score, away_score
    FROM schedules
    WHERE season = p_season
      AND season_type = 2
      AND status_type_completed = true
      AND home_score IS NOT NULL
      AND away_score IS NOT NULL
      AND (UPPER(home_abbreviation) = v_away OR UPPER(away_abbreviation) = v_away)
      AND game_id::text NOT IN ('401809839','401838140','401838141','401838142','401838143')
    ORDER BY game_date DESC, game_id DESC
    LIMIT (p_limit + 5)
  ),
  away_with_result AS (
    SELECT
      CASE WHEN UPPER(home_abbreviation) = v_away
        THEN (home_score > away_score)
        ELSE (away_score > home_score)
      END AS won
    FROM away_games
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'wins', (SELECT COUNT(*)::int FROM away_with_result WHERE won),
    'losses', (SELECT COUNT(*)::int FROM away_with_result WHERE NOT won),
    'results', (
      SELECT jsonb_agg(CASE WHEN won THEN 'W'::text ELSE 'L'::text END ORDER BY ord)
      FROM (SELECT won, row_number() OVER () AS ord FROM away_with_result) t
    )
  ) INTO v_away_results;

  -- Home team recent results
  WITH home_games AS (
    SELECT game_id, game_date, home_abbreviation, away_abbreviation, home_score, away_score
    FROM schedules
    WHERE season = p_season
      AND season_type = 2
      AND status_type_completed = true
      AND home_score IS NOT NULL
      AND away_score IS NOT NULL
      AND (UPPER(home_abbreviation) = v_home OR UPPER(away_abbreviation) = v_home)
      AND game_id::text NOT IN ('401809839','401838140','401838141','401838142','401838143')
    ORDER BY game_date DESC, game_id DESC
    LIMIT (p_limit + 5)
  ),
  home_with_result AS (
    SELECT
      CASE WHEN UPPER(home_abbreviation) = v_home
        THEN (home_score > away_score)
        ELSE (away_score > home_score)
      END AS won
    FROM home_games
    LIMIT p_limit
  )
  SELECT jsonb_build_object(
    'wins', (SELECT COUNT(*)::int FROM home_with_result WHERE won),
    'losses', (SELECT COUNT(*)::int FROM home_with_result WHERE NOT won),
    'results', (
      SELECT jsonb_agg(CASE WHEN won THEN 'W'::text ELSE 'L'::text END ORDER BY ord)
      FROM (SELECT won, row_number() OVER () AS ord FROM home_with_result) t
    )
  ) INTO v_home_results;

  -- Active away player IDs (played in last N games)
  WITH away_games_distinct AS (
    SELECT DISTINCT game_id, game_date
    FROM player_boxscores_raw
    WHERE season = p_season
      AND season_type = 2
      AND UPPER(TRIM(team_abbreviation)) = v_away
      AND (did_not_play IS NULL OR did_not_play = false)
      AND game_id::text NOT IN ('401809839','401838140','401838141','401838142','401838143')
  ),
  away_last_games AS (
    SELECT game_id FROM (
      SELECT game_id, ROW_NUMBER() OVER (ORDER BY game_date DESC, game_id DESC) AS rn
      FROM away_games_distinct
    ) t
    WHERE rn <= p_limit
  )
  SELECT COALESCE(array_agg(DISTINCT athlete_id::text), ARRAY[]::text[])
  INTO v_active_away
  FROM player_boxscores_raw b
  INNER JOIN away_last_games g ON b.game_id = g.game_id
  WHERE b.season = p_season
    AND b.season_type = 2
    AND UPPER(TRIM(b.team_abbreviation)) = v_away
    AND (b.did_not_play IS NULL OR b.did_not_play = false);

  -- Active home player IDs
  WITH home_games_distinct AS (
    SELECT DISTINCT game_id, game_date
    FROM player_boxscores_raw
    WHERE season = p_season
      AND season_type = 2
      AND UPPER(TRIM(team_abbreviation)) = v_home
      AND (did_not_play IS NULL OR did_not_play = false)
      AND game_id::text NOT IN ('401809839','401838140','401838141','401838142','401838143')
  ),
  home_last_games AS (
    SELECT game_id FROM (
      SELECT game_id, ROW_NUMBER() OVER (ORDER BY game_date DESC, game_id DESC) AS rn
      FROM home_games_distinct
    ) t
    WHERE rn <= p_limit
  )
  SELECT COALESCE(array_agg(DISTINCT athlete_id::text), ARRAY[]::text[])
  INTO v_active_home
  FROM player_boxscores_raw b
  INNER JOIN home_last_games g ON b.game_id = g.game_id
  WHERE b.season = p_season
    AND b.season_type = 2
    AND UPPER(TRIM(b.team_abbreviation)) = v_home
    AND (b.did_not_play IS NULL OR b.did_not_play = false);

  RETURN QUERY SELECT
    COALESCE(v_away_results, '{"wins":0,"losses":0,"results":[]}'::jsonb),
    COALESCE(v_home_results, '{"wins":0,"losses":0,"results":[]}'::jsonb),
    COALESCE(v_active_away, ARRAY[]::text[]),
    COALESCE(v_active_home, ARRAY[]::text[]);
END;
$$;
