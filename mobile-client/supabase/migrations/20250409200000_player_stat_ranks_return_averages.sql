-- Extend get_player_stat_ranks to also return the computed PIT averages.
-- The RPC already computes ppg/rpg/apg/spg/bpg/three_pm internally;
-- exposing them lets the client use true season-to-date averages for
-- the Season Leaders stat display instead of the 20-game-capped game_log.

DROP FUNCTION IF EXISTS get_player_stat_ranks(integer, integer, text[], date);

CREATE OR REPLACE FUNCTION get_player_stat_ranks(
  p_season int DEFAULT 2026,
  p_season_type int DEFAULT 2,
  p_athlete_ids text[] DEFAULT '{}',
  p_as_of_date date DEFAULT NULL
)
RETURNS TABLE (
  athlete_id text,
  ppg numeric,
  rpg numeric,
  apg numeric,
  spg numeric,
  bpg numeric,
  three_pm numeric,
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
      b.team_abbreviation,
      b.game_id,
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
      AND (p_as_of_date IS NULL OR b.game_date::date < p_as_of_date)
  ),
  team_game_counts AS (
    SELECT team_abbreviation AS ta, COUNT(DISTINCT game_id)::int AS team_gp
    FROM boxscores
    GROUP BY team_abbreviation
  ),
  player_totals AS (
    SELECT
      b.athlete_id::text,
      MAX(b.team_abbreviation) AS ta,
      COUNT(*)::bigint AS games_played,
      SUM(b.points) AS total_points,
      SUM(b.rebounds) AS total_rebounds,
      SUM(b.assists) AS total_assists,
      SUM(b.steals) AS total_steals,
      SUM(b.blocks) AS total_blocks,
      SUM(b.three_point_made) AS total_three_point_made
    FROM boxscores b
    GROUP BY b.athlete_id
  ),
  qualified AS (
    SELECT pt.*
    FROM player_totals pt
    JOIN team_game_counts tgc ON pt.ta = tgc.ta
    WHERE pt.games_played >= tgc.team_gp * 0.7
  ),
  with_avgs AS (
    SELECT
      athlete_id,
      ROUND(total_points::numeric / NULLIF(games_played, 0), 2) AS ppg,
      ROUND(total_rebounds::numeric / NULLIF(games_played, 0), 2) AS rpg,
      ROUND(total_assists::numeric / NULLIF(games_played, 0), 2) AS apg,
      ROUND(total_steals::numeric / NULLIF(games_played, 0), 2) AS spg,
      ROUND(total_blocks::numeric / NULLIF(games_played, 0), 2) AS bpg,
      ROUND(total_three_point_made::numeric / NULLIF(games_played, 0), 2) AS three_pm
    FROM qualified
  ),
  ranked AS (
    SELECT
      athlete_id,
      ppg, rpg, apg, spg, bpg, three_pm,
      ROW_NUMBER() OVER (ORDER BY ppg DESC NULLS LAST)::int AS ppg_rank,
      ROW_NUMBER() OVER (ORDER BY rpg DESC NULLS LAST)::int AS rpg_rank,
      ROW_NUMBER() OVER (ORDER BY apg DESC NULLS LAST)::int AS apg_rank,
      ROW_NUMBER() OVER (ORDER BY spg DESC NULLS LAST)::int AS spg_rank,
      ROW_NUMBER() OVER (ORDER BY bpg DESC NULLS LAST)::int AS bpg_rank,
      ROW_NUMBER() OVER (ORDER BY three_pm DESC NULLS LAST)::int AS three_pm_rank
    FROM with_avgs
  )
  SELECT athlete_id, ppg, rpg, apg, spg, bpg, three_pm,
         ppg_rank, rpg_rank, apg_rank, spg_rank, bpg_rank, three_pm_rank
  FROM ranked
  WHERE cardinality(p_athlete_ids) = 0 OR athlete_id = ANY(p_athlete_ids);
$$;
