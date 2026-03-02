# Load NBA data from hoopR into PostgreSQL.
# Run from bet_backend. Requires: make migrateup first.
options(repos = c(CRAN = "https://cloud.r-project.org"))

# Uncomment to install packages once:
# install.packages("hoopR")
# install.packages("DBI")
# install.packages("RPostgres")
# install.packages("dplyr")

library(hoopR)
library(dplyr)
library(DBI)
library(RPostgres)

# ===== DB CONFIGURATION =====
PG_HOST <- "localhost"
PG_PORT <- 5433
PG_USER <- "root"
PG_PASSWORD <- "secret"
DB_NAME <- "nba_analytics"

TABLE_NAMES <- list(
  player_box = "player_boxscores_raw",
  play_by_play = "play_by_play_raw",
  team_box = "team_boxscores_raw",
  schedules = "schedules"
)

cat("Connecting to database...\n")
con <- dbConnect(
  RPostgres::Postgres(),
  host = PG_HOST,
  port = PG_PORT,
  user = PG_USER,
  password = PG_PASSWORD,
  dbname = DB_NAME
)
cat("Connected successfully.\n")

# Check all tables exist
for (tn in TABLE_NAMES) {
  if (!dbExistsTable(con, tn)) {
    dbDisconnect(con)
    stop(sprintf("Table '%s' does not exist. Run 'make migrateup' first.", tn))
  }
}

# Season(s) to load (most recent by default)
seasons <- most_recent_nba_season()
cat(sprintf("Loading data for season(s): %s\n", paste(seasons, collapse = ", ")))

# Truncate for fresh load
cat("\nTruncating tables for fresh load...\n")
for (tn in TABLE_NAMES) {
  dbExecute(con, sprintf("TRUNCATE TABLE %s", tn))
  cat(sprintf("  Truncated %s\n", tn))
}

# Load and write each dataset
cat("\nLoading player box scores...\n")
load_nba_player_box(seasons = seasons, dbConnection = con, tablename = TABLE_NAMES$player_box)

cat("Loading play-by-play...\n")
load_nba_pbp(seasons = seasons, dbConnection = con, tablename = TABLE_NAMES$play_by_play)

cat("Loading team box scores...\n")
team_box_data <- load_nba_team_box(seasons = seasons)

if (!is.null(team_box_data) && nrow(team_box_data) > 0) {
  # Convert to standard data frame
  team_box_df <- team_box_data %>% 
    as_tibble() %>% 
    as.data.frame()
  
  dbWriteTable(con, TABLE_NAMES$team_box, team_box_df, 
               overwrite = FALSE, append = TRUE)
  cat(sprintf("  Wrote %d rows to team_boxscores_raw\n", nrow(team_box_df)))
} else {
  warning("No team box data returned")
}

cat("Loading schedules...\n")
load_nba_schedule(seasons = seasons, dbConnection = con, tablename = TABLE_NAMES$schedules)
# Verify row counts
cat("\n===== Row counts =====\n")
for (tn in TABLE_NAMES) {
  n <- dbGetQuery(con, sprintf("SELECT COUNT(*) as n FROM %s", tn))$n
  cat(sprintf("  %s: %d\n", tn, as.integer(n)))
}

dbDisconnect(con)
cat("\nDatabase connection closed.\n")
cat(sprintf("Database: %s @ %s:%d\n", DB_NAME, PG_HOST, PG_PORT))
