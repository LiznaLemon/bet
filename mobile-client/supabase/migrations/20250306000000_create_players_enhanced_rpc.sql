-- RPC function to get aggregated player stats (replaces fetch-player-stats.js output)
-- Run this in Supabase SQL Editor or via: supabase db push

CREATE OR REPLACE FUNCTION get_players_enhanced(p_season int DEFAULT 2026, p_season_type int DEFAULT 2)
RETURNS TABLE (
  athlete_id text,
  athlete_display_name text,
  athlete_short_name text,
  athlete_headshot_href text,
  athlete_position_name text,
  athlete_position_abbreviation text,
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
  game_log jsonb,
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
  shots jsonb
)
LANGUAGE sql
STABLE
AS $$
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
      b.team_display_name,
      b.team_abbreviation,
      b.team_logo,
      REPLACE(COALESCE(b.team_color, ''), '#', '') AS team_color,
      b.game_id,
      b.game_date,
      b.home_away,
      b.team_winner AS win,
      b.opponent_team_abbreviation,
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
  player_agg AS (
    SELECT
      athlete_id::text,
      (array_agg(athlete_display_name ORDER BY game_date DESC))[1] AS athlete_display_name,
      (array_agg(athlete_short_name ORDER BY game_date DESC))[1] AS athlete_short_name,
      (array_agg(athlete_headshot_href ORDER BY game_date DESC))[1] AS athlete_headshot_href,
      (array_agg(athlete_position_name ORDER BY game_date DESC))[1] AS athlete_position_name,
      (array_agg(athlete_position_abbreviation ORDER BY game_date DESC))[1] AS athlete_position_abbreviation,
      (array_agg(team_display_name ORDER BY game_date DESC))[1] AS team_display_name,
      (array_agg(team_abbreviation ORDER BY game_date DESC))[1] AS team_abbreviation,
      (array_agg(team_logo ORDER BY game_date DESC))[1] AS team_logo,
      (array_agg(team_color ORDER BY game_date DESC))[1] AS team_color,
      COUNT(*)::bigint AS games_played,
      SUM(minutes) AS total_minutes,
      SUM(points) AS total_points,
      SUM(rebounds) AS total_rebounds,
      SUM(assists) AS total_assists,
      SUM(steals) AS total_steals,
      SUM(blocks) AS total_blocks,
      SUM(turnovers) AS total_turnovers,
      SUM(fouls) AS total_fouls,
      SUM(field_goals_made) AS total_field_goals_made,
      SUM(field_goals_attempted) AS total_field_goals_attempted,
      SUM(three_point_made) AS total_three_point_made,
      SUM(three_point_attempted) AS total_three_point_attempted,
      SUM(free_throws_made) AS total_free_throws_made,
      SUM(free_throws_attempted) AS total_free_throws_attempted,
      SUM(offensive_rebounds) AS total_offensive_rebounds,
      SUM(defensive_rebounds) AS total_defensive_rebounds,
      SUM(plus_minus) AS total_plus_minus,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'game_id', game_id::text,
            'game_date', to_char(game_date, 'YYYY-MM-DD'),
            'home_away', COALESCE(home_away, 'home'),
            'win', COALESCE(win, false),
            'opponent_team_abbreviation', COALESCE(opponent_team_abbreviation, ''),
            'points', points,
            'rebounds', rebounds,
            'assists', assists,
            'steals', steals,
            'blocks', blocks,
            'minutes', minutes,
            'field_goals_made', field_goals_made,
            'field_goals_attempted', field_goals_attempted,
            'three_point_made', three_point_made,
            'three_point_attempted', three_point_attempted,
            'free_throws_made', free_throws_made,
            'free_throws_attempted', free_throws_attempted,
            'turnovers', turnovers,
            'fouls', fouls,
            'plus_minus', plus_minus
          ) ORDER BY game_date DESC
        ) FILTER (WHERE game_id IS NOT NULL),
        '[]'::jsonb
      ) AS game_log
    FROM boxscores
    GROUP BY athlete_id
  ),
  shots_agg AS (
    SELECT
      athlete_id_1::text AS athlete_id,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'x', coordinate_x_raw::float,
            'y', coordinate_y_raw::float,
            'made', COALESCE(scoring_play, false),
            'pts', COALESCE(points_attempted, 0)
          )
        ) FILTER (WHERE coordinate_x_raw IS NOT NULL),
        '[]'::jsonb
      ) AS shots
    FROM play_by_play_raw
    WHERE shooting_play = true
      AND type_text NOT LIKE 'Free Throw%'
      AND coordinate_y_raw <= 42.25
      AND season = p_season
      AND game_id::text NOT IN (SELECT gid FROM excluded_games)
    GROUP BY athlete_id_1
  )
  SELECT
    p.athlete_id,
    p.athlete_display_name,
    p.athlete_short_name,
    p.athlete_headshot_href,
    p.athlete_position_name,
    p.athlete_position_abbreviation,
    p.team_display_name,
    p.team_abbreviation,
    p.team_logo,
    p.team_color,
    p.games_played,
    p.total_minutes,
    p.total_points,
    p.total_rebounds,
    p.total_assists,
    p.total_steals,
    p.total_blocks,
    p.total_turnovers,
    p.total_fouls,
    p.total_field_goals_made,
    p.total_field_goals_attempted,
    p.total_three_point_made,
    p.total_three_point_attempted,
    p.total_free_throws_made,
    p.total_free_throws_attempted,
    p.total_offensive_rebounds,
    p.total_defensive_rebounds,
    p.total_plus_minus,
    p.game_log,
    ROUND((p.total_points / NULLIF(p.games_played, 0))::numeric, 1)::text AS ppg,
    ROUND((p.total_rebounds / NULLIF(p.games_played, 0))::numeric, 1)::text AS rpg,
    ROUND((p.total_assists / NULLIF(p.games_played, 0))::numeric, 1)::text AS apg,
    ROUND((p.total_steals / NULLIF(p.games_played, 0))::numeric, 1)::text AS spg,
    ROUND((p.total_blocks / NULLIF(p.games_played, 0))::numeric, 1)::text AS bpg,
    ROUND((p.total_turnovers / NULLIF(p.games_played, 0))::numeric, 1)::text AS tpg,
    ROUND((p.total_fouls / NULLIF(p.games_played, 0))::numeric, 1)::text AS fpg,
    ROUND((p.total_minutes / NULLIF(p.games_played, 0))::numeric, 1)::text AS mpg,
    ROUND((p.total_plus_minus / NULLIF(p.games_played, 0))::numeric, 1)::text AS plus_minus_avg,
    COALESCE(ROUND((p.total_field_goals_made / NULLIF(p.total_field_goals_attempted, 0) * 100)::numeric, 1)::text, '0.0') AS fg_pct,
    COALESCE(ROUND((p.total_three_point_made / NULLIF(p.total_three_point_attempted, 0) * 100)::numeric, 1)::text, '0.0') AS three_pt_pct,
    COALESCE(ROUND((p.total_free_throws_made / NULLIF(p.total_free_throws_attempted, 0) * 100)::numeric, 1)::text, '0.0') AS ft_pct,
    COALESCE(s.shots, '[]'::jsonb) AS shots
  FROM player_agg p
  LEFT JOIN shots_agg s ON p.athlete_id = s.athlete_id
  ORDER BY p.total_points DESC;
$$;
