-- Fix mutable search_path security warning on all RPCs
ALTER FUNCTION public.get_league_second_half_percentiles(integer, integer) SET search_path = 'public';
ALTER FUNCTION public.get_league_stat_variance(integer, integer) SET search_path = 'public';
ALTER FUNCTION public.get_player_quarter_stats(text, integer, integer, integer, date) SET search_path = 'public';
ALTER FUNCTION public.get_player_stat_ranks(integer, integer, text[]) SET search_path = 'public';
ALTER FUNCTION public.get_players_enhanced(integer, integer) SET search_path = 'public';
ALTER FUNCTION public.get_players_enhanced_for_teams(integer, integer, text[]) SET search_path = 'public';
ALTER FUNCTION public.get_team_defensive_stats(integer, integer) SET search_path = 'public';
ALTER FUNCTION public.get_team_defensive_stats_all_modes(integer, integer) SET search_path = 'public';
ALTER FUNCTION public.get_team_matchup_context(text, text, integer, integer) SET search_path = 'public';
ALTER FUNCTION public.get_team_offensive_stats(integer, integer) SET search_path = 'public';
ALTER FUNCTION public.get_team_offensive_stats_all_modes(integer, integer) SET search_path = 'public';
ALTER FUNCTION public.get_team_offensive_stats_last_n(integer, integer, integer) SET search_path = 'public';
