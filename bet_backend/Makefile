postgres:
	docker run --name bet_nba_db -p 5432:5432 -e POSTGRES_USER=root -e POSTGRES_PASSWORD=secret -d postgres

createdb:
	docker exec -it bet_nba_db createdb --username=root --owner=root nba_analytics

dropdb:
	docker exec -it bet_nba_db dropdb nba_analytics

migrateup:
	migrate -path db/migration -database "postgresql://root:secret@localhost:5432/nba_analytics?sslmode=disable" --verbose up

migratedown:
	migrate -path db/migration -database "postgresql://root:secret@localhost:5432/nba_analytics?sslmode=disable" --verbose down

# Populate nba_analytics from hoopR (requires R). Run from bet_backend.
# Run `make migrateup` first so player_boxscores_raw exists.
populatenba:
	Rscript nba_data_collection.R.r

sqlc:
	sqlc generate

test: 
	go test -v -cover ./...

server:
	go run main.go

start-db: postgres createdb migrateup

resetdb: migratedown migrateup populatenba populatenba 


.PHONY: postgres createdb dropdb migrateup migratedown populatenba sqlc serverpostgres resetdb start-db-server