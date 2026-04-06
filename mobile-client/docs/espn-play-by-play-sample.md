# ESPN NBA play-by-play sample (Site API v2)

Play-by-play is **not** a plain string feed. ESPN returns a JSON document whose top-level **`plays`** field is an **array of objects**. Each play combines structured fields (ids, scores, flags, participant athlete ids) with a human-readable **`text`** description (and often **`type.text`** for the play category).

## Endpoint (as used in this repo)

`GET https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={gameId}`

The client maps `response.plays` in [`lib/api/espn-live.ts`](../lib/api/espn-live.ts) via `mapESPNPlaysToPlayByPlayRecord` into the internal `PlayByPlayRecord` shape (plus `play_text`, `away_score`, `home_score` for UI).

## Sample: real `plays[]` entries

Below are a few objects taken from a live **`summary`** response (NBA game id `401810960`). Field names match what the API returns at time of fetch.

### Opening jump ball

```json
{
  "id": "4018109604",
  "sequenceNumber": "4",
  "type": {
    "id": "615",
    "text": "Jumpball"
  },
  "text": "Adem Bona vs. Tristan Vukcevic (VJ Edgecombe gains possession)",
  "awayScore": 0,
  "homeScore": 0,
  "period": {
    "number": 1,
    "displayValue": "1st Quarter"
  },
  "clock": {
    "displayValue": "12:00"
  },
  "scoringPlay": false,
  "scoreValue": 0,
  "team": {
    "id": "20"
  },
  "participants": [
    { "athlete": { "id": "5105637" } },
    { "athlete": { "id": "4997537" } },
    { "athlete": { "id": "5124612" } }
  ],
  "wallclock": "2026-04-01T23:11:08Z",
  "shootingPlay": false,
  "coordinate": {
    "x": -214748340,
    "y": -214748365
  },
  "pointsAttempted": 0,
  "shortDescription": "Jump Ball"
}
```

### Scoring play (FG + assist in `text`)

```json
{
  "id": "4018109607",
  "sequenceNumber": "7",
  "type": {
    "id": "131",
    "text": "Pullup Jump Shot"
  },
  "text": "Paul George makes 12-foot pullup jump shot (Tyrese Maxey assists)",
  "awayScore": 2,
  "homeScore": 0,
  "period": {
    "number": 1,
    "displayValue": "1st Quarter"
  },
  "clock": {
    "displayValue": "11:38"
  },
  "scoringPlay": true,
  "scoreValue": 2,
  "team": {
    "id": "20"
  },
  "participants": [
    { "athlete": { "id": "4251" } },
    { "athlete": { "id": "4431678" } }
  ],
  "wallclock": "2026-04-01T23:11:26Z",
  "shootingPlay": true,
  "coordinate": {
    "x": 19,
    "y": 12
  },
  "pointsAttempted": 2,
  "shortDescription": "+2 Points"
}
```

### Missed shot (`shootingPlay` true, `scoringPlay` false)

```json
{
  "id": "40181096012",
  "sequenceNumber": "12",
  "type": {
    "id": "132",
    "text": "Step Back Jump Shot"
  },
  "text": "Adem Bona blocks Bilal Coulibaly's step back jumpshot",
  "awayScore": 2,
  "homeScore": 2,
  "period": {
    "number": 1,
    "displayValue": "1st Quarter"
  },
  "clock": {
    "displayValue": "10:44"
  },
  "scoringPlay": false,
  "scoreValue": 0,
  "team": {
    "id": "27"
  },
  "participants": [
    { "athlete": { "id": "5104155" } },
    { "athlete": { "id": "5105637" } }
  ],
  "wallclock": "2026-04-01T23:12:20Z",
  "shootingPlay": true,
  "coordinate": {
    "x": 4,
    "y": 0
  },
  "pointsAttempted": 2,
  "shortDescription": "Missed FG"
}
```

### Turnover (`type.text` may contain newlines)

```json
{
  "id": "40181096010",
  "sequenceNumber": "10",
  "type": {
    "id": "62",
    "text": "Bad Pass\nTurnover"
  },
  "text": "Tyrese Maxey bad pass\nturnover (Tristan Vukcevic steals)",
  "awayScore": 2,
  "homeScore": 2,
  "period": {
    "number": 1,
    "displayValue": "1st Quarter"
  },
  "clock": {
    "displayValue": "10:58"
  },
  "scoringPlay": false,
  "scoreValue": 0,
  "team": {
    "id": "20"
  },
  "participants": [
    { "athlete": { "id": "4431678" } },
    { "athlete": { "id": "4997537" } }
  ],
  "wallclock": "2026-04-01T23:12:06Z",
  "shootingPlay": false
}
```

## Typical fields on a play object

| Field | Role |
| --- | --- |
| `id`, `sequenceNumber` | Stable identifiers / ordering |
| `type.id`, `type.text` | Structured play category |
| `text` | Full sentence description for display |
| `shortDescription` | Short label (e.g. "+2 Points", "Missed FG") |
| `period`, `clock` | Quarter and game clock |
| `awayScore`, `homeScore` | Running score after the play |
| `scoringPlay`, `scoreValue` | Whether points were scored and how many |
| `shootingPlay`, `pointsAttempted` | Shot context |
| `team` | Team involved (when present) |
| `participants[].athlete.id` | ESPN athlete ids (up to three slots used in our mapper) |
| `wallclock` | ISO timestamp |
| `coordinate` | Court coordinates (may be sentinel values when N/A) |

## After mapping in the app

Each item becomes a row-like object used by live stats, e.g. `type_text`, `play_text`, `period_number`, `clock_display_value`, `scoring_play`, `score_value`, `athlete_id_1` … `athlete_id_3`, etc. See `PlayByPlayRecord` in [`lib/queries/play-by-play.ts`](../lib/queries/play-by-play.ts) and `mapESPNPlaysToPlayByPlayRecord` in [`lib/api/espn-live.ts`](../lib/api/espn-live.ts).
