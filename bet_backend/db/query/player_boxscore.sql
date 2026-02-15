
-- name: ListAllBoxscores :many
SELECT * FROM player_boxscores_raw
ORDER BY game_date DESC, game_id, athlete_id
LIMIT $1 OFFSET $2;
