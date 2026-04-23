-- Extend get_previous_matchups to include playoff games and expose season_type.
DROP FUNCTION IF EXISTS public.get_previous_matchups(text, text, integer, text);
-- Previously filtered to season_type = 2 (regular season only), which meant
-- playoff series games were invisible during the postseason.
CREATE OR REPLACE FUNCTION public.get_previous_matchups(
  p_home_abbrev text,
  p_away_abbrev text,
  p_season integer DEFAULT 2026,
  p_exclude_game_id text DEFAULT NULL
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
  season_type integer
) LANGUAGE sql STABLE AS $$
  SELECT
    s.game_id, s.game_date, s.game_date_time,
    s.home_abbreviation, s.away_abbreviation,
    s.home_display_name, s.away_display_name,
    s.venue_full_name, s.status_type_short_detail,
    s.status_type_completed, s.home_score, s.away_score,
    s.season_type
  FROM schedules s
  WHERE s.season = p_season
    AND s.season_type != 1
    AND s.status_type_completed = true
    AND s.home_score IS NOT NULL
    AND s.away_score IS NOT NULL
    AND s.game_id::text NOT IN ('401809839','401838140','401838141','401838142','401838143')
    AND (p_exclude_game_id IS NULL OR s.game_id::text != p_exclude_game_id)
    AND (
      (UPPER(s.home_abbreviation) = ANY(team_abbrev_aliases(p_home_abbrev))
       AND UPPER(s.away_abbreviation) = ANY(team_abbrev_aliases(p_away_abbrev)))
      OR
      (UPPER(s.home_abbreviation) = ANY(team_abbrev_aliases(p_away_abbrev))
       AND UPPER(s.away_abbreviation) = ANY(team_abbrev_aliases(p_home_abbrev)))
    )
  ORDER BY s.game_date DESC;
$$;
ALTER FUNCTION public.get_previous_matchups(text, text, integer, text) SET search_path = 'public';
