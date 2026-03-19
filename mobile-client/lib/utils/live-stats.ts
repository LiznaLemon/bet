import type { PlayByPlayRecord } from '@/lib/queries/play-by-play';
import { toThreeLetterAbbrev } from '@/lib/utils/team-abbreviation';

export type LiveStatDeltas = {
  athlete_id: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  field_goals_made: number;
  field_goals_attempted: number;
  three_point_made: number;
  three_point_attempted: number;
  free_throws_made: number;
  free_throws_attempted: number;
};

export type AccumulatedStats = LiveStatDeltas & {
  minutes_estimate: number;
};

const ZERO_DELTAS: Omit<LiveStatDeltas, 'athlete_id'> = {
  points: 0,
  rebounds: 0,
  assists: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fouls: 0,
  field_goals_made: 0,
  field_goals_attempted: 0,
  three_point_made: 0,
  three_point_attempted: 0,
  free_throws_made: 0,
  free_throws_attempted: 0,
};

function getDeltasForPlay(play: PlayByPlayRecord): Map<string, Omit<LiveStatDeltas, 'athlete_id'>> {
  const result = new Map<string, Omit<LiveStatDeltas, 'athlete_id'>>();
  const typeText = (play.type_text ?? '').toLowerCase();

  const addDeltas = (athleteId: string, d: Partial<Omit<LiveStatDeltas, 'athlete_id'>>) => {
    const existing = result.get(athleteId) ?? { ...ZERO_DELTAS };
    const merged: Omit<LiveStatDeltas, 'athlete_id'> = { ...ZERO_DELTAS };
    for (const k of Object.keys(existing) as (keyof typeof merged)[]) {
      merged[k] = (existing[k] ?? 0) + ((d[k] as number) ?? 0);
    }
    result.set(athleteId, merged);
  };

  // Points: scoring_play + score_value (scorer gets points)
  if (play.scoring_play && play.athlete_id_1 != null) {
    const pts = play.score_value ?? 0;
    const isThree = play.shooting_play && (play.points_attempted ?? 0) === 3;
    const isFt = typeText.includes('free throw');
    const d: Partial<Omit<LiveStatDeltas, 'athlete_id'>> = { points: pts };
    if (isFt) {
      d.free_throws_made = 1;
      d.free_throws_attempted = 1;
    } else if (play.shooting_play) {
      d.field_goals_made = 1;
      d.field_goals_attempted = 1;
      if (isThree) {
        d.three_point_made = pts === 3 ? 1 : 0;
        d.three_point_attempted = 1;
      }
    }
    addDeltas(String(play.athlete_id_1), d);
  }

  // Missed free throw
  if (!play.scoring_play && typeText.includes('free throw') && play.athlete_id_1 != null) {
    addDeltas(String(play.athlete_id_1), { free_throws_attempted: 1 });
  }

  // Missed field goal (shooting play, not scoring)
  if (!play.scoring_play && play.shooting_play && !typeText.includes('free throw') && play.athlete_id_1 != null) {
    const isThree = (play.points_attempted ?? 0) === 3;
    addDeltas(String(play.athlete_id_1), {
      field_goals_attempted: 1,
      three_point_attempted: isThree ? 1 : 0,
    });
  }

  // Assists: athlete_id_2 on scoring plays
  if (play.scoring_play && play.athlete_id_2 != null) {
    addDeltas(String(play.athlete_id_2), { assists: 1 });
  }

  // Rebounds
  if (typeText.includes('offensive rebound') || typeText.includes('defensive rebound')) {
    if (play.athlete_id_1 != null) {
      addDeltas(String(play.athlete_id_1), { rebounds: 1 });
    }
  }

  // Turnovers
  if (typeText.includes('turnover') && play.athlete_id_1 != null) {
    addDeltas(String(play.athlete_id_1), { turnovers: 1 });
  }

  // Steals: athlete_id_1 is the stealer
  if (typeText.includes('steal') && play.athlete_id_1 != null) {
    addDeltas(String(play.athlete_id_1), { steals: 1 });
  }

  // Blocks: athlete_id_1 is the blocker (e.g. "Blocked Shot")
  if (typeText.includes('block') && play.athlete_id_1 != null) {
    addDeltas(String(play.athlete_id_1), { blocks: 1 });
  }

  // Fouls
  if (typeText.includes('foul') && play.athlete_id_1 != null && !typeText.includes('turnover')) {
    addDeltas(String(play.athlete_id_1), { fouls: 1 });
  }

  return result;
}

function mergeDeltas(
  acc: Omit<LiveStatDeltas, 'athlete_id'>,
  deltas: Omit<LiveStatDeltas, 'athlete_id'>
): Omit<LiveStatDeltas, 'athlete_id'> {
  return {
    points: acc.points + deltas.points,
    rebounds: acc.rebounds + deltas.rebounds,
    assists: acc.assists + deltas.assists,
    steals: acc.steals + deltas.steals,
    blocks: acc.blocks + deltas.blocks,
    turnovers: acc.turnovers + deltas.turnovers,
    fouls: acc.fouls + deltas.fouls,
    field_goals_made: acc.field_goals_made + deltas.field_goals_made,
    field_goals_attempted: acc.field_goals_attempted + deltas.field_goals_attempted,
    three_point_made: acc.three_point_made + deltas.three_point_made,
    three_point_attempted: acc.three_point_attempted + deltas.three_point_attempted,
    free_throws_made: acc.free_throws_made + deltas.free_throws_made,
    free_throws_attempted: acc.free_throws_attempted + deltas.free_throws_attempted,
  };
}

/**
 * Accumulates stats from plays[0] through plays[playIndex] (inclusive).
 * Returns a map of athlete_id -> accumulated stats.
 */
export function accumulateStatsFromPlays(
  plays: PlayByPlayRecord[],
  playIndex: number,
  athleteIds?: string[]
): Map<string, AccumulatedStats> {
  const map = new Map<string, AccumulatedStats>();
  const endIdx = Math.min(playIndex, plays.length - 1);

  for (let i = 0; i <= endIdx; i++) {
    const play = plays[i];
    const deltasMap = getDeltasForPlay(play);
    for (const [athleteId, deltas] of deltasMap) {
      if (athleteIds && !athleteIds.includes(athleteId)) continue;
      const existing = map.get(athleteId);
      const merged = existing
        ? mergeDeltas(
            {
              points: existing.points,
              rebounds: existing.rebounds,
              assists: existing.assists,
              steals: existing.steals,
              blocks: existing.blocks,
              turnovers: existing.turnovers,
              fouls: existing.fouls,
              field_goals_made: existing.field_goals_made,
              field_goals_attempted: existing.field_goals_attempted,
              three_point_made: existing.three_point_made,
              three_point_attempted: existing.three_point_attempted,
              free_throws_made: existing.free_throws_made,
              free_throws_attempted: existing.free_throws_attempted,
            },
            deltas
          )
        : deltas;
      map.set(athleteId, {
        athlete_id: athleteId,
        ...merged,
        minutes_estimate: 0,
      });
    }
  }

  // Estimate minutes from game clock (all players get same game-time estimate for now)
  const lastPlay = plays[endIdx];
  const startGameSeconds = lastPlay?.start_game_seconds_remaining ?? 2880;
  const secondsElapsed = Math.max(0, 2880 - startGameSeconds);
  const minutesEstimate = secondsElapsed / 60;

  for (const [, stats] of map) {
    stats.minutes_estimate = minutesEstimate;
  }

  return map;
}

/** Find the index of the last play in the given quarter. Returns -1 if quarter has no plays. */
export function findLastPlayIndexForQuarter(
  plays: PlayByPlayRecord[],
  quarter: number
): number {
  for (let i = plays.length - 1; i >= 0; i--) {
    if (plays[i].period_number === quarter) return i;
  }
  return -1;
}

/**
 * Returns true if the quarter has ended at the current play index.
 * Handles both Supabase (type_text "End Period") and ESPN ("End of the Xth Quarter") formats.
 * Also treats clock at 0 as quarter end.
 */
export function isQuarterEndedAtPlayIndex(
  plays: PlayByPlayRecord[],
  playIndex: number,
  quarter: number
): boolean {
  const lastIdx = findLastPlayIndexForQuarter(plays, quarter);
  if (lastIdx < 0 || playIndex < lastIdx) return false;
  const play = plays[lastIdx];
  if (!play) return false;
  const typeText = (play.type_text ?? '').toLowerCase();
  const isEndPeriod =
    typeText.includes('end period') ||
    (typeText.includes('end of') && typeText.includes('quarter')) ||
    typeText.includes('end of the');
  const secs = play.start_quarter_seconds_remaining;
  const clockAtZero = secs != null && secs <= 0;
  const clockDisplay = (play.clock_display_value ?? '').trim();
  const clockAtZeroDisplay =
    clockDisplay === '0' ||
    clockDisplay === '0.0' ||
    clockDisplay === '0:00' ||
    clockDisplay === '0:0.0' ||
    /^0:0\.?0*$/.test(clockDisplay);
  return isEndPeriod || clockAtZero || clockAtZeroDisplay;
}

/**
 * Get accumulated stats at the end of each completed quarter.
 * Returns maps for Q1, Q2, Q3, Q4 when we're past those quarters (based on current playIndex).
 */
export function getStatsAtQuarterEnds(
  plays: PlayByPlayRecord[],
  playIndex: number,
  athleteIds?: string[]
): {
  q1: Map<string, AccumulatedStats> | null;
  q2: Map<string, AccumulatedStats> | null;
  q3: Map<string, AccumulatedStats> | null;
  q4: Map<string, AccumulatedStats> | null;
} {
  const lastQ1 = findLastPlayIndexForQuarter(plays, 1);
  const lastQ2 = findLastPlayIndexForQuarter(plays, 2);
  const lastQ3 = findLastPlayIndexForQuarter(plays, 3);
  const lastQ4 = findLastPlayIndexForQuarter(plays, 4);

  return {
    q1: lastQ1 >= 0 && playIndex >= lastQ1 ? accumulateStatsFromPlays(plays, lastQ1, athleteIds) : null,
    q2: lastQ2 >= 0 && playIndex >= lastQ2 ? accumulateStatsFromPlays(plays, lastQ2, athleteIds) : null,
    q3: lastQ3 >= 0 && playIndex >= lastQ3 ? accumulateStatsFromPlays(plays, lastQ3, athleteIds) : null,
    q4: lastQ4 >= 0 && playIndex >= lastQ4 ? accumulateStatsFromPlays(plays, lastQ4, athleteIds) : null,
  };
}

export type PlayWithScore = PlayByPlayRecord & { away_score?: number; home_score?: number };

/**
 * Get away/home score at a given play index.
 * Uses per-play away_score/home_score when available (ESPN), otherwise accumulates from scoring plays.
 */
export function getScoreAtPlayIndex(
  plays: PlayWithScore[],
  playIndex: number,
  athleteToTeam: Map<string, string>,
  awayTeamAbbrev: string,
  homeTeamAbbrev: string
): { awayScore: number; homeScore: number } {
  const endIdx = Math.min(playIndex, plays.length - 1);
  if (endIdx < 0) return { awayScore: 0, homeScore: 0 };

  const lastPlay = plays[endIdx];
  if (lastPlay.away_score != null && lastPlay.home_score != null) {
    return { awayScore: lastPlay.away_score, homeScore: lastPlay.home_score };
  }

  const awayNorm = toThreeLetterAbbrev(awayTeamAbbrev) || awayTeamAbbrev.toUpperCase();
  const homeNorm = toThreeLetterAbbrev(homeTeamAbbrev) || homeTeamAbbrev.toUpperCase();

  let awayScore = 0;
  let homeScore = 0;
  for (let i = 0; i <= endIdx; i++) {
    const play = plays[i];
    if (play.scoring_play && play.athlete_id_1 != null) {
      const pts = play.score_value ?? 0;
      const teamRaw = athleteToTeam.get(String(play.athlete_id_1)) ?? athleteToTeam.get(String(Number(play.athlete_id_1)));
      const teamNorm = toThreeLetterAbbrev(teamRaw) || (teamRaw ?? '').toUpperCase();
      if (teamNorm === awayNorm) awayScore += pts;
      else if (teamNorm === homeNorm) homeScore += pts;
    }
  }
  return { awayScore, homeScore };
}

/**
 * Get period and clock info at a given play index.
 * Uses quarter clock (12:00 per quarter) so the clock resets at the start of each quarter.
 */
export function getGameStateAtPlay(
  plays: PlayByPlayRecord[],
  playIndex: number
): { period: number; clockDisplay: string | null; gameSecondsRemaining: number | null } {
  const idx = Math.min(playIndex, plays.length - 1);
  const play = plays[idx];
  if (!play) {
    return { period: 1, clockDisplay: '12:00', gameSecondsRemaining: 2880 };
  }
  // Use quarter seconds (720 = 12:00 at start of period) so clock resets each quarter
  let secs = play.start_quarter_seconds_remaining;
  if (secs == null && play.start_game_seconds_remaining != null) {
    const elapsed = 2880 - play.start_game_seconds_remaining;
    secs = (720 - (elapsed % 720)) % 720;
  }
  const mins = secs != null ? Math.floor(secs / 60) : 12;
  const sec = secs != null ? Math.floor(secs % 60) : 0;
  const clockDisplay = `${mins}:${String(sec).padStart(2, '0')}`;
  return {
    period: play.period_number,
    clockDisplay,
    gameSecondsRemaining: play.start_game_seconds_remaining ?? null,
  };
}

function isSubstitutionPlay(play: PlayByPlayRecord): boolean {
  const typeText = (play.type_text ?? '').toLowerCase();
  return typeText.includes('substitution') || typeText.includes('sub:');
}

/**
 * Compute the set of athlete IDs currently on court at a given play index.
 * Derives lineup from starters (first 5 per team from early plays) + substitution events.
 * Returns null when data is insufficient (empty plays, empty athleteToTeam, or cannot infer starters).
 */
export function computeOnCourtAtPlayIndex(
  plays: PlayByPlayRecord[],
  playIndex: number,
  athleteToTeam: Map<string, string>,
  awayAbbrev: string,
  homeAbbrev: string
): Set<string> | null {
  if (plays.length === 0 || athleteToTeam.size === 0) return null;

  const awayNorm = toThreeLetterAbbrev(awayAbbrev) || awayAbbrev.toUpperCase();
  const homeNorm = toThreeLetterAbbrev(homeAbbrev) || homeAbbrev.toUpperCase();

  const getTeam = (athleteId: string): 'away' | 'home' | null => {
    const team = athleteToTeam.get(athleteId) ?? athleteToTeam.get(String(Number(athleteId)));
    if (!team) return null;
    const teamNorm = toThreeLetterAbbrev(team) || team.toUpperCase();
    if (teamNorm === awayNorm) return 'away';
    if (teamNorm === homeNorm) return 'home';
    return null;
  };

  const awayOnCourt = new Set<string>();
  const homeOnCourt = new Set<string>();

  const firstSubIdx = plays.findIndex((p) => isSubstitutionPlay(p));
  const bootstrapLimit = firstSubIdx >= 0 ? firstSubIdx : Math.min(20, plays.length);

  for (let i = 0; i < bootstrapLimit; i++) {
    const play = plays[i];
    if (isSubstitutionPlay(play)) continue;

    const ids: (number | null)[] = [play.athlete_id_1, play.athlete_id_2, play.athlete_id_3];
    for (const id of ids) {
      if (id == null) continue;
      const sid = String(id);
      const team = getTeam(sid);
      if (team === 'away' && awayOnCourt.size < 5) awayOnCourt.add(sid);
      else if (team === 'home' && homeOnCourt.size < 5) homeOnCourt.add(sid);
    }
  }

  if (awayOnCourt.size === 0 && homeOnCourt.size === 0) return null;

  const endIdx = Math.min(playIndex, plays.length - 1);
  for (let i = 0; i <= endIdx; i++) {
    const play = plays[i];
    if (!isSubstitutionPlay(play)) continue;

    const playerIn = play.athlete_id_1 != null ? String(play.athlete_id_1) : null;
    const playerOut = play.athlete_id_2 != null ? String(play.athlete_id_2) : null;
    if (!playerIn || !playerOut) continue;

    const teamOut = getTeam(playerOut);

    if (teamOut === 'away') {
      awayOnCourt.delete(playerOut);
      awayOnCourt.add(playerIn);
    } else if (teamOut === 'home') {
      homeOnCourt.delete(playerOut);
      homeOnCourt.add(playerIn);
    }
  }

  const result = new Set<string>();
  for (const id of awayOnCourt) result.add(id);
  for (const id of homeOnCourt) result.add(id);
  return result.size > 0 ? result : null;
}
