-- Add stat_rank to get_players_paginated for layout stability (rank arrives with players, no separate query)
-- Must DROP first because we're changing the return type (adding a column)

DROP FUNCTION IF EXISTS public.get_players_paginated(integer, integer, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.get_players_paginated(
  p_season integer DEFAULT 2026,
  p_season_type integer DEFAULT 2,
  p_search text DEFAULT NULL,
  p_sort_by text DEFAULT 'ppg',
  p_sort_dir text DEFAULT 'desc',
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 25
)
RETURNS TABLE (
  athlete_id text,
  athlete_display_name text,
  athlete_short_name text,
  athlete_headshot_href text,
  athlete_position_name text,
  athlete_position_abbreviation text,
  jersey_number text,
  team_display_name text,
  team_abbreviation text,
  team_logo text,
  team_color text,
  games_played bigint,
  total_minutes numeric,
  total_points numeric,
  total_rebounds numeric,
  total_assists numeric,
  total_steals numeric,
  total_blocks numeric,
  total_turnovers numeric,
  total_fouls numeric,
  total_field_goals_made numeric,
  total_field_goals_attempted numeric,
  total_three_point_made numeric,
  total_three_point_attempted numeric,
  total_free_throws_made numeric,
  total_free_throws_attempted numeric,
  total_offensive_rebounds numeric,
  total_defensive_rebounds numeric,
  total_plus_minus numeric,
  ppg text,
  rpg text,
  apg text,
  spg text,
  bpg text,
  tpg text,
  fpg text,
  mpg text,
  plus_minus_avg text,
  fg_pct text,
  three_pt_pct text,
  ft_pct text,
  recent_game_log jsonb,
  total_count bigint,
  qualified boolean,
  stat_rank integer
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  v_search text;
BEGIN
  v_search := NULLIF(TRIM(COALESCE(p_search, '')), '');

  RETURN QUERY
  WITH excluded_games AS (
    SELECT unnest(ARRAY['401809839','401838140','401838141','401838142','401838143']::text[]) AS gid
  ),
  boxscores AS (
    SELECT
      b.athlete_id,
      b.athlete_display_name,
      b.athlete_short_name,
      b.athlete_headshot_href,
      b.athlete_position_name,
      b.athlete_position_abbreviation,
      b.athlete_jersey,
      b.team_display_name,
      b.team_abbreviation,
      b.team_logo,
      REPLACE(COALESCE(b.team_color, ''), '#', '') AS team_color,
      b.game_id,
      b.game_date,
      COALESCE(b.points, 0)::numeric AS points,
      COALESCE(b.rebounds, 0)::numeric AS rebounds,
      COALESCE(b.assists, 0)::numeric AS assists,
      COALESCE(b.steals, 0)::numeric AS steals,
      COALESCE(b.blocks, 0)::numeric AS blocks,
      COALESCE(b.minutes, 0)::numeric AS minutes,
      COALESCE(b.field_goals_made, 0)::numeric AS field_goals_made,
      COALESCE(b.field_goals_attempted, 0)::numeric AS field_goals_attempted,
      COALESCE(b.three_point_field_goals_made, 0)::numeric AS three_point_made,
      COALESCE(b.three_point_field_goals_attempted, 0)::numeric AS three_point_attempted,
      COALESCE(b.free_throws_made, 0)::numeric AS free_throws_made,
      COALESCE(b.free_throws_attempted, 0)::numeric AS free_throws_attempted,
      COALESCE(b.turnovers, 0)::numeric AS turnovers,
      COALESCE(b.fouls, 0)::numeric AS fouls,
      COALESCE((b.plus_minus::text::numeric), 0)::numeric AS plus_minus,
      COALESCE(b.offensive_rebounds, 0)::numeric AS offensive_rebounds,
      COALESCE(b.defensive_rebounds, 0)::numeric AS defensive_rebounds
    FROM player_boxscores_raw b
    WHERE b.season = p_season
      AND b.season_type = p_season_type
      AND (b.did_not_play IS NULL OR b.did_not_play = false)
      AND b.game_id::text NOT IN (SELECT gid FROM excluded_games)
  ),
  team_game_counts AS (
    SELECT bx.team_abbreviation AS ta, COUNT(DISTINCT bx.game_id)::bigint AS team_gp
    FROM boxscores bx
    GROUP BY bx.team_abbreviation
  ),
  player_totals AS (
    SELECT
      bx.athlete_id::text AS aid,
      (array_agg(bx.athlete_display_name ORDER BY bx.game_date DESC))[1] AS adn,
      (array_agg(bx.athlete_short_name ORDER BY bx.game_date DESC))[1] AS asn,
      (array_agg(bx.athlete_headshot_href ORDER BY bx.game_date DESC))[1] AS ahh,
      (array_agg(bx.athlete_position_name ORDER BY bx.game_date DESC))[1] AS apn,
      (array_agg(bx.athlete_position_abbreviation ORDER BY bx.game_date DESC))[1] AS apa,
      NULLIF(TRIM(COALESCE((array_agg(bx.athlete_jersey ORDER BY bx.game_date DESC))[1]::text, '')), '') AS jn,
      (array_agg(bx.team_display_name ORDER BY bx.game_date DESC))[1] AS tdn,
      (array_agg(bx.team_abbreviation ORDER BY bx.game_date DESC))[1] AS ta,
      (array_agg(bx.team_logo ORDER BY bx.game_date DESC))[1] AS tl,
      (array_agg(bx.team_color ORDER BY bx.game_date DESC))[1] AS tc,
      COUNT(*)::bigint AS gp,
      SUM(bx.minutes) AS tot_min,
      SUM(bx.points) AS tot_pts,
      SUM(bx.rebounds) AS tot_reb,
      SUM(bx.assists) AS tot_ast,
      SUM(bx.steals) AS tot_stl,
      SUM(bx.blocks) AS tot_blk,
      SUM(bx.turnovers) AS tot_tov,
      SUM(bx.fouls) AS tot_fls,
      SUM(bx.field_goals_made) AS tot_fgm,
      SUM(bx.field_goals_attempted) AS tot_fga,
      SUM(bx.three_point_made) AS tot_3pm,
      SUM(bx.three_point_attempted) AS tot_3pa,
      SUM(bx.free_throws_made) AS tot_ftm,
      SUM(bx.free_throws_attempted) AS tot_fta,
      SUM(bx.offensive_rebounds) AS tot_oreb,
      SUM(bx.defensive_rebounds) AS tot_dreb,
      SUM(bx.plus_minus) AS tot_pm
    FROM boxscores bx
    GROUP BY bx.athlete_id
  ),
  filtered AS (
    SELECT pt.*
    FROM player_totals pt
    WHERE v_search IS NULL
      OR LOWER(pt.adn) LIKE '%' || LOWER(v_search) || '%'
      OR LOWER(pt.ta) LIKE '%' || LOWER(v_search) || '%'
  ),
  cnt AS (
    SELECT COUNT(*)::bigint AS c FROM filtered
  ),
  sorted AS (
    SELECT f.*,
      COALESCE(tgc.team_gp, 0) AS team_gp,
      (f.gp >= COALESCE(tgc.team_gp, 0) * 0.7) AS is_qualified,
      CASE p_sort_by
        WHEN 'ppg' THEN f.tot_pts / NULLIF(f.gp, 0)
        WHEN 'rpg' THEN f.tot_reb / NULLIF(f.gp, 0)
        WHEN 'apg' THEN f.tot_ast / NULLIF(f.gp, 0)
        WHEN '3pm' THEN f.tot_3pm / NULLIF(f.gp, 0)
        WHEN 'spg' THEN f.tot_stl / NULLIF(f.gp, 0)
        WHEN 'bpg' THEN f.tot_blk / NULLIF(f.gp, 0)
        WHEN 'mpg' THEN f.tot_min / NULLIF(f.gp, 0)
        ELSE f.tot_pts / NULLIF(f.gp, 0)
      END AS sort_val
    FROM filtered f
    LEFT JOIN team_game_counts tgc ON f.ta = tgc.ta
  ),
  sorted_with_rank AS (
    SELECT s.*,
      ROW_NUMBER() OVER (
        ORDER BY
          s.is_qualified DESC,
          CASE WHEN p_sort_dir = 'desc' THEN s.sort_val END DESC NULLS LAST,
          CASE WHEN p_sort_dir != 'desc' THEN s.sort_val END ASC NULLS LAST
      )::int AS stat_rank
    FROM sorted s
  ),
  paged AS (
    SELECT s.*
    FROM sorted_with_rank s
    ORDER BY
      s.is_qualified DESC,
      CASE WHEN p_sort_dir = 'desc' THEN s.sort_val END DESC NULLS LAST,
      CASE WHEN p_sort_dir != 'desc' THEN s.sort_val END ASC NULLS LAST
    OFFSET p_offset
    LIMIT p_limit
  ),
  recent_logs AS (
    SELECT
      bx.athlete_id::text AS aid,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'points', bx.points,
            'rebounds', bx.rebounds,
            'assists', bx.assists,
            'steals', bx.steals,
            'blocks', bx.blocks,
            'three_point_made', bx.three_point_made
          ) ORDER BY bx.game_date DESC
        ) FILTER (WHERE bx.game_id IS NOT NULL),
        '[]'::jsonb
      ) AS rgl
    FROM (
      SELECT bx2.*, ROW_NUMBER() OVER (PARTITION BY bx2.athlete_id ORDER BY bx2.game_date DESC) AS rn
      FROM boxscores bx2
      WHERE bx2.athlete_id::text IN (SELECT p.aid FROM paged p)
    ) bx
    WHERE bx.rn <= 10
    GROUP BY bx.athlete_id
  )
  SELECT
    p.aid,
    p.adn, p.asn, p.ahh, p.apn, p.apa, p.jn,
    p.tdn, p.ta, p.tl, p.tc,
    p.gp, p.tot_min, p.tot_pts, p.tot_reb, p.tot_ast, p.tot_stl, p.tot_blk,
    p.tot_tov, p.tot_fls, p.tot_fgm, p.tot_fga, p.tot_3pm, p.tot_3pa,
    p.tot_ftm, p.tot_fta, p.tot_oreb, p.tot_dreb, p.tot_pm,
    ROUND((p.tot_pts / NULLIF(p.gp, 0))::numeric, 1)::text,
    ROUND((p.tot_reb / NULLIF(p.gp, 0))::numeric, 1)::text,
    ROUND((p.tot_ast / NULLIF(p.gp, 0))::numeric, 1)::text,
    ROUND((p.tot_stl / NULLIF(p.gp, 0))::numeric, 1)::text,
    ROUND((p.tot_blk / NULLIF(p.gp, 0))::numeric, 1)::text,
    ROUND((p.tot_tov / NULLIF(p.gp, 0))::numeric, 1)::text,
    ROUND((p.tot_fls / NULLIF(p.gp, 0))::numeric, 1)::text,
    ROUND((p.tot_min / NULLIF(p.gp, 0))::numeric, 1)::text,
    ROUND((p.tot_pm / NULLIF(p.gp, 0))::numeric, 1)::text,
    COALESCE(ROUND((p.tot_fgm / NULLIF(p.tot_fga, 0) * 100)::numeric, 1)::text, '0.0'),
    COALESCE(ROUND((p.tot_3pm / NULLIF(p.tot_3pa, 0) * 100)::numeric, 1)::text, '0.0'),
    COALESCE(ROUND((p.tot_ftm / NULLIF(p.tot_fta, 0) * 100)::numeric, 1)::text, '0.0'),
    COALESCE(rl.rgl, '[]'::jsonb),
    (SELECT c FROM cnt),
    p.is_qualified,
    p.stat_rank
  FROM paged p
  LEFT JOIN recent_logs rl ON p.aid = rl.aid
  ORDER BY
    p.is_qualified DESC,
    CASE WHEN p_sort_dir = 'desc' THEN p.sort_val END DESC NULLS LAST,
    CASE WHEN p_sort_dir != 'desc' THEN p.sort_val END ASC NULLS LAST;
END;
$$;
