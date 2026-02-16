# Load the necessary libraries
# install.packages("DBI")
# install.packages("RPostgres")
# install.packages("readr")
# install.packages("dplyr")
options(repos = c(CRAN = "https://cloud.r-project.org"))

install.packages("hoopR")
install.packages("DBI")
install.packages("RPostgres")
install.packages("readr")

# install.packages('plyr', repos = "http://cran.us.r-project.org")

library(hoopR)
library(dplyr)
library(DBI)
library(RPostgres)
library(readr)

# ===== CSV FILE CONFIGURATION =====
# Set the output CSV filename (will be created in the current directory)
OUTPUT_CSV_FILE <- "nba_player_boxscores_raw.csv"

# Load NBA player box score data for the most recent season
# You can change the season parameter to load data from specific years
# Example: seasons = c(2023, 2024) for multiple seasons
cat("Loading NBA player box score data...\n")
player_box_scores <- load_nba_player_box(seasons = most_recent_nba_season())

# Write raw data to CSV
cat("Writing raw data to CSV...\n")
write_csv(player_box_scores, OUTPUT_CSV_FILE)
cat(sprintf("Raw data saved to: %s\n", OUTPUT_CSV_FILE))

str(player_box_scores)


# Print summary statistics
cat("\n=== Data Summary ===\n")
cat(sprintf("Total games loaded: %d\n", nrow(player_box_scores)))
cat(sprintf("Number of unique players: %d\n", n_distinct(player_box_scores$athlete_id)))
cat(sprintf("Season: %s\n", unique(player_box_scores$season)))
cat(sprintf("Date range: %s to %s\n", 
            min(player_box_scores$game_date), 
            max(player_box_scores$game_date)))


# ===== POSTGRESQL CONFIGURATION =====
# Update these settings for your PostgreSQL setup
PG_HOST <- "localhost"
PG_PORT <- 5433
PG_USER <- "root"  # Change to your PostgreSQL username
PG_PASSWORD <- "secret"      # Enter your PostgreSQL password
DB_NAME <- "nba_analytics"
TABLE_NAME <- "player_boxscores_raw"
# CSV file to load into PostgreSQL (can be different from OUTPUT_CSV_FILE if loading existing data)
CSV_FILE <- OUTPUT_CSV_FILE

# ===== STEP 1: Create Database =====
cat("Connecting to PostgreSQL server...\n")

# First connect to the default 'postgres' database to create our new database
con_postgres <- tryCatch({
  dbConnect(
    RPostgres::Postgres(),
    host = PG_HOST,
    port = PG_PORT,
    user = PG_USER,
    password = PG_PASSWORD,
    dbname = DB_NAME  # Connect to default database first
  )
}, error = function(e) {
  stop(sprintf("Failed to connect to PostgreSQL: %s\nPlease check your credentials and ensure PostgreSQL is running.", e$message))
})

cat("Connected to PostgreSQL server.\n")

# Check if database exists
db_exists <- dbGetQuery(con_postgres, 
                        sprintf("SELECT 1 FROM pg_database WHERE datname = '%s'", DB_NAME)
)

if (nrow(db_exists) == 0) {
  cat(sprintf("Creating database '%s'...\n", DB_NAME))
  dbExecute(con_postgres, sprintf("CREATE DATABASE %s", DB_NAME))
  cat(sprintf("Database '%s' created successfully!\n", DB_NAME))
} else {
  cat(sprintf("Database '%s' already exists.\n", DB_NAME))
}

# Disconnect from postgres database
dbDisconnect(con_postgres)

# ===== STEP 2: Connect to New Database =====
cat(sprintf("\nConnecting to database '%s'...\n", DB_NAME))

con <- dbConnect(
  RPostgres::Postgres(),
  host = PG_HOST,
  port = PG_PORT,
  user = PG_USER,
  password = PG_PASSWORD,
  dbname = DB_NAME
)

cat("Connected successfully!\n")

# ===== STEP 3: Load CSV and Prepare Data =====
cat(sprintf("\nReading CSV file '%s'...\n", CSV_FILE))

if (!file.exists(CSV_FILE)) {
  stop(sprintf("CSV file '%s' not found. Please run dataCollection.R first.", CSV_FILE))
}

player_data <- read_csv(CSV_FILE, show_col_types = FALSE)
cat(sprintf("Loaded %d rows from CSV.\n", nrow(player_data)))

# ===== STEP 4: Load Data into Table =====
# Table must already exist (created by migration). We truncate and reload to avoid
# type mismatch: dbWriteTable creates double precision for R numerics, but Go/sqlc
# expects BIGINT/INTEGER. The migration schema has correct types.
table_exists <- dbExistsTable(con, TABLE_NAME)

if (!table_exists) {
  stop(sprintf("Table '%s' does not exist. Run 'make migrateup' first to create it.", TABLE_NAME))
}

cat(sprintf("\nTruncating table '%s' for fresh data load...\n", TABLE_NAME))
dbExecute(con, sprintf("TRUNCATE TABLE %s", TABLE_NAME))

cat(sprintf("Loading data into table '%s'...\n", TABLE_NAME))
# Cast numeric columns to integer so they map to BIGINT/INTEGER, not double precision
player_data <- player_data %>%
  mutate(
    game_id = as.integer(game_id),
    season = as.integer(season),
    season_type = as.integer(season_type),
    athlete_id = as.integer(athlete_id),
    team_id = as.integer(team_id),
    field_goals_made = as.integer(field_goals_made),
    field_goals_attempted = as.integer(field_goals_attempted),
    three_point_field_goals_made = as.integer(three_point_field_goals_made),
    three_point_field_goals_attempted = as.integer(three_point_field_goals_attempted),
    free_throws_made = as.integer(free_throws_made),
    free_throws_attempted = as.integer(free_throws_attempted),
    offensive_rebounds = as.integer(offensive_rebounds),
    defensive_rebounds = as.integer(defensive_rebounds),
    rebounds = as.integer(rebounds),
    assists = as.integer(assists),
    steals = as.integer(steals),
    blocks = as.integer(blocks),
    turnovers = as.integer(turnovers),
    fouls = as.integer(fouls),
    points = as.integer(points),
    team_score = as.integer(team_score),
    opponent_team_id = as.integer(opponent_team_id),
    opponent_team_score = as.integer(opponent_team_score)
  )

dbAppendTable(con, TABLE_NAME, player_data)

cat(sprintf("Data loaded successfully into table '%s'!\n", TABLE_NAME))

# ===== STEP 5: Verify Data Load =====
cat("\n===== Data Verification =====\n")

# Count rows
row_count <- dbGetQuery(con, sprintf("SELECT COUNT(*) as count FROM %s", TABLE_NAME))
cat(sprintf("Total rows in database: %.0f\n", row_count$count))

# Show sample data
cat("\nSample of first 5 rows:\n")
sample_data <- dbGetQuery(con, sprintf("SELECT * FROM %s LIMIT 5", TABLE_NAME))
print(sample_data[, 1:10])  # Show first 10 columns

# Show table schema
cat("\nTable schema:\n")
schema_info <- dbGetQuery(con, sprintf("
  SELECT column_name, data_type, character_maximum_length
  FROM information_schema.columns
  WHERE table_name = '%s'
  ORDER BY ordinal_position
", TABLE_NAME))
print(head(schema_info, 20))

# ===== STEP 6: Create Useful Indexes =====
cat("\n===== Creating Indexes for Better Query Performance =====\n")

indexes <- list(
  sprintf("CREATE INDEX IF NOT EXISTS idx_%s_athlete_id ON %s(athlete_id)", TABLE_NAME, TABLE_NAME),
  sprintf("CREATE INDEX IF NOT EXISTS idx_%s_game_date ON %s(game_date)", TABLE_NAME, TABLE_NAME),
  sprintf("CREATE INDEX IF NOT EXISTS idx_%s_team_id ON %s(team_id)", TABLE_NAME, TABLE_NAME),
  sprintf("CREATE INDEX IF NOT EXISTS idx_%s_season ON %s(season)", TABLE_NAME, TABLE_NAME)
)

for (idx_sql in indexes) {
  tryCatch({
    dbExecute(con, idx_sql)
    cat(sprintf("✓ Index created\n"))
  }, error = function(e) {
    cat(sprintf("✗ Index creation failed or already exists\n"))
  })
}

# ===== STEP 7: Example Queries =====
cat("\n===== Example Queries =====\n")

cat("\nTop 10 highest scoring games:\n")
top_games <- dbGetQuery(con, sprintf("
  SELECT athlete_display_name, team_abbreviation, game_date, points, minutes
  FROM %s
  ORDER BY points DESC
  LIMIT 10
", TABLE_NAME))
print(top_games)

cat("\nPlayer game count:\n")
player_counts <- dbGetQuery(con, sprintf("
  SELECT athlete_display_name, COUNT(*) as games_played
  FROM %s
  GROUP BY athlete_display_name, athlete_id
  ORDER BY games_played DESC
  LIMIT 10
", TABLE_NAME))
print(player_counts)

# ===== Cleanup =====
dbDisconnect(con)
cat("\n✓ Database connection closed.\n")
cat("\n===== SUMMARY =====\n")
cat(sprintf("Database: %s\n", DB_NAME))
cat(sprintf("Host: %s:%d\n", PG_HOST, PG_PORT))
cat(sprintf("Table: %s\n", TABLE_NAME))
cat(sprintf("Rows loaded: %.0f\n", row_count$count))
cat("\nConnection string for future use:\n")
cat(sprintf("postgresql://%s@%s:%d/%s\n", PG_USER, PG_HOST, PG_PORT, DB_NAME))
cat("\nTo connect again in R:\n")
cat(sprintf("con <- dbConnect(RPostgres::Postgres(), host='%s', port=%d, user='%s', password='YOUR_PASSWORD', dbname='%s')\n", 
            PG_HOST, PG_PORT, PG_USER, DB_NAME))