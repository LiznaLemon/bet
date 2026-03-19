/**
 * ESPN Live NBA Game API
 *
 * Fetches live play-by-play and box score data from ESPN's site API v2.
 * Used when Supabase play_by_play_raw is empty (e.g., games in progress).
 *
 * API: https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event={gameId}
 */

import type { GameBoxScore } from '@/lib/queries/game-boxscores';
import type { PlayByPlayRecord } from '@/lib/queries/play-by-play';

const SUMMARY_URL = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary';

// ESPN play shape (simplified)
type ESPNPlay = {
  id?: string;
  sequenceNumber?: string;
  type?: { id?: string; text?: string };
  text?: string;
  awayScore?: number;
  homeScore?: number;
  period?: { number?: number; displayValue?: string };
  clock?: { displayValue?: string };
  scoringPlay?: boolean;
  scoreValue?: number;
  participants?: Array<{ athlete?: { id?: string } }>;
  shootingPlay?: boolean;
  pointsAttempted?: number;
};

// ESPN boxscore team/statistics shape
type ESPNBoxscoreTeam = {
  team?: { id?: string; abbreviation?: string; color?: string };
  statistics?: Array<{
    keys?: string[];
    athletes?: Array<{
      athlete?: {
        id?: string;
        displayName?: string;
        headshot?: { href?: string };
        position?: { abbreviation?: string };
      };
      stats?: string[];
    }>;
  }>;
};

export type ESPNGameSummary = {
  header?: {
    id?: string;
    competitions?: Array<{
      competitors?: Array<{
        homeAway?: string;
        score?: string;
        team?: { abbreviation?: string };
      }>;
      status?: {
        type?: { name?: string; state?: string };
        displayClock?: string;
        period?: number;
        displayPeriod?: string;
      };
    }>;
  };
  plays?: ESPNPlay[];
  boxscore?: {
    players?: ESPNBoxscoreTeam[];
  };
  injuries?: Array<{
    team?: { abbreviation?: string; displayName?: string };
    injuries?: Array<{
      status?: string;
      athlete?: {
        displayName?: string;
        shortName?: string;
        headshot?: { href?: string };
        position?: { abbreviation?: string };
        jersey?: string;
      };
      details?: {
        type?: string;
        detail?: string;
        side?: string;
        fantasyStatus?: { displayDescription?: string };
      };
    }>;
  }>;
};

/**
 * Parse clock display value (e.g. "12:00", "2:19", "0.0") to seconds remaining in quarter.
 * 12:00 = 720, 0:00 = 0. ESPN also uses decimal format like "0.0" or "2.5" for seconds.
 */
export function parseClockToQuarterSeconds(displayValue: string | null | undefined): number | null {
  if (displayValue == null || typeof displayValue !== 'string') return null;
  const trimmed = displayValue.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length >= 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseInt(parts[1], 10);
    if (Number.isNaN(mins) || Number.isNaN(secs)) return null;
    return mins * 60 + secs;
  }
  const asSeconds = parseFloat(trimmed);
  if (!Number.isNaN(asSeconds) && asSeconds >= 0) {
    return Math.floor(asSeconds);
  }
  return null;
}

/** PlayByPlayRecord with optional full play text and per-play score for feed display */
export type PlayByPlayWithText = PlayByPlayRecord & {
  play_text?: string;
  away_score?: number;
  home_score?: number;
};

/**
 * Map ESPN plays to PlayByPlayRecord format (compatible with live-stats.ts).
 * Includes play_text for full ESPN description when available.
 * Includes away_score and home_score when provided by ESPN API.
 */
export function mapESPNPlaysToPlayByPlayRecord(plays: ESPNPlay[]): PlayByPlayWithText[] {
  return plays.map((p, idx) => {
    const periodNum = p.period?.number ?? 1;
    const clockVal = p.clock?.displayValue ?? null;
    const quarterSecs = parseClockToQuarterSeconds(clockVal);
    // start_game_seconds_remaining = seconds left in game (2880 at tip)
    const gameSecs =
      quarterSecs != null ? quarterSecs + (4 - periodNum) * 720 : null;

    const participants = p.participants ?? [];
    const athlete1 = participants[0]?.athlete?.id;
    const athlete2 = participants[1]?.athlete?.id;
    const athlete3 = participants[2]?.athlete?.id;

    return {
      id: idx + 1,
      sequence_number: p.sequenceNumber ?? String(idx + 1),
      type_text: p.type?.text ?? p.text ?? '',
      play_text: p.text ?? p.type?.text ?? '',
      period_number: periodNum,
      clock_display_value: clockVal,
      start_quarter_seconds_remaining: quarterSecs,
      start_game_seconds_remaining: gameSecs,
      game_play_number: p.sequenceNumber != null ? parseInt(p.sequenceNumber, 10) : idx + 1,
      scoring_play: Boolean(p.scoringPlay),
      score_value: p.scoreValue ?? 0,
      athlete_id_1: athlete1 != null ? parseInt(athlete1, 10) : null,
      athlete_id_2: athlete2 != null ? parseInt(athlete2, 10) : null,
      athlete_id_3: athlete3 != null ? parseInt(athlete3, 10) : null,
      shooting_play: Boolean(p.shootingPlay),
      points_attempted: p.pointsAttempted ?? null,
      away_score: p.awayScore,
      home_score: p.homeScore,
    };
  });
}

/**
 * Parse ESPN stats array. Keys: minutes, points, fieldGoalsMade-fieldGoalsAttempted, etc.
 */
function parseStatsFromRow(
  stats: string[] | undefined,
  keys: string[] | undefined
): Partial<GameBoxScore> {
  const result: Partial<GameBoxScore> = {};
  if (!stats || !keys) return result;

  const idx = (key: string) => keys.indexOf(key);
  const getNum = (key: string) => {
    const i = idx(key);
    if (i < 0) return 0;
    const val = stats[i];
    if (val == null) return 0;
    const n = parseFloat(String(val).split('-')[0]);
    return Number.isNaN(n) ? 0 : n;
  };
  const getSplit = (key: string): [number, number] => {
    const i = idx(key);
    if (i < 0) return [0, 0];
    const parts = String(stats[i] ?? '0-0').split('-');
    return [parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0];
  };

  result.minutes = getNum('minutes');
  result.points = getNum('points');
  result.rebounds = getNum('rebounds');
  result.assists = getNum('assists');
  result.turnovers = getNum('turnovers');
  result.steals = getNum('steals');
  result.blocks = getNum('blocks');
  result.fouls = getNum('fouls');

  const [fgm, fga] = getSplit('fieldGoalsMade-fieldGoalsAttempted');
  result.field_goals_made = fgm;
  result.field_goals_attempted = fga;

  const [tpm, tpa] = getSplit('threePointFieldGoalsMade-threePointFieldGoalsAttempted');
  result.three_point_made = tpm;
  result.three_point_attempted = tpa;

  const [ftm, fta] = getSplit('freeThrowsMade-freeThrowsAttempted');
  result.free_throws_made = ftm;
  result.free_throws_attempted = fta;

  const pmI = idx('plusMinus');
  const pmStr = pmI >= 0 ? stats[pmI] : '0';
  result.plus_minus = parseInt(String(pmStr).replace(/[^-\d]/g, ''), 10) || 0;

  return result;
}

/**
 * Map ESPN boxscore to GameBoxScore[] for use in live-sim.
 */
export function mapESPNBoxscoreToGameBoxScore(summary: ESPNGameSummary): GameBoxScore[] {
  const players = summary.boxscore?.players ?? [];
  const result: GameBoxScore[] = [];

  for (const teamData of players) {
    const teamAbbrev = teamData.team?.abbreviation ?? '';
    const teamColor = teamData.team?.color
      ? (teamData.team.color.startsWith('#') ? teamData.team.color : `#${teamData.team.color}`)
      : null;

    const statBlock = teamData.statistics?.[0];
    if (!statBlock?.athletes) continue;

    const keys = statBlock.keys ?? [];

    for (const row of statBlock.athletes) {
      const athlete = row.athlete;
      if (!athlete?.id) continue;

      const parsed = parseStatsFromRow(row.stats, keys);

      result.push({
        athlete_id: String(athlete.id),
        athlete_display_name: athlete.displayName ?? '',
        athlete_headshot_href: athlete.headshot?.href ?? '',
        athlete_position_abbreviation: athlete.position?.abbreviation ?? '',
        team_abbreviation: teamAbbrev,
        team_color: teamColor?.replace(/^#/, '') ?? null,
        points: parsed.points ?? 0,
        rebounds: parsed.rebounds ?? 0,
        assists: parsed.assists ?? 0,
        steals: parsed.steals ?? 0,
        blocks: parsed.blocks ?? 0,
        minutes: parsed.minutes ?? 0,
        field_goals_made: parsed.field_goals_made ?? 0,
        field_goals_attempted: parsed.field_goals_attempted ?? 0,
        three_point_made: parsed.three_point_made ?? 0,
        three_point_attempted: parsed.three_point_attempted ?? 0,
        free_throws_made: parsed.free_throws_made ?? 0,
        free_throws_attempted: parsed.free_throws_attempted ?? 0,
        turnovers: parsed.turnovers ?? 0,
        fouls: parsed.fouls ?? 0,
        plus_minus: parsed.plus_minus ?? 0,
      });
    }
  }

  return result.sort((a, b) => b.points - a.points);
}

export async function fetchESPNGameSummary(gameId: string): Promise<ESPNGameSummary> {
  const url = `${SUMMARY_URL}?event=${encodeURIComponent(gameId)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`ESPN API failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
