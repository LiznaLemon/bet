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


# Update with only new data (incremental - for daily updates)
updatenba:
	Rscript ../scripts/nba_data_to_db.r --incremental

# Full reload (truncate and reload all - for initial setup or reset)
populatenba:
	Rscript ../scripts/nba_data_to_db.r --full

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

refresh-db: 


.PHONY: postgres createdb dropdb migrateup migratedown populatenba sqlc server test resetdb start-db reload-db updatenba