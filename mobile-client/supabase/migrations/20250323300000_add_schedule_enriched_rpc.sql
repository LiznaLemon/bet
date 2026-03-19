CREATE OR REPLACE FUNCTION public.get_schedule_enriched(
  p_season integer DEFAULT 2026,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  game_id bigint,
  game_date date,
  game_date_time timestamptz,
  home_abbreviation text,
  away_abbreviation text,
  home_display_name text,
  away_display_name text,
  venue_full_name text,
  status_type_short_detail text,
  status_type_completed boolean,
  home_score integer,
  away_score integer,
  home_records text,
  away_records text,
  home_back_to_back boolean,
  away_back_to_back boolean
) LANGUAGE sql STABLE AS $$
  WITH excluded AS (
    SELECT unnest(ARRAY[401809839,401838140,401838141,401838142,401838143]::bigint[]) AS gid
  ),
  base AS (
    SELECT s.game_id, s.game_date, s.game_date_time,
      s.home_abbreviation, s.away_abbreviation,
      s.home_display_name, s.away_display_name,
      s.venue_full_name, s.status_type_short_detail,
      s.status_type_completed, s.home_score, s.away_score,
      s.home_records, s.away_records
    FROM schedules s
    WHERE s.season = p_season
      AND s.season_type = 2
      AND s.home_abbreviation IS NOT NULL
      AND s.home_abbreviation != 'TBD'
      AND s.game_id NOT IN (SELECT gid FROM excluded)
  ),
  team_games AS (
    SELECT game_id, game_date, UPPER(home_abbreviation) AS team, 'home' AS side FROM base
    UNION ALL
    SELECT game_id, game_date, UPPER(away_abbreviation) AS team, 'away' AS side FROM base
  ),
  with_lag AS (
    SELECT game_id, team, side,
      (game_date - LAG(game_date) OVER (PARTITION BY team ORDER BY game_date, game_id)) = 1 AS is_b2b
    FROM team_games
  )
  SELECT
    b.game_id, b.game_date, b.game_date_time,
    b.home_abbreviation, b.away_abbreviation,
    b.home_display_name, b.away_display_name,
    b.venue_full_name, b.status_type_short_detail,
    b.status_type_completed, b.home_score, b.away_score,
    b.home_records, b.away_records,
    COALESCE(hb.is_b2b, false) AS home_back_to_back,
    COALESCE(ab.is_b2b, false) AS away_back_to_back
  FROM base b
  LEFT JOIN with_lag hb ON b.game_id = hb.game_id AND hb.side = 'home'
  LEFT JOIN with_lag ab ON b.game_id = ab.game_id AND ab.side = 'away'
  WHERE (p_start_date IS NULL OR b.game_date >= p_start_date)
    AND (p_end_date IS NULL OR b.game_date <= p_end_date)
  ORDER BY b.game_date, b.game_date_time;
$$;
ALTER FUNCTION public.get_schedule_enriched(integer, date, date) SET search_path = 'public';
