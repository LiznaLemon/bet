# NBA Data Update Scripts

Fetches NBA play-by-play, player boxscores, team boxscores, and schedule updates from ESPN's public API and writes them to Supabase. Useful for keeping a database in sync when hoopR's pre-built data lags behind live games.

## How It Works

### Data Flow

```
ESPN API (no auth)          Script                      Supabase
─────────────────          ──────                      ────────

1. Scoreboard (per date)
   GET .../scoreboard?dates=YYYYMMDD
   → List of completed game IDs
                              │
2. For each game_id:          │
   GET .../summary?event={id}  │
   → Full game JSON           │
   (plays, boxscore, header)  │
                              ▼
                    ┌─────────────────┐
                    │     parsers.js   │
                    │  Transforms JSON │
                    │  → row arrays    │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     play_by_play_raw  team_boxscores_raw  player_boxscores_raw
     schedules (update)
```

### File Relationships

| File | Role | Depends On | Used By |
|------|------|------------|---------|
| **update-nba-data.js** | Main entry. Parses CLI, loops dates, orchestrates fetch → parse → write. | espn-api, parsers, supabase-client, csv-writer | — |
| **espn-api.js** | ESPN HTTP client. `fetchScoreboard(date)` returns completed game IDs; `fetchGameSummary(gameId)` returns raw game JSON. | (none, uses `fetch`) | update-nba-data |
| **parsers.js** | Pure parsing. Takes ESPN game summary JSON, returns row arrays/objects for each table. No I/O. | (none) | update-nba-data |
| **supabase-client.js** | DB layer. Creates client from env, `getLastGameDate()`, `upsertGameData()` (delete-then-insert), `updateSchedule()` (partial update). | @supabase/supabase-js | update-nba-data |
| **csv-writer.js** | Writes row arrays to CSV files. Used when `--csv` to inspect before DB write. | csv-stringify, fs | update-nba-data |

### Parsers → Tables Mapping

| Parser | Output | Target Table |
|--------|--------|--------------|
| `parsePlayByPlay(json)` | Array of play rows | `play_by_play_raw` |
| `parseTeamBox(json)` | Array of team box rows | `team_boxscores_raw` |
| `parsePlayerBox(json)` | Array of player box rows | `player_boxscores_raw` |
| `parseScheduleFromSummary(json)` | Single object (status, scores, attendance, etc.) | `schedules` (UPDATE by game_id) |

### ESPN API Endpoints

- **Scoreboard:** `http://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=1000&dates={YYYYMMDD}`
- **Game Summary:** `http://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={gameId}`

No authentication required. The summary returns `header`, `plays`, `boxscore` (teams + players), `gameInfo` (attendance, venue).

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment**

   Copy `.env.example` to `.env` or `.env.local` and set:

   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

## Running

```bash
# Default: from day after last DB date to today
npm run update

# Explicit date range
node update-nba-data.js --from 2026-03-07 --to 2026-03-12

# Export to CSV only (no DB write)
node update-nba-data.js --from 2026-03-07 --to 2026-03-12 --csv

# Export to CSV and write to DB
node update-nba-data.js --from 2026-03-07 --to 2026-03-12 --csv --no-skip-db

# Dry run (fetch + parse, no DB, no CSV)
node update-nba-data.js --from 2026-03-07 --to 2026-03-08 --dry-run

# Custom CSV output directory
node update-nba-data.js --csv --output-dir ./my-output
```

### CLI Options

| Option | Description |
|--------|-------------|
| `--from YYYY-MM-DD` | Start date (default: day after last `play_by_play_raw` date, or today - 7 if no DB) |
| `--to YYYY-MM-DD` | End date (default: today) |
| `--csv` | Write parsed data to CSV files; skips DB unless `--no-skip-db` |
| `--no-skip-db` | With `--csv`, also write to DB |
| `--dry-run` | Fetch and parse only; no DB, no CSV |
| `--output-dir DIR` | CSV output directory (default: `./output`) |

## Database Tables

The script expects these Supabase tables:

- **play_by_play_raw** – One row per play. Delete by `game_id`, then insert.
- **player_boxscores_raw** – One row per player per game.
- **team_boxscores_raw** – One row per team per game.
- **schedules** – One row per game. Script **updates** existing rows (status, scores, PBP, attendance) by `game_id`; does not insert new schedule rows.

## Converting to Another Language

When porting:

1. **espn-api.js** – Replace with HTTP client calls to the two ESPN URLs. Same request/response shape.
2. **parsers.js** – Port the JSON traversal and field mapping. Input is the game summary JSON; output is arrays/objects matching your DB schema. No external deps.
3. **supabase-client.js** – Replace with your DB client. Logic: `getLastGameDate` (SELECT max game_date), `upsertGameData` (DELETE WHERE game_id, INSERT batch), `updateSchedule` (UPDATE schedules SET ... WHERE game_id).
4. **csv-writer.js** – Optional. Any CSV library or manual string building.
5. **update-nba-data.js** – Orchestration: date loop → fetch scoreboard → for each game fetch summary → parse → write. CLI parsing and env loading are language-specific.

The parsing logic in `parsers.js` is the most detailed; it maps ESPN's nested JSON (e.g. `boxscore.teams[].statistics`, `plays[]`) to flat row structures. Reference the ESPN summary response shape when porting.
