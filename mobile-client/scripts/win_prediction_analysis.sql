-- Win Prediction Stats Validation
-- Part 1: For each completed game, did the winning team have better pre-game stats (season, L10, L5)?
--         Output: hit rate (%) by stat and time window
-- Part 2: AND scenarios - when one team leads in BOTH (or all three) windows, how often does that team win?
--         Scenarios: season_and_l10, season_and_l5, season_and_l10_and_l5, l10_and_l5
-- Part 3: B2B stratified - hit rate by back-to-back bucket (neither, home_only, away_only, both)
-- Part 4: Home vs Away - hit rate when home led stats vs when away led stats
-- Part 5: Opposite trend - hit rate when teams trending opposite directions (L5 vs L10, pts)
-- Part 6: Rest advantage - hit rate when one team rested (2+ days) vs other B2B
-- Run via: Supabase MCP execute_sql, or psql (run each query separately)

WITH excluded_games AS (
  SELECT unnest(ARRAY['401809839','401838140','401838141','401838142','401838143']::text[]) AS gid
),
team_game_totals AS (
  SELECT
    b.team_abbreviation,
    b.game_id,
    MIN(b.game_date) AS game_date,
    SUM(COALESCE(b.points, 0))::numeric AS pts,
    SUM(COALESCE(b.rebounds, 0))::numeric AS reb,
    SUM(COALESCE(b.assists, 0))::numeric AS ast,
    SUM(COALESCE(b.steals, 0))::numeric AS stl,
    SUM(COALESCE(b.blocks, 0))::numeric AS blk,
    SUM(COALESCE(b.turnovers, 0))::numeric AS tov,
    CASE WHEN SUM(COALESCE(b.field_goals_attempted, 0)) > 0
      THEN 100.0 * SUM(COALESCE(b.field_goals_made, 0)) / SUM(COALESCE(b.field_goals_attempted, 0))
      ELSE NULL END AS fg_pct,
    CASE WHEN SUM(COALESCE(b.three_point_field_goals_attempted, 0)) > 0
      THEN 100.0 * SUM(COALESCE(b.three_point_field_goals_made, 0)) / SUM(COALESCE(b.three_point_field_goals_attempted, 0))
      ELSE NULL END AS three_pt_pct,
    CASE WHEN SUM(COALESCE(b.free_throws_attempted, 0)) > 0
      THEN 100.0 * SUM(COALESCE(b.free_throws_made, 0)) / SUM(COALESCE(b.free_throws_attempted, 0))
      ELSE NULL END AS ft_pct
  FROM player_boxscores_raw b
  WHERE b.season = 2026
    AND b.season_type = 2
    AND (b.did_not_play IS NULL OR b.did_not_play = false)
    AND b.team_abbreviation IS NOT NULL
    AND b.team_abbreviation != ''
    AND b.game_id::text NOT IN (SELECT gid FROM excluded_games)
  GROUP BY b.team_abbreviation, b.game_id
),
games AS (
  SELECT
    game_id,
    game_date,
    UPPER(TRIM(home_abbreviation)) AS home_abbreviation,
    UPPER(TRIM(away_abbreviation)) AS away_abbreviation,
    home_score,
    away_score,
    CASE WHEN home_score > away_score THEN UPPER(TRIM(home_abbreviation))
         WHEN away_score > home_score THEN UPPER(TRIM(away_abbreviation))
         ELSE NULL END AS winner
  FROM schedules
  WHERE season = 2026
    AND season_type = 2
    AND status_type_completed = true
    AND home_score IS NOT NULL
    AND away_score IS NOT NULL
    AND game_id::text NOT IN (SELECT gid FROM excluded_games)
),
-- Home team stats (season = all games before this game)
home_season AS (
  SELECT
    g.game_id,
    AVG(t.pts) AS pts,
    AVG(t.reb) AS reb,
    AVG(t.ast) AS ast,
    AVG(t.stl) AS stl,
    AVG(t.blk) AS blk,
    AVG(t.tov) AS tov,
    AVG(t.fg_pct) AS fg_pct,
    AVG(t.three_pt_pct) AS three_pt_pct,
    AVG(t.ft_pct) AS ft_pct
  FROM games g
  JOIN team_game_totals t
    ON t.team_abbreviation = g.home_abbreviation
   AND t.game_date < g.game_date
  GROUP BY g.game_id
),
away_season AS (
  SELECT
    g.game_id,
    AVG(t.pts) AS pts,
    AVG(t.reb) AS reb,
    AVG(t.ast) AS ast,
    AVG(t.stl) AS stl,
    AVG(t.blk) AS blk,
    AVG(t.tov) AS tov,
    AVG(t.fg_pct) AS fg_pct,
    AVG(t.three_pt_pct) AS three_pt_pct,
    AVG(t.ft_pct) AS ft_pct
  FROM games g
  JOIN team_game_totals t
    ON t.team_abbreviation = g.away_abbreviation
   AND t.game_date < g.game_date
  GROUP BY g.game_id
),
-- L10: last 10 games before this game (using subquery with ORDER BY + LIMIT)
home_l10 AS (
  SELECT
    g.game_id,
    (SELECT AVG(sub.pts) FROM (
      SELECT t.pts FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS pts,
    (SELECT AVG(sub.reb) FROM (
      SELECT t.reb FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS reb,
    (SELECT AVG(sub.ast) FROM (
      SELECT t.ast FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS ast,
    (SELECT AVG(sub.stl) FROM (
      SELECT t.stl FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS stl,
    (SELECT AVG(sub.blk) FROM (
      SELECT t.blk FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS blk,
    (SELECT AVG(sub.tov) FROM (
      SELECT t.tov FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS tov,
    (SELECT AVG(sub.fg_pct) FROM (
      SELECT t.fg_pct FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS fg_pct,
    (SELECT AVG(sub.three_pt_pct) FROM (
      SELECT t.three_pt_pct FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS three_pt_pct,
    (SELECT AVG(sub.ft_pct) FROM (
      SELECT t.ft_pct FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS ft_pct
  FROM games g
),
away_l10 AS (
  SELECT
    g.game_id,
    (SELECT AVG(sub.pts) FROM (
      SELECT t.pts FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS pts,
    (SELECT AVG(sub.reb) FROM (
      SELECT t.reb FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS reb,
    (SELECT AVG(sub.ast) FROM (
      SELECT t.ast FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS ast,
    (SELECT AVG(sub.stl) FROM (
      SELECT t.stl FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS stl,
    (SELECT AVG(sub.blk) FROM (
      SELECT t.blk FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS blk,
    (SELECT AVG(sub.tov) FROM (
      SELECT t.tov FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS tov,
    (SELECT AVG(sub.fg_pct) FROM (
      SELECT t.fg_pct FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS fg_pct,
    (SELECT AVG(sub.three_pt_pct) FROM (
      SELECT t.three_pt_pct FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS three_pt_pct,
    (SELECT AVG(sub.ft_pct) FROM (
      SELECT t.ft_pct FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 10
    ) sub) AS ft_pct
  FROM games g
),
-- L5: last 5 games
home_l5 AS (
  SELECT
    g.game_id,
    (SELECT AVG(sub.pts) FROM (
      SELECT t.pts FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS pts,
    (SELECT AVG(sub.reb) FROM (
      SELECT t.reb FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS reb,
    (SELECT AVG(sub.ast) FROM (
      SELECT t.ast FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS ast,
    (SELECT AVG(sub.stl) FROM (
      SELECT t.stl FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS stl,
    (SELECT AVG(sub.blk) FROM (
      SELECT t.blk FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS blk,
    (SELECT AVG(sub.tov) FROM (
      SELECT t.tov FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS tov,
    (SELECT AVG(sub.fg_pct) FROM (
      SELECT t.fg_pct FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS fg_pct,
    (SELECT AVG(sub.three_pt_pct) FROM (
      SELECT t.three_pt_pct FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS three_pt_pct,
    (SELECT AVG(sub.ft_pct) FROM (
      SELECT t.ft_pct FROM team_game_totals t
      WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS ft_pct
  FROM games g
),
away_l5 AS (
  SELECT
    g.game_id,
    (SELECT AVG(sub.pts) FROM (
      SELECT t.pts FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS pts,
    (SELECT AVG(sub.reb) FROM (
      SELECT t.reb FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS reb,
    (SELECT AVG(sub.ast) FROM (
      SELECT t.ast FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS ast,
    (SELECT AVG(sub.stl) FROM (
      SELECT t.stl FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS stl,
    (SELECT AVG(sub.blk) FROM (
      SELECT t.blk FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS blk,
    (SELECT AVG(sub.tov) FROM (
      SELECT t.tov FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS tov,
    (SELECT AVG(sub.fg_pct) FROM (
      SELECT t.fg_pct FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS fg_pct,
    (SELECT AVG(sub.three_pt_pct) FROM (
      SELECT t.three_pt_pct FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS three_pt_pct,
    (SELECT AVG(sub.ft_pct) FROM (
      SELECT t.ft_pct FROM team_game_totals t
      WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
      ORDER BY t.game_date DESC LIMIT 5
    ) sub) AS ft_pct
  FROM games g
),
-- Context: B2B, rest days, trend direction (pts: L5 vs L10)
team_game_dates AS (
  SELECT DISTINCT UPPER(TRIM(home_abbreviation)) AS team_abbreviation, game_date
  FROM schedules
  WHERE season = 2026 AND season_type = 2 AND status_type_completed = true
    AND game_id::text NOT IN (SELECT gid FROM excluded_games)
    AND home_abbreviation IS NOT NULL AND TRIM(home_abbreviation) != ''
  UNION
  SELECT DISTINCT UPPER(TRIM(away_abbreviation)) AS team_abbreviation, game_date
  FROM schedules
  WHERE season = 2026 AND season_type = 2 AND status_type_completed = true
    AND game_id::text NOT IN (SELECT gid FROM excluded_games)
    AND away_abbreviation IS NOT NULL AND TRIM(away_abbreviation) != ''
),
game_context AS (
  SELECT
    g.game_id,
    g.home_abbreviation,
    g.away_abbreviation,
    g.winner,
    home_prior.max_date AS home_prior_date,
    away_prior.max_date AS away_prior_date,
    (g.game_date::date - home_prior.max_date::date) AS home_rest_days,
    (g.game_date::date - away_prior.max_date::date) AS away_rest_days,
    (g.game_date::date - home_prior.max_date::date) = 1 AS home_b2b,
    (g.game_date::date - away_prior.max_date::date) = 1 AS away_b2b,
    CASE
      WHEN (g.game_date::date - home_prior.max_date::date) = 1 AND (g.game_date::date - away_prior.max_date::date) = 1 THEN 'both_b2b'
      WHEN (g.game_date::date - home_prior.max_date::date) = 1 THEN 'home_b2b_only'
      WHEN (g.game_date::date - away_prior.max_date::date) = 1 THEN 'away_b2b_only'
      ELSE 'neither_b2b'
    END AS b2b_bucket,
    ((g.game_date::date - home_prior.max_date::date) = 1 AND (g.game_date::date - away_prior.max_date::date) >= 2)
      OR ((g.game_date::date - away_prior.max_date::date) = 1 AND (g.game_date::date - home_prior.max_date::date) >= 2) AS rest_advantage,
    (h5.pts > h10.pts) AS home_trend_up,
    (a5.pts > a10.pts) AS away_trend_up,
    ((h5.pts > h10.pts) AND NOT (a5.pts > a10.pts)) OR (NOT (h5.pts > h10.pts) AND (a5.pts > a10.pts)) AS opposite_trend
  FROM games g
  LEFT JOIN LATERAL (
    SELECT MAX(tgd.game_date) AS max_date FROM team_game_dates tgd
    WHERE tgd.team_abbreviation = g.home_abbreviation AND tgd.game_date < g.game_date
  ) home_prior ON true
  LEFT JOIN LATERAL (
    SELECT MAX(tgd.game_date) AS max_date FROM team_game_dates tgd
    WHERE tgd.team_abbreviation = g.away_abbreviation AND tgd.game_date < g.game_date
  ) away_prior ON true
  JOIN home_l5 h5 ON h5.game_id = g.game_id
  JOIN away_l5 a5 ON a5.game_id = g.game_id
  JOIN home_l10 h10 ON h10.game_id = g.game_id
  JOIN away_l10 a10 ON a10.game_id = g.game_id
  WHERE h5.pts IS NOT NULL AND a5.pts IS NOT NULL
    AND h10.pts IS NOT NULL AND a10.pts IS NOT NULL
    AND home_prior.max_date IS NOT NULL AND away_prior.max_date IS NOT NULL
),
-- Unpivot: for each game, stat, mode -> winner_had_better
-- winner_had_better: pts/reb/ast/stl/blk/fg/3pt/ft: higher is better; tov: lower is better
comparisons AS (
  SELECT 'pts' AS stat, 'season' AS mode, g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND hs.pts > as_.pts THEN true
         WHEN g.winner = g.away_abbreviation AND as_.pts > hs.pts THEN true
         ELSE false END AS winner_had_better
  FROM games g
  JOIN home_season hs ON hs.game_id = g.game_id
  JOIN away_season as_ ON as_.game_id = g.game_id
  WHERE g.winner IS NOT NULL
  UNION ALL
  SELECT 'reb', 'season', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND hs.reb > as_.reb THEN true
         WHEN g.winner = g.away_abbreviation AND as_.reb > hs.reb THEN true
         ELSE false END
  FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id
  WHERE g.winner IS NOT NULL
  UNION ALL
  SELECT 'ast', 'season', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND hs.ast > as_.ast THEN true
         WHEN g.winner = g.away_abbreviation AND as_.ast > hs.ast THEN true
         ELSE false END
  FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id
  WHERE g.winner IS NOT NULL
  UNION ALL
  SELECT 'stl', 'season', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND hs.stl > as_.stl THEN true
         WHEN g.winner = g.away_abbreviation AND as_.stl > hs.stl THEN true
         ELSE false END
  FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id
  WHERE g.winner IS NOT NULL
  UNION ALL
  SELECT 'blk', 'season', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND hs.blk > as_.blk THEN true
         WHEN g.winner = g.away_abbreviation AND as_.blk > hs.blk THEN true
         ELSE false END
  FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id
  WHERE g.winner IS NOT NULL
  UNION ALL
  SELECT 'tov', 'season', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND hs.tov < as_.tov THEN true
         WHEN g.winner = g.away_abbreviation AND as_.tov < hs.tov THEN true
         ELSE false END
  FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id
  WHERE g.winner IS NOT NULL
  UNION ALL
  SELECT 'fg_pct', 'season', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND hs.fg_pct > as_.fg_pct THEN true
         WHEN g.winner = g.away_abbreviation AND as_.fg_pct > hs.fg_pct THEN true
         ELSE false END
  FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id
  WHERE g.winner IS NOT NULL
  UNION ALL
  SELECT 'three_pt_pct', 'season', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND hs.three_pt_pct > as_.three_pt_pct THEN true
         WHEN g.winner = g.away_abbreviation AND as_.three_pt_pct > hs.three_pt_pct THEN true
         ELSE false END
  FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id
  WHERE g.winner IS NOT NULL
  UNION ALL
  SELECT 'ft_pct', 'season', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND hs.ft_pct > as_.ft_pct THEN true
         WHEN g.winner = g.away_abbreviation AND as_.ft_pct > hs.ft_pct THEN true
         ELSE false END
  FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id
  WHERE g.winner IS NOT NULL
  UNION ALL
  -- L10
  SELECT 'pts', 'l10', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h10.pts > a10.pts THEN true
         WHEN g.winner = g.away_abbreviation AND a10.pts > h10.pts THEN true
         ELSE false END
  FROM games g
  JOIN home_l10 h10 ON h10.game_id = g.game_id
  JOIN away_l10 a10 ON a10.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h10.pts IS NOT NULL AND a10.pts IS NOT NULL
  UNION ALL
  SELECT 'reb', 'l10', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h10.reb > a10.reb THEN true
         WHEN g.winner = g.away_abbreviation AND a10.reb > h10.reb THEN true
         ELSE false END
  FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h10.reb IS NOT NULL AND a10.reb IS NOT NULL
  UNION ALL
  SELECT 'ast', 'l10', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h10.ast > a10.ast THEN true
         WHEN g.winner = g.away_abbreviation AND a10.ast > h10.ast THEN true
         ELSE false END
  FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h10.ast IS NOT NULL AND a10.ast IS NOT NULL
  UNION ALL
  SELECT 'stl', 'l10', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h10.stl > a10.stl THEN true
         WHEN g.winner = g.away_abbreviation AND a10.stl > h10.stl THEN true
         ELSE false END
  FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h10.stl IS NOT NULL AND a10.stl IS NOT NULL
  UNION ALL
  SELECT 'blk', 'l10', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h10.blk > a10.blk THEN true
         WHEN g.winner = g.away_abbreviation AND a10.blk > h10.blk THEN true
         ELSE false END
  FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h10.blk IS NOT NULL AND a10.blk IS NOT NULL
  UNION ALL
  SELECT 'tov', 'l10', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h10.tov < a10.tov THEN true
         WHEN g.winner = g.away_abbreviation AND a10.tov < h10.tov THEN true
         ELSE false END
  FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h10.tov IS NOT NULL AND a10.tov IS NOT NULL
  UNION ALL
  SELECT 'fg_pct', 'l10', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h10.fg_pct > a10.fg_pct THEN true
         WHEN g.winner = g.away_abbreviation AND a10.fg_pct > h10.fg_pct THEN true
         ELSE false END
  FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h10.fg_pct IS NOT NULL AND a10.fg_pct IS NOT NULL
  UNION ALL
  SELECT 'three_pt_pct', 'l10', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h10.three_pt_pct > a10.three_pt_pct THEN true
         WHEN g.winner = g.away_abbreviation AND a10.three_pt_pct > h10.three_pt_pct THEN true
         ELSE false END
  FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h10.three_pt_pct IS NOT NULL AND a10.three_pt_pct IS NOT NULL
  UNION ALL
  SELECT 'ft_pct', 'l10', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h10.ft_pct > a10.ft_pct THEN true
         WHEN g.winner = g.away_abbreviation AND a10.ft_pct > h10.ft_pct THEN true
         ELSE false END
  FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h10.ft_pct IS NOT NULL AND a10.ft_pct IS NOT NULL
  UNION ALL
  -- L5
  SELECT 'pts', 'l5', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h5.pts > a5.pts THEN true
         WHEN g.winner = g.away_abbreviation AND a5.pts > h5.pts THEN true
         ELSE false END
  FROM games g
  JOIN home_l5 h5 ON h5.game_id = g.game_id
  JOIN away_l5 a5 ON a5.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h5.pts IS NOT NULL AND a5.pts IS NOT NULL
  UNION ALL
  SELECT 'reb', 'l5', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h5.reb > a5.reb THEN true
         WHEN g.winner = g.away_abbreviation AND a5.reb > h5.reb THEN true
         ELSE false END
  FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h5.reb IS NOT NULL AND a5.reb IS NOT NULL
  UNION ALL
  SELECT 'ast', 'l5', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h5.ast > a5.ast THEN true
         WHEN g.winner = g.away_abbreviation AND a5.ast > h5.ast THEN true
         ELSE false END
  FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h5.ast IS NOT NULL AND a5.ast IS NOT NULL
  UNION ALL
  SELECT 'stl', 'l5', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h5.stl > a5.stl THEN true
         WHEN g.winner = g.away_abbreviation AND a5.stl > h5.stl THEN true
         ELSE false END
  FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h5.stl IS NOT NULL AND a5.stl IS NOT NULL
  UNION ALL
  SELECT 'blk', 'l5', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h5.blk > a5.blk THEN true
         WHEN g.winner = g.away_abbreviation AND a5.blk > h5.blk THEN true
         ELSE false END
  FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h5.blk IS NOT NULL AND a5.blk IS NOT NULL
  UNION ALL
  SELECT 'tov', 'l5', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h5.tov < a5.tov THEN true
         WHEN g.winner = g.away_abbreviation AND a5.tov < h5.tov THEN true
         ELSE false END
  FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h5.tov IS NOT NULL AND a5.tov IS NOT NULL
  UNION ALL
  SELECT 'fg_pct', 'l5', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h5.fg_pct > a5.fg_pct THEN true
         WHEN g.winner = g.away_abbreviation AND a5.fg_pct > h5.fg_pct THEN true
         ELSE false END
  FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h5.fg_pct IS NOT NULL AND a5.fg_pct IS NOT NULL
  UNION ALL
  SELECT 'three_pt_pct', 'l5', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h5.three_pt_pct > a5.three_pt_pct THEN true
         WHEN g.winner = g.away_abbreviation AND a5.three_pt_pct > h5.three_pt_pct THEN true
         ELSE false END
  FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h5.three_pt_pct IS NOT NULL AND a5.three_pt_pct IS NOT NULL
  UNION ALL
  SELECT 'ft_pct', 'l5', g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND h5.ft_pct > a5.ft_pct THEN true
         WHEN g.winner = g.away_abbreviation AND a5.ft_pct > h5.ft_pct THEN true
         ELSE false END
  FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id
  WHERE g.winner IS NOT NULL AND h5.ft_pct IS NOT NULL AND a5.ft_pct IS NOT NULL
)
SELECT
  stat,
  mode,
  COUNT(*) AS games,
  COUNT(*) FILTER (WHERE winner_had_better) AS winner_led_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE winner_had_better) / NULLIF(COUNT(*), 0), 1) AS pct_winner_led
FROM comparisons
GROUP BY stat, mode
ORDER BY stat, mode;

-- =============================================================================
-- PART 2: AND scenarios
-- When one team leads in BOTH (or all three) windows, how often does that team win?
-- Scenarios: season_and_l10, season_and_l5, season_and_l10_and_l5, l10_and_l5
-- =============================================================================

WITH excluded_games AS (
  SELECT unnest(ARRAY['401809839','401838140','401838141','401838142','401838143']::text[]) AS gid
),
team_game_totals AS (
  SELECT
    b.team_abbreviation,
    b.game_id,
    MIN(b.game_date) AS game_date,
    SUM(COALESCE(b.points, 0))::numeric AS pts,
    SUM(COALESCE(b.rebounds, 0))::numeric AS reb,
    SUM(COALESCE(b.assists, 0))::numeric AS ast,
    SUM(COALESCE(b.steals, 0))::numeric AS stl,
    SUM(COALESCE(b.blocks, 0))::numeric AS blk,
    SUM(COALESCE(b.turnovers, 0))::numeric AS tov,
    CASE WHEN SUM(COALESCE(b.field_goals_attempted, 0)) > 0
      THEN 100.0 * SUM(COALESCE(b.field_goals_made, 0)) / SUM(COALESCE(b.field_goals_attempted, 0))
      ELSE NULL END AS fg_pct,
    CASE WHEN SUM(COALESCE(b.three_point_field_goals_attempted, 0)) > 0
      THEN 100.0 * SUM(COALESCE(b.three_point_field_goals_made, 0)) / SUM(COALESCE(b.three_point_field_goals_attempted, 0))
      ELSE NULL END AS three_pt_pct,
    CASE WHEN SUM(COALESCE(b.free_throws_attempted, 0)) > 0
      THEN 100.0 * SUM(COALESCE(b.free_throws_made, 0)) / SUM(COALESCE(b.free_throws_attempted, 0))
      ELSE NULL END AS ft_pct
  FROM player_boxscores_raw b
  WHERE b.season = 2026
    AND b.season_type = 2
    AND (b.did_not_play IS NULL OR b.did_not_play = false)
    AND b.team_abbreviation IS NOT NULL
    AND b.team_abbreviation != ''
    AND b.game_id::text NOT IN (SELECT gid FROM excluded_games)
  GROUP BY b.team_abbreviation, b.game_id
),
games AS (
  SELECT
    game_id,
    game_date,
    UPPER(TRIM(home_abbreviation)) AS home_abbreviation,
    UPPER(TRIM(away_abbreviation)) AS away_abbreviation,
    CASE WHEN home_score > away_score THEN UPPER(TRIM(home_abbreviation))
         WHEN away_score > home_score THEN UPPER(TRIM(away_abbreviation))
         ELSE NULL END AS winner
  FROM schedules
  WHERE season = 2026
    AND season_type = 2
    AND status_type_completed = true
    AND home_score IS NOT NULL
    AND away_score IS NOT NULL
    AND game_id::text NOT IN (SELECT gid FROM excluded_games)
),
home_season AS (
  SELECT g.game_id,
    AVG(t.pts) AS pts, AVG(t.reb) AS reb, AVG(t.ast) AS ast, AVG(t.stl) AS stl, AVG(t.blk) AS blk, AVG(t.tov) AS tov,
    AVG(t.fg_pct) AS fg_pct, AVG(t.three_pt_pct) AS three_pt_pct, AVG(t.ft_pct) AS ft_pct
  FROM games g
  JOIN team_game_totals t ON t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date
  GROUP BY g.game_id
),
away_season AS (
  SELECT g.game_id,
    AVG(t.pts) AS pts, AVG(t.reb) AS reb, AVG(t.ast) AS ast, AVG(t.stl) AS stl, AVG(t.blk) AS blk, AVG(t.tov) AS tov,
    AVG(t.fg_pct) AS fg_pct, AVG(t.three_pt_pct) AS three_pt_pct, AVG(t.ft_pct) AS ft_pct
  FROM games g
  JOIN team_game_totals t ON t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date
  GROUP BY g.game_id
),
home_l10 AS (
  SELECT g.game_id,
    (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS pts,
    (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS reb,
    (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ast,
    (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS stl,
    (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS blk,
    (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS tov,
    (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS fg_pct,
    (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS three_pt_pct,
    (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ft_pct
  FROM games g
),
away_l10 AS (
  SELECT g.game_id,
    (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS pts,
    (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS reb,
    (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ast,
    (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS stl,
    (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS blk,
    (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS tov,
    (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS fg_pct,
    (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS three_pt_pct,
    (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ft_pct
  FROM games g
),
home_l5 AS (
  SELECT g.game_id,
    (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS pts,
    (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS reb,
    (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ast,
    (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS stl,
    (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS blk,
    (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS tov,
    (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS fg_pct,
    (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS three_pt_pct,
    (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ft_pct
  FROM games g
),
away_l5 AS (
  SELECT g.game_id,
    (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS pts,
    (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS reb,
    (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ast,
    (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS stl,
    (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS blk,
    (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS tov,
    (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS fg_pct,
    (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS three_pt_pct,
    (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ft_pct
  FROM games g
),
and_base AS (
  SELECT g.game_id, g.winner, g.home_abbreviation, g.away_abbreviation,
    hs.pts AS hs_pts, as_.pts AS as_pts, h10.pts AS h10_pts, a10.pts AS a10_pts, h5.pts AS h5_pts, a5.pts AS a5_pts,
    hs.reb AS hs_reb, as_.reb AS as_reb, h10.reb AS h10_reb, a10.reb AS a10_reb, h5.reb AS h5_reb, a5.reb AS a5_reb,
    hs.ast AS hs_ast, as_.ast AS as_ast, h10.ast AS h10_ast, a10.ast AS a10_ast, h5.ast AS h5_ast, a5.ast AS a5_ast,
    hs.stl AS hs_stl, as_.stl AS as_stl, h10.stl AS h10_stl, a10.stl AS a10_stl, h5.stl AS h5_stl, a5.stl AS a5_stl,
    hs.blk AS hs_blk, as_.blk AS as_blk, h10.blk AS h10_blk, a10.blk AS a10_blk, h5.blk AS h5_blk, a5.blk AS a5_blk,
    hs.tov AS hs_tov, as_.tov AS as_tov, h10.tov AS h10_tov, a10.tov AS a10_tov, h5.tov AS h5_tov, a5.tov AS a5_tov,
    hs.fg_pct AS hs_fg, as_.fg_pct AS as_fg, h10.fg_pct AS h10_fg, a10.fg_pct AS a10_fg, h5.fg_pct AS h5_fg, a5.fg_pct AS a5_fg,
    hs.three_pt_pct AS hs_3p, as_.three_pt_pct AS as_3p, h10.three_pt_pct AS h10_3p, a10.three_pt_pct AS a10_3p, h5.three_pt_pct AS h5_3p, a5.three_pt_pct AS a5_3p,
    hs.ft_pct AS hs_ft, as_.ft_pct AS as_ft, h10.ft_pct AS h10_ft, a10.ft_pct AS a10_ft, h5.ft_pct AS h5_ft, a5.ft_pct AS a5_ft
  FROM games g
  JOIN home_season hs ON hs.game_id = g.game_id
  JOIN away_season as_ ON as_.game_id = g.game_id
  JOIN home_l10 h10 ON h10.game_id = g.game_id
  JOIN away_l10 a10 ON a10.game_id = g.game_id
  JOIN home_l5 h5 ON h5.game_id = g.game_id
  JOIN away_l5 a5 ON a5.game_id = g.game_id
  WHERE g.winner IS NOT NULL
    AND h10.pts IS NOT NULL AND a10.pts IS NOT NULL AND h5.pts IS NOT NULL AND a5.pts IS NOT NULL
),
and_results AS (
  -- pts
  SELECT 'pts' AS stat, 'season_and_l10' AS scenario, COUNT(*) AS games,
    COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_pts > as_pts AND h10_pts > a10_pts) OR (winner = away_abbreviation AND as_pts > hs_pts AND a10_pts > h10_pts)) AS winner_led
  FROM and_base WHERE (hs_pts > as_pts AND h10_pts > a10_pts) OR (as_pts > hs_pts AND a10_pts > h10_pts)
  UNION ALL SELECT 'pts', 'season_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_pts > as_pts AND h5_pts > a5_pts) OR (winner = away_abbreviation AND as_pts > hs_pts AND a5_pts > h5_pts))
  FROM and_base WHERE (hs_pts > as_pts AND h5_pts > a5_pts) OR (as_pts > hs_pts AND a5_pts > h5_pts)
  UNION ALL SELECT 'pts', 'season_and_l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_pts > as_pts AND h10_pts > a10_pts AND h5_pts > a5_pts) OR (winner = away_abbreviation AND as_pts > hs_pts AND a10_pts > h10_pts AND a5_pts > h5_pts))
  FROM and_base WHERE (hs_pts > as_pts AND h10_pts > a10_pts AND h5_pts > a5_pts) OR (as_pts > hs_pts AND a10_pts > h10_pts AND a5_pts > h5_pts)
  UNION ALL SELECT 'pts', 'l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND h10_pts > a10_pts AND h5_pts > a5_pts) OR (winner = away_abbreviation AND a10_pts > h10_pts AND a5_pts > h5_pts))
  FROM and_base WHERE (h10_pts > a10_pts AND h5_pts > a5_pts) OR (a10_pts > h10_pts AND a5_pts > h5_pts)
  -- fg_pct
  UNION ALL SELECT 'fg_pct', 'season_and_l10', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_fg > as_fg AND h10_fg > a10_fg) OR (winner = away_abbreviation AND as_fg > hs_fg AND a10_fg > h10_fg))
  FROM and_base WHERE (hs_fg > as_fg AND h10_fg > a10_fg) OR (as_fg > hs_fg AND a10_fg > h10_fg)
  UNION ALL SELECT 'fg_pct', 'season_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_fg > as_fg AND h5_fg > a5_fg) OR (winner = away_abbreviation AND as_fg > hs_fg AND a5_fg > h5_fg))
  FROM and_base WHERE (hs_fg > as_fg AND h5_fg > a5_fg) OR (as_fg > hs_fg AND a5_fg > h5_fg)
  UNION ALL SELECT 'fg_pct', 'season_and_l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_fg > as_fg AND h10_fg > a10_fg AND h5_fg > a5_fg) OR (winner = away_abbreviation AND as_fg > hs_fg AND a10_fg > h10_fg AND a5_fg > h5_fg))
  FROM and_base WHERE (hs_fg > as_fg AND h10_fg > a10_fg AND h5_fg > a5_fg) OR (as_fg > hs_fg AND a10_fg > h10_fg AND a5_fg > h5_fg)
  UNION ALL SELECT 'fg_pct', 'l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND h10_fg > a10_fg AND h5_fg > a5_fg) OR (winner = away_abbreviation AND a10_fg > h10_fg AND a5_fg > h5_fg))
  FROM and_base WHERE (h10_fg > a10_fg AND h5_fg > a5_fg) OR (a10_fg > h10_fg AND a5_fg > h5_fg)
  -- reb
  UNION ALL SELECT 'reb', 'season_and_l10', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_reb > as_reb AND h10_reb > a10_reb) OR (winner = away_abbreviation AND as_reb > hs_reb AND a10_reb > h10_reb))
  FROM and_base WHERE (hs_reb > as_reb AND h10_reb > a10_reb) OR (as_reb > hs_reb AND a10_reb > h10_reb)
  UNION ALL SELECT 'reb', 'season_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_reb > as_reb AND h5_reb > a5_reb) OR (winner = away_abbreviation AND as_reb > hs_reb AND a5_reb > h5_reb))
  FROM and_base WHERE (hs_reb > as_reb AND h5_reb > a5_reb) OR (as_reb > hs_reb AND a5_reb > h5_reb)
  UNION ALL SELECT 'reb', 'season_and_l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_reb > as_reb AND h10_reb > a10_reb AND h5_reb > a5_reb) OR (winner = away_abbreviation AND as_reb > hs_reb AND a10_reb > h10_reb AND a5_reb > h5_reb))
  FROM and_base WHERE (hs_reb > as_reb AND h10_reb > a10_reb AND h5_reb > a5_reb) OR (as_reb > hs_reb AND a10_reb > h10_reb AND a5_reb > h5_reb)
  UNION ALL SELECT 'reb', 'l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND h10_reb > a10_reb AND h5_reb > a5_reb) OR (winner = away_abbreviation AND a10_reb > h10_reb AND a5_reb > h5_reb))
  FROM and_base WHERE (h10_reb > a10_reb AND h5_reb > a5_reb) OR (a10_reb > h10_reb AND a5_reb > h5_reb)
  -- tov (lower is better)
  UNION ALL SELECT 'tov', 'season_and_l10', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_tov < as_tov AND h10_tov < a10_tov) OR (winner = away_abbreviation AND as_tov < hs_tov AND a10_tov < h10_tov))
  FROM and_base WHERE (hs_tov < as_tov AND h10_tov < a10_tov) OR (as_tov < hs_tov AND a10_tov < h10_tov)
  UNION ALL SELECT 'tov', 'season_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_tov < as_tov AND h5_tov < a5_tov) OR (winner = away_abbreviation AND as_tov < hs_tov AND a5_tov < h5_tov))
  FROM and_base WHERE (hs_tov < as_tov AND h5_tov < a5_tov) OR (as_tov < hs_tov AND a5_tov < h5_tov)
  UNION ALL SELECT 'tov', 'season_and_l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_tov < as_tov AND h10_tov < a10_tov AND h5_tov < a5_tov) OR (winner = away_abbreviation AND as_tov < hs_tov AND a10_tov < h10_tov AND a5_tov < h5_tov))
  FROM and_base WHERE (hs_tov < as_tov AND h10_tov < a10_tov AND h5_tov < a5_tov) OR (as_tov < hs_tov AND a10_tov < h10_tov AND a5_tov < h5_tov)
  UNION ALL SELECT 'tov', 'l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND h10_tov < a10_tov AND h5_tov < a5_tov) OR (winner = away_abbreviation AND a10_tov < h10_tov AND a5_tov < h5_tov))
  FROM and_base WHERE (h10_tov < a10_tov AND h5_tov < a5_tov) OR (a10_tov < h10_tov AND a5_tov < h5_tov)
  -- stl
  UNION ALL SELECT 'stl', 'season_and_l10', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_stl > as_stl AND h10_stl > a10_stl) OR (winner = away_abbreviation AND as_stl > hs_stl AND a10_stl > h10_stl))
  FROM and_base WHERE (hs_stl > as_stl AND h10_stl > a10_stl) OR (as_stl > hs_stl AND a10_stl > h10_stl)
  UNION ALL SELECT 'stl', 'season_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_stl > as_stl AND h5_stl > a5_stl) OR (winner = away_abbreviation AND as_stl > hs_stl AND a5_stl > h5_stl))
  FROM and_base WHERE (hs_stl > as_stl AND h5_stl > a5_stl) OR (as_stl > hs_stl AND a5_stl > h5_stl)
  UNION ALL SELECT 'stl', 'season_and_l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_stl > as_stl AND h10_stl > a10_stl AND h5_stl > a5_stl) OR (winner = away_abbreviation AND as_stl > hs_stl AND a10_stl > h10_stl AND a5_stl > h5_stl))
  FROM and_base WHERE (hs_stl > as_stl AND h10_stl > a10_stl AND h5_stl > a5_stl) OR (as_stl > hs_stl AND a10_stl > h10_stl AND a5_stl > h5_stl)
  UNION ALL SELECT 'stl', 'l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND h10_stl > a10_stl AND h5_stl > a5_stl) OR (winner = away_abbreviation AND a10_stl > h10_stl AND a5_stl > h5_stl))
  FROM and_base WHERE (h10_stl > a10_stl AND h5_stl > a5_stl) OR (a10_stl > h10_stl AND a5_stl > h5_stl)
  -- blk
  UNION ALL SELECT 'blk', 'season_and_l10', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_blk > as_blk AND h10_blk > a10_blk) OR (winner = away_abbreviation AND as_blk > hs_blk AND a10_blk > h10_blk))
  FROM and_base WHERE (hs_blk > as_blk AND h10_blk > a10_blk) OR (as_blk > hs_blk AND a10_blk > h10_blk)
  UNION ALL SELECT 'blk', 'season_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_blk > as_blk AND h5_blk > a5_blk) OR (winner = away_abbreviation AND as_blk > hs_blk AND a5_blk > h5_blk))
  FROM and_base WHERE (hs_blk > as_blk AND h5_blk > a5_blk) OR (as_blk > hs_blk AND a5_blk > h5_blk)
  UNION ALL SELECT 'blk', 'season_and_l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_blk > as_blk AND h10_blk > a10_blk AND h5_blk > a5_blk) OR (winner = away_abbreviation AND as_blk > hs_blk AND a10_blk > h10_blk AND a5_blk > h5_blk))
  FROM and_base WHERE (hs_blk > as_blk AND h10_blk > a10_blk AND h5_blk > a5_blk) OR (as_blk > hs_blk AND a10_blk > h10_blk AND a5_blk > h5_blk)
  UNION ALL SELECT 'blk', 'l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND h10_blk > a10_blk AND h5_blk > a5_blk) OR (winner = away_abbreviation AND a10_blk > h10_blk AND a5_blk > h5_blk))
  FROM and_base WHERE (h10_blk > a10_blk AND h5_blk > a5_blk) OR (a10_blk > h10_blk AND a5_blk > h5_blk)
  -- ast
  UNION ALL SELECT 'ast', 'season_and_l10', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_ast > as_ast AND h10_ast > a10_ast) OR (winner = away_abbreviation AND as_ast > hs_ast AND a10_ast > h10_ast))
  FROM and_base WHERE (hs_ast > as_ast AND h10_ast > a10_ast) OR (as_ast > hs_ast AND a10_ast > h10_ast)
  UNION ALL SELECT 'ast', 'season_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_ast > as_ast AND h5_ast > a5_ast) OR (winner = away_abbreviation AND as_ast > hs_ast AND a5_ast > h5_ast))
  FROM and_base WHERE (hs_ast > as_ast AND h5_ast > a5_ast) OR (as_ast > hs_ast AND a5_ast > h5_ast)
  UNION ALL SELECT 'ast', 'season_and_l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_ast > as_ast AND h10_ast > a10_ast AND h5_ast > a5_ast) OR (winner = away_abbreviation AND as_ast > hs_ast AND a10_ast > h10_ast AND a5_ast > h5_ast))
  FROM and_base WHERE (hs_ast > as_ast AND h10_ast > a10_ast AND h5_ast > a5_ast) OR (as_ast > hs_ast AND a10_ast > h10_ast AND a5_ast > h5_ast)
  UNION ALL SELECT 'ast', 'l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND h10_ast > a10_ast AND h5_ast > a5_ast) OR (winner = away_abbreviation AND a10_ast > h10_ast AND a5_ast > h5_ast))
  FROM and_base WHERE (h10_ast > a10_ast AND h5_ast > a5_ast) OR (a10_ast > h10_ast AND a5_ast > h5_ast)
  -- three_pt_pct
  UNION ALL SELECT 'three_pt_pct', 'season_and_l10', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_3p > as_3p AND h10_3p > a10_3p) OR (winner = away_abbreviation AND as_3p > hs_3p AND a10_3p > h10_3p))
  FROM and_base WHERE (hs_3p > as_3p AND h10_3p > a10_3p) OR (as_3p > hs_3p AND a10_3p > h10_3p)
  UNION ALL SELECT 'three_pt_pct', 'season_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_3p > as_3p AND h5_3p > a5_3p) OR (winner = away_abbreviation AND as_3p > hs_3p AND a5_3p > h5_3p))
  FROM and_base WHERE (hs_3p > as_3p AND h5_3p > a5_3p) OR (as_3p > hs_3p AND a5_3p > h5_3p)
  UNION ALL SELECT 'three_pt_pct', 'season_and_l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_3p > as_3p AND h10_3p > a10_3p AND h5_3p > a5_3p) OR (winner = away_abbreviation AND as_3p > hs_3p AND a10_3p > h10_3p AND a5_3p > h5_3p))
  FROM and_base WHERE (hs_3p > as_3p AND h10_3p > a10_3p AND h5_3p > a5_3p) OR (as_3p > hs_3p AND a10_3p > h10_3p AND a5_3p > h5_3p)
  UNION ALL SELECT 'three_pt_pct', 'l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND h10_3p > a10_3p AND h5_3p > a5_3p) OR (winner = away_abbreviation AND a10_3p > h10_3p AND a5_3p > h5_3p))
  FROM and_base WHERE (h10_3p > a10_3p AND h5_3p > a5_3p) OR (a10_3p > h10_3p AND a5_3p > h5_3p)
  -- ft_pct
  UNION ALL SELECT 'ft_pct', 'season_and_l10', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_ft > as_ft AND h10_ft > a10_ft) OR (winner = away_abbreviation AND as_ft > hs_ft AND a10_ft > h10_ft))
  FROM and_base WHERE (hs_ft > as_ft AND h10_ft > a10_ft) OR (as_ft > hs_ft AND a10_ft > h10_ft)
  UNION ALL SELECT 'ft_pct', 'season_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_ft > as_ft AND h5_ft > a5_ft) OR (winner = away_abbreviation AND as_ft > hs_ft AND a5_ft > h5_ft))
  FROM and_base WHERE (hs_ft > as_ft AND h5_ft > a5_ft) OR (as_ft > hs_ft AND a5_ft > h5_ft)
  UNION ALL SELECT 'ft_pct', 'season_and_l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND hs_ft > as_ft AND h10_ft > a10_ft AND h5_ft > a5_ft) OR (winner = away_abbreviation AND as_ft > hs_ft AND a10_ft > h10_ft AND a5_ft > h5_ft))
  FROM and_base WHERE (hs_ft > as_ft AND h10_ft > a10_ft AND h5_ft > a5_ft) OR (as_ft > hs_ft AND a10_ft > h10_ft AND a5_ft > h5_ft)
  UNION ALL SELECT 'ft_pct', 'l10_and_l5', COUNT(*), COUNT(*) FILTER (WHERE (winner = home_abbreviation AND h10_ft > a10_ft AND h5_ft > a5_ft) OR (winner = away_abbreviation AND a10_ft > h10_ft AND a5_ft > h5_ft))
  FROM and_base WHERE (h10_ft > a10_ft AND h5_ft > a5_ft) OR (a10_ft > h10_ft AND a5_ft > h5_ft)
)
SELECT
  stat,
  scenario,
  games,
  winner_led,
  ROUND(100.0 * winner_led / NULLIF(games, 0), 1) AS pct_winner_led
FROM and_results
ORDER BY stat, scenario;

-- =============================================================================
-- PART 3: B2B stratified - hit rate by back-to-back bucket
-- =============================================================================

WITH excluded_games AS (
  SELECT unnest(ARRAY['401809839','401838140','401838141','401838142','401838143']::text[]) AS gid
),
team_game_totals AS (
  SELECT b.team_abbreviation, b.game_id, MIN(b.game_date) AS game_date,
    SUM(COALESCE(b.points, 0))::numeric AS pts, SUM(COALESCE(b.rebounds, 0))::numeric AS reb,
    SUM(COALESCE(b.assists, 0))::numeric AS ast, SUM(COALESCE(b.steals, 0))::numeric AS stl,
    SUM(COALESCE(b.blocks, 0))::numeric AS blk, SUM(COALESCE(b.turnovers, 0))::numeric AS tov,
    CASE WHEN SUM(COALESCE(b.field_goals_attempted, 0)) > 0 THEN 100.0 * SUM(COALESCE(b.field_goals_made, 0)) / SUM(COALESCE(b.field_goals_attempted, 0)) ELSE NULL END AS fg_pct,
    CASE WHEN SUM(COALESCE(b.three_point_field_goals_attempted, 0)) > 0 THEN 100.0 * SUM(COALESCE(b.three_point_field_goals_made, 0)) / SUM(COALESCE(b.three_point_field_goals_attempted, 0)) ELSE NULL END AS three_pt_pct,
    CASE WHEN SUM(COALESCE(b.free_throws_attempted, 0)) > 0 THEN 100.0 * SUM(COALESCE(b.free_throws_made, 0)) / SUM(COALESCE(b.free_throws_attempted, 0)) ELSE NULL END AS ft_pct
  FROM player_boxscores_raw b
  WHERE b.season = 2026 AND b.season_type = 2 AND (b.did_not_play IS NULL OR b.did_not_play = false)
    AND b.team_abbreviation IS NOT NULL AND b.team_abbreviation != ''
    AND b.game_id::text NOT IN (SELECT gid FROM excluded_games)
  GROUP BY b.team_abbreviation, b.game_id
),
games AS (
  SELECT game_id, game_date, UPPER(TRIM(home_abbreviation)) AS home_abbreviation, UPPER(TRIM(away_abbreviation)) AS away_abbreviation,
    home_score, away_score,
    CASE WHEN home_score > away_score THEN UPPER(TRIM(home_abbreviation)) WHEN away_score > home_score THEN UPPER(TRIM(away_abbreviation)) ELSE NULL END AS winner
  FROM schedules
  WHERE season = 2026 AND season_type = 2 AND status_type_completed = true
    AND home_score IS NOT NULL AND away_score IS NOT NULL
    AND game_id::text NOT IN (SELECT gid FROM excluded_games)
),
home_season AS (SELECT g.game_id, AVG(t.pts) AS pts, AVG(t.reb) AS reb, AVG(t.ast) AS ast, AVG(t.stl) AS stl, AVG(t.blk) AS blk, AVG(t.tov) AS tov, AVG(t.fg_pct) AS fg_pct, AVG(t.three_pt_pct) AS three_pt_pct, AVG(t.ft_pct) AS ft_pct FROM games g JOIN team_game_totals t ON t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date GROUP BY g.game_id),
away_season AS (SELECT g.game_id, AVG(t.pts) AS pts, AVG(t.reb) AS reb, AVG(t.ast) AS ast, AVG(t.stl) AS stl, AVG(t.blk) AS blk, AVG(t.tov) AS tov, AVG(t.fg_pct) AS fg_pct, AVG(t.three_pt_pct) AS three_pt_pct, AVG(t.ft_pct) AS ft_pct FROM games g JOIN team_game_totals t ON t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date GROUP BY g.game_id),
home_l10 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ft_pct FROM games g),
away_l10 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ft_pct FROM games g),
home_l5 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ft_pct FROM games g),
away_l5 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ft_pct FROM games g),
team_game_dates AS (
  SELECT DISTINCT UPPER(TRIM(home_abbreviation)) AS team_abbreviation, game_date FROM schedules WHERE season = 2026 AND season_type = 2 AND status_type_completed = true AND game_id::text NOT IN (SELECT gid FROM excluded_games) AND home_abbreviation IS NOT NULL AND TRIM(home_abbreviation) != ''
  UNION
  SELECT DISTINCT UPPER(TRIM(away_abbreviation)) AS team_abbreviation, game_date FROM schedules WHERE season = 2026 AND season_type = 2 AND status_type_completed = true AND game_id::text NOT IN (SELECT gid FROM excluded_games) AND away_abbreviation IS NOT NULL AND TRIM(away_abbreviation) != ''
),
game_context AS (
  SELECT g.game_id,
    CASE WHEN (g.game_date::date - home_prior.max_date::date) = 1 AND (g.game_date::date - away_prior.max_date::date) = 1 THEN 'both_b2b'
         WHEN (g.game_date::date - home_prior.max_date::date) = 1 THEN 'home_b2b_only'
         WHEN (g.game_date::date - away_prior.max_date::date) = 1 THEN 'away_b2b_only'
         ELSE 'neither_b2b' END AS b2b_bucket,
    ((g.game_date::date - home_prior.max_date::date) = 1 AND (g.game_date::date - away_prior.max_date::date) >= 2)
      OR ((g.game_date::date - away_prior.max_date::date) = 1 AND (g.game_date::date - home_prior.max_date::date) >= 2) AS rest_advantage,
    ((h5.pts > h10.pts) AND NOT (a5.pts > a10.pts)) OR (NOT (h5.pts > h10.pts) AND (a5.pts > a10.pts)) AS opposite_trend
  FROM games g
  LEFT JOIN LATERAL (SELECT MAX(tgd.game_date) AS max_date FROM team_game_dates tgd WHERE tgd.team_abbreviation = g.home_abbreviation AND tgd.game_date < g.game_date) home_prior ON true
  LEFT JOIN LATERAL (SELECT MAX(tgd.game_date) AS max_date FROM team_game_dates tgd WHERE tgd.team_abbreviation = g.away_abbreviation AND tgd.game_date < g.game_date) away_prior ON true
  JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id
  JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id
  WHERE h5.pts IS NOT NULL AND a5.pts IS NOT NULL AND h10.pts IS NOT NULL AND a10.pts IS NOT NULL
    AND home_prior.max_date IS NOT NULL AND away_prior.max_date IS NOT NULL
),
comparisons_p3 AS (
  SELECT 'pts' AS stat, 'season' AS mode, g.game_id, g.winner,
    CASE WHEN g.winner = g.home_abbreviation AND hs.pts > as_.pts THEN true WHEN g.winner = g.away_abbreviation AND as_.pts > hs.pts THEN true ELSE false END AS winner_had_better
  FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'reb', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.reb > as_.reb THEN true WHEN g.winner = g.away_abbreviation AND as_.reb > hs.reb THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'ast', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.ast > as_.ast THEN true WHEN g.winner = g.away_abbreviation AND as_.ast > hs.ast THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'stl', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.stl > as_.stl THEN true WHEN g.winner = g.away_abbreviation AND as_.stl > hs.stl THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'blk', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.blk > as_.blk THEN true WHEN g.winner = g.away_abbreviation AND as_.blk > hs.blk THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'tov', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.tov < as_.tov THEN true WHEN g.winner = g.away_abbreviation AND as_.tov < hs.tov THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'fg_pct', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.fg_pct > as_.fg_pct THEN true WHEN g.winner = g.away_abbreviation AND as_.fg_pct > hs.fg_pct THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'three_pt_pct', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.three_pt_pct > as_.three_pt_pct THEN true WHEN g.winner = g.away_abbreviation AND as_.three_pt_pct > hs.three_pt_pct THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'ft_pct', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.ft_pct > as_.ft_pct THEN true WHEN g.winner = g.away_abbreviation AND as_.ft_pct > hs.ft_pct THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'pts', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.pts > a10.pts THEN true WHEN g.winner = g.away_abbreviation AND a10.pts > h10.pts THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.pts IS NOT NULL AND a10.pts IS NOT NULL
  UNION ALL SELECT 'reb', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.reb > a10.reb THEN true WHEN g.winner = g.away_abbreviation AND a10.reb > h10.reb THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.reb IS NOT NULL AND a10.reb IS NOT NULL
  UNION ALL SELECT 'ast', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.ast > a10.ast THEN true WHEN g.winner = g.away_abbreviation AND a10.ast > h10.ast THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.ast IS NOT NULL AND a10.ast IS NOT NULL
  UNION ALL SELECT 'stl', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.stl > a10.stl THEN true WHEN g.winner = g.away_abbreviation AND a10.stl > h10.stl THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.stl IS NOT NULL AND a10.stl IS NOT NULL
  UNION ALL SELECT 'blk', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.blk > a10.blk THEN true WHEN g.winner = g.away_abbreviation AND a10.blk > h10.blk THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.blk IS NOT NULL AND a10.blk IS NOT NULL
  UNION ALL SELECT 'tov', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.tov < a10.tov THEN true WHEN g.winner = g.away_abbreviation AND a10.tov < h10.tov THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.tov IS NOT NULL AND a10.tov IS NOT NULL
  UNION ALL SELECT 'fg_pct', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.fg_pct > a10.fg_pct THEN true WHEN g.winner = g.away_abbreviation AND a10.fg_pct > h10.fg_pct THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.fg_pct IS NOT NULL AND a10.fg_pct IS NOT NULL
  UNION ALL SELECT 'three_pt_pct', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.three_pt_pct > a10.three_pt_pct THEN true WHEN g.winner = g.away_abbreviation AND a10.three_pt_pct > h10.three_pt_pct THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.three_pt_pct IS NOT NULL AND a10.three_pt_pct IS NOT NULL
  UNION ALL SELECT 'ft_pct', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.ft_pct > a10.ft_pct THEN true WHEN g.winner = g.away_abbreviation AND a10.ft_pct > h10.ft_pct THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.ft_pct IS NOT NULL AND a10.ft_pct IS NOT NULL
  UNION ALL SELECT 'pts', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.pts > a5.pts THEN true WHEN g.winner = g.away_abbreviation AND a5.pts > h5.pts THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.pts IS NOT NULL AND a5.pts IS NOT NULL
  UNION ALL SELECT 'reb', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.reb > a5.reb THEN true WHEN g.winner = g.away_abbreviation AND a5.reb > h5.reb THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.reb IS NOT NULL AND a5.reb IS NOT NULL
  UNION ALL SELECT 'ast', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.ast > a5.ast THEN true WHEN g.winner = g.away_abbreviation AND a5.ast > h5.ast THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.ast IS NOT NULL AND a5.ast IS NOT NULL
  UNION ALL SELECT 'stl', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.stl > a5.stl THEN true WHEN g.winner = g.away_abbreviation AND a5.stl > h5.stl THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.stl IS NOT NULL AND a5.stl IS NOT NULL
  UNION ALL SELECT 'blk', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.blk > a5.blk THEN true WHEN g.winner = g.away_abbreviation AND a5.blk > h5.blk THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.blk IS NOT NULL AND a5.blk IS NOT NULL
  UNION ALL SELECT 'tov', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.tov < a5.tov THEN true WHEN g.winner = g.away_abbreviation AND a5.tov < h5.tov THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.tov IS NOT NULL AND a5.tov IS NOT NULL
  UNION ALL SELECT 'fg_pct', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.fg_pct > a5.fg_pct THEN true WHEN g.winner = g.away_abbreviation AND a5.fg_pct > h5.fg_pct THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.fg_pct IS NOT NULL AND a5.fg_pct IS NOT NULL
  UNION ALL SELECT 'three_pt_pct', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.three_pt_pct > a5.three_pt_pct THEN true WHEN g.winner = g.away_abbreviation AND a5.three_pt_pct > h5.three_pt_pct THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.three_pt_pct IS NOT NULL AND a5.three_pt_pct IS NOT NULL
  UNION ALL SELECT 'ft_pct', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.ft_pct > a5.ft_pct THEN true WHEN g.winner = g.away_abbreviation AND a5.ft_pct > h5.ft_pct THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.ft_pct IS NOT NULL AND a5.ft_pct IS NOT NULL
)
SELECT c.stat, c.mode, gc.b2b_bucket,
  COUNT(*) AS games,
  COUNT(*) FILTER (WHERE c.winner_had_better) AS winner_led_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE c.winner_had_better) / NULLIF(COUNT(*), 0), 1) AS pct_winner_led
FROM comparisons_p3 c
JOIN game_context gc ON gc.game_id = c.game_id
GROUP BY c.stat, c.mode, gc.b2b_bucket
ORDER BY c.stat, c.mode, gc.b2b_bucket;

-- =============================================================================
-- PART 4: Home vs Away - hit rate when home led stats vs when away led stats
-- =============================================================================

WITH excluded_games AS (
  SELECT unnest(ARRAY['401809839','401838140','401838141','401838142','401838143']::text[]) AS gid
),
team_game_totals AS (
  SELECT b.team_abbreviation, b.game_id, MIN(b.game_date) AS game_date,
    SUM(COALESCE(b.points, 0))::numeric AS pts, SUM(COALESCE(b.rebounds, 0))::numeric AS reb,
    SUM(COALESCE(b.assists, 0))::numeric AS ast, SUM(COALESCE(b.steals, 0))::numeric AS stl,
    SUM(COALESCE(b.blocks, 0))::numeric AS blk, SUM(COALESCE(b.turnovers, 0))::numeric AS tov,
    CASE WHEN SUM(COALESCE(b.field_goals_attempted, 0)) > 0 THEN 100.0 * SUM(COALESCE(b.field_goals_made, 0)) / SUM(COALESCE(b.field_goals_attempted, 0)) ELSE NULL END AS fg_pct,
    CASE WHEN SUM(COALESCE(b.three_point_field_goals_attempted, 0)) > 0 THEN 100.0 * SUM(COALESCE(b.three_point_field_goals_made, 0)) / SUM(COALESCE(b.three_point_field_goals_attempted, 0)) ELSE NULL END AS three_pt_pct,
    CASE WHEN SUM(COALESCE(b.free_throws_attempted, 0)) > 0 THEN 100.0 * SUM(COALESCE(b.free_throws_made, 0)) / SUM(COALESCE(b.free_throws_attempted, 0)) ELSE NULL END AS ft_pct
  FROM player_boxscores_raw b
  WHERE b.season = 2026 AND b.season_type = 2 AND (b.did_not_play IS NULL OR b.did_not_play = false)
    AND b.team_abbreviation IS NOT NULL AND b.team_abbreviation != ''
    AND b.game_id::text NOT IN (SELECT gid FROM excluded_games)
  GROUP BY b.team_abbreviation, b.game_id
),
games AS (
  SELECT game_id, game_date, UPPER(TRIM(home_abbreviation)) AS home_abbreviation, UPPER(TRIM(away_abbreviation)) AS away_abbreviation,
    home_score, away_score,
    CASE WHEN home_score > away_score THEN UPPER(TRIM(home_abbreviation)) WHEN away_score > home_score THEN UPPER(TRIM(away_abbreviation)) ELSE NULL END AS winner
  FROM schedules
  WHERE season = 2026 AND season_type = 2 AND status_type_completed = true
    AND home_score IS NOT NULL AND away_score IS NOT NULL
    AND game_id::text NOT IN (SELECT gid FROM excluded_games)
),
home_season AS (SELECT g.game_id, AVG(t.pts) AS pts, AVG(t.reb) AS reb, AVG(t.ast) AS ast, AVG(t.stl) AS stl, AVG(t.blk) AS blk, AVG(t.tov) AS tov, AVG(t.fg_pct) AS fg_pct, AVG(t.three_pt_pct) AS three_pt_pct, AVG(t.ft_pct) AS ft_pct FROM games g JOIN team_game_totals t ON t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date GROUP BY g.game_id),
away_season AS (SELECT g.game_id, AVG(t.pts) AS pts, AVG(t.reb) AS reb, AVG(t.ast) AS ast, AVG(t.stl) AS stl, AVG(t.blk) AS blk, AVG(t.tov) AS tov, AVG(t.fg_pct) AS fg_pct, AVG(t.three_pt_pct) AS three_pt_pct, AVG(t.ft_pct) AS ft_pct FROM games g JOIN team_game_totals t ON t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date GROUP BY g.game_id),
home_l10 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ft_pct FROM games g),
away_l10 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ft_pct FROM games g),
home_l5 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ft_pct FROM games g),
away_l5 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ft_pct FROM games g),
comparisons_p4 AS (
  SELECT 'pts' AS stat, 'season' AS mode, g.game_id, g.winner, CASE WHEN hs.pts > as_.pts THEN 'home_led' WHEN as_.pts > hs.pts THEN 'away_led' ELSE 'tie' END AS venue_led, CASE WHEN g.winner = g.home_abbreviation AND hs.pts > as_.pts THEN true WHEN g.winner = g.away_abbreviation AND as_.pts > hs.pts THEN true ELSE false END AS winner_had_better FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'reb', 'season', g.game_id, g.winner, CASE WHEN hs.reb > as_.reb THEN 'home_led' WHEN as_.reb > hs.reb THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND hs.reb > as_.reb THEN true WHEN g.winner = g.away_abbreviation AND as_.reb > hs.reb THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'ast', 'season', g.game_id, g.winner, CASE WHEN hs.ast > as_.ast THEN 'home_led' WHEN as_.ast > hs.ast THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND hs.ast > as_.ast THEN true WHEN g.winner = g.away_abbreviation AND as_.ast > hs.ast THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'stl', 'season', g.game_id, g.winner, CASE WHEN hs.stl > as_.stl THEN 'home_led' WHEN as_.stl > hs.stl THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND hs.stl > as_.stl THEN true WHEN g.winner = g.away_abbreviation AND as_.stl > hs.stl THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'blk', 'season', g.game_id, g.winner, CASE WHEN hs.blk > as_.blk THEN 'home_led' WHEN as_.blk > hs.blk THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND hs.blk > as_.blk THEN true WHEN g.winner = g.away_abbreviation AND as_.blk > hs.blk THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'tov', 'season', g.game_id, g.winner, CASE WHEN hs.tov < as_.tov THEN 'home_led' WHEN as_.tov < hs.tov THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND hs.tov < as_.tov THEN true WHEN g.winner = g.away_abbreviation AND as_.tov < hs.tov THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'fg_pct', 'season', g.game_id, g.winner, CASE WHEN hs.fg_pct > as_.fg_pct THEN 'home_led' WHEN as_.fg_pct > hs.fg_pct THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND hs.fg_pct > as_.fg_pct THEN true WHEN g.winner = g.away_abbreviation AND as_.fg_pct > hs.fg_pct THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'three_pt_pct', 'season', g.game_id, g.winner, CASE WHEN hs.three_pt_pct > as_.three_pt_pct THEN 'home_led' WHEN as_.three_pt_pct > hs.three_pt_pct THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND hs.three_pt_pct > as_.three_pt_pct THEN true WHEN g.winner = g.away_abbreviation AND as_.three_pt_pct > hs.three_pt_pct THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'ft_pct', 'season', g.game_id, g.winner, CASE WHEN hs.ft_pct > as_.ft_pct THEN 'home_led' WHEN as_.ft_pct > hs.ft_pct THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND hs.ft_pct > as_.ft_pct THEN true WHEN g.winner = g.away_abbreviation AND as_.ft_pct > hs.ft_pct THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'pts', 'l10', g.game_id, g.winner, CASE WHEN h10.pts > a10.pts THEN 'home_led' WHEN a10.pts > h10.pts THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h10.pts > a10.pts THEN true WHEN g.winner = g.away_abbreviation AND a10.pts > h10.pts THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.pts IS NOT NULL AND a10.pts IS NOT NULL
  UNION ALL SELECT 'reb', 'l10', g.game_id, g.winner, CASE WHEN h10.reb > a10.reb THEN 'home_led' WHEN a10.reb > h10.reb THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h10.reb > a10.reb THEN true WHEN g.winner = g.away_abbreviation AND a10.reb > h10.reb THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.reb IS NOT NULL AND a10.reb IS NOT NULL
  UNION ALL SELECT 'ast', 'l10', g.game_id, g.winner, CASE WHEN h10.ast > a10.ast THEN 'home_led' WHEN a10.ast > h10.ast THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h10.ast > a10.ast THEN true WHEN g.winner = g.away_abbreviation AND a10.ast > h10.ast THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.ast IS NOT NULL AND a10.ast IS NOT NULL
  UNION ALL SELECT 'stl', 'l10', g.game_id, g.winner, CASE WHEN h10.stl > a10.stl THEN 'home_led' WHEN a10.stl > h10.stl THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h10.stl > a10.stl THEN true WHEN g.winner = g.away_abbreviation AND a10.stl > h10.stl THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.stl IS NOT NULL AND a10.stl IS NOT NULL
  UNION ALL SELECT 'blk', 'l10', g.game_id, g.winner, CASE WHEN h10.blk > a10.blk THEN 'home_led' WHEN a10.blk > h10.blk THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h10.blk > a10.blk THEN true WHEN g.winner = g.away_abbreviation AND a10.blk > h10.blk THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.blk IS NOT NULL AND a10.blk IS NOT NULL
  UNION ALL SELECT 'tov', 'l10', g.game_id, g.winner, CASE WHEN h10.tov < a10.tov THEN 'home_led' WHEN a10.tov < h10.tov THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h10.tov < a10.tov THEN true WHEN g.winner = g.away_abbreviation AND a10.tov < h10.tov THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.tov IS NOT NULL AND a10.tov IS NOT NULL
  UNION ALL SELECT 'fg_pct', 'l10', g.game_id, g.winner, CASE WHEN h10.fg_pct > a10.fg_pct THEN 'home_led' WHEN a10.fg_pct > h10.fg_pct THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h10.fg_pct > a10.fg_pct THEN true WHEN g.winner = g.away_abbreviation AND a10.fg_pct > h10.fg_pct THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.fg_pct IS NOT NULL AND a10.fg_pct IS NOT NULL
  UNION ALL SELECT 'three_pt_pct', 'l10', g.game_id, g.winner, CASE WHEN h10.three_pt_pct > a10.three_pt_pct THEN 'home_led' WHEN a10.three_pt_pct > h10.three_pt_pct THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h10.three_pt_pct > a10.three_pt_pct THEN true WHEN g.winner = g.away_abbreviation AND a10.three_pt_pct > h10.three_pt_pct THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.three_pt_pct IS NOT NULL AND a10.three_pt_pct IS NOT NULL
  UNION ALL SELECT 'ft_pct', 'l10', g.game_id, g.winner, CASE WHEN h10.ft_pct > a10.ft_pct THEN 'home_led' WHEN a10.ft_pct > h10.ft_pct THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h10.ft_pct > a10.ft_pct THEN true WHEN g.winner = g.away_abbreviation AND a10.ft_pct > h10.ft_pct THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.ft_pct IS NOT NULL AND a10.ft_pct IS NOT NULL
  UNION ALL SELECT 'pts', 'l5', g.game_id, g.winner, CASE WHEN h5.pts > a5.pts THEN 'home_led' WHEN a5.pts > h5.pts THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h5.pts > a5.pts THEN true WHEN g.winner = g.away_abbreviation AND a5.pts > h5.pts THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.pts IS NOT NULL AND a5.pts IS NOT NULL
  UNION ALL SELECT 'reb', 'l5', g.game_id, g.winner, CASE WHEN h5.reb > a5.reb THEN 'home_led' WHEN a5.reb > h5.reb THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h5.reb > a5.reb THEN true WHEN g.winner = g.away_abbreviation AND a5.reb > h5.reb THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.reb IS NOT NULL AND a5.reb IS NOT NULL
  UNION ALL SELECT 'ast', 'l5', g.game_id, g.winner, CASE WHEN h5.ast > a5.ast THEN 'home_led' WHEN a5.ast > h5.ast THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h5.ast > a5.ast THEN true WHEN g.winner = g.away_abbreviation AND a5.ast > h5.ast THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.ast IS NOT NULL AND a5.ast IS NOT NULL
  UNION ALL SELECT 'stl', 'l5', g.game_id, g.winner, CASE WHEN h5.stl > a5.stl THEN 'home_led' WHEN a5.stl > h5.stl THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h5.stl > a5.stl THEN true WHEN g.winner = g.away_abbreviation AND a5.stl > h5.stl THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.stl IS NOT NULL AND a5.stl IS NOT NULL
  UNION ALL SELECT 'blk', 'l5', g.game_id, g.winner, CASE WHEN h5.blk > a5.blk THEN 'home_led' WHEN a5.blk > h5.blk THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h5.blk > a5.blk THEN true WHEN g.winner = g.away_abbreviation AND a5.blk > h5.blk THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.blk IS NOT NULL AND a5.blk IS NOT NULL
  UNION ALL SELECT 'tov', 'l5', g.game_id, g.winner, CASE WHEN h5.tov < a5.tov THEN 'home_led' WHEN a5.tov < h5.tov THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h5.tov < a5.tov THEN true WHEN g.winner = g.away_abbreviation AND a5.tov < h5.tov THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.tov IS NOT NULL AND a5.tov IS NOT NULL
  UNION ALL SELECT 'fg_pct', 'l5', g.game_id, g.winner, CASE WHEN h5.fg_pct > a5.fg_pct THEN 'home_led' WHEN a5.fg_pct > h5.fg_pct THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h5.fg_pct > a5.fg_pct THEN true WHEN g.winner = g.away_abbreviation AND a5.fg_pct > h5.fg_pct THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.fg_pct IS NOT NULL AND a5.fg_pct IS NOT NULL
  UNION ALL SELECT 'three_pt_pct', 'l5', g.game_id, g.winner, CASE WHEN h5.three_pt_pct > a5.three_pt_pct THEN 'home_led' WHEN a5.three_pt_pct > h5.three_pt_pct THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h5.three_pt_pct > a5.three_pt_pct THEN true WHEN g.winner = g.away_abbreviation AND a5.three_pt_pct > h5.three_pt_pct THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.three_pt_pct IS NOT NULL AND a5.three_pt_pct IS NOT NULL
  UNION ALL SELECT 'ft_pct', 'l5', g.game_id, g.winner, CASE WHEN h5.ft_pct > a5.ft_pct THEN 'home_led' WHEN a5.ft_pct > h5.ft_pct THEN 'away_led' ELSE 'tie' END, CASE WHEN g.winner = g.home_abbreviation AND h5.ft_pct > a5.ft_pct THEN true WHEN g.winner = g.away_abbreviation AND a5.ft_pct > h5.ft_pct THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.ft_pct IS NOT NULL AND a5.ft_pct IS NOT NULL
)
SELECT c.stat, c.mode, c.venue_led,
  COUNT(*) AS games,
  COUNT(*) FILTER (WHERE c.winner_had_better) AS winner_led_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE c.winner_had_better) / NULLIF(COUNT(*), 0), 1) AS pct_winner_led
FROM comparisons_p4 c
WHERE c.venue_led != 'tie'
GROUP BY c.stat, c.mode, c.venue_led
ORDER BY c.stat, c.mode, c.venue_led;

-- =============================================================================
-- PART 5: Opposite trend - hit rate when teams trending opposite (L5 vs L10 pts)
-- =============================================================================

WITH excluded_games AS (SELECT unnest(ARRAY['401809839','401838140','401838141','401838142','401838143']::text[]) AS gid),
team_game_totals AS (SELECT b.team_abbreviation, b.game_id, MIN(b.game_date) AS game_date, SUM(COALESCE(b.points, 0))::numeric AS pts, SUM(COALESCE(b.rebounds, 0))::numeric AS reb, SUM(COALESCE(b.assists, 0))::numeric AS ast, SUM(COALESCE(b.steals, 0))::numeric AS stl, SUM(COALESCE(b.blocks, 0))::numeric AS blk, SUM(COALESCE(b.turnovers, 0))::numeric AS tov, CASE WHEN SUM(COALESCE(b.field_goals_attempted, 0)) > 0 THEN 100.0 * SUM(COALESCE(b.field_goals_made, 0)) / SUM(COALESCE(b.field_goals_attempted, 0)) ELSE NULL END AS fg_pct, CASE WHEN SUM(COALESCE(b.three_point_field_goals_attempted, 0)) > 0 THEN 100.0 * SUM(COALESCE(b.three_point_field_goals_made, 0)) / SUM(COALESCE(b.three_point_field_goals_attempted, 0)) ELSE NULL END AS three_pt_pct, CASE WHEN SUM(COALESCE(b.free_throws_attempted, 0)) > 0 THEN 100.0 * SUM(COALESCE(b.free_throws_made, 0)) / SUM(COALESCE(b.free_throws_attempted, 0)) ELSE NULL END AS ft_pct FROM player_boxscores_raw b WHERE b.season = 2026 AND b.season_type = 2 AND (b.did_not_play IS NULL OR b.did_not_play = false) AND b.team_abbreviation IS NOT NULL AND b.team_abbreviation != '' AND b.game_id::text NOT IN (SELECT gid FROM excluded_games) GROUP BY b.team_abbreviation, b.game_id),
games AS (SELECT game_id, game_date, UPPER(TRIM(home_abbreviation)) AS home_abbreviation, UPPER(TRIM(away_abbreviation)) AS away_abbreviation, home_score, away_score, CASE WHEN home_score > away_score THEN UPPER(TRIM(home_abbreviation)) WHEN away_score > home_score THEN UPPER(TRIM(away_abbreviation)) ELSE NULL END AS winner FROM schedules WHERE season = 2026 AND season_type = 2 AND status_type_completed = true AND home_score IS NOT NULL AND away_score IS NOT NULL AND game_id::text NOT IN (SELECT gid FROM excluded_games)),
home_season AS (SELECT g.game_id, AVG(t.pts) AS pts, AVG(t.reb) AS reb, AVG(t.ast) AS ast, AVG(t.stl) AS stl, AVG(t.blk) AS blk, AVG(t.tov) AS tov, AVG(t.fg_pct) AS fg_pct, AVG(t.three_pt_pct) AS three_pt_pct, AVG(t.ft_pct) AS ft_pct FROM games g JOIN team_game_totals t ON t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date GROUP BY g.game_id),
away_season AS (SELECT g.game_id, AVG(t.pts) AS pts, AVG(t.reb) AS reb, AVG(t.ast) AS ast, AVG(t.stl) AS stl, AVG(t.blk) AS blk, AVG(t.tov) AS tov, AVG(t.fg_pct) AS fg_pct, AVG(t.three_pt_pct) AS three_pt_pct, AVG(t.ft_pct) AS ft_pct FROM games g JOIN team_game_totals t ON t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date GROUP BY g.game_id),
home_l10 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ft_pct FROM games g),
away_l10 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ft_pct FROM games g),
home_l5 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ft_pct FROM games g),
away_l5 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ft_pct FROM games g),
team_game_dates AS (SELECT DISTINCT UPPER(TRIM(home_abbreviation)) AS team_abbreviation, game_date FROM schedules WHERE season = 2026 AND season_type = 2 AND status_type_completed = true AND game_id::text NOT IN (SELECT gid FROM excluded_games) AND home_abbreviation IS NOT NULL AND TRIM(home_abbreviation) != '' UNION SELECT DISTINCT UPPER(TRIM(away_abbreviation)) AS team_abbreviation, game_date FROM schedules WHERE season = 2026 AND season_type = 2 AND status_type_completed = true AND game_id::text NOT IN (SELECT gid FROM excluded_games) AND away_abbreviation IS NOT NULL AND TRIM(away_abbreviation) != ''),
game_context_p5 AS (SELECT g.game_id, ((h5.pts > h10.pts) AND NOT (a5.pts > a10.pts)) OR (NOT (h5.pts > h10.pts) AND (a5.pts > a10.pts)) AS opposite_trend FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE h5.pts IS NOT NULL AND a5.pts IS NOT NULL AND h10.pts IS NOT NULL AND a10.pts IS NOT NULL),
comparisons_p5 AS (SELECT 'pts' AS stat, 'season' AS mode, g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.pts > as_.pts THEN true WHEN g.winner = g.away_abbreviation AND as_.pts > hs.pts THEN true ELSE false END AS winner_had_better FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'reb', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.reb > as_.reb THEN true WHEN g.winner = g.away_abbreviation AND as_.reb > hs.reb THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'ast', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.ast > as_.ast THEN true WHEN g.winner = g.away_abbreviation AND as_.ast > hs.ast THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'stl', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.stl > as_.stl THEN true WHEN g.winner = g.away_abbreviation AND as_.stl > hs.stl THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'blk', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.blk > as_.blk THEN true WHEN g.winner = g.away_abbreviation AND as_.blk > hs.blk THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'tov', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.tov < as_.tov THEN true WHEN g.winner = g.away_abbreviation AND as_.tov < hs.tov THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'fg_pct', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.fg_pct > as_.fg_pct THEN true WHEN g.winner = g.away_abbreviation AND as_.fg_pct > hs.fg_pct THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'three_pt_pct', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.three_pt_pct > as_.three_pt_pct THEN true WHEN g.winner = g.away_abbreviation AND as_.three_pt_pct > hs.three_pt_pct THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'ft_pct', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.ft_pct > as_.ft_pct THEN true WHEN g.winner = g.away_abbreviation AND as_.ft_pct > hs.ft_pct THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'pts', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.pts > a10.pts THEN true WHEN g.winner = g.away_abbreviation AND a10.pts > h10.pts THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.pts IS NOT NULL AND a10.pts IS NOT NULL UNION ALL SELECT 'reb', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.reb > a10.reb THEN true WHEN g.winner = g.away_abbreviation AND a10.reb > h10.reb THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.reb IS NOT NULL AND a10.reb IS NOT NULL UNION ALL SELECT 'ast', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.ast > a10.ast THEN true WHEN g.winner = g.away_abbreviation AND a10.ast > h10.ast THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.ast IS NOT NULL AND a10.ast IS NOT NULL UNION ALL SELECT 'stl', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.stl > a10.stl THEN true WHEN g.winner = g.away_abbreviation AND a10.stl > h10.stl THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.stl IS NOT NULL AND a10.stl IS NOT NULL UNION ALL SELECT 'blk', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.blk > a10.blk THEN true WHEN g.winner = g.away_abbreviation AND a10.blk > h10.blk THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.blk IS NOT NULL AND a10.blk IS NOT NULL UNION ALL SELECT 'tov', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.tov < a10.tov THEN true WHEN g.winner = g.away_abbreviation AND a10.tov < h10.tov THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.tov IS NOT NULL AND a10.tov IS NOT NULL UNION ALL SELECT 'fg_pct', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.fg_pct > a10.fg_pct THEN true WHEN g.winner = g.away_abbreviation AND a10.fg_pct > h10.fg_pct THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.fg_pct IS NOT NULL AND a10.fg_pct IS NOT NULL UNION ALL SELECT 'three_pt_pct', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.three_pt_pct > a10.three_pt_pct THEN true WHEN g.winner = g.away_abbreviation AND a10.three_pt_pct > h10.three_pt_pct THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.three_pt_pct IS NOT NULL AND a10.three_pt_pct IS NOT NULL UNION ALL SELECT 'ft_pct', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.ft_pct > a10.ft_pct THEN true WHEN g.winner = g.away_abbreviation AND a10.ft_pct > h10.ft_pct THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.ft_pct IS NOT NULL AND a10.ft_pct IS NOT NULL
  UNION ALL SELECT 'pts', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.pts > a5.pts THEN true WHEN g.winner = g.away_abbreviation AND a5.pts > h5.pts THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.pts IS NOT NULL AND a5.pts IS NOT NULL UNION ALL SELECT 'reb', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.reb > a5.reb THEN true WHEN g.winner = g.away_abbreviation AND a5.reb > h5.reb THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.reb IS NOT NULL AND a5.reb IS NOT NULL UNION ALL SELECT 'ast', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.ast > a5.ast THEN true WHEN g.winner = g.away_abbreviation AND a5.ast > h5.ast THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.ast IS NOT NULL AND a5.ast IS NOT NULL UNION ALL SELECT 'stl', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.stl > a5.stl THEN true WHEN g.winner = g.away_abbreviation AND a5.stl > h5.stl THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.stl IS NOT NULL AND a5.stl IS NOT NULL UNION ALL SELECT 'blk', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.blk > a5.blk THEN true WHEN g.winner = g.away_abbreviation AND a5.blk > h5.blk THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.blk IS NOT NULL AND a5.blk IS NOT NULL UNION ALL SELECT 'tov', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.tov < a5.tov THEN true WHEN g.winner = g.away_abbreviation AND a5.tov < h5.tov THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.tov IS NOT NULL AND a5.tov IS NOT NULL UNION ALL SELECT 'fg_pct', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.fg_pct > a5.fg_pct THEN true WHEN g.winner = g.away_abbreviation AND a5.fg_pct > h5.fg_pct THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.fg_pct IS NOT NULL AND a5.fg_pct IS NOT NULL UNION ALL SELECT 'three_pt_pct', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.three_pt_pct > a5.three_pt_pct THEN true WHEN g.winner = g.away_abbreviation AND a5.three_pt_pct > h5.three_pt_pct THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.three_pt_pct IS NOT NULL AND a5.three_pt_pct IS NOT NULL UNION ALL SELECT 'ft_pct', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.ft_pct > a5.ft_pct THEN true WHEN g.winner = g.away_abbreviation AND a5.ft_pct > h5.ft_pct THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.ft_pct IS NOT NULL AND a5.ft_pct IS NOT NULL
)
SELECT c.stat, c.mode, CASE WHEN gc.opposite_trend THEN 'opposite_trend' ELSE 'same_trend' END AS scenario,
  COUNT(*) AS games,
  COUNT(*) FILTER (WHERE c.winner_had_better) AS winner_led_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE c.winner_had_better) / NULLIF(COUNT(*), 0), 1) AS pct_winner_led
FROM comparisons_p5 c
JOIN game_context_p5 gc ON gc.game_id = c.game_id
GROUP BY c.stat, c.mode, gc.opposite_trend
ORDER BY c.stat, c.mode, scenario;

-- =============================================================================
-- PART 6: Rest advantage - hit rate when one team rested (2+ days) vs other B2B
-- =============================================================================

WITH excluded_games AS (SELECT unnest(ARRAY['401809839','401838140','401838141','401838142','401838143']::text[]) AS gid),
team_game_totals AS (SELECT b.team_abbreviation, b.game_id, MIN(b.game_date) AS game_date, SUM(COALESCE(b.points, 0))::numeric AS pts, SUM(COALESCE(b.rebounds, 0))::numeric AS reb, SUM(COALESCE(b.assists, 0))::numeric AS ast, SUM(COALESCE(b.steals, 0))::numeric AS stl, SUM(COALESCE(b.blocks, 0))::numeric AS blk, SUM(COALESCE(b.turnovers, 0))::numeric AS tov, CASE WHEN SUM(COALESCE(b.field_goals_attempted, 0)) > 0 THEN 100.0 * SUM(COALESCE(b.field_goals_made, 0)) / SUM(COALESCE(b.field_goals_attempted, 0)) ELSE NULL END AS fg_pct, CASE WHEN SUM(COALESCE(b.three_point_field_goals_attempted, 0)) > 0 THEN 100.0 * SUM(COALESCE(b.three_point_field_goals_made, 0)) / SUM(COALESCE(b.three_point_field_goals_attempted, 0)) ELSE NULL END AS three_pt_pct, CASE WHEN SUM(COALESCE(b.free_throws_attempted, 0)) > 0 THEN 100.0 * SUM(COALESCE(b.free_throws_made, 0)) / SUM(COALESCE(b.free_throws_attempted, 0)) ELSE NULL END AS ft_pct FROM player_boxscores_raw b WHERE b.season = 2026 AND b.season_type = 2 AND (b.did_not_play IS NULL OR b.did_not_play = false) AND b.team_abbreviation IS NOT NULL AND b.team_abbreviation != '' AND b.game_id::text NOT IN (SELECT gid FROM excluded_games) GROUP BY b.team_abbreviation, b.game_id),
games AS (SELECT game_id, game_date, UPPER(TRIM(home_abbreviation)) AS home_abbreviation, UPPER(TRIM(away_abbreviation)) AS away_abbreviation, home_score, away_score, CASE WHEN home_score > away_score THEN UPPER(TRIM(home_abbreviation)) WHEN away_score > home_score THEN UPPER(TRIM(away_abbreviation)) ELSE NULL END AS winner FROM schedules WHERE season = 2026 AND season_type = 2 AND status_type_completed = true AND home_score IS NOT NULL AND away_score IS NOT NULL AND game_id::text NOT IN (SELECT gid FROM excluded_games)),
home_season AS (SELECT g.game_id, AVG(t.pts) AS pts, AVG(t.reb) AS reb, AVG(t.ast) AS ast, AVG(t.stl) AS stl, AVG(t.blk) AS blk, AVG(t.tov) AS tov, AVG(t.fg_pct) AS fg_pct, AVG(t.three_pt_pct) AS three_pt_pct, AVG(t.ft_pct) AS ft_pct FROM games g JOIN team_game_totals t ON t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date GROUP BY g.game_id),
away_season AS (SELECT g.game_id, AVG(t.pts) AS pts, AVG(t.reb) AS reb, AVG(t.ast) AS ast, AVG(t.stl) AS stl, AVG(t.blk) AS blk, AVG(t.tov) AS tov, AVG(t.fg_pct) AS fg_pct, AVG(t.three_pt_pct) AS three_pt_pct, AVG(t.ft_pct) AS ft_pct FROM games g JOIN team_game_totals t ON t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date GROUP BY g.game_id),
home_l10 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ft_pct FROM games g),
away_l10 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 10) sub) AS ft_pct FROM games g),
home_l5 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.home_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ft_pct FROM games g),
away_l5 AS (SELECT g.game_id, (SELECT AVG(sub.pts) FROM (SELECT t.pts FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS pts, (SELECT AVG(sub.reb) FROM (SELECT t.reb FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS reb, (SELECT AVG(sub.ast) FROM (SELECT t.ast FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ast, (SELECT AVG(sub.stl) FROM (SELECT t.stl FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS stl, (SELECT AVG(sub.blk) FROM (SELECT t.blk FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS blk, (SELECT AVG(sub.tov) FROM (SELECT t.tov FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS tov, (SELECT AVG(sub.fg_pct) FROM (SELECT t.fg_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS fg_pct, (SELECT AVG(sub.three_pt_pct) FROM (SELECT t.three_pt_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS three_pt_pct, (SELECT AVG(sub.ft_pct) FROM (SELECT t.ft_pct FROM team_game_totals t WHERE t.team_abbreviation = g.away_abbreviation AND t.game_date < g.game_date ORDER BY t.game_date DESC LIMIT 5) sub) AS ft_pct FROM games g),
team_game_dates AS (SELECT DISTINCT UPPER(TRIM(home_abbreviation)) AS team_abbreviation, game_date FROM schedules WHERE season = 2026 AND season_type = 2 AND status_type_completed = true AND game_id::text NOT IN (SELECT gid FROM excluded_games) AND home_abbreviation IS NOT NULL AND TRIM(home_abbreviation) != '' UNION SELECT DISTINCT UPPER(TRIM(away_abbreviation)) AS team_abbreviation, game_date FROM schedules WHERE season = 2026 AND season_type = 2 AND status_type_completed = true AND game_id::text NOT IN (SELECT gid FROM excluded_games) AND away_abbreviation IS NOT NULL AND TRIM(away_abbreviation) != ''),
game_context_p6 AS (SELECT g.game_id, ((g.game_date::date - home_prior.max_date::date) = 1 AND (g.game_date::date - away_prior.max_date::date) >= 2) OR ((g.game_date::date - away_prior.max_date::date) = 1 AND (g.game_date::date - home_prior.max_date::date) >= 2) AS rest_advantage FROM games g LEFT JOIN LATERAL (SELECT MAX(tgd.game_date) AS max_date FROM team_game_dates tgd WHERE tgd.team_abbreviation = g.home_abbreviation AND tgd.game_date < g.game_date) home_prior ON true LEFT JOIN LATERAL (SELECT MAX(tgd.game_date) AS max_date FROM team_game_dates tgd WHERE tgd.team_abbreviation = g.away_abbreviation AND tgd.game_date < g.game_date) away_prior ON true JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.game_id IS NOT NULL AND home_prior.max_date IS NOT NULL AND away_prior.max_date IS NOT NULL),
comparisons_p6 AS (SELECT 'pts' AS stat, 'season' AS mode, g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.pts > as_.pts THEN true WHEN g.winner = g.away_abbreviation AND as_.pts > hs.pts THEN true ELSE false END AS winner_had_better FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'reb', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.reb > as_.reb THEN true WHEN g.winner = g.away_abbreviation AND as_.reb > hs.reb THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'ast', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.ast > as_.ast THEN true WHEN g.winner = g.away_abbreviation AND as_.ast > hs.ast THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'stl', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.stl > as_.stl THEN true WHEN g.winner = g.away_abbreviation AND as_.stl > hs.stl THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'blk', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.blk > as_.blk THEN true WHEN g.winner = g.away_abbreviation AND as_.blk > hs.blk THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'tov', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.tov < as_.tov THEN true WHEN g.winner = g.away_abbreviation AND as_.tov < hs.tov THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'fg_pct', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.fg_pct > as_.fg_pct THEN true WHEN g.winner = g.away_abbreviation AND as_.fg_pct > hs.fg_pct THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'three_pt_pct', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.three_pt_pct > as_.three_pt_pct THEN true WHEN g.winner = g.away_abbreviation AND as_.three_pt_pct > hs.three_pt_pct THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL UNION ALL SELECT 'ft_pct', 'season', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND hs.ft_pct > as_.ft_pct THEN true WHEN g.winner = g.away_abbreviation AND as_.ft_pct > hs.ft_pct THEN true ELSE false END FROM games g JOIN home_season hs ON hs.game_id = g.game_id JOIN away_season as_ ON as_.game_id = g.game_id WHERE g.winner IS NOT NULL
  UNION ALL SELECT 'pts', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.pts > a10.pts THEN true WHEN g.winner = g.away_abbreviation AND a10.pts > h10.pts THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.pts IS NOT NULL AND a10.pts IS NOT NULL UNION ALL SELECT 'reb', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.reb > a10.reb THEN true WHEN g.winner = g.away_abbreviation AND a10.reb > h10.reb THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.reb IS NOT NULL AND a10.reb IS NOT NULL UNION ALL SELECT 'ast', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.ast > a10.ast THEN true WHEN g.winner = g.away_abbreviation AND a10.ast > h10.ast THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.ast IS NOT NULL AND a10.ast IS NOT NULL UNION ALL SELECT 'stl', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.stl > a10.stl THEN true WHEN g.winner = g.away_abbreviation AND a10.stl > h10.stl THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.stl IS NOT NULL AND a10.stl IS NOT NULL UNION ALL SELECT 'blk', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.blk > a10.blk THEN true WHEN g.winner = g.away_abbreviation AND a10.blk > h10.blk THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.blk IS NOT NULL AND a10.blk IS NOT NULL UNION ALL SELECT 'tov', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.tov < a10.tov THEN true WHEN g.winner = g.away_abbreviation AND a10.tov < h10.tov THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.tov IS NOT NULL AND a10.tov IS NOT NULL UNION ALL SELECT 'fg_pct', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.fg_pct > a10.fg_pct THEN true WHEN g.winner = g.away_abbreviation AND a10.fg_pct > h10.fg_pct THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.fg_pct IS NOT NULL AND a10.fg_pct IS NOT NULL UNION ALL SELECT 'three_pt_pct', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.three_pt_pct > a10.three_pt_pct THEN true WHEN g.winner = g.away_abbreviation AND a10.three_pt_pct > h10.three_pt_pct THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.three_pt_pct IS NOT NULL AND a10.three_pt_pct IS NOT NULL UNION ALL SELECT 'ft_pct', 'l10', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h10.ft_pct > a10.ft_pct THEN true WHEN g.winner = g.away_abbreviation AND a10.ft_pct > h10.ft_pct THEN true ELSE false END FROM games g JOIN home_l10 h10 ON h10.game_id = g.game_id JOIN away_l10 a10 ON a10.game_id = g.game_id WHERE g.winner IS NOT NULL AND h10.ft_pct IS NOT NULL AND a10.ft_pct IS NOT NULL
  UNION ALL SELECT 'pts', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.pts > a5.pts THEN true WHEN g.winner = g.away_abbreviation AND a5.pts > h5.pts THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.pts IS NOT NULL AND a5.pts IS NOT NULL UNION ALL SELECT 'reb', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.reb > a5.reb THEN true WHEN g.winner = g.away_abbreviation AND a5.reb > h5.reb THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.reb IS NOT NULL AND a5.reb IS NOT NULL UNION ALL SELECT 'ast', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.ast > a5.ast THEN true WHEN g.winner = g.away_abbreviation AND a5.ast > h5.ast THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.ast IS NOT NULL AND a5.ast IS NOT NULL UNION ALL SELECT 'stl', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.stl > a5.stl THEN true WHEN g.winner = g.away_abbreviation AND a5.stl > h5.stl THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.stl IS NOT NULL AND a5.stl IS NOT NULL UNION ALL SELECT 'blk', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.blk > a5.blk THEN true WHEN g.winner = g.away_abbreviation AND a5.blk > h5.blk THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.blk IS NOT NULL AND a5.blk IS NOT NULL UNION ALL SELECT 'tov', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.tov < a5.tov THEN true WHEN g.winner = g.away_abbreviation AND a5.tov < h5.tov THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.tov IS NOT NULL AND a5.tov IS NOT NULL UNION ALL SELECT 'fg_pct', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.fg_pct > a5.fg_pct THEN true WHEN g.winner = g.away_abbreviation AND a5.fg_pct > h5.fg_pct THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.fg_pct IS NOT NULL AND a5.fg_pct IS NOT NULL UNION ALL SELECT 'three_pt_pct', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.three_pt_pct > a5.three_pt_pct THEN true WHEN g.winner = g.away_abbreviation AND a5.three_pt_pct > h5.three_pt_pct THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.three_pt_pct IS NOT NULL AND a5.three_pt_pct IS NOT NULL UNION ALL SELECT 'ft_pct', 'l5', g.game_id, g.winner, CASE WHEN g.winner = g.home_abbreviation AND h5.ft_pct > a5.ft_pct THEN true WHEN g.winner = g.away_abbreviation AND a5.ft_pct > h5.ft_pct THEN true ELSE false END FROM games g JOIN home_l5 h5 ON h5.game_id = g.game_id JOIN away_l5 a5 ON a5.game_id = g.game_id WHERE g.winner IS NOT NULL AND h5.ft_pct IS NOT NULL AND a5.ft_pct IS NOT NULL
)
SELECT c.stat, c.mode,
  COUNT(*) AS games,
  COUNT(*) FILTER (WHERE c.winner_had_better) AS winner_led_count,
  ROUND(100.0 * COUNT(*) FILTER (WHERE c.winner_had_better) / NULLIF(COUNT(*), 0), 1) AS pct_winner_led
FROM comparisons_p6 c
JOIN game_context_p6 gc ON gc.game_id = c.game_id
WHERE gc.rest_advantage = true
GROUP BY c.stat, c.mode
ORDER BY c.stat, c.mode;
