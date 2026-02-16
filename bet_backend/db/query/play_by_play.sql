-- name: ListPlayByPlay :many
SELECT * FROM play_by_play_raw
ORDER BY game_date DESC, game_id, game_play_number
LIMIT $1 OFFSET $2;
