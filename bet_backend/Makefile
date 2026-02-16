postgres:
	docker run --name bet_nba_db -p 5433:5432 -e POSTGRES_USER=root -e POSTGRES_PASSWORD=secret -d postgres

createdb:
	docker exec -it bet_nba_db createdb --username=root --owner=root nba_analytics

dropdb:
	docker exec -it bet_nba_db dropdb nba_analytics

migrateup:
	docker run --rm -v $(shell pwd)/db/migration:/migration --network host migrate/migrate -path=/migration -database "postgresql://root:secret@localhost:5433/nba_analytics?sslmode=disable" -verbose up

migratedown:
	echo y | docker run --rm -i -v $(shell pwd)/db/migration:/migration --network host migrate/migrate -path=/migration -database "postgresql://root:secret@localhost:5433/nba_analytics?sslmode=disable" -verbose down

# Populate nba_analytics from hoopR (requires R). Run from bet_backend.
# Run `make migrateup` first so player_boxscores_raw exists.
populatenba:
	Rscript nba_data_to_db.R.r

sqlc:
	sqlc generate

test: 
	go test -v -cover ./...

server:
	go run main.go

# Full DB setup: start Postgres, create DB, run migrations, populate NBA data.
# Waits for Postgres to be ready before creating the DB.
start-db: postgres
	@sleep 3 && $(MAKE) createdb migrateup populatenba

reload-db: migratedown migrateup populatenba


.PHONY: postgres createdb dropdb migrateup migratedown populatenba sqlc server test resetdb start-db