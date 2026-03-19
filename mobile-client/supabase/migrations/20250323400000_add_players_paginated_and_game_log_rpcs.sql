-- See migration applied via MCP for full SQL
-- This file documents the two new RPCs:
-- 1. get_players_paginated(p_season, p_season_type, p_search, p_sort_by, p_sort_dir, p_offset, p_limit)
--    Returns paginated players with server-side search/sort and compact recent_game_log (last 10 games)
-- 2. get_player_game_log(p_athlete_id, p_season, p_season_type, p_limit)
--    Returns full game log for a single player (on-demand fetch for detail views)

-- get_players_paginated: see MCP-applied migration for full source
-- get_player_game_log: see MCP-applied migration for full source
