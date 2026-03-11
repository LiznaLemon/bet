import type { PlayByPlayRecord } from '@/lib/queries/play-by-play';

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
