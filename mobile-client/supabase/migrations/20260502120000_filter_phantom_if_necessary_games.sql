-- Exclude phantom "If Necessary" playoff games for series that are already decided.
-- ESPN pre-populates these games but never marks them completed when a series ends early.
-- A series is decided when completed head-to-head games show one team has >= 4 wins.
CREATE OR REPLACE FUNCTION public.get_schedule_enriched(
  p_season integer DEFAULT 2026,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_season_type integer DEFAULT NULL
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
  away_back_to_back boolean,
  notes_headline text,
  season_type integer
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
      s.home_records, s.away_records,
      s.notes_headline, s.season_type
    FROM schedules s
    WHERE s.season = p_season
      AND (
        CASE
          WHEN p_season_type IS NOT NULL THEN s.season_type = p_season_type
          ELSE s.season_type IN (2, 3, 5)
        END
      )
      AND s.home_abbreviation IS NOT NULL
      AND s.game_id NOT IN (SELECT gid FROM excluded)
  ),
  series_wins AS (
    SELECT
      LEAST(UPPER(home_abbreviation), UPPER(away_abbreviation)) AS team_a,
      GREATEST(UPPER(home_abbreviation), UPPER(away_abbreviation)) AS team_b,
      COUNT(*) FILTER (
        WHERE home_score > away_score
          AND UPPER(home_abbreviation) = LEAST(UPPER(home_abbreviation), UPPER(away_abbreviation))
      ) + COUNT(*) FILTER (
        WHERE away_score > home_score
          AND UPPER(away_abbreviation) = LEAST(UPPER(home_abbreviation), UPPER(away_abbreviation))
      ) AS team_a_wins,
      COUNT(*) FILTER (
        WHERE home_score > away_score
          AND UPPER(home_abbreviation) = GREATEST(UPPER(home_abbreviation), UPPER(away_abbreviation))
      ) + COUNT(*) FILTER (
        WHERE away_score > home_score
          AND UPPER(away_abbreviation) = GREATEST(UPPER(home_abbreviation), UPPER(away_abbreviation))
      ) AS team_b_wins
    FROM schedules
    WHERE season = p_season AND season_type = 3 AND status_type_completed = true
    GROUP BY team_a, team_b
  ),
  team_games AS (
    SELECT game_id, game_date, UPPER(home_abbreviation) AS team, 'home' AS side
    FROM base WHERE home_abbreviation != 'TBD'
    UNION ALL
    SELECT game_id, game_date, UPPER(away_abbreviation) AS team, 'away' AS side
    FROM base WHERE away_abbreviation != 'TBD'
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
    COALESCE(ab.is_b2b, false) AS away_back_to_back,
    b.notes_headline,
    b.season_type
  FROM base b
  LEFT JOIN with_lag hb ON b.game_id = hb.game_id AND hb.side = 'home'
  LEFT JOIN with_lag ab ON b.game_id = ab.game_id AND ab.side = 'away'
  WHERE (p_start_date IS NULL OR b.game_date >= p_start_date)
    AND (p_end_date IS NULL OR b.game_date <= p_end_date)
    AND NOT (
      b.notes_headline ILIKE '%If Necessary%'
      AND NOT b.status_type_completed
      AND EXISTS (
        SELECT 1 FROM series_wins sw
        WHERE sw.team_a = LEAST(UPPER(b.home_abbreviation), UPPER(b.away_abbreviation))
          AND sw.team_b = GREATEST(UPPER(b.home_abbreviation), UPPER(b.away_abbreviation))
          AND (sw.team_a_wins >= 4 OR sw.team_b_wins >= 4)
      )
    )
  ORDER BY b.game_date, b.game_date_time;
$$;

ALTER FUNCTION public.get_schedule_enriched(integer, date, date, integer) SET search_path = 'public';

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
  SELECT
    e.game_id,
    e.game_date,
    e.game_date_time,
    e.home_abbreviation,
    e.away_abbreviation,
    e.home_display_name,
    e.away_display_name,
    e.venue_full_name,
    e.status_type_short_detail,
    e.status_type_completed,
    e.home_score,
    e.away_score,
    e.home_records,
    e.away_records,
    e.home_back_to_back,
    e.away_back_to_back
  FROM public.get_schedule_enriched(p_season, p_start_date, p_end_date, NULL) AS e;
$$;

ALTER FUNCTION public.get_schedule_enriched(integer, date, date) SET search_path = 'public';
