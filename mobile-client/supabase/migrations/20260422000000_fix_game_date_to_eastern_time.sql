-- Fix game_date to use America/New_York (NBA canonical date convention).
-- Previous ingestion extracted game_date as the UTC date by slicing the ESPN
-- ISO timestamp, causing late-night games (tipoff between 00:00–05:00 UTC,
-- i.e. 8 PM–1 AM EDT) to land on the wrong calendar day in every table.
-- game_date_time remains stored as UTC (unchanged); only the derived date column is corrected.

UPDATE schedules
SET game_date = (game_date_time AT TIME ZONE 'America/New_York')::date
WHERE game_date_time IS NOT NULL
  AND (game_date_time AT TIME ZONE 'America/New_York')::date != game_date;

UPDATE player_boxscores_raw
SET game_date = (game_date_time AT TIME ZONE 'America/New_York')::date
WHERE game_date_time IS NOT NULL
  AND (game_date_time AT TIME ZONE 'America/New_York')::date != game_date;

UPDATE team_boxscores_raw
SET game_date = (game_date_time AT TIME ZONE 'America/New_York')::date
WHERE game_date_time IS NOT NULL
  AND (game_date_time AT TIME ZONE 'America/New_York')::date != game_date;

UPDATE play_by_play_raw
SET game_date = (game_date_time AT TIME ZONE 'America/New_York')::date
WHERE game_date_time IS NOT NULL
  AND (game_date_time AT TIME ZONE 'America/New_York')::date != game_date;
