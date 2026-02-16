-- name: ListTeamBoxscores :many
SELECT * FROM team_boxscores_raw
ORDER BY game_date DESC, game_id, team_id
LIMIT $1 OFFSET $2;
