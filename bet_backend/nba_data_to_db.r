# Load NBA data from hoopR into PostgreSQL.
# Usage: 
#   Rscript nba_data_to_db.r --incremental  (default, only new records)
#   Rscript nba_data_to_db.r --full         (truncate and reload all)

options(repos = c(CRAN = "https://cloud.r-project.org"))

library(hoopR)
library(dplyr)
library(DBI)
library(RPostgres)

# ===== PARSE COMMAND LINE ARGUMENTS =====
args <- commandArgs(trailingOnly = TRUE)
FULL_RELOAD <- FALSE

if (length(args) > 0) {
  if (args[1] == "--full") {
    FULL_RELOAD <- TRUE
  } else if (args[1] == "--incremental") {
    FULL_RELOAD <- FALSE
  } else {
    stop("Invalid argument. Use --full or --incremental")
  }
}

cat("=====================================\n")
cat(sprintf("Mode: %s\n", if(FULL_RELOAD) "FULL RELOAD (TRUNCATE)" else "INCREMENTAL UPDATE"))
cat("=====================================\n\n")

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
  if (FULL_RELOAD) {
    return(integer(0))  # Return empty if full reload
  }
  query <- sprintf("SELECT DISTINCT game_id FROM %s", table_name)
  result <- dbGetQuery(con, query)
  return(result$game_id)
}

filter_new_records <- function(new_data, existing_ids) {
  if (is.null(new_data) || nrow(new_data) == 0) {
    return(new_data)
  }
  if (FULL_RELOAD || length(existing_ids) == 0) {
    return(new_data)  # Return all if full reload
  }
  new_data %>% filter(!game_id %in% existing_ids)
}

# ===== LOAD PLAYER BOX SCORES =====
cat("\nLoading player box scores...\n")
existing_player_games <- get_existing_game_ids(con, TABLE_NAMES$player_box)
if (!FULL_RELOAD) {
  cat(sprintf("  Found %d existing games in database\n", length(existing_player_games)))
}

player_box_data <- load_nba_player_box(seasons = seasons)

if (!is.null(player_box_data) && nrow(player_box_data) > 0) {
  player_box_df <- as.data.frame(player_box_data)
  new_player_box <- filter_new_records(player_box_df, existing_player_games)
  
  if (nrow(new_player_box) > 0) {
    dbWriteTable(con, TABLE_NAMES$player_box, new_player_box, 
                 overwrite = FALSE, append = TRUE)
    cat(sprintf("  Inserted %d player box score records\n", nrow(new_player_box)))
  } else {
    cat("  No new player box scores to insert\n")
  }
}

# ===== LOAD PLAY-BY-PLAY =====
cat("\nLoading play-by-play...\n")
existing_pbp_games <- get_existing_game_ids(con, TABLE_NAMES$play_by_play)
if (!FULL_RELOAD) {
  cat(sprintf("  Found %d existing games in database\n", length(existing_pbp_games)))
}

pbp_data <- load_nba_pbp(seasons = seasons)

if (!is.null(pbp_data) && nrow(pbp_data) > 0) {
  pbp_df <- as.data.frame(pbp_data)
  new_pbp <- filter_new_records(pbp_df, existing_pbp_games)
  
  if (nrow(new_pbp) > 0) {
    dbWriteTable(con, TABLE_NAMES$play_by_play, new_pbp, 
                 overwrite = FALSE, append = TRUE)
    cat(sprintf("  Inserted %d play-by-play records\n", nrow(new_pbp)))
  } else {
    cat("  No new play-by-play data to insert\n")
  }
}

# ===== LOAD TEAM BOX SCORES =====
cat("\nLoading team box scores...\n")
existing_team_games <- get_existing_game_ids(con, TABLE_NAMES$team_box)
if (!FULL_RELOAD) {
  cat(sprintf("  Found %d existing games in database\n", length(existing_team_games)))
}

team_box_data <- load_nba_team_box(seasons = seasons)

if (!is.null(team_box_data) && nrow(team_box_data) > 0) {
  team_box_df <- team_box_data %>% 
    as_tibble() %>% 
    as.data.frame()
  
  new_team_box <- filter_new_records(team_box_df, existing_team_games)
  
  if (nrow(new_team_box) > 0) {
    dbWriteTable(con, TABLE_NAMES$team_box, new_team_box, 
                 overwrite = FALSE, append = TRUE)
    cat(sprintf("  Inserted %d team box score records\n", nrow(new_team_box)))
  } else {
    cat("  No new team box scores to insert\n")
  }
}

# ===== LOAD SCHEDULES =====
cat("\nLoading schedules...\n")
existing_schedule_games <- get_existing_game_ids(con, TABLE_NAMES$schedules)
if (!FULL_RELOAD) {
  cat(sprintf("  Found %d existing games in database\n", length(existing_schedule_games)))
}

schedule_data <- load_nba_schedule(seasons = seasons)

if (!is.null(schedule_data) && nrow(schedule_data) > 0) {
  schedule_df <- as.data.frame(schedule_data)
  new_schedules <- filter_new_records(schedule_df, existing_schedule_games)
  
  if (nrow(new_schedules) > 0) {
    dbWriteTable(con, TABLE_NAMES$schedules, new_schedules, 
                 overwrite = FALSE, append = TRUE)
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
cat(sprintf("Database: %s @ %s:%d\n", DB_NAME, PG_HOST, PG_PORT))