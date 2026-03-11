-- Add shooting insight ranks and points breakdown to get_players_enhanced

DROP FUNCTION IF EXISTS get_players_enhanced(integer, integer);

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
  shots jsonb,
  pts_ft numeric,
  pts_fg numeric,
  pts_3pt numeric,
  pct_pts_ft numeric,
  pct_pts_fg numeric,
  pct_pts_3pt numeric,
  fga_rank bigint,
  tpa_rank bigint,
  fta_rank bigint,
  pts_ft_rank bigint,
  pts_fg_rank bigint,
  pts_3pt_rank bigint,
  pct_pts_ft_rank bigint,
  pct_pts_fg_rank bigint,
  pct_pts_3pt_rank bigint,
  fg_acc_rank bigint,
  three_acc_rank bigint,
  ft_acc_rank bigint,
  min_fga_90 numeric,
  min_3pa_90 numeric,
  min_fta_90 numeric
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
  player_totals AS (
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
      SUM(plus_minus) AS total_plus_minus
    FROM boxscores
    GROUP BY athlete_id
  ),
  -- Points breakdown: pts_2pt, pts_3pt, pts_ft, pts_fg
  player_pts AS (
    SELECT *,
      GREATEST(0, (total_field_goals_made - total_three_point_made) * 2)::numeric AS pts_2pt,
      (total_three_point_made * 3)::numeric AS pts_3pt,
      total_free_throws_made::numeric AS pts_ft,
      (GREATEST(0, (total_field_goals_made - total_three_point_made) * 2) + total_three_point_made * 3)::numeric AS pts_fg
    FROM player_totals
  ),
  -- Percent of total points by shot type; include shooting pct for accuracy ranks
  player_with_pct AS (
    SELECT *,
      CASE WHEN (pts_2pt + pts_3pt + pts_ft) > 0
        THEN 100.0 * pts_ft / (pts_2pt + pts_3pt + pts_ft) ELSE 0 END AS pct_pts_ft,
      CASE WHEN (pts_2pt + pts_3pt + pts_ft) > 0
        THEN 100.0 * pts_fg / (pts_2pt + pts_3pt + pts_ft) ELSE 0 END AS pct_pts_fg,
      CASE WHEN (pts_2pt + pts_3pt + pts_ft) > 0
        THEN 100.0 * pts_3pt / (pts_2pt + pts_3pt + pts_ft) ELSE 0 END AS pct_pts_3pt,
      COALESCE((total_field_goals_made / NULLIF(total_field_goals_attempted, 0) * 100)::numeric, 0) AS fg_pct_num,
      COALESCE((total_three_point_made / NULLIF(total_three_point_attempted, 0) * 100)::numeric, 0) AS three_pt_pct_num,
      COALESCE((total_free_throws_made / NULLIF(total_free_throws_attempted, 0) * 100)::numeric, 0) AS ft_pct_num
    FROM player_pts
  ),
  qualified AS (
    SELECT * FROM player_with_pct WHERE games_played >= 10
  ),
  min_thresholds AS (
    SELECT
      percentile_cont(0.9) WITHIN GROUP (ORDER BY total_field_goals_attempted) AS min_fga_90,
      percentile_cont(0.9) WITHIN GROUP (ORDER BY total_three_point_attempted) AS min_3pa_90,
      percentile_cont(0.9) WITHIN GROUP (ORDER BY total_free_throws_attempted) AS min_fta_90
    FROM qualified
  ),
  ranked AS (
    SELECT
      q.athlete_id,
      ROW_NUMBER() OVER (ORDER BY q.total_field_goals_attempted DESC)::bigint AS fga_rank,
      ROW_NUMBER() OVER (ORDER BY q.total_three_point_attempted DESC)::bigint AS tpa_rank,
      ROW_NUMBER() OVER (ORDER BY q.total_free_throws_attempted DESC)::bigint AS fta_rank,
      ROW_NUMBER() OVER (ORDER BY q.pts_ft DESC)::bigint AS pts_ft_rank,
      ROW_NUMBER() OVER (ORDER BY q.pts_fg DESC)::bigint AS pts_fg_rank,
      ROW_NUMBER() OVER (ORDER BY q.pts_3pt DESC)::bigint AS pts_3pt_rank,
      ROW_NUMBER() OVER (ORDER BY q.pct_pts_ft DESC)::bigint AS pct_pts_ft_rank,
      ROW_NUMBER() OVER (ORDER BY q.pct_pts_fg DESC)::bigint AS pct_pts_fg_rank,
      ROW_NUMBER() OVER (ORDER BY q.pct_pts_3pt DESC)::bigint AS pct_pts_3pt_rank
    FROM qualified q
  ),
  acc_fg AS (
    SELECT athlete_id, ROW_NUMBER() OVER (ORDER BY fg_pct_num DESC NULLS LAST)::bigint AS fg_acc_rank
    FROM qualified q
    CROSS JOIN min_thresholds t
    WHERE q.total_field_goals_attempted >= t.min_fga_90
  ),
  acc_3pt AS (
    SELECT athlete_id, ROW_NUMBER() OVER (ORDER BY three_pt_pct_num DESC NULLS LAST)::bigint AS three_acc_rank
    FROM qualified q
    CROSS JOIN min_thresholds t
    WHERE q.total_three_point_attempted >= t.min_3pa_90
  ),
  acc_ft AS (
    SELECT athlete_id, ROW_NUMBER() OVER (ORDER BY ft_pct_num DESC NULLS LAST)::bigint AS ft_acc_rank
    FROM qualified q
    CROSS JOIN min_thresholds t
    WHERE q.total_free_throws_attempted >= t.min_fta_90
  ),
  game_log_limited AS (
    SELECT
      athlete_id::text,
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
    FROM (
      SELECT *, ROW_NUMBER() OVER (PARTITION BY athlete_id ORDER BY game_date DESC) AS rn
      FROM boxscores
    ) ranked
    WHERE rn <= 30
    GROUP BY athlete_id
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
    COALESCE(g.game_log, '[]'::jsonb) AS game_log,
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
    '[]'::jsonb AS shots,
    pw.pts_ft,
    pw.pts_fg,
    pw.pts_3pt,
    pw.pct_pts_ft,
    pw.pct_pts_fg,
    pw.pct_pts_3pt,
    r.fga_rank,
    r.tpa_rank,
    r.fta_rank,
    r.pts_ft_rank,
    r.pts_fg_rank,
    r.pts_3pt_rank,
    r.pct_pts_ft_rank,
    r.pct_pts_fg_rank,
    r.pct_pts_3pt_rank,
    af.fg_acc_rank,
    a3.three_acc_rank,
    aft.ft_acc_rank,
    t.min_fga_90,
    t.min_3pa_90,
    t.min_fta_90
  FROM player_totals p
  LEFT JOIN game_log_limited g ON p.athlete_id = g.athlete_id
  LEFT JOIN player_with_pct pw ON p.athlete_id = pw.athlete_id
  LEFT JOIN ranked r ON p.athlete_id = r.athlete_id
  LEFT JOIN acc_fg af ON p.athlete_id = af.athlete_id
  LEFT JOIN acc_3pt a3 ON p.athlete_id = a3.athlete_id
  LEFT JOIN acc_ft aft ON p.athlete_id = aft.athlete_id
  CROSS JOIN min_thresholds t
  ORDER BY p.total_points DESC;
$$;
