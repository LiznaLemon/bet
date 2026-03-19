-- Add 3pm_rank to get_player_stat_ranks for Players screen sort-by-3PM ranking
-- Must DROP first because we're changing the return type (adding a column)

DROP FUNCTION IF EXISTS get_player_stat_ranks(integer, integer, text[]);

CREATE OR REPLACE FUNCTION get_player_stat_ranks(
  p_season int DEFAULT 2026,
  p_season_type int DEFAULT 2,
  p_athlete_ids text[] DEFAULT '{}'
)
RETURNS TABLE (
  athlete_id text,
  ppg_rank int,
  rpg_rank int,
  apg_rank int,
  spg_rank int,
  bpg_rank int,
  three_pm_rank int
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
      b.game_date,
      COALESCE(b.points, 0)::numeric AS points,
      COALESCE(b.rebounds, 0)::numeric AS rebounds,
      COALESCE(b.assists, 0)::numeric AS assists,
      COALESCE(b.steals, 0)::numeric AS steals,
      COALESCE(b.blocks, 0)::numeric AS blocks,
      COALESCE(b.three_point_field_goals_made, 0)::numeric AS three_point_made
    FROM player_boxscores_raw b
    WHERE b.season = p_season
      AND b.season_type = p_season_type
      AND (b.did_not_play IS NULL OR b.did_not_play = false)
      AND b.game_id::text NOT IN (SELECT gid FROM excluded_games)
  ),
  player_totals AS (
    SELECT
      athlete_id::text,
      COUNT(*)::bigint AS games_played,
      SUM(points) AS total_points,
      SUM(rebounds) AS total_rebounds,
      SUM(assists) AS total_assists,
      SUM(steals) AS total_steals,
      SUM(blocks) AS total_blocks,
      SUM(three_point_made) AS total_three_point_made
    FROM boxscores
    GROUP BY athlete_id
  ),
  with_avgs AS (
    SELECT
      athlete_id,
      total_points::numeric / NULLIF(games_played, 0) AS ppg,
      total_rebounds::numeric / NULLIF(games_played, 0) AS rpg,
      total_assists::numeric / NULLIF(games_played, 0) AS apg,
      total_steals::numeric / NULLIF(games_played, 0) AS spg,
      total_blocks::numeric / NULLIF(games_played, 0) AS bpg,
      total_three_point_made::numeric / NULLIF(games_played, 0) AS three_pm
    FROM player_totals
  ),
  ranked AS (
    SELECT
      athlete_id,
      ROW_NUMBER() OVER (ORDER BY ppg DESC NULLS LAST)::int AS ppg_rank,
      ROW_NUMBER() OVER (ORDER BY rpg DESC NULLS LAST)::int AS rpg_rank,
      ROW_NUMBER() OVER (ORDER BY apg DESC NULLS LAST)::int AS apg_rank,
      ROW_NUMBER() OVER (ORDER BY spg DESC NULLS LAST)::int AS spg_rank,
      ROW_NUMBER() OVER (ORDER BY bpg DESC NULLS LAST)::int AS bpg_rank,
      ROW_NUMBER() OVER (ORDER BY three_pm DESC NULLS LAST)::int AS three_pm_rank
    FROM with_avgs
  )
  SELECT athlete_id, ppg_rank, rpg_rank, apg_rank, spg_rank, bpg_rank, three_pm_rank
  FROM ranked
  WHERE cardinality(p_athlete_ids) = 0 OR athlete_id = ANY(p_athlete_ids);
$$;
