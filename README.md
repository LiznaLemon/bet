# bet

NBA analytics backend with local DB and hoopR data loading.

## Prerequisites

- **Docker** – for Postgres
- **make** – `xcode-select --install` on macOS if needed
- **R** – for loading NBA data via hoopR (`make populatenba`, `make start-db`)
- **Go** – for running the API and tests

## Quick start

From **`bet_backend`**:

```bash
cd bet_backend
make start-db   # Start Postgres, create DB, run migrations, populate NBA data
make server     # Run the Go API
```

## Make targets (run from `bet_backend`)

| Command | Description |
|--------|-------------|
| `make start-db` | Full DB setup: start Postgres, create DB, run migrations, populate NBA data (one-shot) |
| `make postgres` | Start Postgres in Docker (port 5433) |
| `make createdb` | Create `nba_analytics` database (Postgres must be running) |
| `make dropdb` | Drop `nba_analytics` database |
| `make migrateup` | Run database migrations up |
| `make migratedown` | Run all migrations down |
| `make populatenba` | Load NBA data from hoopR into DB (requires R; run after migrateup) |
| `make reload-db` | Migrate down, up, then repopulate NBA data |
| `make server` | Run the Go API server |
| `make test` | Run Go tests with coverage |
| `make sqlc` | Generate Go code from SQL (sqlc) |

## Backend only (no R)

To run the API against an existing DB without loading NBA data:

```bash
cd bet_backend
make postgres
make createdb
make migrateup
make server
```
