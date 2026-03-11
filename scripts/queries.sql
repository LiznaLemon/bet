SELECT game_id, 
	   game_date,
	   -- season,
	   season_type,
	   team_name,
	   home_away,
	   opponent_team_name,
	   CASE 
	     WHEN team_winner = true THEN 'Win'
	     WHEN team_winner = false THEN 'Loss'
	     ELSE NULL
	   END AS "W/L",
	   athlete_display_name,
	   active,
	   starter,
	   ejected,
	   did_not_play,
	   minutes,
	   points,
	   COALESCE(ROUND(AVG((points::numeric))
	   		OVER (ORDER BY game_date
			   	  ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 1),0) AS PPG_Before,
	   COALESCE(ROUND(AVG((points::numeric))
			OVER (ORDER BY game_date
				  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 1),0) AS PPG_After,
				
	   field_goals_made AS FGM,
	   field_goals_attempted AS FGA,
	   ROUND((field_goals_made::numeric / NULLIF(field_goals_attempted::numeric, 0)) * 100, 1) AS "FG%",
	   COALESCE(ROUND(AVG((field_goals_made::numeric / NULLIF(field_goals_attempted::numeric, 0)) * 100) 
	         OVER (ORDER BY game_date 
	               ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 1),0) AS "AFG%_Before",
	   ROUND(AVG((field_goals_made::numeric / NULLIF(field_goals_attempted::numeric, 0)) * 100)
	         OVER (ORDER BY game_date
	               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW), 1) AS "AFG%_After",
	   ROUND((points::numeric / NULLIF((2 * (field_goals_attempted + 0.44 * free_throws_attempted))::numeric, 0)) * 100, 2) as TSP,
	   three_point_field_goals_made AS "3PM",
	   three_point_field_goals_attempted AS "3PA",
	   ROUND((three_point_field_goals_made::numeric / NULLIF(three_point_field_goals_attempted::numeric, 0)) * 100, 2) as "3P%",
	   free_throws_made AS FTM,
	   free_throws_attempted AS FTA,
	   ROUND((free_throws_made::numeric / NULLIF(free_throws_attempted::numeric, 0)) * 100, 1) AS "FT%"
	   -- offensive_rebounds,
	   -- defensive_rebounds,
	   -- rebounds,
	   -- assists,
	   -- steals,
	   -- blocks,
	   -- turnovers,
	   -- fouls
FROM player_boxscores_raw
WHERE athlete_id = 3945274
AND game_id NOT IN (401809839, 401838140, 401838141, 401838142, 401838143)
ORDER BY game_date;

-- Get games for the current week (Monday to Sunday) from the schedule table
SELECT * FROM schedule
WHERE CAST(date AS DATE) >= date_trunc('week', CURRENT_DATE)
  AND CAST(date AS DATE) <  date_trunc('week', CURRENT_DATE) + INTERVAL '1 week'
ORDER BY date;

-- Get play-by-play data
SELECT * FROM play_by_play_raw
WHERE game_date >= date_trunc('week', CAST('02-09-2026' AS DATE))
	AND game_date < date_trunc('week', CAST('02-09-2026' AS DATE)) + INTERVAL '1 week'
LIMIT 100;


-- ============================================================
-- PLAY-BY-PLAY DERIVED STATS
-- ============================================================
-- Run the queries below and export results to CSV files.
-- Then run: node scripts/convert-enhanced-stats.js
--
-- EXCLUDED GAMES (NBA Cup Tournament & All-Star):
--   401809839, 401838140, 401838141, 401838142, 401838143
-- These are filtered out of every query below.
-- ============================================================


-- ============================================================
-- 1. PLAYER QUARTER STATS (per game, per quarter)
--    Export to: scripts/nba_player_quarter_stats.csv
--
--    Derives per-player, per-game, per-quarter counting stats
--    from the play_by_play_raw table. Each row = one player's
--    stats in one quarter of one game.
-- ============================================================
WITH primary_stats AS (
    -- Stats where the player is the primary actor (athlete_id_1):
    -- scoring, shooting, rebounds, turnovers, fouls
    SELECT
        athlete_id_1 AS athlete_id,
        game_id,
        game_date,
        period_number,
        SUM(CASE WHEN scoring_play = true THEN score_value ELSE 0 END) AS points,
        COUNT(*) FILTER (WHERE shooting_play = true AND points_attempted IN (2, 3)) AS fga,
        COUNT(*) FILTER (WHERE shooting_play = true AND scoring_play = true AND points_attempted IN (2, 3)) AS fgm,
        COUNT(*) FILTER (WHERE shooting_play = true AND points_attempted = 3) AS three_pa,
        COUNT(*) FILTER (WHERE shooting_play = true AND scoring_play = true AND points_attempted = 3) AS three_pm,
        COUNT(*) FILTER (WHERE shooting_play = true AND points_attempted = 1) AS fta,
        COUNT(*) FILTER (WHERE shooting_play = true AND scoring_play = true AND points_attempted = 1) AS ftm,
        COUNT(*) FILTER (WHERE type_id IN (155, 156)) AS rebounds,
        COUNT(*) FILTER (WHERE type_id = 156) AS off_reb,
        COUNT(*) FILTER (WHERE type_id = 155) AS def_reb,
        COUNT(*) FILTER (WHERE short_description = 'Turnover') AS turnovers,
        COUNT(*) FILTER (WHERE short_description = 'Foul') AS fouls
    FROM play_by_play_raw
    WHERE athlete_id_1 IS NOT NULL
      AND game_id NOT IN (401809839, 401838140, 401838141, 401838142, 401838143)
    GROUP BY athlete_id_1, game_id, game_date, period_number
),
secondary_stats AS (
    -- Stats where the player is the secondary actor (athlete_id_2):
    -- assists (on scoring plays), steals (on turnovers), blocks (on missed shots)
    SELECT
        athlete_id_2 AS athlete_id,
        game_id,
        game_date,
        period_number,
        COUNT(*) FILTER (WHERE scoring_play = true AND score_value > 0) AS assists,
        COUNT(*) FILTER (WHERE short_description = 'Turnover') AS steals,
        COUNT(*) FILTER (WHERE shooting_play = true AND scoring_play = false) AS blocks
    FROM play_by_play_raw
    WHERE athlete_id_2 IS NOT NULL
      AND game_id NOT IN (401809839, 401838140, 401838141, 401838142, 401838143)
    GROUP BY athlete_id_2, game_id, game_date, period_number
),
combined AS (
    SELECT
        COALESCE(p.athlete_id, s.athlete_id) AS athlete_id,
        COALESCE(p.game_id, s.game_id) AS game_id,
        COALESCE(p.game_date, s.game_date) AS game_date,
        COALESCE(p.period_number, s.period_number) AS period_number,
        COALESCE(p.points, 0) AS points,
        COALESCE(p.fgm, 0) AS fgm,
        COALESCE(p.fga, 0) AS fga,
        COALESCE(p.three_pm, 0) AS three_pm,
        COALESCE(p.three_pa, 0) AS three_pa,
        COALESCE(p.ftm, 0) AS ftm,
        COALESCE(p.fta, 0) AS fta,
        COALESCE(p.rebounds, 0) AS rebounds,
        COALESCE(p.off_reb, 0) AS off_reb,
        COALESCE(p.def_reb, 0) AS def_reb,
        COALESCE(s.assists, 0) AS assists,
        COALESCE(s.steals, 0) AS steals,
        COALESCE(s.blocks, 0) AS blocks,
        COALESCE(p.turnovers, 0) AS turnovers,
        COALESCE(p.fouls, 0) AS fouls
    FROM primary_stats p
    FULL OUTER JOIN secondary_stats s
        ON p.athlete_id = s.athlete_id
        AND p.game_id = s.game_id
        AND p.period_number = s.period_number
)
SELECT
    c.athlete_id,
    pl.athlete_display_name,
    pl.team_abbreviation,
    c.game_id,
    c.game_date,
    c.period_number,
    c.points,
    c.fgm,
    c.fga,
    c.three_pm,
    c.three_pa,
    c.ftm,
    c.fta,
    c.rebounds,
    c.off_reb,
    c.def_reb,
    c.assists,
    c.steals,
    c.blocks,
    c.turnovers,
    c.fouls
FROM combined c
LEFT JOIN (
    SELECT DISTINCT ON (athlete_id)
        athlete_id, athlete_display_name, team_abbreviation
    FROM player_boxscores_raw
    WHERE game_id NOT IN (401809839, 401838140, 401838141, 401838142, 401838143)
	AND minutes IS NOT NULL
    ORDER BY athlete_id, game_date DESC
) pl ON c.athlete_id = pl.athlete_id
ORDER BY c.athlete_id, c.game_date, c.period_number;


-- ============================================================
-- 2. PLAYER QUARTER SEASON AVERAGES (convenience query)
--    This summarizes the per-game data into season averages
--    broken down by quarter. Useful for quick analysis.
-- ============================================================
WITH primary_stats AS (
    SELECT
        athlete_id_1 AS athlete_id,
        game_id,
        game_date,
        period_number,
        SUM(CASE WHEN scoring_play = true THEN score_value ELSE 0 END) AS points,
        COUNT(*) FILTER (WHERE shooting_play = true AND points_attempted IN (2, 3)) AS fga,
        COUNT(*) FILTER (WHERE shooting_play = true AND scoring_play = true AND points_attempted IN (2, 3)) AS fgm,
        COUNT(*) FILTER (WHERE shooting_play = true AND points_attempted = 3) AS three_pa,
        COUNT(*) FILTER (WHERE shooting_play = true AND scoring_play = true AND points_attempted = 3) AS three_pm,
        COUNT(*) FILTER (WHERE shooting_play = true AND points_attempted = 1) AS fta,
        COUNT(*) FILTER (WHERE shooting_play = true AND scoring_play = true AND points_attempted = 1) AS ftm,
        COUNT(*) FILTER (WHERE type_id IN (155, 156)) AS rebounds,
        COUNT(*) FILTER (WHERE type_id = 156) AS off_reb,
        COUNT(*) FILTER (WHERE type_id = 155) AS def_reb,
        COUNT(*) FILTER (WHERE short_description = 'Turnover') AS turnovers,
        COUNT(*) FILTER (WHERE short_description = 'Foul') AS fouls
    FROM play_by_play_raw
    WHERE athlete_id_1 IS NOT NULL
      AND game_id NOT IN (401809839, 401838140, 401838141, 401838142, 401838143)
    GROUP BY athlete_id_1, game_id, game_date, period_number
),
secondary_stats AS (
    SELECT
        athlete_id_2 AS athlete_id,
        game_id,
        game_date,
        period_number,
        COUNT(*) FILTER (WHERE scoring_play = true AND score_value > 0) AS assists,
        COUNT(*) FILTER (WHERE short_description = 'Turnover') AS steals,
        COUNT(*) FILTER (WHERE shooting_play = true AND scoring_play = false) AS blocks
    FROM play_by_play_raw
    WHERE athlete_id_2 IS NOT NULL
      AND game_id NOT IN (401809839, 401838140, 401838141, 401838142, 401838143)
    GROUP BY athlete_id_2, game_id, game_date, period_number
),
combined AS (
    SELECT
        COALESCE(p.athlete_id, s.athlete_id) AS athlete_id,
        COALESCE(p.game_id, s.game_id) AS game_id,
        COALESCE(p.game_date, s.game_date) AS game_date,
        COALESCE(p.period_number, s.period_number) AS period_number,
        COALESCE(p.points, 0) AS points,
        COALESCE(p.fgm, 0) AS fgm,
        COALESCE(p.fga, 0) AS fga,
        COALESCE(p.three_pm, 0) AS three_pm,
        COALESCE(p.three_pa, 0) AS three_pa,
        COALESCE(p.ftm, 0) AS ftm,
        COALESCE(p.fta, 0) AS fta,
        COALESCE(p.rebounds, 0) AS rebounds,
        COALESCE(p.off_reb, 0) AS off_reb,
        COALESCE(p.def_reb, 0) AS def_reb,
        COALESCE(s.assists, 0) AS assists,
        COALESCE(s.steals, 0) AS steals,
        COALESCE(s.blocks, 0) AS blocks,
        COALESCE(p.turnovers, 0) AS turnovers,
        COALESCE(p.fouls, 0) AS fouls
    FROM primary_stats p
    FULL OUTER JOIN secondary_stats s
        ON p.athlete_id = s.athlete_id
        AND p.game_id = s.game_id
        AND p.period_number = s.period_number
)
SELECT
    c.athlete_id,
    pl.athlete_display_name,
    pl.team_abbreviation,
    c.period_number AS quarter,
    COUNT(DISTINCT c.game_id) AS games,
    ROUND(AVG(c.points)::numeric, 1) AS ppg,
    ROUND(AVG(c.fgm)::numeric, 1) AS fgm,
    ROUND(AVG(c.fga)::numeric, 1) AS fga,
    ROUND((SUM(c.fgm)::numeric / NULLIF(SUM(c.fga), 0)) * 100, 1) AS fg_pct,
    ROUND(AVG(c.three_pm)::numeric, 1) AS three_pm,
    ROUND(AVG(c.three_pa)::numeric, 1) AS three_pa,
    ROUND((SUM(c.three_pm)::numeric / NULLIF(SUM(c.three_pa), 0)) * 100, 1) AS three_pt_pct,
    ROUND(AVG(c.ftm)::numeric, 1) AS ftm,
    ROUND(AVG(c.fta)::numeric, 1) AS fta,
    ROUND((SUM(c.ftm)::numeric / NULLIF(SUM(c.fta), 0)) * 100, 1) AS ft_pct,
    ROUND(AVG(c.rebounds)::numeric, 1) AS rpg,
    ROUND(AVG(c.assists)::numeric, 1) AS apg,
    ROUND(AVG(c.steals)::numeric, 1) AS spg,
    ROUND(AVG(c.blocks)::numeric, 1) AS bpg,
    ROUND(AVG(c.turnovers)::numeric, 1) AS tpg
FROM combined c
LEFT JOIN (
    SELECT DISTINCT ON (athlete_id)
        athlete_id, athlete_display_name, team_abbreviation
    FROM player_boxscores_raw
    WHERE game_id NOT IN (401809839, 401838140, 401838141, 401838142, 401838143)
	AND minutes IS NOT NULL
    ORDER BY athlete_id, game_date DESC
) pl ON c.athlete_id = pl.athlete_id
WHERE c.period_number BETWEEN 1 AND 4
GROUP BY c.athlete_id, pl.athlete_display_name, pl.team_abbreviation, c.period_number
ORDER BY c.athlete_id, c.period_number;


-- ============================================================
-- 3. CLUTCH STATS
--    Last 5 minutes of 4th quarter or OT, game within 5 points.
--    Export to: scripts/nba_player_clutch_stats.csv
-- ============================================================
WITH clutch_primary AS (
    SELECT
        athlete_id_1 AS athlete_id,
        game_id,
        game_date,
        SUM(CASE WHEN scoring_play = true THEN score_value ELSE 0 END) AS points,
        COUNT(*) FILTER (WHERE shooting_play = true AND points_attempted IN (2, 3)) AS fga,
        COUNT(*) FILTER (WHERE shooting_play = true AND scoring_play = true AND points_attempted IN (2, 3)) AS fgm,
        COUNT(*) FILTER (WHERE shooting_play = true AND points_attempted = 3) AS three_pa,
        COUNT(*) FILTER (WHERE shooting_play = true AND scoring_play = true AND points_attempted = 3) AS three_pm,
        COUNT(*) FILTER (WHERE shooting_play = true AND points_attempted = 1) AS fta,
        COUNT(*) FILTER (WHERE shooting_play = true AND scoring_play = true AND points_attempted = 1) AS ftm,
        COUNT(*) FILTER (WHERE type_id IN (155, 156)) AS rebounds,
        COUNT(*) FILTER (WHERE short_description = 'Turnover') AS turnovers
    FROM play_by_play_raw
    WHERE athlete_id_1 IS NOT NULL
      AND game_id NOT IN (401809839, 401838140, 401838141, 401838142, 401838143)
      AND period_number >= 4
      AND clock_minutes::integer < 5
      AND ABS(home_score::integer - away_score::integer) <= 5
    GROUP BY athlete_id_1, game_id, game_date
),
clutch_secondary AS (
    SELECT
        athlete_id_2 AS athlete_id,
        game_id,
        game_date,
        COUNT(*) FILTER (WHERE scoring_play = true AND score_value > 0) AS assists,
        COUNT(*) FILTER (WHERE short_description = 'Turnover') AS steals,
        COUNT(*) FILTER (WHERE shooting_play = true AND scoring_play = false) AS blocks
    FROM play_by_play_raw
    WHERE athlete_id_2 IS NOT NULL
      AND game_id NOT IN (401809839, 401838140, 401838141, 401838142, 401838143)
      AND period_number >= 4
      AND clock_minutes::integer < 5
      AND ABS(home_score::integer - away_score::integer) <= 5
    GROUP BY athlete_id_2, game_id, game_date
),
clutch_combined AS (
    SELECT
        COALESCE(p.athlete_id, s.athlete_id) AS athlete_id,
        COALESCE(p.game_id, s.game_id) AS game_id,
        COALESCE(p.game_date, s.game_date) AS game_date,
        COALESCE(p.points, 0) AS points,
        COALESCE(p.fgm, 0) AS fgm,
        COALESCE(p.fga, 0) AS fga,
        COALESCE(p.three_pm, 0) AS three_pm,
        COALESCE(p.three_pa, 0) AS three_pa,
        COALESCE(p.ftm, 0) AS ftm,
        COALESCE(p.fta, 0) AS fta,
        COALESCE(p.rebounds, 0) AS rebounds,
        COALESCE(s.assists, 0) AS assists,
        COALESCE(s.steals, 0) AS steals,
        COALESCE(s.blocks, 0) AS blocks,
        COALESCE(p.turnovers, 0) AS turnovers
    FROM clutch_primary p
    FULL OUTER JOIN clutch_secondary s
        ON p.athlete_id = s.athlete_id
        AND p.game_id = s.game_id
)
SELECT
    c.athlete_id,
    pl.athlete_display_name,
    pl.team_abbreviation,
    COUNT(DISTINCT c.game_id) AS clutch_games,
    ROUND(AVG(c.points)::numeric, 1) AS clutch_ppg,
    ROUND((SUM(c.fgm)::numeric / NULLIF(SUM(c.fga), 0)) * 100, 1) AS clutch_fg_pct,
    ROUND((SUM(c.three_pm)::numeric / NULLIF(SUM(c.three_pa), 0)) * 100, 1) AS clutch_3pt_pct,
    ROUND((SUM(c.ftm)::numeric / NULLIF(SUM(c.fta), 0)) * 100, 1) AS clutch_ft_pct,
    ROUND(AVG(c.rebounds)::numeric, 1) AS clutch_rpg,
    ROUND(AVG(c.assists)::numeric, 1) AS clutch_apg,
    ROUND(AVG(c.steals)::numeric, 1) AS clutch_spg,
    ROUND(AVG(c.blocks)::numeric, 1) AS clutch_bpg,
    ROUND(AVG(c.turnovers)::numeric, 1) AS clutch_tpg,
    SUM(c.points) AS clutch_total_pts,
    SUM(c.fgm) AS clutch_total_fgm,
    SUM(c.fga) AS clutch_total_fga,
    SUM(c.three_pm) AS clutch_total_3pm,
    SUM(c.three_pa) AS clutch_total_3pa,
    SUM(c.ftm) AS clutch_total_ftm,
    SUM(c.fta) AS clutch_total_fta
FROM clutch_combined c
LEFT JOIN (
    SELECT DISTINCT ON (athlete_id)
        athlete_id, athlete_display_name, team_abbreviation
    FROM player_boxscores_raw
    WHERE game_id NOT IN (401809839, 401838140, 401838141, 401838142, 401838143)
	AND minutes IS NOT NULL
    ORDER BY athlete_id, game_date DESC
) pl ON c.athlete_id = pl.athlete_id
GROUP BY c.athlete_id, pl.athlete_display_name, pl.team_abbreviation
ORDER BY clutch_ppg DESC;


-- ============================================================
-- 4. SHOT TYPE BREAKDOWN
--    Categorizes shots into: At Rim, Midrange, Three-Point
--    Export to: scripts/nba_player_shot_types.csv
-- ============================================================
SELECT
    athlete_id_1 AS athlete_id,
    pl.athlete_display_name,
    pl.team_abbreviation,
    CASE
        WHEN points_attempted = 3 THEN 'Three-Point'
        WHEN type_text ILIKE '%layup%'
          OR type_text ILIKE '%dunk%'
          OR type_text ILIKE '%tip%'
          OR type_text ILIKE '%alley oop%'
          OR type_text ILIKE '%hook%'
          OR type_text ILIKE '%finger roll%'
          THEN 'At Rim'
        WHEN points_attempted = 1 THEN 'Free Throw'
        ELSE 'Midrange'
    END AS shot_zone,
    COUNT(*) AS attempts,
    COUNT(*) FILTER (WHERE scoring_play = true) AS makes,
    ROUND(
        (COUNT(*) FILTER (WHERE scoring_play = true)::numeric / NULLIF(COUNT(*), 0)) * 100,
        1
    ) AS pct
FROM play_by_play_raw
LEFT JOIN (
    SELECT DISTINCT ON (athlete_id)
        athlete_id, athlete_display_name, team_abbreviation
    FROM player_boxscores_raw
    WHERE game_id NOT IN (401809839, 401838140, 401838141, 401838142, 401838143)
	AND minutes IS NOT NULL
    ORDER BY athlete_id, game_date DESC
) pl ON play_by_play_raw.athlete_id_1 = pl.athlete_id
WHERE shooting_play = true
  AND athlete_id_1 IS NOT NULL
  AND play_by_play_raw.game_id NOT IN (401809839, 401838140, 401838141, 401838142, 401838143)
GROUP BY athlete_id_1, pl.athlete_display_name, pl.team_abbreviation,
    CASE
        WHEN points_attempted = 3 THEN 'Three-Point'
        WHEN type_text ILIKE '%layup%'
          OR type_text ILIKE '%dunk%'
          OR type_text ILIKE '%tip%'
          OR type_text ILIKE '%alley oop%'
          OR type_text ILIKE '%hook%'
          OR type_text ILIKE '%finger roll%'
          THEN 'At Rim'
        WHEN points_attempted = 1 THEN 'Free Throw'
        ELSE 'Midrange'
    END
ORDER BY athlete_id_1, shot_zone;