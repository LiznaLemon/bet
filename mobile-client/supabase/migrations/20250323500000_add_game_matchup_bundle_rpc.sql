CREATE OR REPLACE FUNCTION public.get_game_matchup_bundle(
  p_season integer DEFAULT 2026,
  p_season_type integer DEFAULT 2
)
RETURNS TABLE (
  bundle jsonb
) LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN QUERY
  SELECT jsonb_build_object(
    'team_offensive_all_modes', (
      SELECT jsonb_agg(row_to_json(r))
      FROM get_team_offensive_stats_all_modes(p_season, p_season_type) r
    ),
    'team_defensive_all_modes', (
      SELECT jsonb_agg(row_to_json(r))
      FROM get_team_defensive_stats_all_modes(p_season, p_season_type) r
    ),
    'league_variance', (
      SELECT row_to_json(r)
      FROM get_league_stat_variance(p_season, p_season_type) r
    )
  ) AS bundle;
END;
$$;
ALTER FUNCTION public.get_game_matchup_bundle(integer, integer) SET search_path = 'public';
