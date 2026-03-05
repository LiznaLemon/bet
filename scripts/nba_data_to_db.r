# Load NBA data from hoopR into PostgreSQL.
# Usage:
#   Rscript nba_data_to_db.r --incremental  (default, only new records)
#   Rscript nba_data_to_db.r --full         (truncate and reload all)

library(hoopR)
library(dplyr)
library(DBI)
library(RPostgres)

# ===== PARSE COMMAND LINE ARGUMENTS =====
args <- commandArgs(trailingOnly = TRUE)
load_type <- if (length(args) >= 1) args[1] else "--incremental"
FULL_RELOAD <- load_type == "--full"

# Read DB URL from environment
db_url <- Sys.getenv("BET_DATABASE_URL")
if (db_url == "") stop("BET_DATABASE_URL secret is not set")

cat("Load type:", load_type, "\n")
cat("=====================================\n")
cat(sprintf("Mode: %s\n", if (FULL_RELOAD) "FULL RELOAD (TRUNCATE)" else "INCREMENTAL UPDATE"))
cat("=====================================\n\n")

# ===== TABLE NAMES =====
TABLE_NAMES <- list(
  player_box = "player_boxscores_raw",
  play_by_play = "play_by_play_raw",
  team_box = "team_boxscores_raw",
  schedules = "schedules"
)

# ===== CONNECT TO DATABASE =====
cat("Connecting to database...\n")

con <- dbConnect(
  RPostgres::Postgres(),
  host     = gsub(".*@([^:]+):\\d+/.*", "\\1", db_url),
  port     = as.integer(gsub(".*:(\\d+)/[^/]*$", "\\1", db_url)),
  dbname   = gsub(".*/([^/]+)$", "\\1", db_url),
  user     = gsub(".*://([^:]+):.*", "\\1", db_url),
  password = gsub(".*://[^:]+:([^@]+)@.*", "\\1", db_url),
  sslmode  = "require"
)

cat("Connected successfully.\n")

# ===== CHECK TABLES EXIST =====
for (tn in TABLE_NAMES) {
  if (!dbExistsTable(con, tn)) {
    dbDisconnect(con)
    stop(sprintf("Table '%s' does not exist. Run migrations first.", tn))
  }
}

seasons <- most_recent_nba_season()
cat(sprintf("Loading data for season(s): %s\n", paste(seasons, collapse = ", ")))

# ===== TRUNCATE IF FULL RELOAD =====
if (FULL_RELOAD) {
  cat("\nTruncating tables for full reload...\n")
  for (tn in TABLE_NAMES) {
    dbExecute(con, sprintf("TRUNCATE TABLE %s", tn))
    cat(sprintf("  Truncated %s\n", tn))
  }
}

# ===== HELPER FUNCTIONS =====
get_existing_game_ids <- function(con, table_name) {
  if (FULL_RELOAD) return(integer(0))
  result <- dbGetQuery(con, sprintf("SELECT DISTINCT game_id FROM %s", table_name))
  return(result$game_id)
}

filter_new_records <- function(new_data, existing_ids) {
  if (is.null(new_data) || nrow(new_data) == 0) return(new_data)
  if (FULL_RELOAD || length(existing_ids) == 0) return(new_data)
  new_data %>% filter(!game_id %in% existing_ids)
}

# ===== LOAD PLAYER BOX SCORES =====
cat("\nLoading player box scores...\n")
existing_player_games <- get_existing_game_ids(con, TABLE_NAMES$player_box)
if (!FULL_RELOAD) cat(sprintf("  Found %d existing games in database\n", length(existing_player_games)))

player_box_data <- load_nba_player_box(seasons = seasons)
if (!is.null(player_box_data) && nrow(player_box_data) > 0) {
  new_player_box <- filter_new_records(as.data.frame(player_box_data), existing_player_games)
  if (nrow(new_player_box) > 0) {
    dbWriteTable(con, TABLE_NAMES$player_box, new_player_box, overwrite = FALSE, append = TRUE)
    cat(sprintf("  Inserted %d player box score records\n", nrow(new_player_box)))
  } else {
    cat("  No new player box scores to insert\n")
  }
}

# ===== LOAD PLAY-BY-PLAY =====
cat("\nLoading play-by-play...\n")
existing_pbp_games <- get_existing_game_ids(con, TABLE_NAMES$play_by_play)
if (!FULL_RELOAD) cat(sprintf("  Found %d existing games in database\n", length(existing_pbp_games)))

pbp_data <- load_nba_pbp(seasons = seasons)
if (!is.null(pbp_data) && nrow(pbp_data) > 0) {
  new_pbp <- filter_new_records(as.data.frame(pbp_data), existing_pbp_games)
  if (nrow(new_pbp) > 0) {
    dbWriteTable(con, TABLE_NAMES$play_by_play, new_pbp, overwrite = FALSE, append = TRUE)
    cat(sprintf("  Inserted %d play-by-play records\n", nrow(new_pbp)))
  } else {
    cat("  No new play-by-play data to insert\n")
  }
}

# ===== LOAD TEAM BOX SCORES =====
cat("\nLoading team box scores...\n")
existing_team_games <- get_existing_game_ids(con, TABLE_NAMES$team_box)
if (!FULL_RELOAD) cat(sprintf("  Found %d existing games in database\n", length(existing_team_games)))

team_box_data <- load_nba_team_box(seasons = seasons)
if (!is.null(team_box_data) && nrow(team_box_data) > 0) {
  new_team_box <- filter_new_records(as.data.frame(team_box_data), existing_team_games)
  if (nrow(new_team_box) > 0) {
    dbWriteTable(con, TABLE_NAMES$team_box, new_team_box, overwrite = FALSE, append = TRUE)
    cat(sprintf("  Inserted %d team box score records\n", nrow(new_team_box)))
  } else {
    cat("  No new team box scores to insert\n")
  }
}

# ===== LOAD SCHEDULES =====
cat("\nLoading schedules...\n")
existing_schedule_games <- get_existing_game_ids(con, TABLE_NAMES$schedules)
if (!FULL_RELOAD) cat(sprintf("  Found %d existing games in database\n", length(existing_schedule_games)))

schedule_data <- load_nba_schedule(seasons = seasons)
if (!is.null(schedule_data) && nrow(schedule_data) > 0) {
  new_schedules <- filter_new_records(as.data.frame(schedule_data), existing_schedule_games)
  if (nrow(new_schedules) > 0) {
    dbWriteTable(con, TABLE_NAMES$schedules, new_schedules, overwrite = FALSE, append = TRUE)
    cat(sprintf("  Inserted %d schedule records\n", nrow(new_schedules)))
  } else {
    cat("  No new schedules to insert\n")
  }
}

# ===== VERIFY ROW COUNTS =====
cat("\n===== Total row counts =====\n")
for (tn in TABLE_NAMES) {
  n <- dbGetQuery(con, sprintf("SELECT COUNT(*) as n FROM %s", tn))$n
  cat(sprintf("  %s: %d\n", tn, as.integer(n)))
}

dbDisconnect(con)
cat("\nDatabase connection closed.\n")