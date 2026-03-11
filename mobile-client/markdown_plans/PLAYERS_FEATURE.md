# NBA Players Stats Feature

## Overview
This feature displays NBA player season averages for the 2026 season, calculated from game-by-game boxscore data.

## Features

### 1. Players List Screen
- **Location**: `app/(tabs)/players.tsx`
- **Features**:
  - View all 506 NBA players with season averages
  - Search by player name or team abbreviation
  - Sort by: Points, Rebounds, Assists, or Name
  - Quick stats preview: PPG, RPG, APG
  - Player headshots and team logos
  - Tap any player to view detailed stats

### 2. Player Detail Screen
- **Location**: `app/player/[id].tsx`
- **Displays**:
  - **Season Averages**: Points, Rebounds, Assists, Steals, Blocks, Turnovers, Fouls, Minutes, Plus/Minus
  - **Shooting Statistics**: FG%, 3PT%, FT%, and made/attempted averages
  - **Season Totals**: Total points, rebounds, assists, and rebound breakdown
  - Team-colored header with player photo

### 3. Data Processing
- **Script**: `scripts/convert-csv-to-json.js`
- **Input**: `nba_player_boxscores_raw.csv` (14,523 game records)
- **Output**: `scripts/output/nba_player_season_averages.json` (506 players)

## Data Structure

The JSON file contains player objects with:
```json
{
  "athlete_id": "3945274",
  "athlete_display_name": "Luka Doncic",
  "team_abbreviation": "LAL",
  "games_played": 28,
  "ppg": "33.7",
  "rpg": "8.0",
  "apg": "8.8",
  "fg_pct": "46.3",
  "three_pt_pct": "31.6",
  "ft_pct": "79.1",
  // ... more stats
}
```

## Usage

### Re-generating the JSON Data
If you update the CSV file, regenerate the JSON:
```bash
npm run convert-data
```

### Navigation
- **Tab Navigation**: Access via the "Players" tab (middle tab)
- **Player Details**: Tap any player card to view full statistics

## Statistics Included

### Per-Game Averages
- PPG (Points Per Game)
- RPG (Rebounds Per Game)
- APG (Assists Per Game)
- SPG (Steals Per Game)
- BPG (Blocks Per Game)
- TPG (Turnovers Per Game)
- FPG (Fouls Per Game)
- MPG (Minutes Per Game)
- Plus/Minus

### Shooting Percentages
- FG% (Field Goal Percentage)
- 3PT% (Three-Point Percentage)
- FT% (Free Throw Percentage)

### Season Totals
- Total Points
- Total Rebounds
- Total Assists
- Offensive Rebounds
- Defensive Rebounds

## Design
- **Minimal, clean interface**
- **Dark/Light mode support**
- **Team-colored player detail headers**
- **Smooth navigation and filtering**
- **Responsive grid layouts**

## Top 5 Scorers (2026 Season)
1. Luka Doncic - 33.7 PPG (LAL)
2. Shai Gilgeous-Alexander - 31.9 PPG (OKC)
3. Tyrese Maxey - 30.7 PPG (PHI)
4. Donovan Mitchell - 29.8 PPG (CLE)
5. Jaylen Brown - 29.7 PPG (BOS)

## Future Enhancements
- Replace with real API instead of static JSON
- Add advanced stats (PER, TS%, etc.)
- Add game logs and trends
- Add player comparisons
- Add team filtering
- Add favorites/bookmarks
